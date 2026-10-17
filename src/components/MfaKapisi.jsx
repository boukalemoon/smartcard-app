import { useCallback, useEffect, useState } from 'react'
import { MfaChallenge } from '../vendor/shieldauth-react/index.js'
import { supabase } from '../lib/supabaseClient'
import { mfaDurumum } from '../lib/shieldauth'
import { MFA_AKTIF } from '../lib/mfaAyari'
import { Yukleniyor } from '../site/giris/parcalar'

// GİRİŞ KAPISI — doğrulama uygulaması kurmuş kişi panele girmeden önce
//
// Şifre doğru girildiğinde Supabase oturumu zaten açılır; bu kapı o oturumun
// iki adımlı doğrulamadan geçmesini ister (12 saatte bir). Kapı arayüzdür;
// asıl kural veritabanında: TOTP kurmuş kişinin kimlik tablolarına yazması
// aynı 12 saatlik doğrulamayı ister (denetim G-01, guard_identity_write_mfa).
//
// SÜRE DOLUNCA: panel açık kalırken 12 saat geçerse veritabanı yazmaları
// reddetmeye başlar. Kapı bunu kendisi fark eder (sekmeye dönüldüğünde ve
// birkaç dakikada bir) ve paneli kapatmadan üstüne doğrulama penceresi açar;
// yazılmamış form verisi kaybolmaz.
//
// Yöntem: TOTP ve yedek kod. E-posta kodu sunulmaz, veritabanı onu bu kişide
// saymıyor (denetim G-02).
//
// Doğrulama uygulaması kurmamış kişi için kapı yok (aşamalı geçiş).
const YOKLAMA_MS = 60 * 1000

const serbestMi = (d) => !d?.totp_kurulu || d.taze_12_saat

// Doğrulama servisi kapalıyken kapı yok (bkz. lib/mfaAyari.js).
export default function MfaKapisi({ children }) {
  return MFA_AKTIF ? <MfaKapisiAcik>{children}</MfaKapisiAcik> : children
}

function MfaKapisiAcik({ children }) {
  const [durum, setDurum] = useState(undefined)
  // Panel bu oturumda en az bir kez açıldı mı (süre dolunca üstüne pencere).
  const [gecti, setGecti] = useState(false)

  const uygula = useCallback((d) => {
    setDurum(d)
    if (serbestMi(d)) setGecti(true)
  }, [])

  const yokla = useCallback(async () => {
    uygula(await mfaDurumum())
  }, [uygula])

  useEffect(() => {
    let iptal = false
    mfaDurumum().then((d) => { if (!iptal) uygula(d) })
    const gorunurluk = () => { if (document.visibilityState === 'visible') yokla() }
    document.addEventListener('visibilitychange', gorunurluk)
    const zamanlayici = setInterval(yokla, YOKLAMA_MS)
    return () => {
      iptal = true
      document.removeEventListener('visibilitychange', gorunurluk)
      clearInterval(zamanlayici)
    }
  }, [yokla, uygula])

  if (durum === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zemin">
        <Yukleniyor />
      </div>
    )
  }

  if (serbestMi(durum)) return children

  const pencere = (
    <div className="w-full flex flex-col gap-5 text-metin">
      <div className="flex flex-col items-center text-center gap-3">
        {/* Logo PNG'si beyaz zeminli: koyu temada beyaz yüzey içinde durur. */}
        <span className="inline-flex rounded-lg dark:bg-white dark:px-2 dark:py-1">
          <img src="/qrtim-logo.png" alt="QRtım" width="240" height="68" className="h-9 w-auto" />
        </span>
        <h1 className="font-baslik text-2xl font-extrabold tracking-[-0.015em]">İki adımlı doğrulama</h1>
        <p className="text-sm text-metin-2">
          {gecti
            ? 'Doğrulamanızın süresi doldu. Devam etmek için yeniden doğrulayın.'
            : 'Hesabınız doğrulama uygulamasıyla korunuyor.'}
        </p>
      </div>
      <MfaChallenge
        methods={['totp', 'backup']}
        onVerified={yokla}
      />
      <button
        type="button"
        onClick={() => supabase.auth.signOut()}
        className="self-center text-sm font-semibold text-metin-2 hover:text-metin rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksan"
      >
        Çıkış yap
      </button>
    </div>
  )

  // Panel daha önce açıldıysa kapatılmaz; doğrulama üstüne gelir.
  if (gecti) {
    return (
      <>
        {children}
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-lacivert-950/60 px-4">
          <div role="dialog" aria-modal="true" className="w-full max-w-[460px] bg-yuzey border border-cizgi rounded-[20px] p-6 sm:p-8">{pencere}</div>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-zemin px-4 py-10">
      <div className="w-full max-w-[460px] bg-yuzey border border-cizgi rounded-[20px] p-6 sm:p-8">{pencere}</div>
    </div>
  )
}
