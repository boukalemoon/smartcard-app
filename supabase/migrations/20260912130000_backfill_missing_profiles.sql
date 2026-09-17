-- ============================================================================
-- ADIM 2 — PROFİLSİZ KULLANICILAR İÇİN GERİ DOLDURMA
-- ============================================================================
--
-- handle_new_user'daki 42P10 hatası yüzünden 15 kullanıcının profili
-- oluşturulup anında geri alınmıştı (bkz. 20260912120000_fix_signup_pipeline).
-- Bunların 12'si doğrulanmış ve giriş yapmış gerçek kişilerdi; panele
-- girdiklerinde boş ekran görüyorlardı.
--
-- Ad ve kullanıcı adı, tetikleyicinin (düzeltilmiş hâli) üreteceği değerlerin
-- AYNISI ile üretilir; kayıt sırasında girdikleri gerçek adlar kullanılır.
--
-- Profil eklenince zincirleme çalışan tetikleyiciler:
--   create_free_subscription_for_new_user -> ücretsiz abonelik
--   ensure_qrtim_user_id                  -> ekosistem kimliği
--   seed_profile_field_defaults           -> 8 görünürlük satırı (gizlilik-önce)
--
-- Doğrulandı: 21 -> 36 profil, 0 profilsiz, 0 mükerrer abonelik, 0 hata.

insert into public.profiles (id, user_id, email, name, username)
select
  u.id,
  u.id,
  u.email,
  coalesce(nullif(trim(u.raw_user_meta_data->>'name'), ''), split_part(u.email, '@', 1)),
  coalesce(nullif(regexp_replace(lower(split_part(u.email, '@', 1)), '[^a-z0-9]', '', 'g'), ''), 'kullanici')
    || '_' || substring(u.id::text, 1, 6)
from auth.users u
where not exists (select 1 from public.profiles p where p.user_id = u.id)
on conflict (id) do nothing;
