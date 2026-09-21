// ZİYARETÇİ İÇİN "TAKVİMİME EKLE"
//
// Randevuyu alan kişinin bizde hesabı yok ve takvimine abone olamayız.
// Ona tek seferlik bir .ics dosyası veriyoruz: Gmail, Outlook/Hotmail,
// Apple Takvim ve kurumsal Exchange dosyayı açıp olayı ekliyor. Sağlayıcı
// başına entegrasyon gerekmiyor.
//
// Dosya TARAYICIDA üretilir; sunucuya gitmez.

// RFC 5545: TEXT değeri kontrol karakteri İÇEREMEZ.
//
// Temizlenmezse yalın CR (\r) bazı takvim uygulamalarında SATIR SONU sayılır.
// Randevu formuna "Ali\rBEGIN:VALARM\rACTION:DISPLAY..." yazan biri, kart
// sahibinin takvimine uydurma kayıt ve alarm düşürebilir; katı davranan bir
// uygulamada ise dosyanın TAMAMI reddedilir ve kişinin bütün takvim
// aboneliği bozulur. Denendi: temizlik öncesi sahte ACTION:DISPLAY satırı
// üretilen dosyada gerçekten ayrı bir satır olarak çıkıyordu.
//
// Sunucu (book_appointment) aynı temizliği kayıt anında da yapıyor; burada
// ikinci kez yapıyoruz çünkü tek savunmaya bağlı kalmak, o savunma bir gün
// gevşediğinde sessizce açığa dönüşür.
function kacir(metin) {
  return String(metin ?? '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n')
}

// RFC 5545: satırlar 75 okteti geçemez; uzun satır katlanır. Katlanmayan
// dosyayı bazı takvimler sessizce bozuk okur. 500 karakterlik bir açıklama
// bu sınırı tek başına altı kat aşıyordu.
function katla(satir) {
  const kodlayici = new TextEncoder()
  if (kodlayici.encode(satir).length <= 73) return satir
  const parcalar = []
  let mevcut = ''
  let uzunluk = 0
  for (const karakter of satir) {
    const k = kodlayici.encode(karakter).length
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
  // Geçersiz tarihte toISOString istisna fırlatır. O istisna düğmenin
  // onClick'i içinde sessizce yutuluyor, kullanıcı ise "hiçbir şey olmadı"
  // görüyordu: ne dosya iniyor ne hata çıkıyordu.
  if (Number.isNaN(d.getTime())) return null
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function randevuIcsOlustur({ id, baslar, biter, kartSahibi, aciklama, konum }) {
  const bas = zaman(baslar)
  const bit = zaman(biter)
  if (!bas || !bit) return null

  const satirlar = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//QRtim//Randevu//TR',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${kacir(id || Date.now())}@qrtim`,
    `DTSTAMP:${zaman(new Date().toISOString())}`,
    `DTSTART:${bas}`,
    `DTEND:${bit}`,
    katla(`SUMMARY:${kacir(kartSahibi ? `Randevu — ${kartSahibi}` : 'Randevu')}`),
    aciklama ? katla(`DESCRIPTION:${kacir(aciklama)}`) : null,
    konum ? katla(`LOCATION:${kacir(konum)}`) : null,
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
  if (!icerik) return false

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
  return true
}
