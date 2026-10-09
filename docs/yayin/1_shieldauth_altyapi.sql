-- ============================================================================
-- YAYIN PAKETİ 1/2 — ShieldAuth altyapısı (ETKİSİZ: hiçbir kuralı açmaz)
-- ============================================================================
-- Supabase SQL Editor'e olduğu gibi yapıştırıp çalıştırın.
-- Kaynak: supabase/migrations/20260929090000_shieldauth_mfa.sql (birebir).
-- Neden SQL Editor: canlı veritabanının migration geçmişi depodaki dosya
-- adlarıyla eşleşmiyor (değişiklikler farklı sürüm numaralarıyla uygulanmış);
-- `supabase db push` eski dosyaları yeniden çalıştırmaya kalkar. Bkz.
-- docs/guvenlik-faz0-yayin.md.
begin;
-- ============================================================================
-- ShieldAuth — iki adımlı doğrulamanın VERİTABANINDA uygulanması
-- ============================================================================
--
-- NEDEN: QRtım'de tarayıcı veritabanına doğrudan yazıyor (PostgREST / RPC).
-- Arayüzde gösterilen bir "kodu girin" ekranı tek başına koruma değildir:
-- şifreyi ele geçiren biri aynı oturum belirteciyle doğrudan istek atıp ekranı
-- hiç görmeden işlem yapabilir. Bu yüzden zorunluluk burada, veritabanında.
--
-- Nasıl çalışır:
--   • shieldauth Edge Function'ı her başarılı doğrulamada (TOTP, e-posta kodu,
--     yedek kod) o anki Supabase oturumuna — JWT'deki session_id — service_role
--     ile bir kayıt yazar. İstemci bu tablolara YAZAMAZ, okuyamaz.
--   • shieldauth_mfa_fresh('10 minutes') → bu oturum son 10 dakikada doğrulandı mı?
--   • shieldauth_mfa_enrolled()          → kişi doğrulama uygulaması kurmuş mu?
--
-- Bu migration ile uygulananlar:
--   1) Banka hesabı / fatura bilgisi değişikliği HERKES için son 10 dakikada
--      doğrulama ister. IBAN kartta herkese gösteriliyor: ele geçirilen bir
--      hesapla IBAN'ı değiştirmek, ziyaretçilerin parasını saldırgana
--      yönlendirmek demekti. TOTP kurmamış kişi doğrulanmış e-postasına gelen
--      kodla geçer; bu yüzden kimse kilitlenmez.
--   2) is_admin(): TOTP kurmuş yöneticiler için son 12 saatte doğrulama şartı.
--      Tüm yönetici RPC'leri ve profil koruma tetikleyicisi bu tek noktadan
--      geçtiği için hepsi birden korunur.
--      AŞAMALI: TOTP kurmamış yönetici şimdilik eskisi gibi devam eder (yayın
--      anında kilitlenme olmasın). Tüm yöneticiler kurduktan sonra
--      supabase/bekleyen/shieldauth_yonetici_zorunlu.sql uygulanır.
--
-- YAYIN SIRASI (önemli):
--   1. Bu migration            → hiçbir şeyi ZORUNLU KILMAZ (aşağıya bak)
--   2. supabase functions deploy shieldauth  (+ SHIELDAUTH_* secret'ları)
--   3. Web uygulaması (adım atlama modalı)
--   4. 20260929091000_shieldauth_odeme_tetikleyici.sql  → IBAN kuralını açar
--
-- BU DOSYA BİLEREK ETKİSİZDİR. Ödeme tetikleyicisi ayrı dosyada çünkü 1 ile 2
-- arasında kaldığı sürece kimse IBAN'ını değiştiremez AMA doğrulama da
-- yapamaz (doğrulayacak fonksiyon henüz yayında değil) — yani kilitlenir.
-- Tetikleyiciyi en sona alınca o pencere hiç oluşmuyor.
--
-- is_admin() değişikliği 1. adımda inebilir: TOTP kurmuş kimse olmadığı için
-- shieldauth_mfa_users boş, enrolled=false, sonuç eskisiyle birebir aynı.
-- Geri alma: drop trigger trg_guard_profile_payment_mfa on public.profile_payment;

-- ---------------------------------------------------------------------------
-- Doğrulama kayıtları (yalnızca service_role)
-- ---------------------------------------------------------------------------
create table if not exists public.shieldauth_mfa_assertions (
  user_id     uuid not null references auth.users (id) on delete cascade,
  session_id  uuid not null,
  method      text not null,
  verified_at timestamptz not null default now(),
  primary key (user_id, session_id)
);
alter table public.shieldauth_mfa_assertions enable row level security;
revoke all on public.shieldauth_mfa_assertions from anon, authenticated;

create table if not exists public.shieldauth_mfa_users (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  totp_enrolled boolean not null default false,
  updated_at    timestamptz not null default now()
);
alter table public.shieldauth_mfa_users enable row level security;
revoke all on public.shieldauth_mfa_users from anon, authenticated;

comment on table public.shieldauth_mfa_assertions is
  'ShieldAuth: oturum başına son iki adımlı doğrulama. Yalnızca shieldauth Edge Function (service_role) yazar.';
comment on table public.shieldauth_mfa_users is
  'ShieldAuth: doğrulama uygulaması (TOTP) kurulu mu. Yalnızca shieldauth Edge Function (service_role) yazar.';

-- ---------------------------------------------------------------------------
-- Kontrol fonksiyonları
-- ---------------------------------------------------------------------------
create or replace function public.shieldauth_mfa_enrolled(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select totp_enrolled from public.shieldauth_mfa_users where user_id = uid),
    false
  );
$$;

create or replace function public.shieldauth_mfa_fresh(max_age interval default interval '10 minutes')
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.shieldauth_mfa_assertions a
    where a.user_id = auth.uid()
      and a.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and a.verified_at > now() - max_age
  );
$$;

-- shieldauth_mfa_enrolled(uid) başka birinin durumunu sorgulayabilir; istemciye
-- yalnızca kendi durumunu sorduran sarmalayıcı veriyoruz.
create or replace function public.shieldauth_mfa_durumum()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'totp_kurulu', public.shieldauth_mfa_enrolled(auth.uid()),
    'taze_12_saat', public.shieldauth_mfa_fresh(interval '12 hours'),
    'taze_10_dk',  public.shieldauth_mfa_fresh(interval '10 minutes')
  );
$$;

revoke all on function public.shieldauth_mfa_enrolled(uuid) from public, anon, authenticated;
revoke all on function public.shieldauth_mfa_fresh(interval) from public, anon;
revoke all on function public.shieldauth_mfa_durumum() from public, anon;
grant execute on function public.shieldauth_mfa_fresh(interval) to authenticated;
grant execute on function public.shieldauth_mfa_durumum() to authenticated;

-- ---------------------------------------------------------------------------
-- 1) Banka hesabı / fatura bilgisi: son 10 dakikada doğrulama
-- ---------------------------------------------------------------------------
-- SECURITY INVOKER (varsayılan): current_user gerçek çağıran rol olsun ki
-- service_role muafiyeti çalışsın (bkz. guard_profile_privileged_columns).
create or replace function public.guard_profile_payment_mfa()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  degisti boolean;
begin
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Kolon tipinden bağımsız "boş değil mi?" (dizi, nesne veya null olabilir).
    degisti := coalesce(to_jsonb(new.bank_accounts), '[]'::jsonb) not in ('[]'::jsonb, '{}'::jsonb, 'null'::jsonb)
               or coalesce(to_jsonb(new.billing_info), 'null'::jsonb) not in ('null'::jsonb, '{}'::jsonb);
  else
    degisti := new.bank_accounts is distinct from old.bank_accounts
               or new.billing_info is distinct from old.billing_info;
  end if;

  -- Yalnızca görünürlük anahtarları (show_*) değişiyorsa doğrulama istenmez.
  if degisti and not public.shieldauth_mfa_fresh(interval '10 minutes') then
    raise exception 'mfa_required'
      using errcode = '42501',
            hint = 'Banka ve fatura bilgisini değiştirmek için iki adımlı doğrulama gerekiyor.';
  end if;
  return new;
end;
$$;

-- Tetikleyici BU DOSYADA DEĞİL: 20260929091000_shieldauth_odeme_tetikleyici.sql.
-- Sebep aşağıdaki "YAYIN SIRASI" notunda.

comment on function public.guard_profile_payment_mfa() is
  'ShieldAuth: IBAN/fatura değişikliği son 10 dakikada iki adımlı doğrulama ister (ödeme yönlendirme dolandırıcılığına karşı). service_role muaftır.';

-- ---------------------------------------------------------------------------
-- 2) Yönetici: TOTP kurmuşsa son 12 saatte doğrulama (aşamalı)
-- ---------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where user_id = auth.uid()
      and role in ('admin', 'superadmin')
  )
  and (
    not public.shieldauth_mfa_enrolled(auth.uid())
    or public.shieldauth_mfa_fresh(interval '12 hours')
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

comment on function public.is_admin() is
  'Yönetici mi? ShieldAuth: TOTP kurmuş yöneticide son 12 saatte iki adımlı doğrulama şartı (aşamalı geçiş).';

commit;
