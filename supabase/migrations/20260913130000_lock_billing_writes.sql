-- ============================================================================
-- FATURALAMA YAZMA KİLİDİ — ödeme sistemini baypas eden açıklar
-- ============================================================================
--
-- KRİTİK (canlıda denendi, geri alınan işlemde):
--   Giriş yapmış HERHANGİ bir kullanıcı tek istekle kendi aboneliğini
--     plan='business', status='active', expires_at=+10 yıl, nfc_cards_included=50
--   yapabiliyordu. Etkilenen satır: 1. Sebep: iki ayrı UPDATE politikası
--   ("Users can update own subscriptions via profile", "subscriptions_update")
--   yalnızca "kendi kaydın mı" diye soruyor, "hangi kolonu değiştiriyorsun"
--   diye sormuyordu. Bu kapanmadan kurulacak her ödeme altyapısı anlamsızdı.
--
-- AYNI SINIFTAN:
--   • nfc_orders: istemci siparişi kendi fiyatı ve kendi payment_status'ü ile
--     ekleyebiliyor ("ödendi", 0 TL). Tablo henüz boş — şimdi kapatmak ucuz.
--   • payment_settle: bankanın bildirdiği TUTARI kontrol etmiyordu.
--
-- YAN BULGU:
--   AdminCRM'deki "plan değiştir" düğmesi başka bir kullanıcının planını
--   değiştirmeye çalışınca 0 satır etkiliyordu: aboneliklerde yönetici
--   politikası yok. Yani yönetici paneli bu işlevde zaten sessizce bozuktu.
--   Artık denetimli bir RPC üzerinden çalışıyor.

-- ---------------------------------------------------------------------------
-- 1) subscriptions — istemci yazamaz
-- ---------------------------------------------------------------------------
-- Abonelik satırını yalnızca şunlar yazar:
--   • yeni profil tetikleyicisi (SECURITY DEFINER, politika gerektirmez)
--   • payment_settle (banka bildirimi, service_role)
--   • admin_set_plan (yönetici, denetimli)

drop policy if exists "Users can update own subscriptions via profile" on public.subscriptions;
drop policy if exists "subscriptions_update"                           on public.subscriptions;
drop policy if exists "subscriptions_insert"                           on public.subscriptions;
-- Birebir aynı iki okuma politikası vardı; biri yeterli.
drop policy if exists "Users can view own subscriptions via profile"   on public.subscriptions;

-- ---------------------------------------------------------------------------
-- 2) Yönetici plan değişikliği — denetimli
-- ---------------------------------------------------------------------------

create or replace function public.admin_set_plan(
  p_profile_id uuid,
  p_plan       text,
  p_expires_at timestamptz default null,
  p_reason     text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_eski public.subscriptions; v_n int; v_hedef_user uuid;
begin
  if not public.is_admin() then
    perform public.log_event('admin.set_plan', auth.uid(), 'qrtim', 'subscription',
                             p_profile_id::text, 'denied', 'critical', 'internal',
                             jsonb_build_object('istenen_plan', p_plan));
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  if p_plan not in ('free','student','professional','stk','business','corporate') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_plan');
  end if;

  select * into v_eski from public.subscriptions s where s.profile_id = p_profile_id;
  select p.user_id into v_hedef_user from public.profiles p where p.id = p_profile_id;

  update public.subscriptions
     set plan = p_plan,
         status = 'active',
         expires_at = case when p_plan = 'free' then null
                           else coalesce(p_expires_at, expires_at) end,
         updated_at = now()
   where profile_id = p_profile_id;
  get diagnostics v_n = row_count;

  if v_n = 0 then
    return jsonb_build_object('ok', false, 'hata', 'abonelik_bulunamadi');
  end if;

  -- Ödemesiz plan değişikliği para anlamı taşır: her zaman critical ve gerekçeli.
  perform public.log_event('admin.set_plan', auth.uid(), 'qrtim', 'subscription',
                           p_profile_id::text, 'success', 'critical', 'user',
                           jsonb_build_object('eski_plan', v_eski.plan, 'yeni_plan', p_plan,
                                              'gerekce', p_reason),
                           null, null, null, null, v_hedef_user);

  return jsonb_build_object('ok', true, 'eski_plan', v_eski.plan, 'yeni_plan', p_plan);
end;
$fn$;

revoke all on function public.admin_set_plan(uuid,text,timestamptz,text) from public, anon;
grant execute on function public.admin_set_plan(uuid,text,timestamptz,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) nfc_orders — ödeme alanlarını istemci belirleyemez
-- ---------------------------------------------------------------------------
-- Sipariş oluşturmak serbest kalıyor; ama ödeme durumu her zaman 'pending'
-- başlar ve ödeme kimliği boş gelir. Ödendi bilgisi yalnızca sunucudan gelir.

create or replace function public.nfc_orders_client_guard()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' then
    return new;
  end if;

  new.payment_status := 'pending';
  new.payment_id     := null;
  new.status         := 'pending';
  return new;
end;
$fn$;

drop trigger if exists nfc_orders_client_guard_trg on public.nfc_orders;
create trigger nfc_orders_client_guard_trg
  before insert on public.nfc_orders
  for each row execute function public.nfc_orders_client_guard();

revoke all on function public.nfc_orders_client_guard() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 4) payment_settle — tutar doğrulaması + çift ödeme işareti + erken yenileme
-- ---------------------------------------------------------------------------

drop function if exists public.payment_settle(text,boolean,text,jsonb,text);

create or replace function public.payment_settle(
  p_merchant_ref text,
  p_success      boolean,
  p_provider_ref text   default null,
  p_raw          jsonb  default '{}'::jsonb,
  p_reason       text   default null,
  p_amount_kurus bigint default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_i      public.payment_intents;
  v_sub    public.subscriptions;
  v_baz    timestamptz;
  v_bitis  timestamptz;
begin
  select * into v_i from public.payment_intents pi where pi.merchant_ref = p_merchant_ref;
  if v_i.id is null then
    perform public.log_event('payment.unknown_ref', null, 'qrtim', 'payment_intent',
                             p_merchant_ref, 'failure', 'warning', 'internal',
                             jsonb_build_object('basari', p_success), 'service');
    return jsonb_build_object('ok', false, 'hata', 'niyet_bulunamadi');
  end if;

  -- İDEMPOTENS: hak zaten tanımlıysa dokunma, bildirimi yine de kaydet.
  if v_i.granted_at is not null then
    update public.payment_intents
       set callback_raw = coalesce(callback_raw,'{}'::jsonb) || jsonb_build_object('tekrar', p_raw)
     where id = v_i.id;
    return jsonb_build_object('ok', true, 'zaten_islendi', true);
  end if;

  if not coalesce(p_success, false) then
    update public.payment_intents
       set status = 'basarisiz', failed_reason = p_reason,
           provider_ref = coalesce(p_provider_ref, provider_ref),
           callback_raw = p_raw, settled_at = now()
     where id = v_i.id;

    perform public.log_event('payment.failed', null, 'qrtim', 'payment_intent', v_i.id::text,
                             'failure', 'warning', 'user',
                             jsonb_build_object('sebep', p_reason), 'service',
                             null, null, null, v_i.user_id);
    return jsonb_build_object('ok', true, 'sonuc', 'basarisiz');
  end if;

  -- TUTAR DOĞRULAMASI — başarılı bildirimde tutar ZORUNLU.
  -- Bildirilmezse hak tanımlanmaz (kapalı başarısızlık).
  if p_amount_kurus is null or p_amount_kurus <> v_i.amount_kurus then
    update public.payment_intents
       set status = 'basarisiz',
           failed_reason = case when p_amount_kurus is null then 'tutar_bildirilmedi'
                                else 'tutar_uyusmazligi' end,
           provider_ref = coalesce(p_provider_ref, provider_ref),
           callback_raw = p_raw, settled_at = now()
     where id = v_i.id;

    perform public.log_event('payment.amount_mismatch', null, 'qrtim', 'payment_intent', v_i.id::text,
                             'denied', 'critical', 'internal',
                             jsonb_build_object('beklenen_kurus', v_i.amount_kurus,
                                                'bildirilen_kurus', p_amount_kurus), 'service',
                             null, null, null, v_i.user_id);
    return jsonb_build_object('ok', false, 'hata', 'tutar_uyusmazligi');
  end if;

  -- İptal edilmiş niyet ödendiyse: banka parayı çektiyse hakkı VERİRİZ
  -- (vermemek parayı alıp hizmet vermemek olur), ama olası çift ödeme
  -- olarak işaretleriz ki iade gerekip gerekmediğine bakılsın.
  if v_i.status = 'iptal' then
    perform public.log_event('payment.paid_after_cancel', null, 'qrtim', 'payment_intent', v_i.id::text,
                             'success', 'warning', 'internal',
                             jsonb_build_object('olasi_cift_odeme', true), 'service',
                             null, null, null, v_i.user_id);
  end if;

  -- ERKEN YENİLEME: aynı plan hâlâ geçerliyse süre bugünden değil, mevcut
  -- bitişten uzar. Aksi halde erken yenileyen kullanıcı kalan günlerini kaybeder.
  select * into v_sub from public.subscriptions s where s.profile_id = v_i.profile_id;
  v_baz := case when v_sub.plan = v_i.plan and v_sub.expires_at > now()
                then v_sub.expires_at else now() end;
  v_bitis := v_baz + case when v_i.period = 'yearly' then interval '1 year'
                          else interval '1 month' end;

  update public.payment_intents
     set status = 'odendi', settled_at = now(), granted_at = now(),
         provider_ref = coalesce(p_provider_ref, provider_ref), callback_raw = p_raw
   where id = v_i.id;

  update public.subscriptions s
     set plan = v_i.plan,
         billing_cycle = v_i.period,
         status = 'active',
         started_at = case when v_baz = now() then now() else s.started_at end,
         expires_at = v_bitis,
         nfc_cards_included = greatest(
           coalesce(s.nfc_cards_included, 0),
           coalesce((select pp.nfc_included from public.plan_prices pp
                      where pp.plan = v_i.plan and pp.period = v_i.period
                        and pp.with_nfc = v_i.with_nfc), 0)),
         updated_at = now()
   where s.profile_id = v_i.profile_id;

  perform public.log_event('payment.settled', null, 'qrtim', 'payment_intent', v_i.id::text,
                           'success', 'critical', 'user',
                           jsonb_build_object('plan', v_i.plan, 'period', v_i.period,
                                              'tutar_kurus', v_i.amount_kurus,
                                              'gecerlilik', v_bitis,
                                              'erken_yenileme', v_baz <> now()),
                           'service', null, null, null, v_i.user_id);

  return jsonb_build_object('ok', true, 'sonuc', 'odendi', 'gecerlilik', v_bitis);
end;
$fn$;

revoke all on function public.payment_settle(text,boolean,text,jsonb,text,bigint)
  from public, anon, authenticated;
grant execute on function public.payment_settle(text,boolean,text,jsonb,text,bigint) to service_role;

-- Yönlendirme anını kaydetmek için (payment-start Edge Function, service_role)
create or replace function public.payment_mark_redirected(p_intent_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_n int;
begin
  update public.payment_intents
     set status = 'yonlendirildi', redirected_at = now()
   where id = p_intent_id and status = 'olusturuldu';
  get diagnostics v_n = row_count;
  return v_n > 0;
end;
$fn$;

revoke all on function public.payment_mark_redirected(uuid) from public, anon, authenticated;
grant execute on function public.payment_mark_redirected(uuid) to service_role;
