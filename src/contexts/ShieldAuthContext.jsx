import { useCallback, useMemo, useRef, useState } from 'react'
import { ShieldAuthProvider, MfaChallenge } from '../vendor/shieldauth-react/index.js'
import Modal from '../components/Modal'
import { useTheme } from './ThemeContext'
import { ShieldAuthBaglami } from './shieldauthBaglam'
import { SHIELDAUTH_ENDPOINT, mfaDurumum, shieldauthBasliklari } from '../lib/shieldauth'

// ADIM ATLAMA (step-up) SAĞLAYICISI
//
// NEDEN BURADA: IBAN değişikliği, partner uygulamaya giriş belirteci, QR ile
// başka cihaza oturum onayı ve yönetici dışa aktarması aynı soruyu soruyor:
// "bu oturum az önce doğrulandı mı?" Her ekran kendi penceresini yazsaydı
// kurallar dağılırdı. Tek pencere, tek karar.
//
// Pencere yalnızca KOLAYLIK: asıl kural veritabanında ve Edge Function'larda.
// Birisi bu pencereyi atlayıp isteği doğrudan atsa da işlem geçmez.
export function ShieldAuthSaglayici({ children }) {
  const { theme } = useTheme()
  const [pencere, setPencere] = useState(null) // { sebep, yontemler }
  const bekleyen = useRef(null)

  const bitir = useCallback((sonuc) => {
    bekleyen.current?.(sonuc)
    bekleyen.current = null
    setPencere(null)
  }, [])

  const adimAtla = useCallback(async ({ sebep = 'Bu işlem', zorla = false } = {}) => {
    const durum = await mfaDurumum()
    if (!zorla && durum?.taze_10_dk) return true
    // Doğrulama uygulaması kurmuş kişide e-posta kodu SUNULMAZ: veritabanı onu
    // saymıyor (denetim G-02 — e-postası ele geçirilen hesapta e-posta kodu
    // ikinci faktör olamaz). Telefonu olmayan yedek kodla geçer. TOTP
    // kurmamış kişi doğrulanmış e-postasına gelen kodla geçer.
    const yontemler = durum?.totp_kurulu ? ['totp', 'backup'] : ['email']
    return new Promise((coz) => {
      bekleyen.current = coz
      setPencere({ sebep, yontemler })
    })
  }, [])

  const deger = useMemo(() => ({ adimAtla }), [adimAtla])

  return (
    <ShieldAuthProvider endpoint={SHIELDAUTH_ENDPOINT} locale="tr" theme={theme === 'dark' ? 'dark' : 'light'} headers={shieldauthBasliklari}>
      <ShieldAuthBaglami.Provider value={deger}>
        {children}
        <Modal isOpen={!!pencere} onClose={() => bitir(false)} title="İki adımlı doğrulama" size="md">
          {pencere && (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 dark:text-gray-300">
                {pencere.sebep} için kimliğinizi doğrulayın.
              </p>
              <MfaChallenge methods={pencere.yontemler} onVerified={() => bitir(true)} />
            </div>
          )}
        </Modal>
      </ShieldAuthBaglami.Provider>
    </ShieldAuthProvider>
  )
}
