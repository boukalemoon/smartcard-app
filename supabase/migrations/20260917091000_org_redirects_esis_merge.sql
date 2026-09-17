-- ============================================================================
-- MÜKERRER ORGANİZASYONLAR + ÜYE KİMLİK VERİSİ
-- ============================================================================
--
-- 1) ESİS MÜKERRERLERİ (kullanıcı onayı, 17.09.2026)
--    Aynı sendika için üç kayıt, eski organizasyon oluşturma hatasından:
--      03e1e9da  "Espor İşverenleri Sendikası"         30.01 21:38  0 üye, 3 başvuru
--      fde2b87d  "Esis"                                30.01 21:50  0 üye, 0 başvuru
--      cba31b6e  "Espor İşverenleri Sendikası - ESİS"  01.02 20:03  1 üye (yönetici)  ← KALAN
--
--    Başvurular SİLİNMEDİ, taşındı: başvuranlar (abdul@, wervf@, selim@gmail.com)
--    kullanıcının hesabına bağlı değil. Başkalarına ait olabilecek başvuru
--    verisini tahminle silmek yerine yöneticinin görebileceği kayda taşındı;
--    panelden silinebilir.
--
-- 2) ESKİ BAĞLANTILAR KIRILMASIN
--    Başvuru ve üye rehberi adresi doğrudan organizasyon kimliğini kullanıyor
--    (/org/<kimlik>/apply). 3 başvuru eski kaydın kimliğiyle gelmiş; o bağlantı
--    bir yerde paylaşılmış olabilir. Silinen kimlik yenisine yönlendiriliyor.
--
-- 3) "Üye <email@example.com>"
--    9 organizasyonun 9 yöneticisi de kurumsal panelde bu yer tutucuyla
--    görünüyordu. Sebep: members.name varsayılanı 'Üye'; katılma ve başvuru
--    onaylama kodu ad/e-posta göndermiyor. Hata yeni üyelerde de sürüyordu.
--
--    GİZLİLİK: profildeki e-posta üye kaydına KÖRÜ KÖRÜNE kopyalanmaz. Kişi
--    e-postasını gizli işaretlediyse organizasyonun diğer üyelerine de
--    açılmamalı. Ad her zaman profilden, e-posta yalnızca paylaşıma açıksa.

-- ---------------------------------------------------------------------------
-- Yönlendirme tablosu
-- ---------------------------------------------------------------------------

create table if not exists public.organization_redirects (
  old_id     uuid primary key,
  new_id     uuid not null references public.organizations(id) on delete cascade,
  reason     text,
  created_at timestamptz not null default now()
);

comment on table public.organization_redirects is
  'Birleştirilen/silinen organizasyonun eski kimliği. Paylaşılmış bağlantılar kırılmasın diye.';

alter table public.organization_redirects enable row level security;
-- Politika yok: yalnızca SECURITY DEFINER herkese açık fonksiyonlar okur.

create or replace function public.resolve_organization_id(p_org_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $fn$
  select coalesce((select r.new_id from public.organization_redirects r where r.old_id = p_org_id),
                  p_org_id);
$fn$;

revoke all on function public.resolve_organization_id(uuid) from public, anon, authenticated;

create or replace function public.get_public_organization(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_o  public.organizations%rowtype;
  v_id uuid;
begin
  if p_org_id is null then return null; end if;
  v_id := public.resolve_organization_id(p_org_id);
  select * into v_o from public.organizations where id = v_id;
  if not found then return null; end if;
  if not public.is_stk_org_type(v_o.type) then
    return null;
  end if;
  -- 'id' HER ZAMAN güncel kimliktir: form bununla başvuru gönderir.
  return jsonb_build_object(
    'id',          v_o.id,
    'name',        public.unquote_text(v_o.name),
    'type',        public.unquote_text(v_o.type),
    'description', public.unquote_text(v_o.description),
    'logo_url',    v_o.logo_url,
    'website',     v_o.website,
    'city',        public.unquote_text(v_o.city),
    'theme_color', v_o.theme_color,
    'allow_public_directory',
      coalesce((v_o.settings->>'allowPublicDirectory')::boolean, false),
    'auto_approve',
      coalesce((v_o.settings->>'autoApprove')::boolean, false)
  );
end;
$fn$;

create or replace function public.get_public_org_members(p_org_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $fn$
declare
  v_o            public.organizations%rowtype;
  v_id           uuid;
  v_show_contact boolean;
  v_rows         jsonb;
begin
  if p_org_id is null then return '[]'::jsonb; end if;
  v_id := public.resolve_organization_id(p_org_id);
  select * into v_o from public.organizations where id = v_id;
  if not found then return '[]'::jsonb; end if;
  if not public.is_stk_org_type(v_o.type) then
    return '[]'::jsonb;
  end if;
  if not coalesce((v_o.settings->>'allowPublicDirectory')::boolean, false) then
    return '[]'::jsonb;
  end if;
  if lower(coalesce(v_o.settings->>'memberVisibility', 'members_only')) <> 'public' then
    return '[]'::jsonb;
  end if;
  v_show_contact := coalesce((v_o.settings->>'showMemberContact')::boolean, false);
  select coalesce(jsonb_agg(t.r order by t.r->>'name'), '[]'::jsonb) into v_rows
  from (
    select jsonb_build_object(
             'id',    m.id,
             'name',  public.unquote_text(m.name),
             'role',  public.unquote_text(m.role),
             'email', case when v_show_contact then public.unquote_text(m.email) end,
             'phone', case when v_show_contact then public.unquote_text(m.phone) end
           ) as r
    from public.members m
    where m.organization_id = v_id
      and lower(coalesce(public.unquote_text(m.status), 'active')) = 'active'
  ) t;
  return v_rows;
end;
$fn$;

-- ---------------------------------------------------------------------------
-- ESİS birleştirme (kimlikler yoksa hiçbir şey yapmaz)
-- ---------------------------------------------------------------------------

do $mig$
declare
  v_kalan  constant uuid := 'cba31b6e-beef-423b-a116-5c6afd770f48';
  v_eski   uuid;
  v_tasi   int;
begin
  if not exists (select 1 from public.organizations where id = v_kalan) then
    raise notice 'ESİS birleştirme atlandı: hedef kayıt yok';
    return;
  end if;

  foreach v_eski in array array['03e1e9da-8f0d-46d6-80dc-0e87005681f0',
                                'fde2b87d-f0fa-4468-8613-ccb507d20973']::uuid[]
  loop
    if not exists (select 1 from public.organizations where id = v_eski) then
      continue;
    end if;

    -- Güvenlik: üyesi olan bir kaydı asla bu yolla silme.
    if exists (select 1 from public.members where organization_id = v_eski) then
      raise exception 'Birleştirme durduruldu: % kaydında üye var', v_eski;
    end if;

    update public.applications set organization_id = v_kalan where organization_id = v_eski;
    get diagnostics v_tasi = row_count;

    insert into public.organization_redirects (old_id, new_id, reason)
    values (v_eski, v_kalan, 'ESİS mükerrer kaydı birleştirildi (17.09.2026)')
    on conflict (old_id) do nothing;

    perform public.log_event('organization.merged', null, 'qrtim', 'organization', v_eski::text,
                             'success', 'warning', 'internal',
                             jsonb_build_object('hedef', v_kalan, 'tasinan_basvuru', v_tasi,
                                                'gerekce', 'kullanici_talebi_mukerrer_kayit'),
                             'system');

    delete from public.organizations where id = v_eski;
  end loop;
end
$mig$;

-- ---------------------------------------------------------------------------
-- Üye kimlik verisi — profilden, gizliliğe saygılı
-- ---------------------------------------------------------------------------

create or replace function public.members_fill_from_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_ad       text;
  v_eposta   text;
  v_acik     boolean;
begin
  if new.profile_id is null then
    return new;
  end if;

  select p.name, p.email into v_ad, v_eposta
    from public.profiles p where p.id = new.profile_id;

  -- Kişinin e-postası kartında paylaşıma açık mı?
  select exists (select 1 from public.profile_fields f
                  where f.profile_id = new.profile_id and f.field_key = 'email'
                    and f.persona = 'default' and f.visibility = 'public')
    into v_acik;

  if new.name is null or btrim(new.name) = '' or new.name = 'Üye' then
    new.name := nullif(btrim(coalesce(v_ad, '')), '');
  end if;

  if new.email is null or btrim(new.email) = '' or new.email = 'email@example.com' then
    new.email := case when v_acik then v_eposta else null end;
  end if;

  return new;
end;
$fn$;

revoke all on function public.members_fill_from_profile() from public, anon, authenticated;

drop trigger if exists members_fill_from_profile_trg on public.members;
create trigger members_fill_from_profile_trg
  before insert or update of profile_id, name, email on public.members
  for each row execute function public.members_fill_from_profile();

alter table public.members alter column name drop default;

-- Mevcut yer tutucular: tetikleyiciyi çalıştırmak için değerleri boşalt.
update public.members
   set name  = case when name  = 'Üye'               then null else name  end,
       email = case when email = 'email@example.com' then null else email end
 where profile_id is not null
   and (name = 'Üye' or email = 'email@example.com');
