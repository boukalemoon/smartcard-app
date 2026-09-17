-- ============================================================================
-- KURUMSAL / STK PANELİ — BEŞ HATA
-- ============================================================================
--
-- Hepsi canlı ortamda deneyerek doğrulandı (13.09.2026).
--
-- ORTAK KÖK SEBEP: politikalar `members.profile_id = auth.uid()` diye
-- karşılaştırıyor. Ama profile_id bir PROFİL kimliği, auth.uid() bir KULLANICI
-- kimliği ve 36 profilin 9'unda bunlar FARKLI (panelden elle açılmış eski
-- kayıtlar). Organizasyon yöneticilerinin 9'undan 7'si bu gruba düşüyor.
--
--   A) BAŞVURULAR GÖRÜNMÜYOR. Yönetici olarak başvuru listesi 0 döndü.
--      Ayrıca politikanın alt sorgusu `members` tablosunu okuduğu için
--      giriş yapmamış ziyaretçide "permission denied for table members"
--      hatasına dönüşüyordu.
--
--   B) ÜYE VERİSİ SIZIYOR. members SELECT politikası `USING (true)` idi.
--      Ölçüldü: giriş yapmış bir kullanıcı 9 üyenin tamamını görüyor,
--      bunların 6'sı hiç üyesi olmadığı organizasyonlara ait ve
--      e-postaları okunabiliyor. Kimlik ürününde kabul edilemez.
--
--   C) ÜYE ROLÜ DEĞİŞTİRİLEMİYOR. members tablosunda UPDATE politikası
--      HİÇ YOKTU. Etkilenen satır: 0. Arayüz yine de "Üye güncellendi!"
--      diyordu — bu projede üçüncü kez aynı sessiz yalan.
--
--   D) ÜYE SİLİNEMİYOR. İki DELETE politikası da `organization_admins`
--      tablosuna bakıyor; o tablo BOŞ (0 satır) ve hiçbir kod ona yazmıyor.
--      Etkilenen satır: 0, arayüzde "Üye silindi!".
--
--   E) BAŞVURU SPAMİ SERBEST. Sınır yok; üst üste 5 sahte başvuru geçti.
--      Herkes herhangi bir organizasyona sınırsız başvuru yağdırabilir.

-- ---------------------------------------------------------------------------
-- 1) KİMLİK ÇEVİRİCİLERİ
-- ---------------------------------------------------------------------------
-- Bu üç yardımcı, profil/kullanıcı kimliği karışıklığını TEK yerde çözer.
-- SECURITY DEFINER olmaları iki işe yarıyor:
--   • members politikası members'ı okurken sonsuz özyineleme oluşmaz
--   • giriş yapmamış ziyaretçide "permission denied" yerine düz `false` döner

create or replace function public.my_profile_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select p.id from public.profiles p where p.user_id = auth.uid() limit 1;
$fn$;

comment on function public.my_profile_id() is
  'auth.uid() -> profiles.id çevirisi. 36 profilin 9''unda bu ikisi farklı.';

create or replace function public.is_member_of_org(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.members m
     where m.organization_id = p_org
       and m.profile_id = public.my_profile_id()
  );
$fn$;

create or replace function public.is_admin_of_org(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $fn$
  select exists (
    select 1 from public.members m
     where m.organization_id = p_org
       and m.profile_id = public.my_profile_id()
       and m.role = 'admin'
  );
$fn$;

revoke all on function public.my_profile_id()        from public, anon;
revoke all on function public.is_member_of_org(uuid) from public, anon;
revoke all on function public.is_admin_of_org(uuid)  from public, anon;
grant execute on function public.my_profile_id()        to authenticated;
grant execute on function public.is_member_of_org(uuid) to authenticated;
grant execute on function public.is_admin_of_org(uuid)  to authenticated;

-- ---------------------------------------------------------------------------
-- 2) members — politikaları baştan yaz
-- ---------------------------------------------------------------------------

drop policy if exists "members_select"           on public.members;
drop policy if exists "members_insert_self"      on public.members;
drop policy if exists "members_insert_admin"     on public.members;
drop policy if exists "members_delete_admin"     on public.members;
drop policy if exists "Admins can delete members" on public.members;

-- OKUMA: kendi üyelik kaydın + aynı organizasyondaki arkadaşların.
-- Herkese açık üye rehberi bu tablodan DEĞİL, get_public_org_members
-- fonksiyonundan besleniyor; o yüzden burada kapatmak rehberi bozmaz.
create policy "uye kendi orgunu gorur"
  on public.members for select
  to authenticated
  using (
    profile_id = public.my_profile_id()
    or public.is_member_of_org(organization_id)
  );

-- EKLEME: kendini ekleyebilirsin ya da o organizasyonun yöneticisisin.
create policy "uye ekleme"
  on public.members for insert
  to authenticated
  with check (
    profile_id = public.my_profile_id()
    or public.is_admin_of_org(organization_id)
  );

-- GÜNCELLEME: yalnızca yönetici. (Daha önce HİÇ politika yoktu.)
create policy "yonetici uye gunceller"
  on public.members for update
  to authenticated
  using (public.is_admin_of_org(organization_id))
  with check (public.is_admin_of_org(organization_id));

-- SİLME: yönetici çıkarabilir, herkes kendi üyeliğinden ayrılabilir.
create policy "yonetici veya kisi uyeligi siler"
  on public.members for delete
  to authenticated
  using (
    public.is_admin_of_org(organization_id)
    or profile_id = public.my_profile_id()
  );

-- ---------------------------------------------------------------------------
-- 3) SON YÖNETİCİ KORUMASI
-- ---------------------------------------------------------------------------
-- Sahipsiz organizasyonların nasıl oluştuğunu daha önce görmüştük. Bu
-- tetikleyici aynı deliği kapatıyor: son yönetici ne silinebilir ne de
-- normal üyeye düşürülebilir.

create or replace function public.prevent_last_admin_removal()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare v_org uuid; v_kalan int;
begin
  v_org := coalesce(old.organization_id, new.organization_id);

  -- CASCADE ile gelen silmeyi engelleme. members iki ayri CASCADE tasiyor:
  -- organizasyon silinince VE profil silinince (hesap kapatma) uyelik de
  -- siliniyor. Bu koruma olmasa organizasyon silmek ve hesap kapatmak
  -- imkansiz hale gelirdi.
  if tg_op = 'DELETE' then
    if not exists (select 1 from public.organizations o where o.id = v_org)
       or not exists (select 1 from public.profiles p where p.id = old.profile_id) then
      return old;
    end if;
  end if;

  if tg_op = 'UPDATE' and not (old.role = 'admin' and new.role <> 'admin') then
    return new;
  end if;

  select count(*) into v_kalan
    from public.members m
   where m.organization_id = v_org
     and m.role = 'admin'
     and m.id <> old.id;

  if v_kalan = 0 then
    raise exception 'Bu organizasyonun son yoneticisi kaldirilamaz. Once baska bir yonetici atayin.'
      using errcode = 'P0001';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end;
$fn$;

drop trigger if exists members_last_admin_trg on public.members;
create trigger members_last_admin_trg
  before update or delete on public.members
  for each row when (old.role = 'admin')
  execute function public.prevent_last_admin_removal();

-- ---------------------------------------------------------------------------
-- 4) applications — politikaları düzelt
-- ---------------------------------------------------------------------------

drop policy if exists "Organization admins can view applications"   on public.applications;
drop policy if exists "Organization admins can update applications" on public.applications;
drop policy if exists "Anyone can insert applications"              on public.applications;

-- Yönetici artık başvurularını GERÇEKTEN görüyor.
create policy "yonetici basvurulari gorur"
  on public.applications for select
  to authenticated
  using (public.is_admin_of_org(organization_id));

create policy "yonetici basvuru gunceller"
  on public.applications for update
  to authenticated
  using (public.is_admin_of_org(organization_id))
  with check (public.is_admin_of_org(organization_id));

create policy "yonetici basvuru siler"
  on public.applications for delete
  to authenticated
  using (public.is_admin_of_org(organization_id));

-- Başvuru göndermek herkese açık kalmalı (formun amacı bu), ama var olan
-- bir organizasyona ve makul biçimde.
create policy "herkes basvuru gonderebilir"
  on public.applications for insert
  to anon, authenticated
  with check (
    exists (select 1 from public.organizations o where o.id = organization_id)
    and applicant_name  is not null and btrim(applicant_name)  <> ''
    and applicant_email is not null and applicant_email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  );

-- ---------------------------------------------------------------------------
-- 5) BAŞVURU SPAM SINIRI
-- ---------------------------------------------------------------------------
-- Ölçüldü: sınır yoktu, üst üste 5 sahte başvuru geçti.

create unique index if not exists applications_bekleyen_tekil_idx
  on public.applications (organization_id, lower(applicant_email))
  where status = 'pending';

create or replace function public.applications_rate_limit()
returns trigger
language plpgsql
set search_path = ''
as $fn$
declare v_saatlik int;
begin
  select count(*) into v_saatlik
    from public.applications a
   where a.organization_id = new.organization_id
     and a.created_at > now() - interval '1 hour';

  if v_saatlik >= 20 then
    raise exception 'Bu kuruma son bir saatte cok fazla basvuru yapildi. Lutfen daha sonra tekrar deneyin.'
      using errcode = 'P0001';
  end if;

  return new;
end;
$fn$;

drop trigger if exists applications_rate_limit_trg on public.applications;
create trigger applications_rate_limit_trg
  before insert on public.applications
  for each row execute function public.applications_rate_limit();

-- ---------------------------------------------------------------------------
-- 6) Başvurular da denetim kaydına girsin
-- ---------------------------------------------------------------------------
-- Başvuruyu kimin onayladığı/reddettiği izlenebilir olmalı.

drop trigger if exists audit_applications_trg on public.applications;
create trigger audit_applications_trg
  after insert or update or delete on public.applications
  -- reviewed_by, auth.users'a degil PROFILES'a bakiyor (FK ile dogrulandi).
  for each row execute function public.audit_row_change('reviewed_by', 'profile');
