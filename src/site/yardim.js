// Web sitesi yardımcıları.

// Partner (referans) kodu: ziyaretçi ?ref=KOD ile geldiyse kayıt ve giriş
// bağlantıları kodu taşımalı ki hak ediş doğru partnere yazılsın. Kod ilk
// gelişte saklanır; kişi başka sayfaya geçip sonra kaydolsa da kaybolmaz.
const ANAHTAR = 'qrtim-ref'

export function refKodu() {
  try {
    const url = new URLSearchParams(window.location.search).get('ref')
    if (url && /^[A-Za-z0-9_-]{3,40}$/.test(url)) {
      sessionStorage.setItem(ANAHTAR, url)
      return url
    }
    return sessionStorage.getItem(ANAHTAR)
  } catch {
    return null
  }
}

export function refliAdres(yol) {
  const ref = refKodu()
  if (!ref) return yol
  return `${yol}${yol.includes('?') ? '&' : '?'}ref=${encodeURIComponent(ref)}`
}

// Menü bağlantıları açılış sayfasındaki bölümlere gider. Başka sayfadayken
// "/#planlar" adresi önce ana sayfayı açar, sonra bölüme kaydırır.
export const SITE_MENU = [
  { ad: 'Nasıl çalışır', bolum: 'nasil' },
  { ad: 'Bloklar', bolum: 'bloklar' },
  { ad: 'Kimler için', bolum: 'kimler' },
  { ad: 'Planlar', bolum: 'planlar' },
  { ad: 'Partner ol', bolum: 'partner' },
]
