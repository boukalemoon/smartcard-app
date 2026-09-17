-- ============================================================================
-- PROFİLLER (PERSONA) — dijital kimliğin kişi tarafından yönetilen yüzleri
-- ============================================================================
--
-- KULLANICININ TARİFİ (17.09.2026):
--   "Burak olarak ben İŞ profili oluşturup iş ile ilgili bilgilerimi
--    paylaşabilecek şekilde link oluşturabilmeliyim. Bireysel olarak bir
--    profil eklediğimde bireysel bilgilerimi belirleyip paylaşabilmeliyim.
--    QR paylaşırken önce seçim yapacak, sonra QR paylaşacak."
--
-- MEVCUT DURUM:
--   profile_fields zaten persona metni, kişiye özel değer ve görünürlük
--   taşıyordu; get_public_card persona parametresi alıyordu. Ama:
--     • Persona ADIYLA çağrılıyordu. İş kartını gören biri ".../bireysel"
--       deneyerek kişisel profile ulaşabilirdi.
--     • Sosyal bağlantılar, organizasyonlar, ödeme bilgisi, ad ve fotoğraf
--       persona'dan bağımsızdı: her kartta hepsi görünüyordu.
--     • Persona oluşturma/yönetme diye bir şey yoktu; tek persona 'default'.
--
-- TASARIM:
--   • Her profilin tek bir ANA persona'sı var: /card/<kullanıcı-adı> ve
--     basılmış NFC/QR kartlar onu gösterir. Ana persona değiştirilebilir.
--   • Diğer persona'lar TAHMİN EDİLEMEZ bir kodla paylaşılır: /k/<kod>.
--     Kod yenilenebilir → eski bağlantı ve QR anında geçersiz olur.
--   • Yeni persona'da hassas alanlar (e-posta, telefon, WhatsApp) hiçbir
--     şablonda kendiliğinden açık gelmez.
--   • Alan değeri persona'ya özel olabilir (iş e-postası ≠ kişisel e-posta);
--     boş bırakılırsa profildeki değer kullanılır.
--   • Persona türleri ve alan kataloğu VERİDİR: kategoriler birlikte
--     belirlenecek, migration gerektirmeden değişir.
--
-- CANLI SİTE UYUMLULUĞU:
--   Arayüz henüz dağıtılmadı. Eski FieldVisibilityManager persona='default'
--   ile yazmaya devam eder; ana persona satırları 'default' metnini korur.
--   Eski get_public_card(p_username) ve increment_card_view(p_username)
--   çağrıları aynen çalışır.

-- ===========================================================================
-- 1) Paylaşım kodu üretici
-- ===========================================================================

create or replace function public.new_share_code()
returns text
language plpgsql
volatile
set search_path = ''
as $fn$
declare
  -- Karıştırılabilen karakterler (0/O, 1/l/I) çıkarıldı: kod elle de yazılabilsin.
  v_alfabe constant text := 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_bayt   bytea := extensions.gen_random_bytes(12);
  v_kod    text := '';
begin
  for i in 0..11 loop
    v_kod := v_kod || substr(v_alfabe, 1 + (get_byte(v_bayt, i) % length(v_alfabe)), 1);
  end loop;
  return v_kod;   -- 56^12 ≈ 9.6e20 olasılık
end;
$fn$;

revoke all on function public.new_share_code() from public, anon, authenticated;

-- ===========================================================================
-- 2) Katalog: persona türleri ve alanlar (birlikte belirlenecek — veri)
-- ===========================================================================

create table if not exists public.persona_kinds (
  key            text primary key,
  label          text not null,
  description    text,
  default_fields text[] not null default '{}',
  sort_order     int not null default 0,
  is_active      boolean not null default true
);

comment on table public.persona_kinds is
  'Persona türleri. default_fields şablonda açık gelen alanlar; hassas alanlar hiçbir zaman otomatik açılmaz.';

insert into public.persona_kinds (key, label, description, default_fields, sort_order) values
  ('genel',    'Genel',                 'Herkese açık ana kartınız',              '{title,company,bio,website}', 10),
  ('is',       'İş',                    'İş bağlantılarınız için',                '{title,company,department,website,services,catalog_links,google_review_link}', 20),
  ('bireysel', 'Bireysel',              'Yakın çevreniz için',                    '{bio,city}', 30),
  ('akademik', 'Akademik',              'Akademik çevreniz için',                 '{title,company,department,website,bio}', 40),
  ('etkinlik', 'Etkinlik / Networking', 'Fuar, konferans ve buluşmalar için',     '{title,company,website}', 50),
  ('ozel',     'Özel',                  'Kendiniz tanımlayın',                    '{}', 90)
on conflict (key) do nothing;

create table if not exists public.profile_field_catalog (
  key         text primary key,
  category    text not null,
  label       text not null,
  value_type  text not null,
  base_column text,
  sensitive   boolean not null default false,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  constraint profile_field_catalog_category_chk
    check (category in ('iletisim','kariyer','kisisel','ticari')),
  constraint profile_field_catalog_type_chk
    check (value_type in ('text','longtext','email','phone','url','list')),
  -- Kart herkese açık: yalnızca bu kolonlar kaynak olabilir. role, referral_earnings
  -- gibi kolonlar yanlışlıkla kataloğa eklenip yayımlanamasın.
  constraint profile_field_catalog_base_chk
    check (base_column is null or base_column in
           ('email','phone','title','company','bio','services','catalog_links','google_review_link'))
);

comment on table public.profile_field_catalog is
  'Kartta gösterilebilecek alanlar. Kategoriler birlikte belirlenecek; yeni alan migration gerektirmez.';

insert into public.profile_field_catalog (key, category, label, value_type, base_column, sensitive, sort_order) values
  ('email',              'iletisim', 'E-posta',                 'email',    'email',              true,  10),
  ('phone',              'iletisim', 'Telefon',                 'phone',    'phone',              true,  20),
  ('whatsapp',           'iletisim', 'WhatsApp',                'phone',    null,                 true,  30),
  ('website',            'iletisim', 'Web sitesi',              'url',      null,                 false, 40),
  ('city',               'iletisim', 'Şehir',                   'text',     null,                 false, 50),
  ('title',              'kariyer',  'Ünvan',                   'text',     'title',              false, 60),
  ('company',            'kariyer',  'Şirket / Kurum',          'text',     'company',            false, 70),
  ('department',         'kariyer',  'Departman',               'text',     null,                 false, 80),
  ('bio',                'kisisel',  'Hakkımda',                'longtext', 'bio',                false, 90),
  ('services',           'ticari',   'Hizmetler',               'list',     'services',           false, 100),
  ('catalog_links',      'ticari',   'Katalog ve dökümanlar',   'list',     'catalog_links',      false, 110),
  ('google_review_link', 'ticari',   'Google yorum bağlantısı', 'url',      'google_review_link', false, 120)
on conflict (key) do nothing;

create table if not exists public.plan_features (
  plan          text primary key,
  persona_limit int not null check (persona_limit >= 1)
);

comment on table public.plan_features is
  'Plan özellik sınırları. Fiyat/paket revizyonunda güncellenecek.';

insert into public.plan_features (plan, persona_limit) values
  ('free', 2), ('student', 3), ('professional', 5), ('stk', 10), ('business', 10), ('corporate', 20)
on conflict (plan) do nothing;

alter table public.persona_kinds          enable row level security;
alter table public.profile_field_catalog  enable row level security;
alter table public.plan_features          enable row level security;

drop policy if exists "persona turleri okunur" on public.persona_kinds;
create policy "persona turleri okunur" on public.persona_kinds
  for select to anon, authenticated using (is_active);
drop policy if exists "alan katalogu okunur" on public.profile_field_catalog;
create policy "alan katalogu okunur" on public.profile_field_catalog
  for select to anon, authenticated using (is_active);
drop policy if exists "plan ozellikleri okunur" on public.plan_features;
create policy "plan ozellikleri okunur" on public.plan_features
  for select to authenticated using (true);

-- ===========================================================================
-- 3) Persona tablosu
-- ===========================================================================

create table if not exists public.personas (
  id                 uuid primary key default gen_random_uuid(),
  profile_id         uuid not null references public.profiles(id) on delete cascade,
  kind               text not null references public.persona_kinds(key),
  name               text not null,
  display_name       text,
  avatar_url         text,
  share_code         text not null default public.new_share_code(),
  is_primary         boolean not null default false,
  status             text not null default 'active',
  show_organizations boolean not null default false,
  show_payment       boolean not null default false,
  theme_color        text,
  sort_order         int not null default 0,
  view_count         bigint not null default 0,
  last_viewed_at     timestamptz,
  code_rotated_at    timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  constraint personas_name_chk         check (length(btrim(name)) between 1 and 40),
  constraint personas_display_name_chk check (display_name is null or length(display_name) <= 80),
  constraint personas_status_chk       check (status in ('active','paused')),
  constraint personas_ana_duraklatilamaz check (not (is_primary and status = 'paused')),
  constraint personas_id_profile_key   unique (id, profile_id)
);

create unique index if not exists personas_share_code_idx on public.personas (share_code);
create unique index if not exists personas_tek_ana_idx    on public.personas (profile_id) where is_primary;
create unique index if not exists personas_ad_tekil_idx   on public.personas (profile_id, lower(btrim(name)));

comment on column public.personas.share_code is
  'Tahmin edilemeyen paylaşım kodu (/k/<kod>). Yenilenince eski bağlantı ve QR geçersiz olur.';
comment on column public.personas.is_primary is
  'Ana persona: /card/<kullanıcı-adı> ve basılı NFC/QR kartlar bunu gösterir.';

alter table public.personas enable row level security;

drop policy if exists "kendi personalarini gorur" on public.personas;
create policy "kendi personalarini gorur" on public.personas
  for select to authenticated using (profile_id = public.my_profile_id());
-- Yazma yalnızca RPC ile (doğrulama + denetim kaydı).

drop trigger if exists audit_personas_trg on public.personas;
create trigger audit_personas_trg
  after insert or update or delete on public.personas
  for each row execute function public.audit_row_change('profile_id', 'profile');

-- Mevcut her profile ana persona (canlı kartın bugünkü davranışı korunur:
-- organizasyonlar ve ödeme bilgisi kendi ayarlarına göre görünmeye devam eder)
insert into public.personas (profile_id, kind, name, is_primary, show_organizations, show_payment)
select p.id, 'genel', 'Genel', true, true, true
  from public.profiles p
 where not exists (select 1 from public.personas x where x.profile_id = p.id and x.is_primary);

-- ===========================================================================
-- 4) profile_fields → persona'ya bağla
-- ===========================================================================

alter table public.profile_fields add column if not exists persona_id uuid;

update public.profile_fields f
   set persona_id = x.id
  from public.personas x
 where x.profile_id = f.profile_id and x.is_primary
   and f.persona_id is null and coalesce(f.persona, 'default') = 'default';

alter table public.profile_fields alter column persona_id set not null;

alter table public.profile_fields drop constraint if exists profile_fields_persona_fk;
alter table public.profile_fields
  add constraint profile_fields_persona_fk
  foreign key (persona_id, profile_id) references public.personas(id, profile_id) on delete cascade;

-- Bilinmeyen alan anahtarı yazılamaz; katalog dışı veri yayımlanamaz.
alter table public.profile_fields drop constraint if exists profile_fields_field_key_catalog_fk;
alter table public.profile_fields
  add constraint profile_fields_field_key_catalog_fk
  foreign key (field_key) references public.profile_field_catalog(key);

create unique index if not exists profile_fields_persona_alan_idx
  on public.profile_fields (persona_id, field_key);

-- Eski yazma yolu (persona='default', persona_id yok) ana persona'ya çözülür;
-- persona metni ana persona için 'default', diğerleri için kimlik olarak tutulur.
create or replace function public.profile_fields_resolve_persona()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_ana boolean;
begin
  if new.persona_id is null then
    if coalesce(new.persona, 'default') = 'default' then
      select x.id into new.persona_id from public.personas x
       where x.profile_id = new.profile_id and x.is_primary;
    else
      begin
        new.persona_id := new.persona::uuid;
      exception when others then
        new.persona_id := null;
      end;
    end if;
  end if;

  select x.is_primary into v_ana from public.personas x where x.id = new.persona_id;
  new.persona := case when coalesce(v_ana, false) then 'default' else new.persona_id::text end;
  return new;
end;
$fn$;

revoke all on function public.profile_fields_resolve_persona() from public, anon, authenticated;

drop trigger if exists profile_fields_resolve_persona_trg on public.profile_fields;
create trigger profile_fields_resolve_persona_trg
  before insert or update of persona, persona_id on public.profile_fields
  for each row execute function public.profile_fields_resolve_persona();

-- Ana persona'lara yeni katalog alanlarının satırları
insert into public.profile_fields (profile_id, persona_id, field_key, visibility, display_order)
select x.profile_id, x.id, c.key,
       case when c.sensitive then 'private' else 'public' end,
       c.sort_order
  from public.personas x
 cross join public.profile_field_catalog c
 where x.is_primary and c.is_active
   and not exists (select 1 from public.profile_fields f where f.persona_id = x.id and f.field_key = c.key);

-- ===========================================================================
-- 5) Sosyal bağlantılar → persona bazında
-- ===========================================================================

alter table public.social_links drop constraint if exists social_links_id_profile_key;
alter table public.social_links add constraint social_links_id_profile_key unique (id, profile_id);

create table if not exists public.persona_social_links (
  persona_id     uuid not null,
  profile_id     uuid not null,
  social_link_id uuid not null,
  created_at     timestamptz not null default now(),
  primary key (persona_id, social_link_id),
  -- Aynı profile ait olmayan persona ile bağlantı eşleştirilemez.
  foreign key (persona_id, profile_id)     references public.personas(id, profile_id) on delete cascade,
  foreign key (social_link_id, profile_id) references public.social_links(id, profile_id) on delete cascade
);

alter table public.persona_social_links enable row level security;
drop policy if exists "kendi persona baglantilarini gorur" on public.persona_social_links;
create policy "kendi persona baglantilarini gorur" on public.persona_social_links
  for select to authenticated using (profile_id = public.my_profile_id());

insert into public.persona_social_links (persona_id, profile_id, social_link_id)
select x.id, s.profile_id, s.id
  from public.social_links s
  join public.personas x on x.profile_id = s.profile_id and x.is_primary
on conflict do nothing;

-- Yeni eklenen bağlantı varsayılan olarak ana kartta görünür (bugünkü davranış).
create or replace function public.social_links_add_to_primary()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
begin
  insert into public.persona_social_links (persona_id, profile_id, social_link_id)
  select x.id, new.profile_id, new.id
    from public.personas x where x.profile_id = new.profile_id and x.is_primary
  on conflict do nothing;
  return null;
end;
$fn$;

revoke all on function public.social_links_add_to_primary() from public, anon, authenticated;

drop trigger if exists social_links_add_to_primary_trg on public.social_links;
create trigger social_links_add_to_primary_trg
  after insert on public.social_links
  for each row execute function public.social_links_add_to_primary();

-- ===========================================================================
-- 6) Yeni profil → ana persona + alanlar
-- ===========================================================================

create or replace function public.seed_profile_field_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $fn$
declare v_persona uuid;
begin
  insert into public.personas (profile_id, kind, name, is_primary, show_organizations, show_payment)
  values (new.id, 'genel', 'Genel', true, true, false)
  on conflict do nothing
  returning id into v_persona;

  if v_persona is null then
    select x.id into v_persona from public.personas x where x.profile_id = new.id and x.is_primary;
  end if;

  insert into public.profile_fields (profile_id, persona_id, field_key, visibility, display_order)
  select new.id, v_persona, c.key,
         case when c.sensitive then 'private' else 'public' end,
         c.sort_order
    from public.profile_field_catalog c
   where c.is_active
  on conflict do nothing;

  return new;
end;
$fn$;
