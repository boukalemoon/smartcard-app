// Kartvizit adresinin TEK kaynağı.
//
// NEDEN AYRI BİR DOSYA:
//   QR kod ve NFC kart, adresi üretildiği anda içine BASAR. Basılmış bir kart
//   sonradan düzeltilemez — kişinin cebindeki karta hangi adres yazıldıysa o
//   kalır. Bu yüzden adresi `window.location.origin` üzerinden üretmek
//   kalıcı hasar riski taşır:
//
//     • Vercel önizleme dağıtımından (…-git-main.vercel.app) üretilen bir QR,
//       o geçici adrese işaret eder ve önizleme kapandığında kart ölür.
//     • Domain değiştiğinde (qartim.com → qrtim.com.tr) eski adreste üretilmiş
//       kartlar eski adrese bağlı kalır.
//
//   Bu yüzden adres ortam değişkeninden gelir, tarayıcının o anda hangi
//   adreste olduğundan bağımsızdır.
//
// DOMAIN TAŞIMASINDA YAPILACAK:
//   1. Vercel'de VITE_PUBLIC_URL = https://www.qrtim.com.tr
//   2. Aşağıdaki YEDEK_ADRES sabitini de güncelle
//   3. ESKİ DOMAİNİ KAPATMA. Bugüne kadar basılmış her kart qartim.com diyor;
//      o adres süresiz yenilenmeli ve yolu koruyarak kalıcı yönlendirilmeli
//      (qartim.com/card/ahmet → qrtim.com.tr/card/ahmet).

// Ortam değişkeni tanımsız kalırsa üretimde kullanılacak adres.
// Önizleme adresine düşmektense bilinen üretim adresine düşmek daha güvenli.
const YEDEK_ADRES = 'https://www.qartim.com'

function normalize(deger) {
  if (!deger) return null
  const temiz = String(deger).trim().replace(/\/+$/, '')
  if (!temiz) return null
  try {
    const u = new URL(temiz)
    // Yanlış yazılmış bir değişken basılı karta girmesin.
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return temiz
  } catch {
    return null
  }
}

const yapilandirilmis = normalize(import.meta.env.VITE_PUBLIC_URL)

if (!yapilandirilmis && !import.meta.env.DEV) {
  // Üretimde bu uyarı görünüyorsa Vercel'de değişken tanımlı değil demektir.
  console.warn(
    '[siteUrl] VITE_PUBLIC_URL tanımlı değil; yedek adres kullanılıyor:',
    YEDEK_ADRES
  )
}

/**
 * Kartvizitlerin ve paylaşım bağlantılarının yayımlandığı genel adres.
 * Sonunda eğik çizgi YOKTUR.
 */
export const SITE_URL =
  yapilandirilmis ||
  (import.meta.env.DEV && typeof window !== 'undefined'
    ? window.location.origin // yerel geliştirmede localhost ile test edilebilsin
    : YEDEK_ADRES)

/** Bir kullanıcının herkese açık kartvizit adresi. */
export function cardUrl(username) {
  return `${SITE_URL}/card/${username ?? ''}`
}

/**
 * Ana profil dışındaki bir profilin (persona) kısa bağlantısı.
 * Kod tahmin edilemez; kullanıcı yenilerse eski bağlantı ve QR çalışmaz.
 */
export function personaUrl(shareCode) {
  return `${SITE_URL}/k/${shareCode ?? ''}`
}

/**
 * BASILI kartın (QR / NFC) kalıcı adresi.
 *
 * NEDEN KULLANICI ADI DEĞİL: kullanıcı adı değiştirilebiliyor ve değiştiği
 * anda basılmış bütün kartlar ölüyordu. Kart kodu kalıcıdır, kullanıcı adından
 * bağımsızdır ve "o an hangi profil ana profilse onu göster" diye çözülür —
 * yani basılan kart sonradan başka bir profile yönlendirilebilir.
 * Kart kaybolursa kod yenilenir ve eski baskılar bilerek geçersiz olur.
 */
export function kartKoduUrl(cardCode) {
  return `${SITE_URL}/k/${cardCode ?? ''}`
}

/**
 * Adrese geliş kaynağı işaretini ekler: QR koda basılan ve NFC karta yazılan
 * adres kendini tanıtsın diye.
 *
 * NEDEN: Kurum panelinde "QR tarama" sütunu vardı ama hiçbir zaman dolmuyordu;
 * çünkü QR ile gelen ziyaretçi ile adresi elle yazan ziyaretçi birbirinden
 * ayırt edilemiyordu. İşaret yalnızca QR/NFC adresine basılır — paylaşılan
 * veya kopyalanan bağlantıda görünmez.
 *
 * Daha önce basılmış kartlarda bu işaret yoktur; onlar "doğrudan" sayılır.
 */
export function kaynakliAdres(url, kaynak) {
  if (!url || !kaynak) return url
  return `${url}${url.includes('?') ? '&' : '?'}k=${encodeURIComponent(kaynak)}`
}

/** Davet bağlantısı. */
export function signupUrl(referralCode) {
  return `${SITE_URL}/signup?ref=${encodeURIComponent(referralCode ?? '')}`
}
