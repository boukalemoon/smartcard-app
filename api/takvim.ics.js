// TAKVİM BESLEMESİ — /api/takvim.ics?anahtar=...
//
// NEDEN VERCEL'DE, SUPABASE EDGE FUNCTION'DA DEĞİL:
//   Takvim uygulamaları (Google Takvim, Outlook, Apple Takvim) bir adrese
//   abone olurken ÖZEL BAŞLIK GÖNDEREMEZ. Supabase Edge Function'ları JWT
//   başlığı bekler; abonelik oradan çalışmaz. Burada çalışır.
//
// KİMLİK: adresteki anahtarın kendisi. Sunucu anahtarı doğrulayan bir
// veritabanı fonksiyonu çağırır (SECURITY DEFINER); burada gizli anahtar
// tutulmaz — yalnızca herkese açık olan anon anahtarı kullanılır.
//
// NOT (dürüstlük): abone olunan takvimleri sağlayıcılar KENDİ aralıklarıyla
// tazeler. Google birkaç saate kadar bekletebilir, Outlook da öyle. Yani bu
// besleme "anında" değildir; yeni randevuyu anında görmek için panel var.
// Arayüzde bunu açıkça yazıyoruz.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

// RFC 5545: TEXT değeri kontrol karakteri İÇEREMEZ; ters bölü, noktalı
// virgül, virgül ve satır sonu kaçırılır.
//
// Yalın CR bazı takvim uygulamalarında SATIR SONU sayılır. Randevu formuna
// sahte ICS satırları yazan KİMLİKSİZ biri, kart sahibinin takvimine uydurma
// kayıt ve alarm düşürebilir; katı davranan bir uygulamada ise dosyanın
// TAMAMI reddedilir ve kişinin bütün takvim aboneliği bozulur. Denendi:
// temizlik öncesi sahte bir ACTION:DISPLAY satırı gerçekten ayrı satır
// olarak üretiliyordu. Sunucu (book_appointment) aynı temizliği kayıt anında
// da yapıyor; tek savunmaya bağlı kalmıyoruz.
function kacir(metin) {
  return String(metin ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

// RFC 5545: satırlar 75 oktetten uzun olamaz; uzun satır katlanır.
// Katlanmayan dosyayı bazı takvimler sessizce bozuk okur.
function katla(satir) {
  const bayt = Buffer.from(satir, 'utf8')
  if (bayt.length <= 73) return satir
  const parcalar = []
  let mevcut = ''
  let uzunluk = 0
  for (const karakter of satir) {
    const k = Buffer.byteLength(karakter, 'utf8')
    // İlk satır 73, devam satırları (başında boşluk) 72 oktet.
    const sinir = parcalar.length === 0 ? 73 : 72
    if (uzunluk + k > sinir) {
      parcalar.push(mevcut)
      mevcut = ''
      uzunluk = 0
    }
    mevcut += karakter
    uzunluk += k
  }
  if (mevcut) parcalar.push(mevcut)
  return parcalar[0] + parcalar.slice(1).map((p) => '\r\n ' + p).join('')
}

function zaman(iso) {
  const d = new Date(iso)
  // Geçersiz tarihte toISOString istisna fırlatır ve besleme 500 verirdi.
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

// Object.create(null): düz nesnede "constructor" gibi bir değer, prototip
// zincirinden fonksiyon kaynağı döndürüp dosyaya basardı. Bugün veritabanı
// kısıtları buna izin vermiyor ama kısıt gevşerse sessiz bir açığa dönüşür.
const DURUM_ICS = Object.assign(Object.create(null), {
  onaylandi: 'CONFIRMED',
  bekliyor: 'TENTATIVE',
  iptal: 'CANCELLED',
  tamamlandi: 'CONFIRMED',
})

// SEQUENCE yalnızca ARTMALI: küçülen sıra numaralı güncellemeyi birçok takvim
// yok sayar. Önceki hâlde onaylanan randevu 1, sonra tamamlanınca 0'a düşüyordu.
const SIRA = Object.assign(Object.create(null), {
  bekliyor: 0, onaylandi: 1, tamamlandi: 2, iptal: 3,
})

const KAYNAK_ADI = Object.assign(Object.create(null), {
  qr: 'QR kod', nfc: 'NFC kart', link: 'Bağlantı', direct: 'Doğrudan',
})

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).end()
    return
  }

  const anahtar = String(req.query?.anahtar ?? '')
  if (!/^[0-9a-f]{32}$/.test(anahtar) || !SUPABASE_URL || !SUPABASE_ANON) {
    res.status(404).end()
    return
  }

  let veri = null
  try {
    const cevap = await fetch(`${SUPABASE_URL}/rest/v1/rpc/appointment_calendar_feed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON,
        Authorization: `Bearer ${SUPABASE_ANON}`,
      },
      body: JSON.stringify({ p_anahtar: anahtar }),
    })
    if (cevap.ok) veri = await cevap.json()
  } catch {
    res.status(502).end()
    return
  }

  // Geçersiz anahtarda da 404: geçerli bir anahtarın var olup olmadığını
  // farklı cevaplarla sızdırmayız.
  if (!veri?.ok) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(404).end()
    return
  }

  const satirlar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QRtim//Randevu//TR',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${kacir('QRtım Randevular')}`,
    'X-WR-TIMEZONE:Europe/Istanbul',
    // Sağlayıcıya tazeleme aralığı önerisi. Uyup uymamak onlara kalmış.
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
  ]

  for (const r of veri.randevular || []) {
    const kimlik = [r.ad, r.telefon, r.eposta].filter(Boolean).join(' · ')
    const aciklama = [
      kimlik,
      r.aciklama ? `Konu: ${r.aciklama}` : null,
      r.kaynak ? `Nereden: ${KAYNAK_ADI[r.kaynak] || r.kaynak}` : null,
      r.durum === 'bekliyor' ? 'Bu randevu henüz onaylanmadı.' : null,
    ].filter(Boolean).join('\n')

    const bas = zaman(r.baslar_at)
    const bit = zaman(r.biter_at)
    // Tarihi çözülemeyen TEK kayıt yüzünden bütün beslemeyi düşürmeyiz.
    if (!bas || !bit) continue

    satirlar.push(
      'BEGIN:VEVENT',
      // Sabit kimlik: aynı randevu her tazelemede aynı olay olarak tanınsın,
      // yoksa her tazelemede kopya oluşurdu.
      `UID:${kacir(r.id)}@qrtim`,
      `DTSTAMP:${zaman(r.created_at) || bas}`,
      `DTSTART:${bas}`,
      `DTEND:${bit}`,
      katla(`SUMMARY:${kacir(r.ad)}${r.durum === 'bekliyor' ? ' (onay bekliyor)' : ''}`),
      katla(`DESCRIPTION:${kacir(aciklama)}`),
      `STATUS:${DURUM_ICS[r.durum] || 'TENTATIVE'}`,
      `SEQUENCE:${SIRA[r.durum] ?? 0}`,
      'END:VEVENT',
    )
  }

  satirlar.push('END:VCALENDAR')

  res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
  res.setHeader('Content-Disposition', 'inline; filename="qrtim-randevular.ics"')
  // Takvim uygulaması tazelesin diye önbelleğe alınmaz.
  res.setHeader('Cache-Control', 'no-store')
  res.status(200).send(satirlar.join('\r\n') + '\r\n')
}
