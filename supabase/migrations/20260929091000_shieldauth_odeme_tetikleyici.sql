-- ============================================================================
-- ShieldAuth — IBAN / fatura kuralını AÇAN adım
-- ============================================================================
--
-- 20260929090000_shieldauth_mfa.sql tabloları, kontrol fonksiyonlarını ve
-- guard_profile_payment_mfa() gövdesini kurar ama hiçbir yere bağlamaz.
-- Kuralı fiilen yürürlüğe sokan tek satır burada.
--
-- BU DOSYA EN SON UYGULANIR — şu ikisi CANLIDA çalışır durumdayken:
--   • shieldauth Edge Function + SHIELDAUTH_* secret'ları
--   • adım atlama penceresini gösteren web sürümü
-- Aksi halde kişi IBAN'ını değiştiremez ama doğrulama da yapamaz: kilitlenir.
--
-- Uygulamadan önce kontrol (üçü de true olmalı):
--   select
--     to_regprocedure('public.shieldauth_mfa_fresh(interval)') is not null as fonksiyon_var,
--     to_regclass('public.shieldauth_mfa_assertions') is not null          as tablo_var,
--     exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
--             where n.nspname = 'public' and p.proname = 'guard_profile_payment_mfa') as govde_var;
--
-- Acil geri alma (kuralı kaldırır, tablolar kalır):
--   drop trigger trg_guard_profile_payment_mfa on public.profile_payment;

drop trigger if exists trg_guard_profile_payment_mfa on public.profile_payment;
create trigger trg_guard_profile_payment_mfa
  before insert or update on public.profile_payment
  for each row execute function public.guard_profile_payment_mfa();

comment on trigger trg_guard_profile_payment_mfa on public.profile_payment is
  'ShieldAuth: IBAN/fatura değişikliği son 10 dakikada iki adımlı doğrulama ister. Geri alma: bu trigger düşürülür.';
