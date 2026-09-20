-- ============================================================================
-- KİMLİK ARAMASI YETKİLİ KAYITTAN YAPILIR + finansal uçlarda yetki temizliği
-- ============================================================================
--
-- BULGU (20.09.2026, Arku oturumunun uyarısından yola çıkarak QRtım'da da
-- arandı ve DOĞRULANDI):
--   profiles.email kolonunu kullanıcı kendisi değiştirebiliyordu ve üç yer
--   kişiyi bu kolondan buluyordu. Geri alınan işlemde denendi:
--     1. Saldırgan kendi profilinin e-postasını, QRtım'e henüz üye OLMAYAN
--        birinin adresiyle değiştirdi  → başarılı.
--     2. Kurum yöneticisi o adresi org_add_member_by_email ile davet etti
--        → kuruma SALDIRGAN eklendi (ok=true).
--     3. approve_application da aynı şekilde başvuruyu saldırganın hesabına
--        bağladı.
--   Kuruma giren kişi üye analitiğini ve başvuran kişisel verilerini görüyor.
--   profiles.email üzerindeki UNIQUE kısıt yalnızca ZATEN KAYITLI e-postaları
--   korur; asıl hedef olan "henüz üye olmamış kişi" korumasızdı.
--
-- KURAL: Kimlik araması, kullanıcının yazabildiği bir aynadan değil, YETKİLİ
-- kayıttan (auth.users + doğrulanmış e-posta) yapılır. Bu kural partner
-- entegrasyon sözleşmesine de eklendi (docs/qrtim-kimlik-entegrasyonu.md).

-- ---------------------------------------------------------------------------
-- 1) profiles.email artık istemciden değiştirilemez
-- ---------------------------------------------------------------------------
-- E-posta kimliğin parçası; değişimi GoTrue üzerinden (doğrulama ile) olur.
-- profiles.email yalnızca gösterim aynasıdır.
create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = ''
as $fn$
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if not public.is_admin() then
      new.role := 'user';
    end if;
    return new;
  end if;

  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Yetki hatasi: role kolonu degistirilemez'
      using errcode = '42501';
  end if;

  if not public.is_admin() then
    new.subscription_plan       := old.subscription_plan;
    new.subscription_status     := old.subscription_status;
    new.subscription_expires_at := old.subscription_expires_at;
    new.nfc_cards_included      := old.nfc_cards_included;
    new.referral_earnings       := old.referral_earnings;

    -- E-posta: sessizce eski değere döner ve deneme kayda geçer.
    if new.email is distinct from old.email then
      perform public.log_protected_write('profile', old.id::text, array['email']);
      new.email := old.email;
    end if;
  end if;

  return new;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- 2) Kurum üyeliği: kişi YETKİLİ kayıttan bulunur
-- ---------------------------------------------------------------------------
create or replace function public.org_add_member_by_email(p_org_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_prof uuid; v_ad text; v_sayi int;
begin
  if not public.is_admin_of_org(p_org_id) then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  if (select count(*) from public.audit_log a
       where a.action = 'org.member_lookup' and a.actor_user_id = auth.uid()
         and a.occurred_at > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;

  -- profiles.email DEĞİL: kullanıcı o aynayı kendi yazabiliyordu ve başkasının
  -- adresini üstüne alıp davetleri kendine çekebiliyordu. Yetkili kayıt
  -- auth.users'tır ve e-posta doğrulanmış olmalıdır.
  select p.id into v_prof
    from auth.users u
    join public.profiles p on p.user_id = u.id
   where lower(u.email) = lower(btrim(coalesce(p_email, '')))
     and u.email_confirmed_at is not null
   limit 1;

  perform public.log_event('org.member_lookup', auth.uid(), 'qrtim', 'organization',
                           p_org_id::text, case when v_prof is null then 'failure' else 'success' end,
                           'info', 'internal', jsonb_build_object('bulundu', v_prof is not null));

  if v_prof is null then
    return jsonb_build_object('ok', false, 'hata', 'kullanici_bulunamadi');
  end if;

  if exists (select 1 from public.members m where m.organization_id = p_org_id and m.profile_id = v_prof) then
    return jsonb_build_object('ok', false, 'hata', 'zaten_uye');
  end if;

  insert into public.members (organization_id, profile_id, role, status)
  values (p_org_id, v_prof, 'member', 'active')
  returning name into v_ad;

  select count(*) into v_sayi from public.members m where m.organization_id = p_org_id;

  return jsonb_build_object('ok', true, 'ad', v_ad, 'uye_sayisi', v_sayi);
end;
$fn$;

revoke all on function public.org_add_member_by_email(uuid, text) from public, anon;
grant execute on function public.org_add_member_by_email(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) Başvuru onayı: aynı kural
-- ---------------------------------------------------------------------------
create or replace function public.approve_application(p_application_id uuid, p_decision text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_app public.applications; v_prof uuid; v_eklendi boolean := false;
begin
  select * into v_app from public.applications a where a.id = p_application_id;
  if v_app.id is null then
    return jsonb_build_object('ok', false, 'hata', 'basvuru_bulunamadi');
  end if;
  if not public.is_admin_of_org(v_app.organization_id) then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;
  if p_decision not in ('approved', 'rejected') then
    return jsonb_build_object('ok', false, 'hata', 'gecersiz_karar');
  end if;
  if v_app.status <> 'pending' then
    return jsonb_build_object('ok', false, 'hata', 'zaten_sonuclandi', 'durum', v_app.status);
  end if;

  update public.applications
     set status = p_decision, reviewed_at = now(), reviewed_by = public.my_profile_id()
   where id = v_app.id;

  if p_decision = 'approved' then
    -- Yetkili kayıttan ara (bkz. 2. madde).
    select p.id into v_prof
      from auth.users u
      join public.profiles p on p.user_id = u.id
     where lower(u.email) = lower(btrim(v_app.applicant_email))
       and u.email_confirmed_at is not null
     limit 1;

    if v_prof is not null then
      if not exists (select 1 from public.members m
                      where m.organization_id = v_app.organization_id and m.profile_id = v_prof) then
        insert into public.members (organization_id, profile_id, role, status)
        values (v_app.organization_id, v_prof, 'member', 'active');
        v_eklendi := true;
      end if;
    else
      if not exists (select 1 from public.members m
                      where m.organization_id = v_app.organization_id and m.profile_id is null
                        and lower(m.email) = lower(btrim(v_app.applicant_email))) then
        insert into public.members (organization_id, profile_id, name, email, phone, role, status)
        values (v_app.organization_id, null, v_app.applicant_name, v_app.applicant_email,
                v_app.applicant_phone, 'member', 'active');
        v_eklendi := true;
      end if;
    end if;
  end if;

  perform public.log_event('application.decided', auth.uid(), 'qrtim', 'application', v_app.id::text,
                           'success', 'notice', 'internal',
                           jsonb_build_object('karar', p_decision, 'uye_eklendi', v_eklendi,
                                              'hesap_bagli', v_prof is not null));

  return jsonb_build_object('ok', true, 'karar', p_decision,
                            'uye_eklendi', v_eklendi, 'hesap_bagli', v_prof is not null);
end;
$fn$;

revoke all on function public.approve_application(uuid, text) from public, anon;
grant execute on function public.approve_application(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Finansal fonksiyonlarda yetki temizliği (denetim bulgusu)
-- ---------------------------------------------------------------------------
-- Hakediş hesaplayan fonksiyonlarda EXECUTE anon'a kadar açıktı. Bugün RLS'e
-- takılıp hata veriyorlar, ama fonksiyon bir gün SECURITY DEFINER yapılırsa
-- açık anında canlı hale gelirdi.
do $yetki$
declare f record;
begin
  for f in
    select p.oid::regprocedure::text as imza
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('calculate_monthly_org_commission', 'calculate_referral_earnings')
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.imza);
  end loop;
end
$yetki$;

-- ---------------------------------------------------------------------------
-- 5) Ödeme talebi / işlem kayıtlarında yanlış kimlik karşılaştırması
-- ---------------------------------------------------------------------------
-- Politikalar profile_id = auth.uid() diyordu; oysa bu kolonlar profiles.id'ye
-- bakıyor ve 34 profilin 7'sinde profiles.id ≠ auth.uid(). O 7 kullanıcı kendi
-- kayıtlarını göremiyordu (ve ileride yazamayacaktı).
drop policy if exists "Users can view own payment requests" on public.payment_requests;
drop policy if exists "Users can create payment requests" on public.payment_requests;
drop policy if exists "Users can view own transactions" on public.transactions;

create policy "kisi kendi odeme taleplerini gorur" on public.payment_requests
  for select to authenticated
  using (profile_id = public.my_profile_id() or public.is_admin());

create policy "kisi odeme talebi olusturur" on public.payment_requests
  for insert to authenticated
  with check (profile_id = public.my_profile_id());

create policy "kisi kendi islemlerini gorur" on public.transactions
  for select to authenticated
  using (profile_id = public.my_profile_id() or public.is_admin());
