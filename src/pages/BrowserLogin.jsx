import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAdimAtlama } from '../hooks/useAdimAtlama'

/**
 * İlgezdi tarayyıcısı QR girişi onay sayfası.
 *
 * İlgezdi, QR koduna `https://www.qrtim.com.tr/browser-login?token=<session_token>`
 * gömer. Bu sayfa:
 *  1. Kullanıcı giriş yapmamışsa küçük bir giriş formu gösterir,
 *  2. Girişliyse onay ister,
 *  3. Onayda `ilgezdi-qr` Edge Function'ına (action: approve) kullanıcının
 *     JWT'siyle istek atar — tabloya doğrudan yazım yoktur.
 *
 * SAHTE QR İLE OTURUM ÇALMA (QRLjacking): Saldırgan kendi bilgisayarında QR
 * üretip "şunu okut" diye kurbana gönderirse, kurban onayladığında oturum
 * SALDIRGANIN tarayıcısında açılır. Tek savunma, onaylayan kişinin isteğin
 * kendi cihazından geldiğini görebilmesidir. Bu yüzden onaydan önce istek
 * incelenir (action: inspect) ve cihaz etiketi ile zaman gösterilir.
 */
export default function BrowserLogin() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [istek, setIstek] = useState(null) // { requester_label, created_at, expires_at, same_network, match_options? }
  // Sayı eşleştirme (v2 İlgezdi): kişinin seçtiği sayı
  const [secilenSayi, setSecilenSayi] = useState(null)
  const { adimAtla } = useAdimAtlama()

  const token = new URLSearchParams(window.location.search).get('token')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Oturum varsa isteği incele: hangi cihaz, ne zaman.
  useEffect(() => {
    if (!session?.access_token || !token) return
    let iptal = false
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ilgezdi-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'inspect', session_token: token }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (iptal) return
        if (ok) setIstek(d)
        else if (d.error === 'not_found_or_expired') setError('QR kodun süresi dolmuş. İlgezdi tarayıcısında QR kodu yenileyip tekrar okutun.')
      })
      .catch(() => {})
    return () => { iptal = true }
  }, [session?.access_token, token])

  const handleLogin = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Giriş başarısız: e-posta veya şifre hatalı.')
    setBusy(false)
  }

  const handleApprove = async (tekrar = false) => {
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
          body: JSON.stringify({ action: 'approve', session_token: token, match_code: secilenSayi }),
        }
      )
      const data = await res.json()
      if (res.ok && data.ok) {
        setDone(true)
      } else if (data.error === 'mfa_required' && !tekrar) {
        // Başka cihaza oturum açtırmak için bu oturumda son 10 dakikada
        // iki adımlı doğrulama gerekiyor. Doğrulayınca onayı bir kez daha dene.
        setBusy(false)
        if (await adimAtla({ sebep: 'Başka bir cihazda oturum açmayı onaylamak', zorla: true })) {
          return handleApprove(true)
        }
        setError('Onay için iki adımlı doğrulama gerekiyor.')
        return
      } else if (data.error === 'match_failed') {
        setError('Seçilen sayı bilgisayar ekranındakiyle eşleşmedi. Güvenliğiniz için bu QR iptal edildi; İlgezdi\'de yeni QR oluşturun.')
        setIstek(null)
      } else if (data.error === 'not_found_or_expired') {
        setError('QR kodun süresi dolmuş. İlgezdi tarayıcısında QR kodu yenileyip tekrar okutun.')
      } else if (data.error === 'email_not_verified') {
        setError('Başka bir cihazda oturum açmadan önce e-posta adresinizi doğrulamanız gerekiyor.')
      } else if (data.error === 'rate_limited') {
        setError('Çok fazla deneme. Bir dakika sonra tekrar deneyin.')
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
      <p className="text-gray-600 mb-4">İlgezdi tarayıcısında oturum açılsın mı?</p>
      {istek && (
        <div className="mb-6 p-3 bg-gray-50 border border-gray-200 rounded-lg text-left text-sm">
          {/* Cihaz adı QR'ı üreten programın KENDİ beyanı; saldırgan istediğini
              yazabilir (denetim G-04). Bu yüzden öyle etiketleniyor ve yanında
              sunucunun kendi gözlemi (aynı ağ mı) gösteriliyor. */}
          <div className="text-gray-500">Cihazın kendi bildirdiği ad</div>
          <div className="font-semibold text-gray-800">{istek.requester_label}</div>
          <div className="text-gray-500 mt-1">
            {new Date(istek.created_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla bekliyor
          </div>
          {istek.same_network === true && (
            <div className="mt-2 text-green-700">
              İstek, şu an bağlı olduğunuz ağdan geliyor.
            </div>
          )}
          {istek.same_network === false && (
            <div className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-800">
              <strong>Dikkat:</strong> Bu istek sizinle aynı ağdan gelmiyor. Telefonunuz mobil
              veride, bilgisayarınız Wi-Fi'da ise bu normal olabilir. QR kodu size biri
              gönderdiyse onaylamayın.
            </div>
          )}
        </div>
      )}
      {istek?.match_options && (
        <div className="mb-6 text-left">
          <p className="text-sm font-semibold text-gray-800 mb-2">
            İlgezdi'nin ekranında, QR kodun yanında hangi sayı yazıyor?
          </p>
          <div className="flex gap-3">
            {istek.match_options.map((n) => (
              <button
                key={n} type="button" onClick={() => setSecilenSayi(n)}
                className={`flex-1 py-3 text-xl font-bold rounded-lg border-2 transition ${
                  secilenSayi === n ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-800 hover:bg-gray-50'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Sayıyı göremiyorsanız QR size başkası tarafından gönderilmiştir; onaylamayın.
          </p>
        </div>
      )}
      <div className="flex gap-3">
        <button
          onClick={() => window.close()}
          className="flex-1 py-3 border border-gray-300 text-gray-600 font-semibold rounded-lg hover:bg-gray-50 transition"
        >
          Vazgeç
        </button>
        <button
          onClick={() => handleApprove()} disabled={busy || (istek?.match_options && secilenSayi === null)}
          className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-semibold rounded-lg transition"
        >
          {busy ? 'Onaylanıyor...' : 'Onayla'}
        </button>
      </div>
      <p className="mt-4 text-xs text-gray-500">
        <strong>Yalnızca QR kodu şu an KENDİ bilgisayarınızın ekranında görüyorsanız onaylayın.</strong>{' '}
        Birisi size bir QR kod gönderip "bunu okut" dediyse onaylamayın: onay, oturumu
        QR'ı üreten cihazda açar. QR kod 5 dakika içinde geçersiz olur.
      </p>
    </div>
  )
}
