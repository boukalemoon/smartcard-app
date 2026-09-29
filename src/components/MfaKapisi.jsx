import { useEffect, useState } from 'react'
import { MfaChallenge } from '../vendor/shieldauth-react/index.js'
import { supabase } from '../lib/supabaseClient'
import { mfaDurumum } from '../lib/shieldauth'

// GİRİŞ KAPISI — doğrulama uygulaması kurmuş kişi panele girmeden önce
//
// Şifre doğru girildiğinde Supabase oturumu zaten açılır; bu kapı o oturumun
// iki adımlı doğrulamadan geçmesini ister (12 saatte bir). Kapı arayüzdür;
// yönetici RPC'leri ve IBAN değişikliği veritabanında ayrıca korunur, yani
// kapıyı atlatmak o işlemleri açmaz.
//
// Doğrulama uygulaması kurmamış kişi için kapı yok (aşamalı geçiş).
export default function MfaKapisi({ children }) {
  const [durum, setDurum] = useState(undefined)

  useEffect(() => {
    let iptal = false
    mfaDurumum().then((d) => { if (!iptal) setDurum(d) })
    return () => { iptal = true }
  }, [])

  if (durum === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!durum?.totp_kurulu || durum.taze_12_saat) return children

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="w-full max-w-md space-y-4">
        <div className="text-center">
          <img src="/qrtım-logo.png" alt="QRtım" className="w-14 h-14 mx-auto mb-3 object-contain" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-gray-100">İki adımlı doğrulama</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Hesabınız doğrulama uygulamasıyla korunuyor.</p>
        </div>
        <MfaChallenge
          methods={['totp', 'email', 'backup']}
          onVerified={() => mfaDurumum().then(setDurum)}
        />
        <button
          type="button"
          onClick={() => supabase.auth.signOut()}
          className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          Çıkış yap
        </button>
      </div>
    </div>
  )
}
