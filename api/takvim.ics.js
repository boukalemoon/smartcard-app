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

// RFC 5545: ters bölü, noktalı virgül, virgül ve satır sonu kaçırılır.
function kacir(metin) {
  return String(metin ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
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
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

const DURUM_ICS = {
  onaylandi: 'CONFIRMED',
  bekliyor: 'TENTATIVE',
  iptal: 'CANCELLED',
  tamamlandi: 'CONFIRMED',
}

const KAYNAK_ADI = { qr: 'QR kod', nfc: 'NFC kart', link: 'Bağlantı', direct: 'Doğrudan' }

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

    satirlar.push(
      'BEGIN:VEVENT',
      // Sabit kimlik: aynı randevu her tazelemede aynı olay olarak tanınsın,
      // yoksa her tazelemede kopya oluşurdu.
      `UID:${r.id}@qrtim`,
      `DTSTAMP:${zaman(r.created_at || r.baslar_at)}`,
      `DTSTART:${zaman(r.baslar_at)}`,
      `DTEND:${zaman(r.biter_at)}`,
      katla(`SUMMARY:${kacir(r.ad)}${r.durum === 'bekliyor' ? ' (onay bekliyor)' : ''}`),
      katla(`DESCRIPTION:${kacir(aciklama)}`),
      `STATUS:${DURUM_ICS[r.durum] || 'TENTATIVE'}`,
      // Sıra numarası: iptal/onay değişikliğinin takvimde güncellenmesi için.
      `SEQUENCE:${r.durum === 'iptal' ? 2 : r.durum === 'onaylandi' ? 1 : 0}`,
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
