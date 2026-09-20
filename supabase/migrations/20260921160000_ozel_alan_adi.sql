-- ============================================================================
-- ÖZEL ALAN ADI — kart kişinin kendi adresinde açılsın
-- ============================================================================
--
-- Linktree'de bu ücretli pakette ve orada tek yaptıkları DNS yönlendirmesi.
-- Bizde bir adım fazlası var: adresi bağlayabilmek için o alan adının SAHİBİ
-- olduğunu zaten kanıtlamış olman gerekiyor (identity_verifications). Yani
-- özel alan adı rozet sisteminin üstüne oturuyor; ayrı bir güven mekanizması
-- icat etmiyoruz.
--
-- UYGULAMA TARAFI: özel alan adında uygulamanın GERİ KALANI açılmaz, yalnızca
-- kart. Oturum tarayıcıda adrese göre ayrıldığı için, kişi kendi alan adında
-- giriş yapsa "giriş yaptım ama panelim boş" durumuna düşerdi (src/App.jsx).

create table if not exists public.custom_domains (
  id            uuid primary key default gen_random_uuid(),
  profile_id    uuid not null references public.profiles(id) on delete cascade,
  persona_id    uuid references public.personas(id) on delete set null,
  host          text not null unique check (char_length(host) between 4 and 253),
  -- Sahiplik kanıtı. on delete RESTRICT: doğrulamayı silip adresi bağlı
  -- bırakmak, kanıtsız yayın demek olurdu.
  dogrulama_id  uuid not null references public.identity_verifications(id) on delete restrict,
  durum         text not null default 'beklemede'
                check (durum in ('beklemede','baglandi','hata','iptal')),
  saglayici     jsonb not null default '{}'::jsonb,
  baglandi_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists custom_domains_profil_idx on public.custom_domains (profile_id);

alter table public.custom_domains enable row level security;

comment on table public.custom_domains is
  'Kisinin kendi alan adinda yayinlanan kart. Baglamak icin alan adi sahipligi kanitlanmis olmali.';

drop policy if exists "sahibi ozel alan adlarini gorur" on public.custom_domains;
create policy "sahibi ozel alan adlarini gorur" on public.custom_domains
  for select to authenticated
  using (profile_id = public.my_profile_id() or public.is_admin());

revoke insert, update, delete on public.custom_domains from anon, authenticated;

-- Fonksiyonlar (tam gövdeleri Supabase göç geçmişinde 'ozel_alan_adi'):
--   custom_domain_claim(host, persona)  — adres talebi; adres doğrulanmış alan
--       adının kendisi ya da ALTI olmak zorunda. Başkasının bağladığı adreste
--       hangi hesap olduğunu SÖYLEMEZ.
--   custom_domain_mark(id, durum, ...)  — sağlayıcı sonucu; service_role only.
--   my_custom_domains() / custom_domain_remove(id)
--   resolve_custom_domain(host)         — ziyaretçi; hız sınırlı. Sahiplik
--       kanıtı iptal edilmişse yayın DURUR (kanıtsız yayın yapmayız).
