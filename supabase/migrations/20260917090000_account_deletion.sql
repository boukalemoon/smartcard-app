-- ============================================================================
-- HESAP SİLME — "Database error deleting user"
-- ============================================================================
--
-- ŞİKÂYET: mehmet@ahmet.com test hesabı silinemiyor.
--
-- KÖK SEBEP (geri alınan işlemde denendi, 17.09.2026):
--   23503: update or delete on table "profiles" violates foreign key
--          constraint "referrals_referee_id_fkey" on table "referrals"
--
--   Mehmet, burakakmese'nin davet bağlantısıyla kayıt olmuş. referrals
--   tablosundaki bağlantı NO ACTION kuralında. auth.users silinince profil
--   CASCADE ile silinmeye çalışılıyor, davet kaydı buna izin vermiyor, tüm
--   işlem geri alınıyor. Supabase paneli bunu "Database error deleting user"
--   olarak gösteriyor.
--
-- KAPSAM — yalnız Mehmet'in sorunu değil:
--   Davetle kayıt olan HİÇ KİMSE hesabını silemiyordu; davet eden de.
--   Profile NO ACTION ile bağlı 10 kolon vardı. KVKK md. 7 silinme hakkı
--   açısından ciddi bir engel.
--
-- KARAR — neden CASCADE değil SET NULL:
--   Bu kolonların yarısı FİNANSAL kayıt (komisyon, işlem, ödeme talebi).
--   Vergi mevzuatı finansal kaydın saklanmasını ister; kişi silinince satır
--   kalır ama silinen kişiye bağı kopar. Davet kaydı da aynı mantıkla kalır:
--   "bir davet gerçekleşti, davet edilen daha sonra hesabını sildi".
--
--   referral_transactions ise tersine CASCADE idi: kişi silinince finansal
--   geçmiş de siliniyordu. Tutarlılık için o da SET NULL.

-- ---------------------------------------------------------------------------
-- 1) Silme kuralları
-- ---------------------------------------------------------------------------

do $mig$
declare
  r record;
  v_con text;
  v_hedef text;
begin
  for r in
    select * from (values
      ('applications',                 'reviewed_by',  'profiles'),
      ('organization_member_requests', 'reviewed_by',  'profiles'),
      ('payment_requests',             'processed_by', 'profiles'),
      ('payment_requests',             'profile_id',   'profiles'),
      ('profiles',                     'referred_by',  'profiles'),
      ('referrals',                    'referrer_id',  'profiles'),
      ('referrals',                    'referee_id',   'profiles'),
      ('commissions',                  'profile_id',   'profiles'),
      ('organizational_commissions',   'profile_id',   'profiles'),
      ('transactions',                 'profile_id',   'profiles'),
      ('referral_transactions',        'referrer_id',  'profiles'),
      ('referral_transactions',        'referred_id',  'profiles')
    ) as t(tablo, kolon, hedef)
  loop
    select c.conname into v_con
      from pg_constraint c
      join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
     where c.contype = 'f'
       and c.conrelid = format('public.%I', r.tablo)::regclass
       and a.attname = r.kolon
     limit 1;

    if v_con is null then
      raise notice 'bag bulunamadi, atlandi: %.%', r.tablo, r.kolon;
      continue;
    end if;

    execute format('alter table public.%I alter column %I drop not null', r.tablo, r.kolon);
    execute format('alter table public.%I drop constraint %I', r.tablo, v_con);
    execute format(
      'alter table public.%I add constraint %I foreign key (%I) references public.%I(id) on delete set null',
      r.tablo, v_con, r.kolon, r.hedef);
  end loop;
end
$mig$;

-- ---------------------------------------------------------------------------
-- 2) Hesap silme çekirdeği — yalnız sunucu
-- ---------------------------------------------------------------------------
-- auth.users'tan silmek profili, abonelikleri, senkron verisini, kurtarma
-- kayıtlarını, oturumları CASCADE ile temizler. Finansal kayıtlar kalır,
-- kişiye bağı kopar.
--
-- Denetim kaydına silinen kişinin e-postası MASKELİ yazılır: silinme
-- talebinden sonra kişisel veriyi denetim kaydında tam haliyle tutmak
-- silme işleminin amacına ters düşer.
--
-- DOSYALAR: storage.objects SQL ile silinmez (Supabase Storage API
-- gerektirir). Kalan dosya sayısı sonuçta döner; çağıran taraf temizlemeli.

create or replace function public.delete_user_account_internal(
  p_user_id    uuid,
  p_actor      uuid,
  p_actor_kind text,
  p_reason     text,
  p_force      boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_email     text;
  v_profil    uuid;
  v_yetim     jsonb;
  v_dosya     int;
begin
  select u.email into v_email from auth.users u where u.id = p_user_id;
  if v_email is null then
    return jsonb_build_object('ok', false, 'hata', 'kullanici_bulunamadi');
  end if;

  select p.id into v_profil from public.profiles p where p.user_id = p_user_id;

  -- Tek yöneticisi bu kişi olan VE başka üyesi bulunan organizasyonlar
  -- silme sonrası sahipsiz kalır. Zorlanmadıkça dur.
  select coalesce(jsonb_agg(jsonb_build_object('id', o.id, 'ad', o.name)), '[]'::jsonb)
    into v_yetim
    from public.organizations o
   where exists (select 1 from public.members m
                  where m.organization_id = o.id and m.profile_id = v_profil and m.role = 'admin')
     and not exists (select 1 from public.members m
                      where m.organization_id = o.id and m.role = 'admin' and m.profile_id <> v_profil)
     and exists (select 1 from public.members m
                  where m.organization_id = o.id and m.profile_id is distinct from v_profil);

  if jsonb_array_length(v_yetim) > 0 and not coalesce(p_force, false) then
    return jsonb_build_object('ok', false, 'hata', 'sahipsiz_kalacak_organizasyon',
                              'organizasyonlar', v_yetim);
  end if;

  select count(*) into v_dosya from storage.objects so where so.owner = p_user_id;

  -- Silmeden ÖNCE kaydet: silme başarısız olursa işlem geri alınır, kayıt da.
  perform public.log_event('account.deleted', p_actor, 'qrtim', 'auth_user', p_user_id::text,
                           'success', 'critical', 'internal',
                           jsonb_build_object(
                             'eposta_maskeli', regexp_replace(v_email, '^(.).*(@.*)$', '\1***\2'),
                             'gerekce', p_reason,
                             'zorlandi', coalesce(p_force, false),
                             'sahipsiz_kalan_org', v_yetim,
                             'kalan_dosya', v_dosya),
                           p_actor_kind);

  delete from auth.users where id = p_user_id;

  return jsonb_build_object('ok', true, 'kalan_dosya', v_dosya,
                            'sahipsiz_kalan_org', v_yetim);
end;
$fn$;

revoke all on function public.delete_user_account_internal(uuid,uuid,text,text,boolean)
  from public, anon, authenticated;
grant execute on function public.delete_user_account_internal(uuid,uuid,text,text,boolean)
  to service_role;

-- ---------------------------------------------------------------------------
-- 3) Yönetici silme — AdminCRM
-- ---------------------------------------------------------------------------
-- AdminCRM önceden profiles/subscriptions/referral_codes tablolarından
-- istemci tarafında siliyordu: erişim kuralları başka kullanıcının satırını
-- silmeye izin vermediği için 0 satır etkileniyordu; auth.users hiç
-- silinmiyordu. Yani "sil" düğmesi hiçbir zaman çalışmamıştı.

create or replace function public.admin_delete_user(
  p_user_id uuid,
  p_reason  text,
  p_force   boolean default false
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_hedef_rol text;
begin
  if not public.is_admin() then
    perform public.log_event('account.delete_attempt', auth.uid(), 'qrtim', 'auth_user',
                             p_user_id::text, 'denied', 'critical', 'internal',
                             jsonb_build_object('sebep', 'yonetici_degil'));
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  if p_user_id = auth.uid() then
    return jsonb_build_object('ok', false, 'hata', 'kendini_silemezsin');
  end if;

  select p.role into v_hedef_rol from public.profiles p where p.user_id = p_user_id;
  if v_hedef_rol in ('admin', 'superadmin') then
    return jsonb_build_object('ok', false, 'hata', 'yonetici_silinemez',
                              'bilgi', 'Önce yönetici yetkisini kaldırın.');
  end if;

  if p_reason is null or btrim(p_reason) = '' then
    return jsonb_build_object('ok', false, 'hata', 'gerekce_zorunlu');
  end if;

  return public.delete_user_account_internal(p_user_id, auth.uid(), 'user', p_reason, p_force);
end;
$fn$;

revoke all on function public.admin_delete_user(uuid,text,boolean) from public, anon;
grant execute on function public.admin_delete_user(uuid,text,boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Komisyon yalnızca GERÇEK ödemeden doğar
-- ---------------------------------------------------------------------------
-- on_subscription_upgrade, plan ücretsizden ücretliye geçtiği anda davet
-- edene "onaylanmış" komisyon yazıyordu. Planın NASIL değiştiğine
-- bakmıyordu. Sonuç:
--   • Kapatılan plan yükseltme açığıyla davet edilen kişi kendi planını
--     bedavaya yükseltip davet edene gerçek para kazandırabiliyordu.
--   • Yönetici elle plan verse de komisyon doğuyordu.
--   • Kanıt: mehmet@ahmet.com (test, hiç ödeme yok) Profesyonel'e geçince
--     burakakmese'ye 50 TL komisyon yazılmış, durumu "paid".
--
-- Koşul: aynı işlem içinde bu profil için ödeme niyeti "hak tanımlandı"
-- olarak işaretlenmiş olmalı. payment_settle önce niyeti (granted_at=now())
-- sonra aboneliği güncelliyor; now() işlem boyunca sabit olduğu için eşitlik
-- yalnızca doğrulanmış ödeme bildirimiyle sağlanır.

create or replace function public.update_referral_on_subscription()
returns trigger
language plpgsql
set search_path = 'public', 'pg_temp'
as $fn$
declare
  v_referral_id uuid;
  v_referrer_id uuid;
  v_plan_name   text;
  v_commission  numeric(10,2);
begin
  if new.plan in ('professional', 'stk', 'business')
     and new.status = 'active'
     and (old.plan = 'free' or old.plan is null) then

    if not exists (select 1 from public.payment_intents pi
                    where pi.profile_id = new.profile_id
                      and pi.granted_at = now()) then
      perform public.log_event('referral.commission_skipped', null, 'qrtim', 'subscription',
                               new.profile_id::text, 'denied', 'notice', 'internal',
                               jsonb_build_object('sebep', 'dogrulanmis_odeme_yok',
                                                  'yeni_plan', new.plan), 'system');
      return new;
    end if;

    case new.plan
      when 'professional' then v_plan_name := 'Profesyonel Plan'; v_commission := 50.00;
      when 'stk'          then v_plan_name := 'STK Özel Plan';    v_commission := 75.00;
      when 'business'     then v_plan_name := 'Kurumsal Plan';    v_commission := 150.00;
    end case;

    update referrals
       set status = 'active', commission_amount = v_commission, completed_at = now()
     where referee_id = new.profile_id and status = 'pending'
    returning id, referrer_id into v_referral_id, v_referrer_id;

    if v_referral_id is not null then
      insert into commissions (profile_id, referral_id, amount, type, status, description)
      values (v_referrer_id, v_referral_id, v_commission, 'referral', 'approved',
              v_plan_name || ' - Referral Komisyonu');

      perform public.log_event('referral.commission_created', null, 'qrtim', 'commission',
                               v_referral_id::text, 'success', 'critical', 'internal',
                               jsonb_build_object('tutar', v_commission, 'plan', new.plan),
                               'system');
    end if;
  end if;

  return new;
end;
$fn$;
