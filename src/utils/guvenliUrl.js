// Yalnızca http/https bağlantı (denetim Y-5 ve D-16).
//
// 'javascript:' ve 'data:' şemaları tıklayanın tarayıcısında kod çalıştırabilir.
// Herkese açık kart bunu PublicCard içindeki aynı kuralla süzüyordu; panel ve
// önizleme bileşenleri ise bağlantıyı ham basıyordu. Hepsi buradan geçer.
// Geçersiz → null: çağıran bağlantıyı hiç çizmez.
export function guvenliUrl(url) {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url.trim())
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null
  } catch {
    return null
  }
}
