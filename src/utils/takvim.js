// ZİYARETÇİ İÇİN "TAKVİMİME EKLE"
//
// Randevuyu alan kişinin bizde hesabı yok ve takvimine abone olamayız.
// Ona tek seferlik bir .ics dosyası veriyoruz: Gmail, Outlook/Hotmail,
// Apple Takvim ve kurumsal Exchange dosyayı açıp olayı ekliyor. Sağlayıcı
// başına entegrasyon gerekmiyor.
//
// Dosya TARAYICIDA üretilir; sunucuya gitmez.

function kacir(metin) {
  return String(metin ?? '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

function zaman(iso) {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function randevuIcsOlustur({ id, baslar, biter, kartSahibi, aciklama, konum }) {
  const satirlar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QRtim//Randevu//TR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${id || Date.now()}@qrtim`,
    `DTSTAMP:${zaman(new Date().toISOString())}`,
    `DTSTART:${zaman(baslar)}`,
    `DTEND:${zaman(biter)}`,
    `SUMMARY:${kacir(kartSahibi ? `Randevu — ${kartSahibi}` : 'Randevu')}`,
    aciklama ? `DESCRIPTION:${kacir(aciklama)}` : null,
    konum ? `LOCATION:${kacir(konum)}` : null,
    'STATUS:CONFIRMED',
    // Bir saat önce hatırlatma: hatırlatmayı kişinin kendi takvimi yapar,
    // bizim e-posta göndermemize gerek kalmaz.
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${kacir('Randevu hatırlatması')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean)

  return satirlar.join('\r\n') + '\r\n'
}

export function randevuIcsIndir(randevu) {
  const icerik = randevuIcsOlustur(randevu)
  const blob = new Blob([icerik], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'randevu.ics'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // Tarayıcı indirmeyi başlatana kadar adres yaşasın.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
