// ÖZEL ALAN ADI ALGILAMA
//
// Kart kişinin kendi adresinde de açılabiliyor (kart.ornek.com.tr). O adreste
// uygulamanın GERİ KALANI açılmaz — yalnızca kart.
//
// NEDEN yalnızca kart: oturum bilgisi tarayıcıda adrese göre ayrılır. Kişi
// kart.ornek.com.tr üzerinde giriş yaparsa bu, qrtim.com.tr'deki oturumundan
// bambaşka bir oturum olur; "giriş yaptım ama panelim boş" diye anlaşılmaz
// bir duruma düşer. Panel tek adreste kalsın.

// QRtım'ın kendi adresleri. Bunlar özel alan adı DEĞİLDİR.
const KENDI_ADRESLERIMIZ = [
  'qrtim.com.tr',
  'qartim.com',
  'localhost',
  '127.0.0.1',
]

export function ozelAlanAdiMi(hostname = window.location.hostname) {
  const h = String(hostname || '').toLowerCase().replace(/^www\./, '')
  if (!h) return false
  // Vercel önizleme dağıtımları da bizim sayılır.
  if (h.endsWith('.vercel.app')) return false
  return !KENDI_ADRESLERIMIZ.some((k) => h === k || h.endsWith('.' + k))
}

export function suAnkiHost(hostname = window.location.hostname) {
  return String(hostname || '').toLowerCase().replace(/^www\./, '')
}
