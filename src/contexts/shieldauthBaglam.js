import { createContext } from 'react'

// AYRI DOSYA: bağlam nesnesi sağlayıcı bileşenle aynı dosyadan dışa
// aktarılırsa hızlı yenileme (fast refresh) bozulur.
export const ShieldAuthBaglami = createContext(null)
