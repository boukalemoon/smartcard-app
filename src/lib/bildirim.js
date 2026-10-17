// BİLDİRİM — tarayıcının alert() kutusu yerine panel içi bildirim
//
// NEDEN: 55'ten fazla yerde alert() vardı; ekranı kilitliyor, mobilde
// sayfanın adresini gösteriyor ve tasarımla hiç uyuşmuyordu. Bileşenlerin
// hepsine useToast() taşımak yerine tek bir fonksiyon: ToastProvider
// açıldığında kendini buraya kaydeder.
let goster = null

export function bildirimKaydet(fn) {
  goster = fn
  return () => { if (goster === fn) goster = null }
}

// Tür verilmezse metinden tahmin edilir: hata/eksik içeren mesaj kırmızı.
const HATA = /(hata|olmad|lemedi|lamad|amad|emedi|zorunlu|geçersiz|gerekli|başarısız|bulunamad|yetki|izin yok|reddedildi|en az|en fazla)/i

export function bildir(mesaj, tur) {
  const metin = String(mesaj ?? '')
  const t = tur || (HATA.test(metin) ? 'error' : 'success')
  if (goster) goster(metin, t)
  else window.alert(metin)
}
