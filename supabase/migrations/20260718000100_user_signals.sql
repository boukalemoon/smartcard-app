-- Sinyal ingest altyapısı — Mini Ülgen'ler kullanıcı davranış/tercih
-- sinyallerini (dinlenen müzik, favori, arama vb.) QRtım/Supabase'e yazar;
-- Ana Ülgen bunları Ötüken'e çeker (qrtim_uid → ulgen_uid eşleştirmesiyle).
--
-- YAZMA YETKİSİ: Dağıtılan offline uygulamalarda paylaşılan API anahtarı
-- sızacağı için KULLANILMAZ. SSO sırasında kullanıcıya+uygulamaya özel kalıcı
-- link_secret üretilir; sinyal yazımı bununla doğrulanır (signal-ingest edge fn).
-- Tüm tablolar RLS açık + politika YOK => yalnız service_role (edge fn) erişir.

create extension if not exists pgcrypto;

-- Uygulama başına, kullanıcı başına kalıcı yazma kimliği (SSO'da üretilir)
create table if not exists public.partner_user_links (
  user_id      uuid not null references auth.users(id) on delete cascade,
  partner      text not null,
  link_secret  text unique not null default encode(gen_random_bytes(32), 'hex'),
  created_at   timestamptz not null default now(),
  last_seen    timestamptz,
  primary key (user_id, partner)
);
alter table public.partner_user_links enable row level security;
-- (politika yok => yalnız service_role)

-- Kullanıcı davranış/tercih sinyalleri
create table if not exists public.user_signals (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  partner     text not null,             -- tinga / ilgezdi / arku ...
  signal_type text not null,             -- play / favorite / genre / search ...
  payload     jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists user_signals_user_idx  on public.user_signals (user_id, created_at desc);
create index if not exists user_signals_pull_idx  on public.user_signals (id);
create index if not exists user_signals_type_idx  on public.user_signals (partner, signal_type);
alter table public.user_signals enable row level security;
-- (politika yok => yalnız service_role; Ana Ülgen service_role ile çeker)

comment on table public.partner_user_links is
  'Uygulama+kullanıcı başına kalıcı yazma kimliği (link_secret). SSO handshake''inde üretilir; signal-ingest bunu doğrular.';
comment on table public.user_signals is
  'Mini Ülgen''lerden gelen kullanıcı davranış/tercih sinyalleri. Ana Ülgen service_role ile Ötüken''e çeker.';
