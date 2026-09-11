-- ============================================================================
-- FAZ 2 / ADIM 1 — Sunucu tarafı hız sınırlama (EKLEYİCİ, güvenle uygulanır)
-- ============================================================================
--
-- Bulgu Y-3: `src/utils/rateLimiting.js` bir JavaScript Map'i. Sayfa
-- yenilenince sıfırlanıyor, gizli sekmede yok, curl ile tamamen atlanıyor.
-- Dosyanın kendi başlığında "backend'de de rate limiting olmalı" yazıyor —
-- ama arkasındaki sunucu tarafı hiç yazılmamış. Yani fiilen koruma yoktu.
--
-- Bu migration, sunucuda çalışan ve atlanamayan bir sayaç kurar.
--
-- KAPSAM SINIRI — bu tablo GİRİŞ DENEMELERİNİ sınırlamaz:
--   Giriş/kayıt akışı Supabase Auth'un kendi uçlarına gider, bizim
--   fonksiyonlarımızdan geçmez. Oradaki sınırlar Supabase panelinden
--   ayarlanır: Authentication → Rate Limits. Ayrıca "Leaked password
--   protection" açılmalıdır (bulgu O-7).

-- ---------------------------------------------------------------------------
-- 1) Sayaç tablosu
-- ---------------------------------------------------------------------------
-- Sabit pencere (fixed window) sayacı: basit, ucuz ve bu iş için yeterli.
-- RLS açık + politika YOK => yalnızca SECURITY DEFINER fonksiyonlar erişir.

create table if not exists public.rate_limit_hits (
  bucket_key   text        not null,
  window_start timestamptz not null,
  hits         integer     not null default 1,
  primary key (bucket_key, window_start)
);

create index if not exists rate_limit_hits_window_idx
  on public.rate_limit_hits (window_start);

alter table public.rate_limit_hits enable row level security;

comment on table public.rate_limit_hits is
  'Sunucu tarafı hız sınırlama sayaçları (bulgu Y-3). Yalnızca SECURITY DEFINER fonksiyonlar erişir.';

-- ---------------------------------------------------------------------------
-- 2) İstemci IP'si
-- ---------------------------------------------------------------------------
-- PostgREST istek başlıklarını `request.headers` ayarında taşır. Vercel ve
-- Supabase önünde gerçek istemci IP'si x-forwarded-for'un İLK değeridir.
--
-- NOT: x-forwarded-for taklit edilebilir bir başlıktır; ancak Supabase'in
-- kenar katmanı onu kendisi yazdığı için buradaki değer güvenilirdir. Yine de
-- hız sınırı tek başına bir kimlik doğrulama sınırı değildir — savunma
-- katmanlarından biridir.

create or replace function public.request_client_ip()
returns text
language sql
stable
set search_path = ''
as $$
  select coalesce(
    nullif(
      btrim(split_part(
        nullif(current_setting('request.headers', true), '')::json->>'x-forwarded-for',
        ',', 1
      )),
      ''
    ),
    'bilinmeyen'
  );
$$;

revoke all on function public.request_client_ip() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3) Sınır kontrolü
-- ---------------------------------------------------------------------------
-- true  => isteğe izin ver
-- false => sınır aşıldı
--
-- Sayaç, sınır aşılsa bile artmaya devam eder; böylece ısrarlı bir istemci
-- pencere boyunca kapalı kalır (sadece ilk N'de değil).

create or replace function public.check_rate_limit(
  p_key            text,
  p_max            integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window timestamptz;
  v_hits   integer;
begin
  if p_key is null or p_max is null or p_window_seconds is null or p_window_seconds <= 0 then
    return true;                       -- yanlış kullanım isteği engellemesin
  end if;

  -- Pencerenin başlangıcına yuvarla
  v_window := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_hits as r (bucket_key, window_start, hits)
  values (left(p_key, 300), v_window, 1)
  on conflict (bucket_key, window_start)
    do update set hits = r.hits + 1
  returning r.hits into v_hits;

  return v_hits <= p_max;
end;
$$;

revoke all on function public.check_rate_limit(text, integer, integer) from public, anon, authenticated;
-- Edge Function'lar (signal-ingest vb.) bu sayacı service_role ile çağırır.
-- EXECUTE varsayılanı PUBLIC üzerinden geldiği için yukarıdaki revoke
-- service_role'ü de etkiler; bu yüzden açıkça geri veriliyor.
grant execute on function public.check_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- 4) Eski pencerelerin temizliği
-- ---------------------------------------------------------------------------
-- Tablo sınırsız büyümesin. pg_cron varsa zamanlanabilir; yoksa ara sıra elle
-- çağrılması yeterlidir (satırlar küçük ve indeksli).

create or replace function public.purge_rate_limit_hits(p_older_than interval default '1 day')
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted integer;
begin
  delete from public.rate_limit_hits
   where window_start < now() - p_older_than;
  get diagnostics v_deleted = row_count;
  return v_deleted;
end;
$$;

revoke all on function public.purge_rate_limit_hits(interval) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5) Kart uçlarına uygulanması
-- ---------------------------------------------------------------------------

-- Görüntülenme sayacı: aynı IP, aynı kartı saatte en fazla 10 kez sayabilir.
-- Sayfayı yenileyerek görüntülenme şişirmeyi ve analitiği kirletmeyi engeller.
-- Sınır aşıldığında sessizce döner — ziyaretçi için kart normal çalışır.
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

  if not public.check_rate_limit(
       'view:' || public.request_client_ip() || ':' || p_username, 10, 3600) then
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

-- Kart okuma: aynı IP 10 dakikada en fazla 120 kart açabilir. Normal gezinme
-- bu sınıra yaklaşmaz; toplu kazıma (scraping) durur.
--
-- NOT: Fonksiyon artık VOLATILE (STABLE değil) — sayaç yazması gerekiyor.
-- supabase-js .rpc() zaten POST kullandığı için istemci tarafında değişiklik
-- gerekmez.
create or replace function public.get_public_card(
  p_username text,
  p_persona  text default 'default'
)
returns jsonb
language plpgsql
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

  if not public.check_rate_limit(
       'card:' || public.request_client_ip(), 120, 600) then
    raise exception 'Çok fazla istek. Lütfen biraz bekleyin.'
      using errcode = '53400';
  end if;

  select * into v_p from public.profiles where username = p_username;
  if not found then
    return null;
  end if;

  select coalesce(jsonb_object_agg(f.field_key, f.visibility), '{}'::jsonb)
    into v_vis
  from public.profile_fields f
  where f.profile_id = v_p.id and f.persona = p_persona;

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

  select coalesce(jsonb_agg(f.field_key), '[]'::jsonb)
    into v_verified
  from public.profile_fields f
  where f.profile_id  = v_p.id
    and f.persona     = p_persona
    and f.verified_at is not null;

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
