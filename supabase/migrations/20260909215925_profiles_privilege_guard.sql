-- ============================================================================
-- FAZ 1 / ADIM 3 — Yetki yükseltmeye karşı koruma (GÜVENLE UYGULANIR)
-- ============================================================================
--
-- Bulgu O-2 — 2026-09-10'da CANLI ORTAMDA DOĞRULANDI: AÇIK GERÇEKTİ.
--
-- /admin rotası yalnızca oturum varlığını kontrol ediyor; rol kontrolü
-- AdminPage içinde İSTEMCİDE yapılıyor ve atlanabilir. Gerçek koruma tamamen
-- profiles tablosunun UPDATE politikasına bağlıydı — ve o politikalar
-- `role` kolonunu HİÇ KORUMUYOR:
--
--   "Users can update their profile" (authenticated)
--       USING      (auth.uid() = user_id)
--       WITH CHECK (auth.uid() = user_id)
--   "profiles_update" (public)
--       USING      (user_id = auth.uid())
--       WITH CHECK  yok  -> USING'e düşer
--
-- İkisi de yalnızca "kendi satırın mı?" diye soruyor, "hangi kolonu
-- değiştiriyorsun?" diye sormuyor. `authenticated` rolünün `role` kolonunda
-- UPDATE ayrıcalığı da var (information_schema.column_privileges ile
-- doğrulandı). Sonuç: ücretsiz kayıt olan HERKES tek bir istekle kendini
-- admin yapabiliyordu:
--
--   PATCH /rest/v1/profiles?user_id=eq.<kendi>   {"role":"admin"}
--
-- Ardından AdminCRM tüm kullanıcıları silme, rol atama ve abonelik değiştirme
-- yetkisi veriyor.
--
-- Bu migration açığı POLİTİKADAN BAĞIMSIZ olarak kapatır: ayrıcalıklı
-- kolonlar veritabanı seviyesinde bir trigger ile korunur. Böylece ileride
-- politikalar değişse veya yenisi eklense bile koruma yerinde kalır.
--
-- Mevcut davranışa etkisi yok:
--   • profiles.role'ü yalnızca AdminCRM yazıyor (admin => izinli).
--   • Dashboard yalnızca kozmetik/profil alanları yazıyor (kapsam dışı).
--   • Abonelik akışları `subscriptions` tablosuna yazıyor, profiles'a değil.

-- ---------------------------------------------------------------------------
-- Yönetici kontrolü — RLS'i baypas eder, bu yüzden politika özyinelemesi olmaz
-- (bkz. bulgu Y-1: organization_members politikasındaki sonsuz döngü).
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
  );
$$;

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- ---------------------------------------------------------------------------
-- Ayrıcalıklı kolon koruması
-- ---------------------------------------------------------------------------
-- ÖNEMLİ: Bu fonksiyon bilinçli olarak SECURITY INVOKER (varsayılan). Böylece
-- current_user gerçek çağıran roldür (anon / authenticated / service_role).
-- SECURITY DEFINER yapılsaydı current_user daima fonksiyon sahibi olurdu ve
-- service_role muafiyeti çalışmazdı.

create or replace function public.guard_profile_privileged_columns()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Sunucu tarafı (Edge Function / backend) ve bakım rolleri muaf.
  if current_user in ('service_role', 'postgres', 'supabase_admin') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Kayıt sırasında rol daima 'user'. Yönetici ataması yalnızca sonradan,
    -- mevcut bir yönetici eliyle yapılabilir.
    if not public.is_admin() then
      new.role := 'user';
    end if;
    return new;
  end if;

  -- UPDATE
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Yetki hatası: role kolonu değiştirilemez'
      using errcode = '42501';
  end if;

  -- Para/plan kolonları: yönetici olmayan istemci bunları değiştiremez.
  -- Hata yerine sessizce eski değere döndürülür; böylece tüm satırı geri
  -- gönderen bir istemci kodu kırılmaz, ama değişiklik de geçmez.
  if not public.is_admin() then
    new.subscription_plan       := old.subscription_plan;
    new.subscription_status     := old.subscription_status;
    new.subscription_expires_at := old.subscription_expires_at;
    new.nfc_cards_included      := old.nfc_cards_included;
    new.referral_earnings       := old.referral_earnings;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_guard_profile_privileged_columns on public.profiles;
create trigger trg_guard_profile_privileged_columns
  before insert or update on public.profiles
  for each row execute function public.guard_profile_privileged_columns();

comment on function public.guard_profile_privileged_columns() is
  'Bulgu O-2: role ve abonelik/para kolonlarını istemci tarafı yetki yükseltmesine karşı korur. service_role muaftır.';
