import { useContext } from 'react'
import { ShieldAuthBaglami } from '../contexts/shieldauthBaglam'

// Hassas bir işlemden önce: `if (!(await adimAtla({ sebep: '...' }))) return`
// Bu oturum son 10 dakikada doğrulandıysa pencere açılmaz, hemen true döner.
export function useAdimAtlama() {
  const baglam = useContext(ShieldAuthBaglami)
  if (!baglam) throw new Error('useAdimAtlama, ShieldAuthSaglayici içinde kullanılmalı')
  return baglam
}
