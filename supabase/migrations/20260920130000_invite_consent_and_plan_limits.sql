-- ============================================================================
-- ÜYELİK ONAYA BAĞLANDI + PLAN SINIRLARI TEK KAYNAKTA
-- ============================================================================
--
-- Burak'ın kararları (20.09.2026):
--   1. Kuruma üye eklemek DAVET + ONAY ile olur. Kişi kabul etmeden üyelik
--      başlamaz, analitiği görünmez. Mevcut 10 üyelik (hepsi kurum kurucusu)
--      olduğu gibi kalır.
--   2. Plan sınırlarının tek kaynağı plan_features tablosudur.
--   3. Davet (referans) ödül tutarları şimdilik hiçbir yerde VAAT EDİLMEZ;
--      metinler arayüzden kaldırılır (bu dosyada değil, arayüz tarafında).
--
-- Denetim bulguları (19–20.09): aynı sınır üç ayrı yerde farklı yazıyordu
-- (arayüzde sabit değerler, abonelik satırındaki kolonlar, sunucudaki
-- sabit SQL). Profesyonel kullanıcıya "5 organizasyon" gösterilirken sunucu
-- 999 veriyordu. Sosyal medya sınırı yalnızca arayüzdeydi; sunucuda hiç
-- kural yoktu.

-- ---------------------------------------------------------------------------
-- 1) plan_features: tek kaynak
-- ---------------------------------------------------------------------------
alter table public.plan_features
  add column if not exists organizations_limit int,
  add column if not exists social_links_limit int,
  add column if not exists nfc_cards_yearly int;

update public.plan_features set
  organizations_limit = case plan when 'free' then 2 when 'student' then 2 else 999 end,
  social_links_limit  = case plan when 'free' then 3 else 999 end,
  nfc_cards_yearly    = case plan when 'professional' then 1 when 'stk' then 6
                                  when 'business' then 10 when 'corporate' then 10 else 0 end
where organizations_limit is null;

-- NOT: create_organization içinde öğrenci planı 1 organizasyon veriyordu,
-- yani ÜCRETSİZ plandan (2) daha azını. Ücretli planın ücretsizin altında
-- kalması hata kabul edilip 2'ye çekildi; kesin değerler fiyat revizyonunda.
comment on column public.plan_features.organizations_limit is
  'Kişinin YÖNETİCİ olarak kurabileceği organizasyon sayısı. Üyelikler saymaz.';
comment on column public.plan_features.social_links_limit is
  'Sosyal medya bağlantısı sınırı. Sunucuda da uygulanır (social_links_limit_trg).';
comment on column public.plan_features.nfc_cards_yearly is
  'Yıllık abonelikte pakete dahil NFC kart adedi. Sipariş akışı henüz yok.';

-- Arayüzün ve sunucunun AYNI yerden okuduğu tek sorgu.
create or replace function public.my_plan_limits()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare v_prof uuid := public.my_profile_id(); v_plan text; v_bitis timestamptz; v_pf public.plan_features;
begin
  if auth.uid() is null then
    return jsonb_build_object('ok', false, 'hata', 'oturum_yok');
  end if;

  select s.plan, s.expires_at into v_plan, v_bitis
    from public.subscriptions s
   where s.profile_id = v_prof and s.status = 'active'
     and (s.expires_at is null or s.expires_at > now())
   order by s.created_at desc limit 1;

  v_plan := coalesce(v_plan, 'free');
  select * into v_pf from public.plan_features where plan = v_plan;

  return jsonb_build_object(
    'ok', true,
    'plan', v_plan,
    'expires_at', v_bitis,
    'sinir', jsonb_build_object(
      'profil',        coalesce(v_pf.persona_limit, 2),
      'organizasyon',  coalesce(v_pf.organizations_limit, 2),
      'sosyal_medya',  coalesce(v_pf.social_links_limit, 3),
      'nfc_yillik',    coalesce(v_pf.nfc_cards_yearly, 0),
      'senkron_cihaz', coalesce(v_pf.sync_max_devices, 1),
      'sifre_senkronu', coalesce(v_pf.sync_passwords, false)),
    'kullanim', jsonb_build_object(
      'profil',       (select count(*) from public.personas where profile_id = v_prof),
      'organizasyon', (select count(*) from public.members m
                        where m.profile_id = v_prof and m.role = 'admin' and m.accepted_at is not null),
      'sosyal_medya', (select count(*) from public.social_links where profile_id = v_prof)));
end;
$fn$;

revoke all on function public.my_plan_limits() from public, anon;
grant execute on function public.my_plan_limits() to authenticated;

-- ---------------------------------------------------------------------------
-- 2) Üyelik onayı: davet → kabul
-- ---------------------------------------------------------------------------
alter table public.members
  add column if not exists invited_by  uuid references public.profiles(id) on delete set null,
  add column if not exists invited_at  timestamptz,
  add column if not exists accepted_at timestamptz;

comment on column public.members.accepted_at is
  'Kişi üyeliği kabul ettiği an. BOŞSA üyelik başlamamıştır: analitiği görünmez, kurum listesinde çıkmaz.';

-- Mevcut üyelikler olduğu gibi kalır (hepsi kurum kurucusu).
update public.members
   set accepted_at = coalesce(joined_at, created_at, now())
 where accepted_at is null and status <> 'invited';

-- Üyelik ancak KABUL EDİLMİŞSE geçerlidir.
create or replace function public.is_member_of_org(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (select 1 from public.members m
     where m.organization_id = p_org and m.profile_id = public.my_profile_id()
       and m.accepted_at is not null);
$fn$;

create or replace function public.is_admin_of_org(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (select 1 from public.members m
     where m.organization_id = p_org and m.profile_id = public.my_profile_id()
       and m.role = 'admin' and m.accepted_at is not null);
$fn$;

-- Üye sayısı yalnızca kabul edenleri sayar.
create or replace function public.sync_org_member_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_org uuid;
begin
  v_org := coalesce(new.organization_id, old.organization_id);
  if v_org is not null then
    update public.organizations o
       set member_count = (select count(*) from public.members m
                            where m.organization_id = v_org and m.accepted_at is not null)
     where o.id = v_org;
  end if;

  if tg_op = 'UPDATE'
     and old.organization_id is distinct from new.organization_id
     and old.organization_id is not null then
    update public.organizations o
       set member_count = (select count(*) from public.members m
                            where m.organization_id = old.organization_id and m.accepted_at is not null)
     where o.id = old.organization_id;
  end if;

  return coalesce(new, old);
end;
$fn$;

-- Son yönetici koruması: bekleyen davetler "yönetici" sayılmaz.
create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare v_org uuid; v_kalan int;
begin
  v_org := coalesce(old.organization_id, new.organization_id);

  if tg_op = 'DELETE' then
    if not exists (select 1 from public.organizations o where o.id = v_org)
       or not exists (select 1 from public.profiles p where p.id = old.profile_id) then
      return old;
    end if;
    if old.accepted_at is null then   -- kabul edilmemiş davet silinebilir
      return old;
    end if;
  end if;

  if tg_op = 'UPDATE' and not (old.role = 'admin' and new.role <> 'admin') then
    return new;
  end if;

  select count(*) into v_kalan
    from public.members m
   where m.organization_id = v_org and m.role = 'admin'
     and m.accepted_at is not null and m.id <> old.id;

  if v_kalan = 0 then
    raise exception 'Bu organizasyonun son yoneticisi kaldirilamaz. Once baska bir yonetici atayin.'
      using errcode = 'P0001';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$fn$;

-- E-postayla ekleme artık DAVET üretir; üyelik kabul ile başlar.
create or replace function public.org_add_member_by_email(p_org_id uuid, p_email text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_prof uuid; v_ad text; v_mevcut public.members;
begin
  if not public.is_admin_of_org(p_org_id) then
    return jsonb_build_object('ok', false, 'hata', 'yetkisiz');
  end if;

  if (select count(*) from public.audit_log a
       where a.action = 'org.member_lookup' and a.actor_user_id = auth.uid()
         and a.occurred_at > now() - interval '1 hour') >= 30 then
    return jsonb_build_object('ok', false, 'hata', 'cok_fazla_deneme');
  end if;

  -- Kimlik araması yetkili kayıttan (profiles.email istemciye yazılabiliyordu).
  select p.id, p.name into v_prof, v_ad
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

  select * into v_mevcut from public.members m
   where m.organization_id = p_org_id and m.profile_id = v_prof;
  if v_mevcut.id is not null then
    return jsonb_build_object('ok', false,
      'hata', case when v_mevcut.accepted_at is null then 'davet_zaten_gonderildi' else 'zaten_uye' end);
  end if;

  insert into public.members (organization_id, profile_id, role, status, invited_by, invited_at)
  values (p_org_id, v_prof, 'member', 'invited', public.my_profile_id(), now());

  perform public.log_event('org.member_invited', auth.uid(), 'qrtim', 'organization', p_org_id::text,
                           'success', 'notice', 'user', jsonb_build_object('davet_edilen', v_prof),
                           'user', null, null, null,
                           (select user_id from public.profiles where id = v_prof));

  return jsonb_build_object('ok', true, 'durum', 'davet_gonderildi', 'ad', v_ad);
end;
$fn$;

revoke all on function public.org_add_member_by_email(uuid, text) from public, anon;
grant execute on function public.org_add_member_by_email(uuid, text) to authenticated;

-- Kişinin bekleyen davetleri
create or replace function public.my_pending_invitations()
returns table (member_id uuid, organization_id uuid, organization_name text,
               organization_type text, logo_url text, invited_at timestamptz, invited_by_name text)
language sql
stable
security definer
set search_path = ''
as $fn$
  select m.id, o.id, public.unquote_text(o.name), public.unquote_text(o.type), o.logo_url,
         m.invited_at, dp.name
    from public.members m
    join public.organizations o on o.id = m.organization_id
    left join public.profiles dp on dp.id = m.invited_by
   where m.profile_id = public.my_profile_id()
     and m.accepted_at is null
   order by m.invited_at desc nulls last;
$fn$;

revoke all on function public.my_pending_invitations() from public, anon;
grant execute on function public.my_pending_invitations() to authenticated;

-- Daveti kabul et / reddet
create or replace function public.invitation_respond(p_member_id uuid, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_m public.members; v_org text;
begin
  select * into v_m from public.members
   where id = p_member_id and profile_id = public.my_profile_id();
  if v_m.id is null then
    return jsonb_build_object('ok', false, 'hata', 'davet_bulunamadi');
  end if;
  if v_m.accepted_at is not null then
    return jsonb_build_object('ok', false, 'hata', 'zaten_uyesiniz');
  end if;

  select public.unquote_text(name) into v_org from public.organizations where id = v_m.organization_id;

  if coalesce(p_accept, false) then
    update public.members
       set accepted_at = now(), status = 'active', joined_at = coalesce(joined_at, now())
     where id = p_member_id;
    perform public.log_event('org.invitation_accepted', auth.uid(), 'qrtim', 'organization',
                             v_m.organization_id::text, 'success', 'notice', 'user',
                             jsonb_build_object('kurum', v_org));
    return jsonb_build_object('ok', true, 'durum', 'kabul', 'kurum', v_org);
  else
    delete from public.members where id = p_member_id;
    perform public.log_event('org.invitation_declined', auth.uid(), 'qrtim', 'organization',
                             v_m.organization_id::text, 'success', 'notice', 'user',
                             jsonb_build_object('kurum', v_org));
    return jsonb_build_object('ok', true, 'durum', 'red', 'kurum', v_org);
  end if;
end;
$fn$;

revoke all on function public.invitation_respond(uuid, boolean) from public, anon;
grant execute on function public.invitation_respond(uuid, boolean) to authenticated;

-- Başvuruyu kişi KENDİSİ yaptığı için onay = rıza; üyelik hemen başlar.
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
    select p.id into v_prof
      from auth.users u
      join public.profiles p on p.user_id = u.id
     where lower(u.email) = lower(btrim(v_app.applicant_email))
       and u.email_confirmed_at is not null
     limit 1;

    if v_prof is not null then
      if not exists (select 1 from public.members m
                      where m.organization_id = v_app.organization_id and m.profile_id = v_prof) then
        insert into public.members (organization_id, profile_id, role, status, accepted_at)
        values (v_app.organization_id, v_prof, 'member', 'active', now());
        v_eklendi := true;
      end if;
    else
      if not exists (select 1 from public.members m
                      where m.organization_id = v_app.organization_id and m.profile_id is null
                        and lower(m.email) = lower(btrim(v_app.applicant_email))) then
        insert into public.members (organization_id, profile_id, name, email, phone, role, status, accepted_at)
        values (v_app.organization_id, null, v_app.applicant_name, v_app.applicant_email,
                v_app.applicant_phone, 'member', 'active', now());
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
-- 3) Organizasyon sınırı plan_features'tan; sayım YÖNETİCİLİK üzerinden
-- ---------------------------------------------------------------------------
-- Eskiden kişinin bütün ÜYELİKLERİ sayılıyordu: başkasının kurumuna üye olmak
-- kendi kurum hakkını tüketiyordu. Davet akışıyla bu daha da yanlış olurdu.
create or replace function public.create_organization(
  p_name text, p_type text default 'company', p_description text default null,
  p_website text default null, p_email text default null, p_phone text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_profile_id uuid; v_plan text; v_limit int; v_count int; v_org uuid;
begin
  select p.id into v_profile_id from public.profiles p where p.user_id = auth.uid();
  if v_profile_id is null then
    return jsonb_build_object('ok', false, 'hata', 'profil_yok');
  end if;

  if p_name is null or btrim(p_name) = '' then
    return jsonb_build_object('ok', false, 'hata', 'ad_zorunlu');
  end if;

  if exists (
    select 1 from public.members m
    join public.organizations o on o.id = m.organization_id
    where m.profile_id = v_profile_id
      and lower(btrim(o.name)) = lower(btrim(p_name))
  ) then
    return jsonb_build_object('ok', false, 'hata', 'ayni_isim_var');
  end if;

  select coalesce(s.plan, 'free') into v_plan
    from public.subscriptions s
   where s.profile_id = v_profile_id and s.status = 'active'
     and (s.expires_at is null or s.expires_at > now())
   order by s.created_at desc limit 1;

  select coalesce(pf.organizations_limit, 2) into v_limit
    from public.plan_features pf where pf.plan = coalesce(v_plan, 'free');
  v_limit := coalesce(v_limit, 2);

  select count(*) into v_count from public.members m
   where m.profile_id = v_profile_id and m.role = 'admin' and m.accepted_at is not null;
  if v_count >= v_limit then
    return jsonb_build_object('ok', false, 'hata', 'limit_asildi', 'limit', v_limit, 'mevcut', v_count);
  end if;

  insert into public.organizations (name, type, description, website, email, phone, created_by)
  values (btrim(p_name), coalesce(p_type,'company'), p_description, p_website, p_email, p_phone, v_profile_id)
  returning id into v_org;

  insert into public.members (organization_id, profile_id, role, name, email, status, accepted_at)
  select v_org, v_profile_id, 'admin', p.name, p.email, 'active', now()
  from public.profiles p where p.id = v_profile_id;

  return jsonb_build_object('ok', true, 'id', v_org);
end;
$fn$;

revoke all on function public.create_organization(text,text,text,text,text,text) from public, anon;
grant execute on function public.create_organization(text,text,text,text,text,text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) Persona sınırı: iptal edilmiş abonelik hak vermesin (denetim bulgusu)
-- ---------------------------------------------------------------------------
create or replace function public.persona_plan_limit(p_profile uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce(
    (select pf.persona_limit
       from public.subscriptions s
       join public.plan_features pf on pf.plan = coalesce(s.plan, 'free')
      where s.profile_id = p_profile and s.status = 'active'
        and (s.expires_at is null or s.expires_at > now())
      order by s.created_at desc limit 1),
    (select persona_limit from public.plan_features where plan = 'free'),
    2);
$fn$;

revoke all on function public.persona_plan_limit(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Sosyal medya sınırı artık sunucuda da var
-- ---------------------------------------------------------------------------
create or replace function public.social_links_limit_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_plan text; v_limit int; v_sayi int;
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  select coalesce(s.plan, 'free') into v_plan
    from public.subscriptions s
   where s.profile_id = new.profile_id and s.status = 'active'
     and (s.expires_at is null or s.expires_at > now())
   order by s.created_at desc limit 1;

  select coalesce(pf.social_links_limit, 3) into v_limit
    from public.plan_features pf where pf.plan = coalesce(v_plan, 'free');

  select count(*) into v_sayi from public.social_links where profile_id = new.profile_id;

  if v_sayi >= coalesce(v_limit, 3) then
    raise exception 'Planinizin sosyal medya baglantisi siniri doldu (%).', coalesce(v_limit, 3)
      using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;

drop trigger if exists social_links_limit_trg on public.social_links;
create trigger social_links_limit_trg
  before insert on public.social_links
  for each row execute function public.social_links_limit_guard();

-- ---------------------------------------------------------------------------
-- 6) Raporlar: bekleyen davetler analitiğe girmez
-- ---------------------------------------------------------------------------
create or replace function public.org_member_analytics(
  p_org_id uuid, p_from timestamptz default null, p_to timestamptz default null)
returns table (
  member_id uuid, profile_id uuid, name text, avatar_url text, role text, status text,
  joined_at timestamptz, has_account boolean,
  profile_views bigint, qr_views bigint, nfc_views bigint, link_views bigint, direct_views bigint,
  vcard_downloads bigint, link_clicks bigint, shares bigint,
  total bigint, last_activity timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  with s as (
    select case when p_from is null then null else date_trunc('day', p_from) end as bas,
           case when p_to   is null then null else date_trunc('day', p_to) + interval '1 day' end as bit
  )
  select m.id, m.profile_id,
         coalesce(public.unquote_text(m.name), p.name, 'İsimsiz üye'),
         p.avatar_url, m.role, m.status,
         coalesce(m.accepted_at, m.joined_at, m.created_at),
         (m.profile_id is not null),
         count(*) filter (where e.event_type in ('profile_view','qr_scan','nfc_tap')),
         count(*) filter (where e.event_type in ('profile_view','qr_scan','nfc_tap') and (e.source = 'qr'  or e.event_type = 'qr_scan')),
         count(*) filter (where e.event_type in ('profile_view','qr_scan','nfc_tap') and (e.source = 'nfc' or e.event_type = 'nfc_tap')),
         count(*) filter (where e.event_type = 'profile_view' and e.source = 'link'),
         count(*) filter (where e.event_type = 'profile_view' and coalesce(e.source, 'direct') = 'direct'),
         count(*) filter (where e.event_type = 'vcard_download'),
         count(*) filter (where e.event_type = 'link_click'),
         count(*) filter (where e.event_type = 'share'),
         count(e.id),
         max(e.created_at)
    from public.members m
    cross join s
    left join public.profiles p on p.id = m.profile_id
    left join public.analytics_events e
           on e.profile_id = m.profile_id
          -- Üyeliğin KABUL EDİLDİĞİ andan itibaren; öncesi kuruma ait değil.
          and e.created_at >= coalesce(m.accepted_at, m.joined_at, m.created_at)
          and (s.bas is null or e.created_at >= s.bas)
          and (s.bit is null or e.created_at <  s.bit)
   where m.organization_id = p_org_id
     and m.accepted_at is not null
     and public.is_admin_of_org(p_org_id)
   group by m.id, m.profile_id, m.name, p.name, p.avatar_url, m.role, m.status,
            coalesce(m.accepted_at, m.joined_at, m.created_at)
   order by count(e.id) desc, coalesce(public.unquote_text(m.name), p.name);
$fn$;

revoke all on function public.org_member_analytics(uuid,timestamptz,timestamptz) from public, anon;
grant execute on function public.org_member_analytics(uuid,timestamptz,timestamptz) to authenticated;

-- Üye listesi: bekleyen davetler de görünür ama "davet bekliyor" olarak.
create or replace function public.org_member_list(p_org_id uuid)
returns table (id uuid, profile_id uuid, name text, email text, phone text,
               role text, status text, joined_at timestamptz, avatar_url text,
               title text, company text, is_me boolean, accepted_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  select m.id, m.profile_id,
         coalesce(public.unquote_text(m.name), p.name),
         case when public.is_admin_of_org(p_org_id) or m.profile_id = public.my_profile_id()
              then public.unquote_text(m.email) end,
         case when public.is_admin_of_org(p_org_id) or m.profile_id = public.my_profile_id()
              then public.unquote_text(m.phone) end,
         m.role,
         case when m.accepted_at is null then 'invited' else m.status end,
         coalesce(m.joined_at, m.created_at),
         p.avatar_url,
         case when exists (select 1 from public.profile_fields f
                            join public.personas x on x.id = f.persona_id
                            where f.profile_id = p.id and f.field_key = 'title'
                              and x.is_primary and f.visibility = 'public')
              then p.title end,
         case when exists (select 1 from public.profile_fields f
                            join public.personas x on x.id = f.persona_id
                            where f.profile_id = p.id and f.field_key = 'company'
                              and x.is_primary and f.visibility = 'public')
              then p.company end,
         (m.profile_id is not null and m.profile_id = public.my_profile_id()),
         m.accepted_at
    from public.members m
    left join public.profiles p on p.id = m.profile_id
   where m.organization_id = p_org_id
     and public.is_member_of_org(p_org_id)
   order by (m.accepted_at is null), (m.role = 'admin') desc, m.name nulls last;
$fn$;

revoke all on function public.org_member_list(uuid) from public, anon;
grant execute on function public.org_member_list(uuid) to authenticated;

-- Kurum listesi: kabul edilmemiş davetler burada çıkmaz (davet ekranında çıkar).
create or replace function public.my_organizations()
returns table (
  id uuid, name text, type text, logo_url text, theme_color text,
  my_role text, member_count int, is_stk boolean, is_admin boolean,
  pending_applications bigint, settings jsonb, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $fn$
  select o.id,
         public.unquote_text(o.name),
         public.unquote_text(o.type),
         o.logo_url,
         o.theme_color,
         m.role,
         (select count(*)::int from public.members m2
           where m2.organization_id = o.id and m2.accepted_at is not null),
         public.is_stk_org_type(o.type),
         (m.role = 'admin'),
         case when m.role = 'admin'
              then (select count(*) from public.applications a
                     where a.organization_id = o.id and a.status = 'pending')
              else 0 end,
         coalesce(o.settings, '{}'::jsonb),
         o.created_at
    from public.members m
    join public.organizations o on o.id = m.organization_id
   where m.profile_id = public.my_profile_id()
     and m.accepted_at is not null
   order by (m.role = 'admin') desc, o.name;
$fn$;

revoke all on function public.my_organizations() from public, anon;
grant execute on function public.my_organizations() to authenticated;

-- ---------------------------------------------------------------------------
-- 7) DÜZELTME (aynı gün, testte yakalandı): sosyal medya koruması hiç çalışmıyordu
-- ---------------------------------------------------------------------------
-- Fonksiyon SECURITY DEFINER olduğu için içindeki current_user fonksiyonun
-- SAHİBİNİ gösteriyor, "sistem kullanıcısıysa atla" kontrolü her çağrıda
-- erken dönüyordu. Çağıranın kim olduğu JWT'den okunur.
-- (Aynı tuzak organizations_protect_system_columns'ta da yaşanmıştı.)
create or replace function public.social_links_limit_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_plan text; v_limit int; v_sayi int;
begin
  if auth.uid() is null or coalesce(auth.role(), '') in ('service_role', 'supabase_admin') then
    return new;
  end if;

  select coalesce(s.plan, 'free') into v_plan
    from public.subscriptions s
   where s.profile_id = new.profile_id and s.status = 'active'
     and (s.expires_at is null or s.expires_at > now())
   order by s.created_at desc limit 1;

  select coalesce(pf.social_links_limit, 3) into v_limit
    from public.plan_features pf where pf.plan = coalesce(v_plan, 'free');

  select count(*) into v_sayi from public.social_links where profile_id = new.profile_id;

  if v_sayi >= coalesce(v_limit, 3) then
    raise exception 'Planinizin sosyal medya baglantisi siniri doldu (%).', coalesce(v_limit, 3)
      using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;
