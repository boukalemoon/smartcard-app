# Devir notu — 17.10.2026

Claude Code ile devam ederken başlangıç noktası. Kod durumu: `main` = `97f853f`
(canlıda; www.qrtim.com.tr, qrtim.com.tr, qartim.com aynı dağıtımı sunuyor).

## Bu turda yapılanlar
- Paneller (bireysel, kurumsal/STK, yönetici) onaylanan Claude Design tasarımına göre
  yeniden yazıldı: `src/panel/`. Kabuk `PanelKabugu.jsx`, ortak parçalar `ui.jsx`,
  biçim yardımcıları `bicim.js`. Dashboard.jsx veri/işleyicileri `ctx` ile sayfalara verir.
- Web sitesi yeniden yazıldı: `src/site/` (SiteKabugu, acilis/, giris/, kart/, sayfalar/).
  Açılış `src/pages/LandingPage.jsx`, herkese açık kart `src/pages/PublicCard.jsx`,
  giriş/onay `src/components/Auth.jsx`.
- Fiyatlar tek kaynak: `src/lib/planlar.js` (sunucudaki `plan_prices` ile aynı tutulmalı).
- Kimlik: mevcut logo `/qrtim-logo.png`, lacivert palet. Renk tokenları `src/index.css`
  (`--renk-*`, açık + `.dark`) ve `tailwind.config.js` (zemin, yuzey, cizgi, metin, aksan,
  murekkep, vurgu, marka, lacivert-*). Yeni kodda ham gray/blue/purple sınıfı yazılmaz.
- 36 kullanılmayan eski bileşen silindi; lint tabanı 7/4 (`scripts/lint-taban.json`).
- Kontrol: `node scripts/kontrol.mjs` (derleme + lint tabanı + göç dosyaları).

## Karar bekleyenler
1. Öğrenci planı: `plan_features` (sınırsız sosyal, 2 kurum, kart 0) ile ödeme tablosu
   (yıllık 1 kart) çelişiyor. Site sunucu sınırlarını + 1 kartı gösteriyor.
2. Herkese açık kartta STK görünümü kuralı: doğrulanmış kurum üyeliği varsa kurumsal
   görünüm (`src/pages/PublicCard.jsx`, tek satır).
3. İletişim formu sunucuya göndermiyor (mailto). Gerçek gönderim için edge fonksiyonu.
4. İletişim e-postaları hâlâ info@qartim.com — M365 qrtim.com.tr kurulunca güncellenecek.

## Arka uç eksikleri (arayüzde "Yakında")
- `persona_set_field` yalnız public/private; link_only/on_request yok.
- Günlük ölçüm serisi RPC'si yok (Ölçüm sayfası analytics_events'i istemcide sayıyor, ≤20k).
- Partner komisyonu tetikleyicisi sabit 50/75/150 TL yazıyor; %10 değil.
- Sahibin hesap silme RPC'si yok; `app_disconnect` partner_user_links'i kaldırmıyor.
- Kurum partner kodu, blok sıralama/yeni blok türleri, cüzdan, NFC sipariş takibi yok.
- Yönetici; 2FA, üyelik, NFC sipariş, denetim kaydı okuyamıyor.
- İlgezdi cihaz girişinde sayı eşleştirme (`match_options`) sunucu desteği bekliyor (v2 yaması
  `docs/ilgezdi-qr-v2.patch`).
- Edge fonksiyon kaynakları (arku-link, tinga-link) depoda yok; onay ekranındaki
  "gitmeyecek" listesi canlı yanıtla karşılaştırılmalı.

## Sıradaki işler
- Korgard (eski ShieldAuth) hazır olunca: `VITE_MFA_AKTIF=true`, IBAN tetikleyicisi
  yeniden kurulumu (`docs/guvenlik-faz0-yayin.md` E bölümü).
- M365 DNS (MX/SPF/DKIM/DMARC) qrtim.com.tr için Vercel DNS'te.
- qartim.com süresiz yenilenmeli; basılı kartlar o adresi taşıyor.
