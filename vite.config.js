import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ARAMA MOTORU VE ÜRETKEN YAPAY ZEKÂ (SEO / GEO) ÜRETİMLERİ
//
// Hepsi DERLEME ANINDA üretilir, elle güncellenen dosya yoktur: fiyat ya da
// sayfa eklendiğinde unutulup bayatlamasın. Tek kaynaklar:
//   src/lib/sayfaMeta.js → sayfa listesi, kanonik adres, kuruluş verisi
//   src/site/acilis/sorularVerisi.js → SSS (tutarları planlar.js'ten alır)
//   src/lib/planlar.js → plan ve kart fiyatları
//
// Uygulama tek sayfalık (SPA) olduğu için bileşen içinden basılan yapısal veri
// yalnız JavaScript çalıştıran tarayıcıya görünür. Statik basınca içerik
// HTML'in kendisinde durur.
function aramaMotoruVerisi() {
  // Sunucu (--ssr) derlemesinde çalışmaz: o derlemenin index.html'i yok ve
  // sitemap/llms.txt'i istemci derlemesi üretir. Çift üretim dist-ssr'a
  // çöp dosya bırakırdı.
  let ssr = false
  return {
    name: 'qrtim-seo',

    configResolved(config) {
      ssr = !!config.build?.ssr
    },

    // index.html'in <head>'ine yapısal veri (SSS + kuruluş/site).
    async transformIndexHtml() {
      if (ssr) return []
      const { faqJsonLd } = await import('./src/site/acilis/sorularVerisi.js')
      const { kurulusJsonLd } = await import('./src/lib/sayfaMeta.js')
      return [
        { tag: 'script', attrs: { type: 'application/ld+json' }, children: kurulusJsonLd(), injectTo: 'head' },
        { tag: 'script', attrs: { type: 'application/ld+json' }, children: faqJsonLd(), injectTo: 'head' },
      ]
    },

    // sitemap.xml ve llms.txt.
    //
    // llms.txt: üretken arama motorlarının (ChatGPT, Perplexity, AI Overviews)
    // siteyi özetlerken okuduğu düz metin dosyası. Fiyatları planlar.js'ten
    // üretiyoruz; elle yazılsaydı ilk fiyat değişikliğinde yanlış bilgi
    // veren bir dosya olurdu — yanlış fiyat, yanlış alıntı demek.
    async generateBundle() {
      if (ssr) return
      const { siteHaritasi, SAYFALAR, KANONIK_ADRES } = await import('./src/lib/sayfaMeta.js')
      const { PLANLAR, KART_FIYATLARI } = await import('./src/lib/planlar.js')
      const { soruGruplari } = await import('./src/site/acilis/sorularVerisi.js')

      this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: siteHaritasi() })

      const tl = (n) => `${n.toLocaleString('tr-TR')} ₺`
      const planSatiri = (p) => {
        if (p.anahtar === 'free') return `- ${p.ad}: ücretsiz (${p.sinir.profil} profil, ${p.sinir.sosyal} sosyal bağlantı, ${p.sinir.kurum} kurum)`
        const ek = p.fiyat.yillikKartli ? `, yıllık + 1 kart ${tl(p.fiyat.yillikKartli)}` : p.kartTeklif ? ', toplu kart teklifle' : ''
        return `- ${p.ad}: ${tl(p.fiyat.aylik)}/ay, yıllık ${tl(p.fiyat.yillik)}${ek}`
      }

      const llms = [
        '# QRtım',
        '',
        '> Dijital kimlik ve kartvizit platformu. Kartvizitiniz QR kod ve NFC kartla paylaşılır;',
        '> her bilginin kime görüneceğini kart sahibi alan alan belirler. TrendTech Bilişim ürünü.',
        '',
        `Adres: ${KANONIK_ADRES}`,
        'Dil: Türkçe (arayüz Türkçe varsayılan, İngilizce de var)',
        '',
        '## Ne yapar',
        '',
        '- Dijital kartvizit: ziyaretçi uygulama kurmadan, telefon kamerasıyla QR okutarak ya da NFC kartı dokundurarak açar.',
        '- Alan bazlı görünürlük: her bilgi herkese açık, yalnız bağlantısı olana ya da karşılıklı onayla görünür.',
        '- Birden çok profil: iş, kişisel ve kurum rolü için ayrı kartlar, her birinin kendi QR kodu.',
        '- Doğrulanmış kimlik: alan adı DNS doğrulaması ve kurum yöneticisi onayı.',
        '- Randevu: kart üzerinden talep, onaylanınca takvim dosyası.',
        '- Özel alan adı: kart kişinin kendi adresinde yayınlanabilir.',
        '- Kurum ve STK yönetimi: üye dizini, başvuru sistemi, kurum ölçümü.',
        '',
        '## Planlar ve fiyatlar',
        '',
        ...PLANLAR.map(planSatiri),
        '',
        `Yıllık ödeme on iki aylık tutardan yaklaşık %17 düşüktür (iki ay bedelsiz).`,
        '',
        '## Fiziksel kart fiyatları',
        '',
        `- PVC NFC kart: ${tl(KART_FIYATLARI.pvc)}`,
        `- Metal kart: ${tl(KART_FIYATLARI.metal)}`,
        `- Şeffaf kart: ${tl(KART_FIYATLARI.seffaf)}`,
        `- Bambu kart: ${tl(KART_FIYATLARI.bambu)}`,
        '',
        'Kart satın almak için abonelik şart değildir: ücretsiz planla da kullanılabilir.',
        '',
        '## Sıkça sorulanlar',
        '',
        ...soruGruplari().flatMap((g) => g.maddeler.flatMap((m) => [`### ${m.s}`, '', m.c, ''])),
        '## Sayfalar',
        '',
        ...SAYFALAR.map((s) => `- [${s.baslik}](${KANONIK_ADRES}${s.yol})`),
        '',
      ].join('\n')

      this.emitFile({ type: 'asset', fileName: 'llms.txt', source: llms })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), aramaMotoruVerisi()],
})
