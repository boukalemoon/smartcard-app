// SSS içeriği ve arama motoru gövdesi — React'ten BAĞIMSIZ, düz JavaScript.
//
// NEDEN AYRI DOSYA: Aynı içeriği iki yer okuyor —
//   1) Sorular.jsx            → sayfada çizer
//   2) vite.config.js eklentisi → derleme anında index.html'in <head>'ine
//      schema.org FAQPage gövdesini STATİK olarak basar
// Uygulama bir SPA olduğu için bileşen içinden basılan JSON-LD yalnız JavaScript
// çalıştıran tarayıcıya görünür. Statik basınca içerik HTML'in kendisinde durur.
// Burada JSX ve React importu olmamalı: vite.config.js bunu Node'da import eder.
//
// Tutarlar yazılmaz, src/lib/planlar.js'den okunur: fiyat değişince soru da
// kendiliğinden güncellenir (eski FAQ.jsx bayat rakamlarla yayında kalmıştı).
import { NFC_KART_FIYATI, planBul } from '../../lib/planlar'

const tl = (n) => `${n.toLocaleString('tr-TR')} ₺`

// Yıllıkta kazanılan tutar ve oran, plan verisinden hesaplanır.
function yillikKazanc(anahtar) {
  const p = planBul(anahtar)
  if (!p?.fiyat?.aylik || !p?.fiyat?.yillik) return null
  const onIki = p.fiyat.aylik * 12
  const fark = onIki - p.fiyat.yillik
  if (fark <= 0) return null
  return { fark, oran: Math.round((fark / onIki) * 100), ay: Math.round((fark / p.fiyat.aylik) * 10) / 10 }
}

// YOK: güvenlik/gizlilik ve iptal/iade soruları. İkisi de taahhüt metni;
// kurucu yazacak (bkz. docs/devir-notu.md).
export function soruGruplari() {
  const free = planBul('free')
  const ogrenci = planBul('student')
  const pro = planBul('professional')
  const kazanc = yillikKazanc('professional')

  return [
    {
      ad: 'Kullanım',
      maddeler: [
        {
          s: 'Kartı görmek için uygulama indirmek gerekiyor mu?',
          c: 'Hayır. QR kodunuz telefonun kendi kamerasıyla okunur, NFC kartınız telefona dokundurulur; kartınız doğrudan tarayıcıda açılır. Ne sizin ne de karşınızdaki kişinin uygulama kurması gerekir.',
        },
        {
          s: 'NFC kart hangi telefonlarda çalışır?',
          c: 'NFC donanımı olan Android telefonlarda ve iPhone XR ile sonraki modellerde çalışır. Telefonu kartın üzerine dokundurmak yeterlidir. NFC okumayan bir cihazda kartın üzerindeki QR kod aynı işi görür.',
        },
        {
          s: 'Bilgilerimi değiştirirsem kartı yeniden bastırmam gerekir mi?',
          c: 'Gerekmez. Basılı kart ve QR kod sabit bir adrese gider; o adresteki içeriği panelden güncellersiniz. Değişiklik daha önce paylaştığınız tüm kartlarda aynı anda görünür.',
        },
        {
          s: 'Tek hesapta birden fazla kart tutabilir miyim?',
          c: `Evet, bunlara profil diyoruz: iş, serbest çalışma ve kurum rolünüz için ayrı kartlar tutup her birini ayrı paylaşabilirsiniz. Başlangıç planında ${free.sinir.profil}, Öğrenci'de ${ogrenci.sinir.profil}, Profesyonel'de ${pro.sinir.profil} profil açılır.`,
        },
        {
          s: 'Bazı bilgilerimi herkesin görmesini istemiyorum, mümkün mü?',
          c: 'Her alanın görünürlüğünü ayrı ayrı belirlersiniz: herkese açık, yalnızca kart bağlantısına sahip olana ya da karşılıklı onayla. Telefonunuzu herkese açmadan, yalnız iletişime geçtiğiniz kişiye gösterebilirsiniz.',
        },
        {
          s: 'Kartımı kendi alan adımda yayınlayabilir miyim?',
          c: 'Evet. Kendi alan adınızı bağlayıp kartınızı o adreste yayınlayabilirsiniz; adres doğrulandıktan sonra kart hem QRtım adresinde hem sizin adresinizde açılır.',
        },
        {
          s: 'Kartımdan randevu alınabiliyor mu?',
          c: 'Randevu bloğunu açtığınızda kartınızı açan kişi uygun saatlerden birini seçip talep gönderebilir. Onayladığınız randevu, kendi takvim uygulamanıza ekleyebileceğiniz bir takvim dosyası olarak gelir; ayrıca bir takvim hesabı bağlamanız gerekmez.',
        },
      ],
    },
    {
      ad: 'Ölçüm',
      maddeler: [
        {
          s: 'Ölçüm bölümü ne gösterir, kimin baktığını görebilir miyim?',
          c: 'Kartınızın kaç kez görüntülendiğini, hangi bağlantılara tıklandığını ve kaç kişinin bilgilerinizi rehberine kaydettiğini görürsünüz. Kartınıza bakan kişinin kim olduğu gösterilmez; yalnızca toplam sayılar tutulur.',
        },
      ],
    },
    {
      ad: 'Planlar ve kartlar',
      maddeler: [
        {
          s: 'Ücretsiz planda neler var?',
          c: `Başlangıç planı ücretsizdir ve kart kurmak için yeterlidir: ${free.sinir.profil} profile kadar dijital kart, ${free.sinir.sosyal} sosyal bağlantı, ${free.sinir.kurum} kurum yönetimi ve temel QR kod. Ayrıntılı ölçüm verisi ücretli planlarda açılır.`,
        },
        kazanc && {
          s: 'Yıllık ödemenin aylık ödemeye göre farkı ne?',
          c: `Yıllık ödediğinizde on iki aylık tutara göre ${tl(kazanc.fark)} daha az ödersiniz — Profesyonel planda yaklaşık %${kazanc.oran}, yani ${String(kazanc.ay).replace('.', ',')} aylık ücret. Yıllık planların kart paketli sürümünde ayrıca fiziksel kart da fiyata dahil gelir.`,
        },
        {
          s: 'NFC kartı plandan ayrı alabilir miyim?',
          c: `Evet, tek tek sipariş edebilirsiniz; NFC kart bedeli ${tl(NFC_KART_FIYATI)}. Yıllık planların kart paketli sürümünü seçerseniz plana dahil kart adedi ücret istemeden gelir.`,
        },
        {
          s: 'Öğrenci planı için nasıl doğrulama yapılıyor?',
          c: 'Öğrenci planı okulunuzun verdiği .edu uzantılı e-posta adresiyle doğrulanır. Doğrulama tamamlanana kadar hesabınız ücretsiz planda çalışmaya devam eder.',
        },
      ].filter(Boolean),
    },
  ]
}

// schema.org FAQPage gövdesi. JSON.stringify kaçışı yapar; '<' ayrıca
// <'ye çevrilir ki metinde geçen bir '</script>' dizgesi etiketi
// kapatamasın.
export function faqJsonLd() {
  const veri = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: soruGruplari().flatMap((g) =>
      g.maddeler.map((m) => ({
        '@type': 'Question',
        name: m.s,
        acceptedAnswer: { '@type': 'Answer', text: m.c },
      })),
    ),
  }
  return JSON.stringify(veri).replace(/</g, '\\u003c')
}
