import { useCallback, useEffect, useState } from 'react'
import { MfaChallenge } from '../vendor/shieldauth-react/index.js'
import { supabase } from '../lib/supabaseClient'
import { mfaDurumum } from '../lib/shieldauth'

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

export default function MfaKapisi({ children }) {
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (serbestMi(durum)) return children

  const pencere = (
    <div className="w-full max-w-md space-y-4">
      <div className="text-center">
        <img src="/qrtım-logo.png" alt="QRtım" className="w-14 h-14 mx-auto mb-3 object-contain" />
        <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">İki adımlı doğrulama</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
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
        className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/60 px-4">
          <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl p-6">{pencere}</div>
        </div>
      </>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      {pencere}
    </div>
  )
}
