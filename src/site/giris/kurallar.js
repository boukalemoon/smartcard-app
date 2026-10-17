// Kimlik ekranlarının (giriş, kayıt, şifre yenileme) ortak kuralları.
//
// Şifre asgari uzunluğu TEK yerde: kayıt formu da yeni şifre formu da buradan
// okur. Supabase panelinde (Authentication → Policies) de aynı değer olmalı,
// aksi halde bu yalnızca arayüz kontrolü kalır.
export const MIN_SIFRE = 8

// Şifre gücü göstergesi YOL GÖSTERİR, kural koymaz: zorunlu olan yalnızca
// MIN_SIFRE. Seviye uzunluk ve karakter çeşitliliğinden hesaplanır.
//   0 boş · 1 kısa (kabul edilmez) · 2 yeterli · 3 iyi · 4 güçlü
export function sifreGucu(sifre) {
  const s = String(sifre ?? '')
  if (!s) return { seviye: 0, etiket: '' }
  const cesit = [/[a-zçğıöşü]/, /[A-ZÇĞİÖŞÜ]/, /\d/, /[^A-Za-z0-9çğıöşüÇĞİÖŞÜ]/].filter((r) => r.test(s)).length
  const harfRakam = /[A-Za-zçğıöşüÇĞİÖŞÜ]/.test(s) && /\d/.test(s)
  const ayrinti = `${s.length} karakter${harfRakam ? ', harf ve rakam karışık' : ''}`
  if (s.length < MIN_SIFRE) return { seviye: 1, etiket: `Kısa · en az ${MIN_SIFRE} karakter gerekli` }
  if (s.length >= 14 && cesit >= 3) return { seviye: 4, etiket: `Güçlü · ${ayrinti}` }
  if (s.length >= 12 || (harfRakam && cesit >= 3)) return { seviye: 3, etiket: `İyi · ${ayrinti}` }
  return { seviye: 2, etiket: `Yeterli · ${ayrinti}` }
}

// Şifre yenileme akışının adımları (adım göstergesi).
export const SIFRE_ADIMLARI = ['Bağlantı iste', 'Yeni şifre']
