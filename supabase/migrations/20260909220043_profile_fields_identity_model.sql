-- ============================================================================
-- FAZ 1 / ADIM 1 — Alan bazlı gizlilik modeli (EKLEYİCİ, güvenle uygulanır)
-- ============================================================================
--
-- Bu migration MEVCUT SİTEYİ ETKİLEMEZ. Yalnızca yeni tablo + yeni fonksiyon
-- ekler. Anon erişiminin kaldırılması AYRI bir migration'dadır
-- (…_cutover_lock_anon_reads.sql) ve yalnızca yeni arayüz dağıtılırken
-- uygulanmalıdır.
--
-- NEDEN:
--   Bugün gizlilik yalnızca React render'ında uygulanıyor:
--     {profile.show_email !== false && <span>{profile.email}</span>}
--   Veri sunucudan her hâlükârda geliyor; "kapalı" alan ağ sekmesinde açıkça
--   görünüyor. Doğrulandı: show_email=false olan kullanıcının e-postası
--   /rest/v1/profiles yanıtında dönüyor.
--
--   Kural: İSTEMCİYE GÖNDERİLMEYEN VERİ GİZLİDİR.
--          GÖNDERİLİP JSX'TE GİZLENEN VERİ GİZLİ DEĞİLDİR.
--
-- TASARIM KARARI — değer nerede durur?
--   Bilinen profil kolonları (email, phone, title …) için DEĞER `profiles`
--   tablosunda kalır; `profile_fields` yalnızca GÖRÜNÜRLÜĞÜ taşır. Böylece
--   Dashboard'daki tüm mevcut düzenleme yolları (profil kaydetme, katalog ve
--   hizmet modalleri, Google yorum linki) hiç değişmeden çalışmaya devam eder.
--   Serbest/özel alanlar ise kendi değerini `field_value` içinde taşır.
--   Faz 3'te değerler kademeli olarak bu tabloya taşınabilir.
--
-- Bkz. QRtım Güvenlik Denetimi 2026-09-09, bulgular K-1 / K-2 / Y-2 / Y-4 / O-6.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Alanlar tablosu
-- ---------------------------------------------------------------------------

create table if not exists public.profile_fields (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,

  field_key     text not null,          -- 'email' | 'phone' | 'title' | özel ad
  -- Bilinen profil kolonları için null (değer profiles'ta).
  -- Özel alanlar için değerin kendisi.
  field_value   jsonb,

  -- Görünürlük. Varsayılan EN KAPALI seviye: yeni alan kazara yayımlanmaz.
  visibility    text not null default 'private'
                check (visibility in ('public','link_only','on_request','private')),

  -- Seçici ifşa: değeri paylaşmadan "doğrulanmış" bilgisini paylaşmak için.
  verified_at   timestamptz,
  verify_method text check (verify_method in ('otp_sms','otp_email','kurum','kep','manuel')),

  -- Bağlam profili: aynı kimlikten farklı yüzler (İş / Kişisel / Etkinlik).
  persona       text not null default 'default',

  display_order int  not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  unique (profile_id, field_key, persona)
);

create index if not exists profile_fields_lookup_idx
  on public.profile_fields (profile_id, persona, visibility);

comment on table public.profile_fields is
  'Dijital kimlik alanları. Görünürlük veriyle birlikte saklanır ve SUNUCUDA uygulanır (get_public_card). anon için politika YOKTUR.';
comment on column public.profile_fields.field_value is
  'Bilinen profil kolonları için NULL (değer profiles''ta). Özel alanlar için değerin kendisi.';
comment on column public.profile_fields.visibility is
  'public=herkes · link_only=linki olan, dizinlenmez · on_request=karşılıklı onay · private=yalnız sahibi';

-- RLS: sahibi kendi alanlarını yönetir. anon'a POLİTİKA YOK => erişim yok.
alter table public.profile_fields enable row level security;

drop policy if exists profile_fields_owner_all on public.profile_fields;
create policy profile_fields_owner_all
  on public.profile_fields for all
  to authenticated
  using      (profile_id in (select id from public.profiles where user_id = auth.uid()))
  with check (profile_id in (select id from public.profiles where user_id = auth.uid()));

create or replace function public.touch_profile_fields()
  returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.touch_profile_fields() from public, anon, authenticated;

drop trigger if exists trg_touch_profile_fields on public.profile_fields;
create trigger trg_touch_profile_fields
  before update on public.profile_fields
  for each row execute function public.touch_profile_fields();

-- ---------------------------------------------------------------------------
-- 2) Mevcut kullanıcılar için görünürlük satırları — DAVRANIŞ BİREBİR KORUNUR
-- ---------------------------------------------------------------------------
-- Bugün kartta ne görünüyorsa yarın da o görünsün: halihazırda koşulsuz
-- yayımlanan alanlar 'public'. Tek istisna e-posta — kullanıcının show_email
-- tercihi neyse o uygulanır (ilk kez GERÇEKTEN uygulanmış olur).

insert into public.profile_fields (profile_id, field_key, visibility, display_order)
select p.id, v.key,
       case
         when v.key = 'email'
           then case when coalesce(p.show_email, false) then 'public' else 'private' end
         else 'public'
       end,
       v.ord
from public.profiles p
cross join (values
  ('email', 10), ('phone', 20), ('title', 30), ('company', 40),
  ('bio', 50), ('google_review_link', 60), ('catalog_links', 70), ('services', 80)
) as v(key, ord)
on conflict (profile_id, field_key, persona) do nothing;

-- ---------------------------------------------------------------------------
-- 3) Yeni kullanıcılar için gizlilik-önce varsayılanlar
-- ---------------------------------------------------------------------------
-- Yeni kayıtta iletişim bilgisi KAPALI başlar; kullanıcı bilinçli olarak açar.
-- Ürünün vaadi bu: "paylaşmak istediğimi açarım, istemediğimi kapalı tutarım."

create or replace function public.seed_profile_field_defaults()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profile_fields (profile_id, field_key, visibility, display_order)
  values
    (new.id, 'email',              'private', 10),
    (new.id, 'phone',              'private', 20),
    (new.id, 'title',              'public',  30),
    (new.id, 'company',            'public',  40),
    (new.id, 'bio',                'public',  50),
    (new.id, 'google_review_link', 'public',  60),
    (new.id, 'catalog_links',      'public',  70),
    (new.id, 'services',           'public',  80)
  on conflict (profile_id, field_key, persona) do nothing;
  return new;
end;
$$;
revoke all on function public.seed_profile_field_defaults() from public, anon, authenticated;

drop trigger if exists trg_seed_profile_field_defaults on public.profiles;
create trigger trg_seed_profile_field_defaults
  after insert on public.profiles
  for each row execute function public.seed_profile_field_defaults();

-- ---------------------------------------------------------------------------
-- 4) Public kartın TEK giriş noktası
-- ---------------------------------------------------------------------------
-- Bundan sonra anon istemci profiles/social_links/members/organizations
-- tablolarına HİÇ dokunmaz. Görünürlük filtresi burada, sunucuda uygulanır.

create or replace function public.get_public_card(
  p_username text,
  p_persona  text default 'default'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_p         public.profiles%rowtype;
  v_vis       jsonb;
  v_fields    jsonb := '{}'::jsonb;
  v_custom    jsonb;
  v_verified  jsonb;
  v_links     jsonb;
  v_orgs      jsonb;
  v_plan      text;
  v_org_limit int;
begin
  if p_username is null or length(p_username) > 100 then
    return null;
  end if;

  select * into v_p from public.profiles where username = p_username;
  if not found then
    return null;
  end if;

  -- Alan -> görünürlük haritası
  select coalesce(jsonb_object_agg(f.field_key, f.visibility), '{}'::jsonb)
    into v_vis
  from public.profile_fields f
  where f.profile_id = v_p.id and f.persona = p_persona;

  -- Bilinen kolonlar: değer profiles'tan, görünürlük haritadan.
  -- Görünürlük satırı hiç yoksa alan YAYIMLANMAZ (güvenli varsayılan).
  if v_vis->>'email' = 'public' and coalesce(v_p.email, '') <> '' then
    v_fields := v_fields || jsonb_build_object('email', v_p.email);
  end if;
  if v_vis->>'phone' = 'public' and coalesce(v_p.phone, '') <> '' then
    v_fields := v_fields || jsonb_build_object('phone', v_p.phone);
  end if;
  if v_vis->>'title' = 'public' and coalesce(v_p.title, '') <> '' then
    v_fields := v_fields || jsonb_build_object('title', v_p.title);
  end if;
  if v_vis->>'company' = 'public' and coalesce(v_p.company, '') <> '' then
    v_fields := v_fields || jsonb_build_object('company', v_p.company);
  end if;
  if v_vis->>'bio' = 'public' and coalesce(v_p.bio, '') <> '' then
    v_fields := v_fields || jsonb_build_object('bio', v_p.bio);
  end if;
  if v_vis->>'google_review_link' = 'public'
     and coalesce(v_p.google_review_link, '') <> '' then
    v_fields := v_fields || jsonb_build_object('google_review_link', v_p.google_review_link);
  end if;
  if v_vis->>'catalog_links' = 'public'
     and jsonb_typeof(v_p.catalog_links) = 'array' then
    v_fields := v_fields || jsonb_build_object('catalog_links', v_p.catalog_links);
  end if;
  if v_vis->>'services' = 'public'
     and jsonb_typeof(v_p.services) = 'array' then
    v_fields := v_fields || jsonb_build_object('services', v_p.services);
  end if;

  -- Özel alanlar: değerini kendisi taşır.
  select coalesce(jsonb_object_agg(f.field_key, f.field_value), '{}'::jsonb)
    into v_custom
  from public.profile_fields f
  where f.profile_id = v_p.id
    and f.persona    = p_persona
    and f.visibility = 'public'
    and f.field_value is not null
    and jsonb_typeof(f.field_value) <> 'null'
    and f.field_key not in ('email','phone','title','company','bio',
                            'google_review_link','catalog_links','services');
  v_fields := v_fields || v_custom;

  -- Seçici ifşa: doğrulanmış alan ADLARI (değerleri değil). Gizli bir alanın
  -- doğrulanmış olduğu bilgisi paylaşılabilir; değeri paylaşılmaz.
  select coalesce(jsonb_agg(f.field_key), '[]'::jsonb)
    into v_verified
  from public.profile_fields f
  where f.profile_id  = v_p.id
    and f.persona     = p_persona
    and f.verified_at is not null;

  -- Yalnızca güvenli şemalar dışarı verilir (bkz. bulgu Y-5).
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', s.id, 'platform', s.platform, 'url', s.url
         ) order by s.display_order), '[]'::jsonb)
    into v_links
  from public.social_links s
  where s.profile_id = v_p.id
    and s.url ~* '^https?://';

  v_plan := coalesce(v_p.subscription_plan, 'free');
  v_org_limit := case
    when v_plan in ('professional','stk','business','student','corporate') then 999
    else 2
  end;

  select coalesce(jsonb_agg(t.o), '[]'::jsonb) into v_orgs
  from (
    select jsonb_build_object(
             'id', og.id, 'name', og.name, 'type', og.type,
             'description', og.description, 'logo_url', og.logo_url,
             'phone', og.phone, 'email', og.email, 'website', og.website,
             'address', og.address, 'city', og.city,
             'role', m.role
           ) as o
    from public.members m
    join public.organizations og on og.id = m.organization_id
    where m.profile_id = v_p.id
    order by og.name
    limit v_org_limit
  ) t;

  return jsonb_build_object(
    'id',                   v_p.id,
    'username',             v_p.username,
    'name',                 v_p.name,
    'avatar_url',           v_p.avatar_url,
    'avatar_3d_url',        v_p.avatar_3d_url,
    'background_image_url', v_p.background_image_url,
    'theme_color',          v_p.theme_color,
    'theme_style',          v_p.theme_style,
    'referral_code',        v_p.referral_code,
    'fields',               v_fields,
    'verified_fields',      v_verified,
    'social_links',         v_links,
    'organizations',        v_orgs,
    'payment',              public.get_card_payment_info(p_username)
  );
end;
$$;

revoke all on function public.get_public_card(text, text) from public;
grant execute on function public.get_public_card(text, text) to anon, authenticated;

comment on function public.get_public_card(text, text) is
  'Public kartın tek veri kaynağı. Yalnızca visibility=public alanları döndürür; gizli alanlar istemciye HİÇ ulaşmaz.';

-- ---------------------------------------------------------------------------
-- 5) Görüntülenme sayacı (bulgu O-6)
-- ---------------------------------------------------------------------------
-- Sayaç bugüne kadar istemciden profiles.update ile artırılmaya çalışıyordu;
-- anon için RLS bunu engelliyor, 0 satır etkiliyor ve HATA DA FIRLATMIYOR.
-- Yani giriş yapmamış ziyaretçiler hiç sayılmadı. Sayaç artık sunucuda.

create or replace function public.increment_card_view(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_username is null or length(p_username) > 100 then
    return;
  end if;
  update public.profiles
     set card_views     = coalesce(card_views, 0) + 1,
         last_viewed_at = now()
   where username = p_username;
end;
$$;

revoke all on function public.increment_card_view(text) from public;
grant execute on function public.increment_card_view(text) to anon, authenticated;

comment on function public.increment_card_view(text) is
  'Kart görüntülenme sayacı. İstemciden profiles.update denemesi RLS''e takılıp sessizce başarısız oluyordu (bulgu O-6).';
