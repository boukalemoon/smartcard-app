import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { mfaDurumum } from '../lib/shieldauth'
import { useAdimAtlama } from '../hooks/useAdimAtlama'

// PAROLA YENİLEME — "Şifremi unuttum" e-postasındaki bağlantının indiği sayfa
//
// Bağlantı Supabase'in kurtarma oturumunu açar (adres çubuğundaki belirteç ya
// da /auth/confirm üzerinden token_hash). Bu sayfa yalnızca oturum varsa yeni
// parola formunu gösterir.
//
// İKİ ADIMLI DOĞRULAMA: e-posta kutusunu ele geçiren biri parola sıfırlama
// bağlantısını da alır. Doğrulama uygulaması kurmuş kişiye bu formda TOTP ya
// da yedek kod sorulur.
//
// SINIR (dürüstlük): bu bir ARAYÜZ adımıdır. Kurtarma bağlantısı tam bir
// Supabase oturumu açar; o oturumla supabase.auth.updateUser() doğrudan
// çağrılabilir. Parola değişse bile saldırgan kimlik verisine YAZAMAZ
// (veritabanı kapısı, denetim G-01) ama gerçek sahibi parolasıyla giremez.
// Kalıcı çözüm Supabase'in yerleşik MFA seviyesi (aal2) — Faz 2.
const MIN_PAROLA = 8

export default function SifreYenile() {
  const navigate = useNavigate()
  const { adimAtla } = useAdimAtlama()
  const [oturum, setOturum] = useState(undefined)
  const [parola, setParola] = useState('')
  const [tekrar, setTekrar] = useState('')
  const [mesgul, setMesgul] = useState(false)
  const [hata, setHata] = useState('')
  const [bitti, setBitti] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setOturum(data.session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setOturum(s ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const gonder = async (e) => {
    e.preventDefault()
    setHata('')
    if (parola.length < MIN_PAROLA) return setHata(`Parola en az ${MIN_PAROLA} karakter olmalı.`)
    if (parola !== tekrar) return setHata('Parolalar eşleşmiyor.')

    setMesgul(true)
    try {
      const durum = await mfaDurumum()
      if (durum?.totp_kurulu) {
        const tamam = await adimAtla({ sebep: 'Parolanızı değiştirmek', zorla: true })
        if (!tamam) {
          setHata('Parolayı değiştirmek için iki adımlı doğrulama gerekiyor.')
          return
        }
      }
      const { error } = await supabase.auth.updateUser({ password: parola })
      if (error) {
        const m = (error.message ?? '').toLowerCase()
        if (m.includes('same') || m.includes('different')) setHata('Yeni parola eskisinden farklı olmalı.')
        else if (m.includes('weak') || m.includes('characters')) setHata('Parola yeterince güçlü değil. Daha uzun bir parola deneyin.')
        else setHata('Parola değiştirilemedi. Bağlantının süresi dolmuş olabilir; yeniden sıfırlama isteyin.')
        return
      }
      setBitti(true)
      setTimeout(() => navigate('/dashboard'), 1500)
    } finally {
      setMesgul(false)
    }
  }

  const kutu = (icerik) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <h1 className="text-xl font-bold text-gray-800 text-center mb-6">Yeni parola belirleyin</h1>
        {icerik}
        {hata && <p className="mt-4 text-sm text-red-600 text-center">{hata}</p>}
      </div>
    </div>
  )

  if (oturum === undefined) return kutu(<p className="text-center text-gray-500">Yükleniyor...</p>)

  if (!oturum) {
    return kutu(
      <div className="text-center space-y-4">
        <p className="text-gray-600">
          Bağlantı geçersiz ya da süresi dolmuş. Giriş ekranından yeniden "Şifremi unuttum" isteyin.
        </p>
        <button onClick={() => navigate('/login')} className="text-blue-600 hover:underline text-sm font-medium">
          Giriş ekranına dön
        </button>
      </div>
    )
  }

  if (bitti) return kutu(<p className="text-center text-gray-700">Parolanız değiştirildi. Panele yönlendiriliyorsunuz...</p>)

  return kutu(
    <form onSubmit={gonder} className="space-y-4">
      <input
        type="password" required minLength={MIN_PAROLA} autoComplete="new-password"
        value={parola} onChange={(e) => setParola(e.target.value)}
        placeholder={`Yeni parola (en az ${MIN_PAROLA} karakter)`}
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
      />
      <input
        type="password" required minLength={MIN_PAROLA} autoComplete="new-password"
        value={tekrar} onChange={(e) => setTekrar(e.target.value)}
        placeholder="Yeni parola (tekrar)"
        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 outline-none"
      />
      <button
        type="submit" disabled={mesgul}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-xl"
      >
        {mesgul ? 'Kaydediliyor...' : 'Parolayı değiştir'}
      </button>
    </form>
  )
}
