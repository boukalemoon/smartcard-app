-- ============================================================================
-- FAZ 2 / ADIM 2 — Depolama klasör listelemesinin kapatılması (bulgu O-1)
-- ============================================================================
--
-- ⚠ UYGULADIKTAN HEMEN SONRA DUMAN TESTİ YAPIN (aşağıda). Yanlış giderse
--   geri alma tek komut — dosyanın sonunda.
--
-- SORUN:
--   Anon anahtarla klasör listelenebiliyor:
--     POST /storage/v1/object/list/avatars   {"prefix":"","limit":100}
--   Yüklenmiş HER profil fotoğrafının adı, boyutu ve tarihi dönüyor —
--   silinmiş profillerinki dahil. Kimse bir başkasının dosya adını bilmese
--   bile tüm koleksiyon numaralandırılabiliyor.
--
-- ÇÖZÜM:
--   storage.objects üzerine KISITLAYICI (restrictive) bir politika eklenir.
--   Kısıtlayıcı politikalar mevcut izin verici politikalarla VE'lenir, bu
--   yüzden mevcut politika tanımlarını okumaya/silmeye gerek kalmaz —
--   isimlerini bilmesek de sonuç garanti.
--
-- NEDEN GÖRSELLER KIRILMAZ (2026-09-09'da CANLI ORTAMDA DOĞRULANDI):
--   Herkese açık (public) bucket'larda dosyalar
--   `/storage/v1/object/public/<bucket>/<yol>` ucundan servis edilir ve bu
--   uç RLS'i BAYPAS eder. RLS yalnızca listeleme (`/object/list/...`) ve
--   imzalı erişim yollarında değerlendirilir.
--
--   Üç bucket'ın da gerçekten public olduğu ölçüldü:
--     GET /object/public/avatars/<dosya>      -> HTTP 200 (117032 bayt)
--     GET /object/public/backgrounds/<dosya>  -> HTTP 200
--     GET /object/public/logos/<dosya>        -> HTTP 200
--   Bu yol public olmayan bir bucket'ta RLS'ten bağımsız olarak hata
--   verirdi; 200 dönmesi bucket'ların public olduğunu kesinleştirir.
--
--   Ayrıca uygulamada `.list()` çağrısı hiç yok (src/ tarandı, tek kullanım
--   bile yok); yükleme ve silme `authenticated` rolüyle yapılıyor ve bu
--   politika yalnızca `anon` rolünü hedeflediği için onları etkilemez.

-- Aynı migration'ın tekrar çalıştırılabilmesi için önce düşür
drop policy if exists "anon medya bucketlarini listeleyemez" on storage.objects;

create policy "anon medya bucketlarini listeleyemez"
  on storage.objects
  as restrictive
  for select
  to anon
  using (bucket_id not in ('avatars', 'backgrounds', 'logos'));

-- ---------------------------------------------------------------------------
-- DUMAN TESTİ (uyguladıktan hemen sonra)
-- ---------------------------------------------------------------------------
-- 1) Listeleme ARTIK BOŞ dönmeli (anon anahtarla):
--      POST /storage/v1/object/list/avatars   {"prefix":"","limit":5}
--      beklenen: []
--
-- 2) Mevcut bir avatar görseli HÂLÂ AÇILMALI (tarayıcıda):
--      https://<proje>.supabase.co/storage/v1/object/public/avatars/<dosya>
--      beklenen: görsel yüklenir
--
-- 3) Panelde profil fotoğrafı yükleme ve silme çalışmalı (authenticated).
--
-- 2. adım başarısız olursa (görseller kırıldıysa) bucket'lar "public"
-- değildir ve servis yolu da RLS'ten geçiyordur. O durumda geri alın:
--
--   drop policy "anon medya bucketlarini listeleyemez" on storage.objects;
--
-- ve bunun yerine bucket'ları Supabase panelinden public yapıp tekrar deneyin.
