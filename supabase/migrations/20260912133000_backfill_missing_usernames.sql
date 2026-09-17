-- ============================================================================
-- ADIM 2b — KULLANICI ADI OLMAYAN PROFİLLER
-- ============================================================================
--
-- Kartvizit sayfası /card/:username adresinden açılır; kullanıcı adı olmayan
-- profilin kartı HİÇ açılamaz. 13 profilde kullanıcı adı boştu — bunlar
-- handle_new_user hatası yüzünden yedek yoldan (panelde form doldurarak)
-- oluşmuş profillerdi ve o yol kullanıcı adı üretmiyor.
--
-- Mevcut bir bağlantı kırılmaz: bu profillerin hiçbirinde görüntülenme yok,
-- çünkü zaten erişilebilir bir kart adresleri hiç olmadı.
--
-- Üretim kuralı tetikleyiciyle AYNI (önce lower, sonra temizle, yedek ad).
-- Doğrulandı: 13 -> 0 kullanıcı adsız, 0 çakışma.

update public.profiles p
set username = coalesce(
      nullif(regexp_replace(lower(split_part(p.email, '@', 1)), '[^a-z0-9]', '', 'g'), ''),
      'kullanici'
    ) || '_' || substring(p.id::text, 1, 6)
where p.username is null or p.username = '';
