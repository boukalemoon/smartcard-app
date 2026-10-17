-- ============================================================================
-- Kart paketleri: öğrencide kaldırıldı, STK/kurumsalda teklife geçti
-- ============================================================================
--
-- 20261017120000_fiyat_guncellemesi.sql'den SONRA uygulanır.
--
-- NEDEN (kurucu kararı 17.10.2026):
--   • Öğrenci planı kart İÇERMEZ. Amaç üniversite öğrencisine en düşük fiyatı
--     vermek; sosyal hesaplar sınırsız, kart isteyen ayrıca sipariş eder.
--   • Çok adetli kart alımı STK ve kurumsal tarafta yoğunlaşıyor. Adet ve
--     malzeme müşteriye göre değiştiği için sabit paket fiyatı yanıltıcıydı;
--     o planlarda kart tarafı TEKLİFLE yürür.
--   • Tek kartlı paket yalnız Profesyonel'de kalır (1.590 + 249 = 1.839 ₺).
--
-- Satırlar SİLİNMEZ, is_active = false yapılır: geçmiş ödeme kayıtlarının
-- işaret ettiği fiyat satırı yerinde kalsın. plan_prices okuma politikası
-- yalnız is_active satırları gösterir.

-- 1) Kart paketli satırlar: yalnız Profesyonel açık kalır.
update public.plan_prices
   set is_active = false,
       updated_at = now()
 where with_nfc = true
   and plan in ('student', 'stk', 'business');

-- 2) Pakete dahil kart adedi sıfırlanır (kart artık plandan gelmiyor).
update public.plan_prices
   set nfc_included = 0,
       updated_at = now()
 where plan in ('student', 'stk', 'business')
   and nfc_included <> 0;

-- Kontrol: aşağıdaki sorgu src/lib/planlar.js ile birebir aynı olmalı.
-- Beklenen açık satırlar:
--   student      monthly f   4900  0
--   student      yearly  f  49000  0
--   professional monthly f  15900  0
--   professional yearly  f 159000  1
--   professional yearly  t 183900  1   <- tek kalan kart paketi
--   stk          monthly f  27900  0
--   stk          yearly  f 279000  0
--   business     monthly f  54900  0
--   business     yearly  f 549000  0
--
-- select plan, period, with_nfc, amount_kurus, nfc_included
-- from public.plan_prices
-- where is_active
-- order by plan, period, with_nfc;
