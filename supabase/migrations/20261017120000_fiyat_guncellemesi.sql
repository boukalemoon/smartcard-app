-- ============================================================================
-- Fiyat güncellemesi — 17.10.2026
-- ============================================================================
--
-- NEDEN: Dijital kartviziti ön plana çıkarmak için abonelik ve kart fiyatları
-- aşağı çekildi (kurucu kararı). Rakip analizi: PVC NFC kart 799 ₺ ile
-- piyasanın 2-5 katıydı (vTag 99-149 ₺, KolayNFC 340-450 ₺); abonelik ise
-- yurt içi en yakın rakibin (vTag Pro+ 129 ₺) yaklaşık iki katıydı.
--
-- BU DOSYA TEK BAŞINA YETMEZ. Fiyat iki yerde yaşıyor:
--   1) src/lib/planlar.js  → ekranda GÖSTERİLEN tutar
--   2) public.plan_prices  → payment_create_intent'in TAHSİL ettiği tutar
-- İkisi aynı yayında gitmeli. Yalnız biri giderse PaymentModal ekrandaki
-- tutarın sunucununkinden farklı olduğunu görüp kişiye sorar — yani kimse
-- yanlış tutar ödemez, ama ödeme akışı durur.
--
-- Yıllık ücret = aylık × 10 (iki ay bedelsiz, ~%17).
-- Kart paketli yıllık = yıllık + (pakete dahil kart adedi × 249 ₺).
--   ÖNCEKİ HÂLİ: fark her planda sabit 799 ₺'ydi; 1 kartlı Öğrenci ile
--   10 kartlı Kurumsal aynı farkı ödüyordu. Artık adede göre ölçekleniyor.
--
-- Tutarlar KURUŞ cinsindendir (amount_kurus).

insert into public.plan_prices (plan, period, with_nfc, amount_kurus, nfc_included) values
  -- Öğrenci: 49 ₺/ay · 490 ₺/yıl · +1 kart → 739 ₺
  ('student',      'monthly', false,   4900,  0),
  ('student',      'yearly',  false,  49000,  1),
  ('student',      'yearly',  true,   73900,  1),
  -- Profesyonel: 159 ₺/ay · 1.590 ₺/yıl · +1 kart → 1.839 ₺
  ('professional', 'monthly', false,  15900,  0),
  ('professional', 'yearly',  false, 159000,  1),
  ('professional', 'yearly',  true,  183900,  1),
  -- STK Özel: 279 ₺/ay · 2.790 ₺/yıl · +6 kart → 4.284 ₺
  ('stk',          'monthly', false,  27900,  0),
  ('stk',          'yearly',  false, 279000,  6),
  ('stk',          'yearly',  true,  428400,  6),
  -- Kurumsal: 549 ₺/ay · 5.490 ₺/yıl · +10 kart → 7.980 ₺
  ('business',     'monthly', false,  54900,  0),
  ('business',     'yearly',  false, 549000, 10),
  ('business',     'yearly',  true,  798000, 10)
on conflict (plan, period, with_nfc) do update
  set amount_kurus = excluded.amount_kurus,
      nfc_included = excluded.nfc_included,
      is_active    = true,
      updated_at   = now();

-- Kontrol: aşağıdaki sorgu src/lib/planlar.js ile birebir aynı tutarları
-- vermeli. "fark" sütunu kart paketli satırın adet × 249 ₺ olduğunu gösterir.
--
-- select plan, period, with_nfc, amount_kurus / 100 as tl, nfc_included,
--        (amount_kurus - (select y.amount_kurus from public.plan_prices y
--                         where y.plan = p.plan and y.period = p.period
--                           and y.with_nfc = false)) / 100 as fark_tl
-- from public.plan_prices p
-- where is_active
-- order by plan, period, with_nfc;
