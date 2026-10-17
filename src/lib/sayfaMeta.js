// SAYFA BAŞLIKLARI, AÇIKLAMALARI VE SİTE HARİTASI — tek kaynak.
//
// NEDEN: Uygulama tek sayfalık (SPA). index.html'de tek bir <title> ve tek bir
// açıklama vardı; 21 rotanın tamamı arama sonucunda aynı başlıkla görünüyordu.
// Arama motoru için bu tek sayfa demek. Yalnız herkese açık kart kendi
// başlığını yazıyordu (PublicCard.jsx).
//
// Bu dosyayı iki yer okur:
//   1) src/components/SayfaMeta.jsx → gezinirken <title> ve açıklamayı yazar
//   2) vite.config.js              → derleme anında dist/sitemap.xml üretir
// Bu yüzden React importu YOKTUR: Node'da da import edilebilmeli.

export const KANONIK_ADRES = 'https://www.qrtim.com.tr'

// Arama motoruna açılan, herkese açık sayfalar. Panel/giriş/ödeme rotaları
// BURADA YOK: oraya giren biri arama sonucundan gelmez, sitemap'e girmemeli.
//
// oncelik/sikligi = sitemap'teki priority/changefreq.
export const SAYFALAR = [
  {
    yol: '/',
    baslik: 'QRtım — Dijital Kimlik ve Kartvizit Platformu',
    aciklama:
      'Dijital kartvizitinizi QR kod ve NFC kartla paylaşın. Hangi bilginin kime görüneceğini siz seçin. Ücretsiz başlayın; 2 profil, 3 sosyal bağlantı, 2 kurum.',
    oncelik: '1.0',
    sikligi: 'weekly',
  },
  {
    yol: '/nfc-cards',
    baslik: 'NFC Kartvizit Türleri ve Fiyatları — QRtım',
    aciklama:
      'PVC, metal, şeffaf ve bambu NFC kartvizit seçenekleri. Telefona dokundurun, kartınız tarayıcıda açılsın; uygulama gerekmez.',
    oncelik: '0.9',
    sikligi: 'monthly',
  },
  {
    yol: '/iletisim',
    baslik: 'İletişim — QRtım',
    aciklama: 'QRtım ekibine ulaşın: kurumsal teklif, toplu kart siparişi ve destek talepleri.',
    oncelik: '0.6',
    sikligi: 'monthly',
  },
  // Hukuki sayfaların yalnız BAŞLIĞI burada; içerikleri kendi dosyalarında.
  { yol: '/gizlilik', baslik: 'Gizlilik Politikası — QRtım', aciklama: 'QRtım gizlilik politikası.', oncelik: '0.3', sikligi: 'yearly' },
  { yol: '/kvkk', baslik: 'KVKK Aydınlatma Metni — QRtım', aciklama: 'QRtım KVKK aydınlatma metni.', oncelik: '0.3', sikligi: 'yearly' },
  { yol: '/kullanim-sartlari', baslik: 'Kullanım Şartları — QRtım', aciklama: 'QRtım kullanım şartları.', oncelik: '0.3', sikligi: 'yearly' },
  { yol: '/cerez-politikasi', baslik: 'Çerez Politikası — QRtım', aciklama: 'QRtım çerez politikası.', oncelik: '0.3', sikligi: 'yearly' },
]

export const VARSAYILAN = SAYFALAR[0]

export const sayfaBul = (yol) => SAYFALAR.find((s) => s.yol === yol) || null

// ---------------------------------------------------------------------------
// Yapısal veri: kuruluş ve site. Arama motoru ve üretken yapay zekâ
// (GEO) tarafı "bu kim, ne satıyor" sorusunu buradan okur.
// Şirket adı TrendTech Bilişim; QRtım onun ürünü.
// ---------------------------------------------------------------------------
export function kurulusJsonLd() {
  const veri = [
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'TrendTech Bilişim',
      url: KANONIK_ADRES,
      logo: `${KANONIK_ADRES}/qrtim-logo.png`,
      brand: { '@type': 'Brand', name: 'QRtım' },
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: 'QRtım',
      url: KANONIK_ADRES,
      inLanguage: 'tr-TR',
      publisher: { '@type': 'Organization', name: 'TrendTech Bilişim' },
    },
  ]
  return JSON.stringify(veri).replace(/</g, '\\u003c')
}

// ---------------------------------------------------------------------------
// sitemap.xml gövdesi. Derleme anında üretilir; elle güncellenen bir dosya
// olsaydı yeni sayfa eklendiğinde unutulurdu.
// ---------------------------------------------------------------------------
export function siteHaritasi(bugun = new Date().toISOString().slice(0, 10)) {
  const satirlar = SAYFALAR.map(
    (s) =>
      `  <url>\n    <loc>${KANONIK_ADRES}${s.yol === '/' ? '/' : s.yol}</loc>\n` +
      `    <lastmod>${bugun}</lastmod>\n    <changefreq>${s.sikligi}</changefreq>\n` +
      `    <priority>${s.oncelik}</priority>\n  </url>`,
  ).join('\n')
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${satirlar}\n</urlset>\n`
}
