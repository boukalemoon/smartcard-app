-- ============================================================================
-- Yeni bulgu (2026-09-10) — analytics_summary herkese açıktı (UYGULANDI)
-- ============================================================================
--
-- SORUN:
--   `analytics_summary` materialized view'ı Data API üzerinden herkese açık
--   anahtarla okunabiliyordu ve profil bazında performans metriklerini
--   sızdırıyordu:
--
--     profile_id, profile_views, qr_scans, nfc_taps, vcard_downloads,
--     link_clicks, last_activity
--
--   Yani herhangi biri, bir kullanıcının kartının ne kadar ilgi gördüğünü,
--   kaç kişinin kişilerine kaydettiğini ve en son ne zaman etkileşim
--   aldığını okuyabiliyordu. Rekabetçi istihbarat ve profilleme için
--   doğrudan kullanılabilir bir veri.
--
--   Denetimin ilk turunda numaralı bulgu olarak listelenmemişti; Supabase
--   güvenlik danışmanının uyarısı takip edilerek bulundu ve canlı ortamda
--   doğrulandı (anon anahtarla HTTP 200 + veri döndü).
--
-- NEDEN RLS DEĞİL:
--   Materialized view'lar satır seviyesi güvenliği DESTEKLEMEZ. Tek koruma
--   yolu tablo ayrıcalığını kaldırmaktır.
--
-- NEDEN GÜVENLİ:
--   Uygulama bu view'ı hiç kullanmıyor (src/ tarandı, tek referans yok).
--   Paneldeki özetler `analytics_events` tablosundan istemcide hesaplanıyor
--   (utils/analyticsHelpers.js) ve o tablonun RLS'i açık.

revoke all on public.analytics_summary from anon, authenticated;

comment on materialized view public.analytics_summary is
  'Yalnızca service_role. anon/authenticated yetkisi 2026-09-10''da kaldırıldı: Data API üzerinden profil bazında metrik sızıyordu. Materialized view RLS desteklemez.';

-- DOĞRULAMA (uygulandıktan sonra, anon anahtarla):
--   GET /rest/v1/analytics_summary?select=*
--   beklenen: 401 "permission denied for materialized view analytics_summary"
