import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

/**
 * İlgezdi tarayyıcısı QR girişi onay sayfası.
 *
 * İlgezdi, QR koduna `https://qrtim.com/browser-login?token=<session_token>`
 * gömer. Bu sayfa:
 *  1. Kullanıcı giriş yapmamışsa küçük bir giriş formu gösterir,
 *  2. Girişliyse onay ister,
 *  3. Onayda `ilgezdi-qr` Edge Function'ına (action: approve) kullanıcının
 *     JWT'siyle istek atar — tabloya doğrudan yazım yoktur.
 */
export default function BrowserLogin() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const token = new URLSearchParams(window.location.search).get('token')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  const handleLogin = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Giriş başarısız: e-posta veya şifre hatalı.')
    setBusy(false)
  }

  const handleApprove = async () => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ilgezdi-qr`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'approve', session_token: token }),
        }
      )
      const data = await res.json()
      if (res.ok && data.ok) {
        setDone(true)
      } else if (data.error === 'not_found_or_expired') {
        setError('QR kodun süresi dolmuş. İlgezdi tarayıcısında QR kodu yenileyip tekrar okutun.')
      } else {
        setError('Onay başarısız oldu, lütfen tekrar deneyin.')
      }
    } catch {
      setError('Bağlantı hatası, lütfen tekrar deneyin.')
    }
    setBusy(false)
  }

  const card = (children) => (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center mb-6">
          <img src="/qrtım-logo.png" alt="Qrtım" className="w-14 h-14 mx-auto mb-3 object-contain" />
          <h1 className="text-xl font-bold text-gray-800">İlgezdi Tarayıcı Girişi</h1>
        </div>
        {children}
        {error && <p className="mt-4 text-sm text-red-600 text-center">{error}</p>}
      </div>
    </div>
  )

  if (!token) {
    return card(<p className="text-center text-gray-600">Geçersiz bağlantı — QR kodu İlgezdi tarayıcısından yeniden okutun.</p>)
  }

  if (loading) {
    return card(<p className="text-center text-gray-500">Yükleniyor...</p>)
  }

  if (done) {
    return card(
      <div className="text-center">
        <div className="text-5xl mb-4">✅</div>
        <p className="text-gray-800 font-semibold mb-2">Giriş onaylandı!</p>
        <p className="text-gray-500 text-sm">
          İlgezdi tarayıcısına dönebilirsiniz — oturumunuz otomatik açılacak,
          ayarlarınız ve yer imleriniz senkronize edilecek.
        </p>
      </div>
    )
  }

  if (!session) {
    return card(
      <form onSubmit={handleLogin} className="space-y-4">
        <p className="text-sm text-gray-600 text-center mb-2">
          Tarayıcı girişini onaylamak için Qrtım hesabınızla giriş yapın.
        </p>
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="E-posta"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <input
          type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Şifre"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        <button
          type="submit" disabled={busy}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg transition"
        >
          {busy ? 'Giriş yapılıyor...' : 'Giriş Yap'}
        </button>
      </form>
    )
  }

  return card(
    <div className="text-center">
      <p className="text-gray-700 mb-1">
        <span className="font-semibold">{session.user?.email}</span> hesabıyla
      </p>
      <p className="text-gray-600 mb-6">İlgezdi tarayıcısında oturum açılsın mı?</p>
      <div className="flex gap-3">
        <button
          onClick={() => window.close()}
          className="flex-1 py-3 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition"
        >
          Vazgeç
        </button>
        <button
          onClick={handleApprove} disabled={busy}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg transition"
        >
          {busy ? 'Onaylanıyor...' : 'Onayla'}
        </button>
      </div>
      <p className="mt-4 text-xs text-gray-400">
        Bu isteği siz başlatmadıysanız "Vazgeç" deyin — QR kod 5 dakika içinde geçersiz olur.
      </p>
    </div>
  )
}
