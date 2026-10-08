-- ============================================================================
-- İLGEZDİ QR GİRİŞİ: SAYI EŞLEŞTİRME VE AĞ ÖNEKİ
-- ============================================================================
--
-- Denetim bulgusu G-04 (08.10.2026), bağımsız inceleme H1 ve L7.
--
-- SORUN — QR ile oturum çalma (QRLjacking): saldırgan kendi bilgisayarında QR
-- üretip bir oltalama sayfasına koyar; kurban telefonundan "Onayla"ya basınca
-- oturum SALDIRGANIN tarayıcısında açılır. client_secret bu saldırıyı
-- durdurmaz: sırrı tutan zaten oturumu açan saldırgandır.
--
-- ÇÖZÜM — sayı eşleştirme: v2 istemci (client_secret alan) QR'ın yanında
-- 2 haneli bir sayı gösterir. Telefondaki onay ekranı üç sayı sunar; kişi
-- bilgisayar EKRANINDA gördüğünü seçer. Yanlış seçim oturumu yakar (üçte bir
-- tahmin şansı tek denemeyle sınırlı). Saldırganın ekranını görmeyen kurban
-- doğru sayıyı bilemez.
--
-- Eski (sırsız) istemcide sayı yok; o oturumlar eskisi gibi çalışır.
-- ILGEZDI_QR_STRICT=true açılınca eski istemci tamamen reddedilir.
--
-- AĞ ÖNEKİ: "aynı ağ mı" uyarısı tam IP'yi karşılaştırıyordu. IPv6'da aynı
-- evdeki iki cihazın adresi farklıdır (aynı /64 önek); uyarı yanlış alarm
-- veriyordu. Onay ekranı artık önek özetini karşılaştırır (IPv6 /64, IPv4
-- tam adres — NAT arkasındaki ev/ofis tek genel IPv4 paylaşır).

alter table public.ilgezdi_qr_sessions
  add column if not exists match_code smallint,
  add column if not exists creator_net_hash text;

comment on column public.ilgezdi_qr_sessions.match_code is
  'v2: QR yanında gösterilen 2 haneli sayı. Onay bu sayının seçilmesini ister; yanlış seçim oturumu yakar.';
comment on column public.ilgezdi_qr_sessions.creator_net_hash is
  'QR''ı üreten ağın önek özeti (IPv6 /64, IPv4 tam). Yalnızca onay ekranındaki "aynı ağ mı" bilgisi için.';
