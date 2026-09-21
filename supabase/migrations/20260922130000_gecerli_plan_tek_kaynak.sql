-- ============================================================================
-- GEÇERLİ PLAN: tek hesaplama noktası
-- ============================================================================
--
-- NEDEN: iki uç aynı soruyu farklı yerden cevaplıyordu.
--   • arku-link    → profiles.subscription_plan (denormalize kopya)
--   • partner-plan → subscriptions (asıl kaynak)
--
-- Bugün ikisi tutuyor (34 profilin 34'ü ölçüldü, ayrışma 0) ama aynı şeyi
-- hesaplayan iki kod yolu er geç ayrışır. Ayrıştığı gün partner bağlanma
-- anında bir plan, ilk tazelemede başka bir plan görür ve kullanıcının
-- kademesi sebepsiz oynar.
--
-- Hesaplama buraya alındı; iki uç da bunu çağırıyor. Ayrışma ihtimali yok.
--
-- Bu fonksiyon KİMLİK DOĞRULAMASI YAPMAZ: çağıranın p_user_id'yi hak
-- ettiğini doğrulaması ÇAĞIRANIN işidir. Bu yüzden yalnızca service_role'e
-- açık ve adı da bunu ima ediyor (partner_effective_plan ile karıştırılmasın).

create or replace function public.effective_plan_for_user(p_user_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare v_prof uuid; v_plan text; v_bitis timestamptz; v_pf public.plan_features;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return null;
  end if;
  if p_user_id is null then return null; end if;

  -- profiles.id ≠ user_id (34 profilin 7'sinde farklı) — doğru kolondan.
  select id into v_prof from public.profiles where user_id = p_user_id;
  if v_prof is null then return null; end if;

  select s.plan, s.expires_at into v_plan, v_bitis
    from public.subscriptions s
   where s.profile_id = v_prof
     and s.status = 'active'
     and (s.expires_at is null or s.expires_at > now())
   order by s.created_at desc
   limit 1;

  v_plan := coalesce(v_plan, 'free');
  select * into v_pf from public.plan_features where plan = v_plan;

  return jsonb_build_object(
    'plan', v_plan,
    -- Tanımsız plan adı ücretsiz sayılır: güvenli taraf.
    'ucretli', coalesce(v_pf.ucretli, false),
    'expires_at', v_bitis,
    'max_sync_devices', coalesce(v_pf.sync_max_devices, 1),
    'password_sync', coalesce(v_pf.sync_passwords, false));
end;
$fn$;

revoke all on function public.effective_plan_for_user(uuid) from public, anon, authenticated;
grant execute on function public.effective_plan_for_user(uuid) to service_role;

comment on function public.effective_plan_for_user(uuid) is
  'Gecerli plan hesabinin TEK noktasi. Kimlik dogrulamasi YAPMAZ; cagiran dogrulamis olmali.';

-- partner_effective_plan artık hesabı kendisi yapmıyor, ortak noktayı çağırıyor.
create or replace function public.partner_effective_plan(
  p_partner     text,
  p_qrtim_uid   text,
  p_link_secret text
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_user uuid; v_ozet text; v_plan jsonb;
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    return jsonb_build_object('ok', false, 'hata', 'yetki_yok');
  end if;

  if p_partner is null or p_partner !~ '^[a-z0-9_-]{2,32}$'
     or p_qrtim_uid is null
     or p_qrtim_uid !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
     or p_link_secret is null or p_link_secret !~ '^[0-9a-f]{64}$' then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_istek');
  end if;

  v_ozet := encode(extensions.digest(p_link_secret, 'sha256'), 'hex');

  if not public.check_rate_limit('partner-plan:' || p_partner || ':' || left(v_ozet, 16), 60, 3600) then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;

  -- Canlı bağ — SIRLA aranır (kimliğin kendisi sır).
  select l.user_id into v_user
    from public.partner_user_links l
   where l.partner = p_partner and l.link_secret = p_link_secret;

  if v_user is null then
    if exists (select 1 from public.partner_link_revocations r
                where r.partner = p_partner and r.secret_hash = v_ozet) then
      return jsonb_build_object('ok', false, 'hata', 'baglanti_iptal');
    end if;
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  -- Sunulan kimlik gerçekten bu bağın sahibine mi ait?
  if not exists (select 1 from public.qrtim_user_ids q
                  where q.user_id = v_user and q.qrtim_uid = p_qrtim_uid::uuid) then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  v_plan := public.effective_plan_for_user(v_user);
  if v_plan is null then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  update public.partner_user_links
     set last_seen = now()
   where user_id = v_user and partner = p_partner;

  perform public.log_event('partner.plan_checked', null, p_partner,
                           'subscription', v_user::text, 'success', 'info', 'internal',
                           jsonb_build_object('plan', v_plan->>'plan'),
                           'service', null, null, null, v_user);

  return v_plan || jsonb_build_object('ok', true, 'kontrol_zamani', now());
end;
$fn$;

revoke all on function public.partner_effective_plan(text, text, text) from public, anon, authenticated;
grant execute on function public.partner_effective_plan(text, text, text) to service_role;

-- DOĞRULANDI (geri alınan işlemde, refactor sonrası):
--   istemci ortak fonksiyonu çağıramıyor (42501) ·
--   ortak fonksiyon ile partner_effective_plan aynı cevabı veriyor ·
--   yanlış sır → yetkisiz · kimlik tutmuyor → yetkisiz ·
--   kopmuş bağlantı → baglanti_iptal (hata yolları refactor'da bozulmadı).
