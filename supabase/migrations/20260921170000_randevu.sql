-- ============================================================================
-- RANDEVU / REZERVASYON
-- ============================================================================
--
-- Esnaf ve serbest çalışan için karttan doğrudan randevu. Linktree'de bu
-- ancak dışarıdan bir takvim aracının gömülmesiyle oluyor; bizde kartın kendi
-- parçası ve AYNI ÖLÇÜM HATTINDA — randevunun QR okutandan mı geldiği belli.
--
-- SAAT DİLİMİ: çalışma saatleri Europe/Istanbul'a göre yorumlanır, randevular
-- timestamptz saklanır. Kartta saatler "Türkiye saatiyle" diye yazılı gösterilir;
-- ziyaretçinin yerel saatine çevirmek, yurt dışındaki birinin "sabah 9" sanıp
-- gece yarısına randevu almasına yol açardı.

create extension if not exists btree_gist with schema extensions;

create table if not exists public.appointment_settings (
  profile_id    uuid primary key references public.profiles(id) on delete cascade,
  aktif         boolean not null default false,
  slot_dakika   int not null default 30 check (slot_dakika in (15, 20, 30, 45, 60, 90, 120)),
  ileri_gun     int not null default 14 check (ileri_gun between 1 and 180),
  -- En erken ne kadar sonrasına: "birazdan geliyorum" randevusunu engeller.
  en_erken_saat int not null default 2 check (en_erken_saat between 0 and 168),
  -- {"1": [["09:00","12:00"],["13:00","18:00"]], ...} 1=Pazartesi .. 7=Pazar
  gun_saatleri  jsonb not null default '{}'::jsonb,
  aciklama      text check (aciklama is null or char_length(aciklama) <= 300),
  otomatik_onay boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.appointment_settings enable row level security;

create policy "sahibi randevu ayarlarini gorur" on public.appointment_settings
  for select to authenticated using (profile_id = public.my_profile_id());

revoke insert, update, delete on public.appointment_settings from anon, authenticated;

create table if not exists public.appointments (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  persona_id uuid references public.personas(id) on delete set null,
  baslar_at  timestamptz not null,
  biter_at   timestamptz not null,
  ad         text not null check (char_length(btrim(ad)) between 2 and 80),
  eposta     text check (eposta is null or eposta ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefon    text check (telefon is null or char_length(telefon) between 7 and 25),
  aciklama   text check (aciklama is null or char_length(aciklama) <= 500),
  kaynak     text check (kaynak is null or kaynak in ('qr','nfc','link','direct')),
  durum      text not null default 'bekliyor'
             check (durum in ('bekliyor','onaylandi','iptal','tamamlandi')),
  -- Randevuyu alan kişinin hesabı yok; kendi randevusunu bu kodla iptal eder.
  iptal_kodu text not null default encode(extensions.gen_random_bytes(12), 'hex'),
  riza_at    timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint appointments_sure_chk check (biter_at > baslar_at),
  constraint appointments_iletisim_chk check (eposta is not null or telefon is not null)
);

-- Aynı saate iki randevu VERİTABANI seviyesinde engellenir. Uygulamada
-- "önce bak sonra yaz" yapmak, yarış durumunda iki kişiye aynı saati verir.
alter table public.appointments drop constraint if exists appointments_cakisma_chk;
alter table public.appointments
  add constraint appointments_cakisma_chk
  exclude using gist (
    profile_id with =,
    tstzrange(baslar_at, biter_at) with &&
  ) where (durum in ('bekliyor','onaylandi'));

create index if not exists appointments_profil_zaman_idx
  on public.appointments (profile_id, baslar_at desc);

alter table public.appointments enable row level security;

-- Ziyaretçi tabloyu HİÇ göremez: başkasının randevusunun kim olduğu ve ne
-- zaman olduğu kimseyi ilgilendirmez. Yalnızca BOŞ saatleri öğrenir.
create policy "sahibi randevulari gorur" on public.appointments
  for select to authenticated using (profile_id = public.my_profile_id());

revoke insert, update, delete on public.appointments from anon, authenticated;

comment on table public.appointments is
  'Karttan alinan randevular. Ziyaretci tabloyu okuyamaz; yalnizca bos saatleri gorur.';

-- Fonksiyonlar. Tam gövdeler depoda:
--   20260921210000_dis_denetim_duzeltmeleri.sql (slots, book, settings_save)
--   20260922080000_eksik_fonksiyon_govdeleri.sql (panel tarafı) --
-- 'randevu_panel_rpc'):
--   appointment_slots(code, username, gun)  — ziyaretçi; yalnızca BOŞ saatler.
--   book_appointment(...)                   — ziyaretçi; hız sınırlı. Saatin
--       gerçekten uygun olduğunu boş saat listesinden yeniden doğrular
--       (istemciye güvenip "saat 03:00" randevusu yazmayız) ve yarışı
--       exclusion kısıtı çözer.
--   my_appointment_settings() / appointment_settings_save(...) — kaydederken
--       gün/saat yapısını SUNUCU yeniden doğrular; yalnızca 1..7 anahtarları
--       ve HH:MM ikilileri geçer.
--   my_appointments(gecmis) / appointment_set_status(id, durum)
--   appointment_cancel_by_code(id, kod)     — randevuyu alan kişi için.
