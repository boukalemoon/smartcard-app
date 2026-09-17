-- ============================================================================
-- ENTEGRASYON KATMANI — genel model + iddia doğrulama (EKLEYİCİ, güvenli)
-- ============================================================================
--
-- Mevcut hiçbir tabloya, fonksiyona veya Edge Function'a DOKUNULMAZ. Arku,
-- Tınga ve İlgezdi akışları olduğu gibi çalışmaya devam eder. Bu migration
-- yalnızca yeni tablolar ve yeni fonksiyonlar ekler; göç ayrı bir adımdır.
--
-- NEDEN:
--   Bugün her partner kendi tablolarını ve kendi Edge Function'ını alıyor:
--     ilgezdi_profiles · ilgezdi_qr_sessions · ilgezdi_sync_data
--     partner_tokens · partner_link_tokens · partner_user_links · partner_connections
--     arku-link · tinga-link · ilgezdi-qr · partner-check-user · partner-verify-token
--   Aynı kavram için üç jeton tablosu, aynı işi yapan beş fonksiyon var; bir
--   partner'a e-posta doğrulaması eklemek beşine ayrı ayrı dokunmayı gerektirdi.
--   Turnike, İK, CRM gibi yeni sistemler bu düzende her seferinde yeni tablo +
--   yeni dağıtım demek.
--
--   Bu katmanda partner adı KODA GÖMÜLMEZ, VERİ OLUR:
--   yeni entegrasyon = bir satır, bir dağıtım değil.
--
-- KİLİT FİKİR — sorgu değil, İDDİA:
--   Bir turnike kimin geçtiğini bilmek zorunda değildir; tek ihtiyacı bir
--   evet/hayır: "bu kişi bu kurumun aktif üyesi mi?". verify_claim() yalnızca
--   bunu döndürür. Kişisel veri hiç dışarı çıkmaz. Bu, kartta uyguladığımız
--   seçici ifşanın makineye uygulanmış hâlidir.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 1) Sağlayıcı kataloğu
-- ---------------------------------------------------------------------------
create table if not exists public.integration_providers (
  key          text primary key,                  -- 'arku' | 'tinga' | 'turnike_x'
  name         text not null,
  kind         text not null
               check (kind in ('sso','access_control','hr','crm','signal','other')),
  capabilities jsonb not null default '{}'::jsonb, -- {sso,events,sync,provision}
  config_schema jsonb,                             -- kurulumda istenecek alanlar
  is_active    boolean not null default true,
  created_at   timestamptz not null default now()
);

comment on table public.integration_providers is
  'Entegrasyon kataloğu. Yeni bir sistem eklemek = buraya bir satır. Kod değişmez.';

-- ---------------------------------------------------------------------------
-- 2) Kurulumlar
-- ---------------------------------------------------------------------------
-- SIR YOK: API anahtarları Supabase secret''ta durur, burada yalnızca referans
-- adı tutulur. Tabloya sır yazılmaz.

create table if not exists public.integrations (
  id            uuid primary key default gen_random_uuid(),
  provider_key  text not null references public.integration_providers(key),

  owner_kind    text not null check (owner_kind in ('org','profile')),
  owner_id      uuid not null,                    -- organizations.id | profiles.id

  config        jsonb not null default '{}'::jsonb,
  secret_ref    text,                             -- Supabase secret ADI (değeri değil)

  -- Bu entegrasyonun sorabileceği iddia türleri. Boşsa hiçbir şey soramaz.
  allowed_claim_kinds text[] not null default '{}',

  status        text not null default 'active'
                check (status in ('active','paused','revoked')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists integrations_owner_idx
  on public.integrations (owner_kind, owner_id);

comment on column public.integrations.secret_ref is
  'Supabase secret ADI. Sır değeri BU TABLOYA YAZILMAZ.';
comment on column public.integrations.allowed_claim_kinds is
  'Sorabileceği iddia türleri: org_member, org_role, field_verified. Boş = hiçbiri.';

-- ---------------------------------------------------------------------------
-- 3) Alan kapsamı
-- ---------------------------------------------------------------------------
-- field_key, profile_fields ile AYNI anahtar uzayını kullanır. Bu kasıtlıdır:
-- entegrasyon da yalnızca bir tüketicidir, ikinci bir izin sistemi kurmuyoruz.

create table if not exists public.integration_scopes (
  integration_id uuid not null references public.integrations(id) on delete cascade,
  field_key      text not null,
  direction      text not null check (direction in ('read','write')),
  granted_at     timestamptz not null default now(),
  primary key (integration_id, field_key, direction)
);

-- ---------------------------------------------------------------------------
-- 4) Kimlik eşlemesi
-- ---------------------------------------------------------------------------
-- partner_connections + partner_user_links + ilgezdi_profiles'ın genel hâli.
-- ilgezdi_profiles bir PROFİL AYNASIYDI — QRtım'da zaten olan veriyi ikinci kez
-- tutuyordu. Burada yalnızca eşleme tutulur, veri kopyalanmaz.

create table if not exists public.identity_links (
  id             uuid primary key default gen_random_uuid(),
  qrtim_uid      uuid not null references public.qrtim_user_ids(qrtim_uid) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,

  external_id    text not null,                   -- karşı sistemdeki kimlik
  external_ref   jsonb not null default '{}'::jsonb,

  -- Sinyal/olay yazma kimliği (partner_user_links.link_secret'ın genel hâli)
  link_secret    text unique not null default encode(gen_random_bytes(32), 'hex'),

  linked_at      timestamptz not null default now(),
  last_seen      timestamptz,
  revoked_at     timestamptz,

  unique (integration_id, external_id),
  unique (integration_id, qrtim_uid)
);

create index if not exists identity_links_uid_idx on public.identity_links (qrtim_uid);

-- ---------------------------------------------------------------------------
-- 5) Bağlama jetonları
-- ---------------------------------------------------------------------------
-- partner_tokens + partner_link_tokens'ın yerini alacak tek tablo.
-- (Göç ayrı adım; şimdilik yan yana durur.)

create table if not exists public.link_tokens (
  token          text primary key,
  qrtim_uid      uuid not null references public.qrtim_user_ids(qrtim_uid) on delete cascade,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  created_at     timestamptz not null default now(),
  expires_at     timestamptz not null,
  used_at        timestamptz
);

create index if not exists link_tokens_uid_idx on public.link_tokens (qrtim_uid);

-- ---------------------------------------------------------------------------
-- 6) Gelen olaylar
-- ---------------------------------------------------------------------------
-- Turnike geçişi, kart okutma, İK değişikliği — hepsi buraya normalize edilir.

create table if not exists public.integration_events (
  id             bigint generated always as identity primary key,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  qrtim_uid      uuid references public.qrtim_user_ids(qrtim_uid) on delete set null,
  external_id    text,
  event_type     text not null,                   -- 'access.granted' | 'access.denied' | …
  payload        jsonb not null default '{}'::jsonb,
  occurred_at    timestamptz not null default now(),
  received_at    timestamptz not null default now(),
  processed_at   timestamptz
);

create index if not exists integration_events_lookup_idx
  on public.integration_events (integration_id, occurred_at desc);
create index if not exists integration_events_uid_idx
  on public.integration_events (qrtim_uid, occurred_at desc);

-- ---------------------------------------------------------------------------
-- 7) Uygulama durumu
-- ---------------------------------------------------------------------------
-- ilgezdi_sync_data (settings, bookmarks) bunun özel hâliydi.

create table if not exists public.integration_state (
  integration_id uuid not null references public.integrations(id) on delete cascade,
  qrtim_uid      uuid not null references public.qrtim_user_ids(qrtim_uid) on delete cascade,
  namespace      text not null,                   -- 'sync' | 'settings' | 'bookmarks'
  data           jsonb not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  primary key (integration_id, qrtim_uid, namespace)
);

-- ---------------------------------------------------------------------------
-- 8) İddia denetim günlüğü
-- ---------------------------------------------------------------------------
-- Kim, ne zaman, hangi iddiayı sordu. Hem denetlenebilirlik hem KVKK'nın
-- veri sahibi haklarına yanıt üretebilmek için.

create table if not exists public.claim_checks (
  id             bigint generated always as identity primary key,
  integration_id uuid not null references public.integrations(id) on delete cascade,
  qrtim_uid      uuid not null,
  claim          text not null,
  result         boolean not null,
  checked_at     timestamptz not null default now()
);

create index if not exists claim_checks_uid_idx on public.claim_checks (qrtim_uid, checked_at desc);

-- ---------------------------------------------------------------------------
-- RLS — hepsi kilitli
-- ---------------------------------------------------------------------------
-- Politika YOK => yalnızca service_role (Edge Function'lar) erişir.
-- Tek istisna aşağıda: kullanıcı KENDİ bağlantılarını ve KENDİ erişim
-- günlüğünü görebilir — bu bir şeffaflık özelliği.

alter table public.integration_providers enable row level security;
alter table public.integrations          enable row level security;
alter table public.integration_scopes    enable row level security;
alter table public.identity_links        enable row level security;
alter table public.link_tokens           enable row level security;
alter table public.integration_events    enable row level security;
alter table public.integration_state     enable row level security;
alter table public.claim_checks          enable row level security;

-- Kullanıcı kendi bağlantılarını görür (link_secret HARİÇ — aşağıdaki view ile).
drop policy if exists identity_links_self_read on public.identity_links;
create policy identity_links_self_read
  on public.identity_links for select to authenticated
  using (qrtim_uid in (
    select q.qrtim_uid from public.qrtim_user_ids q where q.user_id = auth.uid()
  ));

-- Kullanıcı kendisi hakkında sorulan iddiaları görür (şeffaflık).
drop policy if exists claim_checks_self_read on public.claim_checks;
create policy claim_checks_self_read
  on public.claim_checks for select to authenticated
  using (qrtim_uid in (
    select q.qrtim_uid from public.qrtim_user_ids q where q.user_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- 9) İDDİA DOĞRULAMA — katmanın kalbi
-- ---------------------------------------------------------------------------
-- Desteklenen iddialar:
--   org_member:<organizations.id>
--   org_role:<organizations.id>:<rol>
--   field_verified:<profile_fields.field_key>
--
-- Güvenlik kuralları:
--   • Entegrasyon yalnızca allowed_claim_kinds içindeki türleri sorabilir.
--   • Kuruma ait bir entegrasyon YALNIZCA KENDİ KURUMUNU sorabilir —
--     başka kurumları yoklayamaz.
--   • Dönen değer boolean'dır. Ad, e-posta, telefon, rol adı DIŞARI ÇIKMAZ.
--   • Bilinmeyen iddia hata vermez, false döner (bilgi sızdırmamak için).
--   • Her çağrı claim_checks'e yazılır.

create or replace function public.verify_claim(
  p_integration_id uuid,
  p_qrtim_uid      uuid,
  p_claim          text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_int    public.integrations%rowtype;
  v_kind   text;
  v_rest   text;
  v_org    uuid;
  v_role   text;
  v_pid    uuid;
  v_result boolean := false;
begin
  if p_integration_id is null or p_qrtim_uid is null or p_claim is null then
    return jsonb_build_object('result', false, 'error', 'eksik_parametre');
  end if;

  select * into v_int from public.integrations where id = p_integration_id;
  if not found or v_int.status <> 'active' then
    return jsonb_build_object('result', false, 'error', 'entegrasyon_yok');
  end if;

  -- Hız sınırı: aynı entegrasyon dakikada en fazla 600 iddia sorabilir.
  if not public.check_rate_limit('claim:' || p_integration_id::text, 600, 60) then
    return jsonb_build_object('result', false, 'error', 'hiz_siniri');
  end if;

  v_kind := split_part(p_claim, ':', 1);
  v_rest := substr(p_claim, length(v_kind) + 2);

  -- Entegrasyonun bu türü sorma yetkisi var mı?
  if not (v_kind = any (v_int.allowed_claim_kinds)) then
    insert into public.claim_checks (integration_id, qrtim_uid, claim, result)
      values (p_integration_id, p_qrtim_uid, p_claim, false);
    return jsonb_build_object('result', false, 'error', 'yetki_yok');
  end if;

  -- qrtim_uid -> profiles.id
  select p.id into v_pid
  from public.qrtim_user_ids q
  join public.profiles p on p.user_id = q.user_id
  where q.qrtim_uid = p_qrtim_uid;

  if v_pid is null then
    insert into public.claim_checks (integration_id, qrtim_uid, claim, result)
      values (p_integration_id, p_qrtim_uid, p_claim, false);
    return jsonb_build_object('result', false);
  end if;

  if v_kind = 'org_member' then
    begin
      v_org := v_rest::uuid;
    exception when others then
      v_org := null;
    end;

    -- Kuruma ait entegrasyon yalnızca KENDİ kurumunu sorabilir.
    if v_org is null
       or (v_int.owner_kind = 'org' and v_int.owner_id <> v_org) then
      v_result := false;
    else
      select exists (
        select 1 from public.members m
        where m.profile_id = v_pid
          and m.organization_id = v_org
          -- Tırnaklı kaydedilmiş status değerlerine tolerans ('active' vs active)
          and lower(coalesce(public.unquote_text(m.status), 'active')) = 'active'
      ) into v_result;
    end if;

  elsif v_kind = 'org_role' then
    begin
      v_org := split_part(v_rest, ':', 1)::uuid;
    exception when others then
      v_org := null;
    end;
    v_role := substr(v_rest, length(split_part(v_rest, ':', 1)) + 2);

    if v_org is null or v_role = ''
       or (v_int.owner_kind = 'org' and v_int.owner_id <> v_org) then
      v_result := false;
    else
      select exists (
        select 1 from public.members m
        where m.profile_id = v_pid
          and m.organization_id = v_org
          and lower(coalesce(public.unquote_text(m.role), '')) = lower(v_role)
          and lower(coalesce(public.unquote_text(m.status), 'active')) = 'active'
      ) into v_result;
    end if;

  elsif v_kind = 'field_verified' then
    select exists (
      select 1 from public.profile_fields f
      where f.profile_id = v_pid
        and f.field_key = v_rest
        and f.verified_at is not null
    ) into v_result;

  else
    -- Bilinmeyen iddia: hata değil, false. Bilgi sızdırmaz.
    v_result := false;
  end if;

  insert into public.claim_checks (integration_id, qrtim_uid, claim, result)
    values (p_integration_id, p_qrtim_uid, p_claim, v_result);

  return jsonb_build_object(
    'result',     v_result,
    'claim',      p_claim,
    'checked_at', now()
  );
end;
$$;

-- Yalnızca service_role. İstemci bunu doğrudan çağıramaz; entegrasyon kendi
-- kimliğiyle Edge Function üzerinden geçer.
revoke all on function public.verify_claim(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.verify_claim(uuid, uuid, text) to service_role;

comment on function public.verify_claim(uuid, uuid, text) is
  'İddia doğrulama. Yalnızca boolean döner; ad/e-posta/telefon/rol DIŞARI ÇIKMAZ. Her çağrı claim_checks''e yazılır.';

-- ---------------------------------------------------------------------------
-- 10) Mevcut partner''ları katalog'a taşı (yalnızca katalog, veri göçü değil)
-- ---------------------------------------------------------------------------
insert into public.integration_providers (key, name, kind, capabilities) values
  ('arku',    'Arku Remote',      'sso',    '{"sso":true}'::jsonb),
  ('tinga',   'Tınga',            'sso',    '{"sso":true,"signals":true}'::jsonb),
  ('ilgezdi', 'İlgezdi Tarayıcı', 'sso',    '{"sso":true,"sync":true}'::jsonb)
on conflict (key) do nothing;
