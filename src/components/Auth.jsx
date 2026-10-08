import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useToast } from './Toast'
import { checkLoginRateLimit, checkSignupRateLimit } from '../utils/rateLimiting'
import { useAdimAtlama } from '../hooks/useAdimAtlama'
import { SITE_URL } from '../lib/siteUrl'

// Şifre asgari uzunluğu. Supabase panelinden de aynı değere çekilmeli
// (Authentication → Policies), aksi halde bu yalnızca arayüz kontrolü kalır.
const MIN_PASSWORD_LENGTH = 8

// Ham `error.message` kullanıcıya gösterilmez: teknik ayrıntı sızdırır ve
// saldırgana sistemin iç durumunu anlatır (bulgu O-8). Bilinen durumlar
// anlaşılır Türkçeye çevrilir, gerisi genel bir mesaja düşer.
const AUTH_ERROR_MESSAGES = [
  ['Invalid login credentials', 'E-posta veya şifre hatalı.'],
  ['Email not confirmed', 'Hesabınız henüz etkinleştirilmemiş. E-postanıza gönderdiğimiz doğrulama bağlantısına tıklayın.'],
  ['User already registered', 'Bu e-posta ile daha önce kayıt olunmuş. Giriş yapmayı deneyin.'],
  ['Password should be at least', `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`],
  // Doğrulama e-postası gönderilemediğinde kayıt 500 ile tamamen başarısız
  // oluyor ve kullanıcı ham İngilizce hata görüyordu. İki ayrı sebep var:
  // adres teslim edilemiyor (SMTP 501/550) ya da saatlik e-posta kotası dolu.
  ['Error sending confirmation email',
   'Doğrulama e-postası gönderilemedi. E-posta adresinizi kontrol edin; adres doğruysa birkaç dakika sonra tekrar deneyin.'],
  ['Unable to validate email address', 'E-posta adresi geçerli görünmüyor. Yazımını kontrol edin.'],
  ['over_email_send_rate_limit', 'Şu an çok fazla e-posta gönderiliyor. Lütfen birkaç dakika sonra tekrar deneyin.'],
  ['rate limit', 'Çok fazla deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.'],
]

function friendlyAuthError(error) {
  const raw = (error?.message ?? '').toLowerCase()
  for (const [needle, message] of AUTH_ERROR_MESSAGES) {
    if (raw.includes(needle.toLowerCase())) return message
  }
  return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
}

// Partner geri dönüş adresleri ORIGIN olarak tutulur ve tam eşitlikle
// karşılaştırılır. Ön ek (startsWith) karşılaştırması güvenli DEĞİLDİR:
// 'https://arku-remote.vercel.app@saldirgan.com' ve
// 'https://arku-remote.vercel.app.saldirgan.com' gibi adresler ön ek testini
// geçer ama gerçekte saldırganın alan adına gider — SSO jetonu sızardı.
const TRUSTED_PARTNERS = {
  arku: ['https://arku-remote.vercel.app'],
  ilgezdi: ['https://ilgezdi.vercel.app'],
  // Tınga masaüstü uygulaması: OAuth loopback (RFC 8252) — sabit yerel port.
  // Loopback adresleri masaüstü akışının parçasıdır, üretimde de geçerlidir.
  tinga: ['http://127.0.0.1:17605', 'http://localhost:17605'],
}

// Yerel geliştirme sunucuları yalnızca dev derlemesinde güvenilir sayılır;
// üretim paketine hiç girmez.
if (import.meta.env.DEV) {
  TRUSTED_PARTNERS.arku.push('http://localhost:3000', 'http://localhost:5173')
  TRUSTED_PARTNERS.ilgezdi.push('http://localhost:4000')
}

// Callback URL'in origin'i hangi partner'a ait? Değilse null.
// new URL(...).origin, kullanıcı-bilgisi (@) ve alt alan adı hilelerini eler.
function detectPartnerSource(url) {
  let origin
  try {
    origin = new URL(url).origin
  } catch {
    return null
  }
  for (const [name, origins] of Object.entries(TRUSTED_PARTNERS)) {
    if (origins.includes(origin)) return name
  }
  return null
}

function isSafeCallback(url) {
  return detectPartnerSource(url) !== null
}

// ONAY EKRANI (denetim G-03). Eskiden QRtım'e girişli biri partnerin
// /login?callback=… adresine geldiğinde belirteç SORULMADAN üretilip
// yönlendiriliyordu: herhangi bir sayfa girişli kişiyi bu adrese gönderip
// kimliğini sessizce bir uygulamaya bağlatabiliyordu. Artık kişi hangi
// uygulamanın hangi bilgilerini alacağını görür ve kendisi onaylar.
// Alan listesi arku-link / tinga-link'in döndürdüğü alanlarla aynı olmalı.
const PARTNER_BILGI = {
  arku: { ad: 'Arku Remote' },
  ilgezdi: { ad: 'İlgezdi' },
  tinga: { ad: 'Tınga' },
}
const PAYLASILAN_ALANLAR = [
  'Ad soyad ve kullanıcı adı',
  'Doğrulanmış e-posta adresi',
  'Telefon, unvan ve firma (profilinizde varsa)',
  'Profil fotoğrafı',
  'Abonelik planı',
]

// Kullanıcı onay vermediğinde partnere boş elle dönülür; partner bilinmeyen
// parametreyi yok sayarsa "giriş yapılmadı" görünür.
function reddiPartnereBildir(cb) {
  const u = new URL(cb)
  u.searchParams.set('qrtim_error', 'access_denied')
  window.location.href = u.toString()
}

// Doğrulama uygulaması kurmuş kişide partner belirteci taze iki adımlı
// doğrulama ister (sunucu 403 { code: "mfa_required" } döner). Böyle bir
// durumda `adimAtla` ile doğrulatıp BİR kez daha deneriz; yine olmazsa belirteç
// verilmez (null) ve partner uygulamaya belirteçsiz dönülür.
async function issuePartnerToken(partnerName, session, adimAtla) {
  const ilk = await requestPartnerToken(partnerName, session)
  if (ilk?.code === 'mfa_required' && adimAtla
      && await adimAtla({ sebep: 'Bağlı uygulamaya giriş', zorla: true })) {
    const tekrar = await requestPartnerToken(partnerName, session)
    return tekrar?.token ? tekrar : null
  }
  return ilk?.token ? ilk : null
}

async function requestPartnerToken(partnerName, session) {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-issue-token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ partner_name: partnerName }),
      }
    )
    const govde = await res.json().catch(() => null)
    if (!res.ok) return govde?.code === 'mfa_required' ? { code: 'mfa_required' } : null
    return govde
  } catch {
    return null
  }
}

export default function Auth({ initialMode = 'signup' }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { adimAtla } = useAdimAtlama()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState(initialMode)
  const [referralCode, setReferralCode] = useState(null)
  const [arkuCallback, setArkuCallback] = useState(null)
  // Partner onay ekranı: { partnerName, cb, session }
  const [onay, setOnay] = useState(null)
  // "Şifremi unuttum": null | 'form' | 'gonderildi'
  const [sifirlama, setSifirlama] = useState(null)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const ref = urlParams.get('ref')
    if (ref) {
      setReferralCode(ref)
      setMode('signup')
    }

    const cb = urlParams.get('callback')
    if (cb && isSafeCallback(cb)) {
      setArkuCallback(cb)
      sessionStorage.setItem('partner_callback', cb)
    } else {
      const saved = sessionStorage.getItem('partner_callback')
      if (saved && isSafeCallback(saved)) setArkuCallback(saved)
    }

    // Eski ad altında saklanmış kod hâlâ okunur: marka adı değişti diye
    // elinde davet kodu olan kişinin kodu düşmesin.
    const savedRef = localStorage.getItem('qrtim_referral_code')
      || localStorage.getItem('qartim_referral_code')
    if (savedRef && !ref) {
      setReferralCode(savedRef)
      if (initialMode === 'signup') setMode('signup')
    }
  }, [])

  // Kullanıcı zaten giriş yapmışsa ve partner bağlama akışındaysa (callback varsa),
  // yeniden giriş istemeden token üretip partner uygulamaya geri yönlendir.
  useEffect(() => {
    const autoLinkIfLoggedIn = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const cb = urlParams.get('callback') || sessionStorage.getItem('partner_callback')
      if (!cb || !isSafeCallback(cb)) return
      const partnerName = detectPartnerSource(cb)
      if (!partnerName) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      // Belirteç burada ÜRETİLMEZ: önce kişinin onayı (bkz. PARTNER_BILGI).
      setOnay({ partnerName, cb, session })
    }
    autoLinkIfLoggedIn()
  }, [])

  // Onaydan sonra: belirteci üret, partnere dön. Oturum TIKLAMA ANINDA
  // okunur: onay ekranında uzun beklenirse ilk oturumun erişim belirteci
  // eskimiş olabilir (supabase-js onu arka planda yeniler).
  const partnereGonder = async () => {
    if (!onay) return
    setLoading(true)
    sessionStorage.removeItem('partner_callback')
    const { data: { session: guncel } } = await supabase.auth.getSession()
    const tokenData = guncel ? await issuePartnerToken(onay.partnerName, guncel, adimAtla) : null
    const redirectUrl = new URL(onay.cb)
    if (tokenData?.token) {
      redirectUrl.searchParams.set('qrtim_token', tokenData.token)
      redirectUrl.searchParams.set('qrtim_email', tokenData.email ?? '')
      redirectUrl.searchParams.set('qrtim_name', tokenData.name ?? '')
      redirectUrl.searchParams.set('qrtim_username', tokenData.username ?? '')
    } else {
      // Belirteç alınamadı (oturum bitti, doğrulama iptal edildi): partner
      // sessizce "girişsiz" kalmasın, sebebini bilsin.
      redirectUrl.searchParams.set('qrtim_error', 'token_unavailable')
    }
    window.location.href = redirectUrl.toString()
  }

  const partneriReddet = () => {
    if (!onay) return
    sessionStorage.removeItem('partner_callback')
    reddiPartnereBildir(onay.cb)
  }

  const sifirlamaIste = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${SITE_URL}/sifre-yenile`,
      })
      // Adresin kayıtlı olup olmadığı SÖYLENMEZ: her durumda aynı mesaj.
      // Hız sınırı da istisna değil — Supabase yalnızca KAYITLI adres için
      // "N saniye sonra tekrar deneyin" der; farklı mesaj göstermek iki hızlı
      // denemeyle hesabın varlığını ele verirdi.
      setSifirlama('gonderildi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
  setMode(initialMode)
}, [initialMode])

  useEffect(() => {
    if (referralCode) {
      localStorage.setItem('qrtim_referral_code', referralCode)
    }
  }, [referralCode])

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (password.length < MIN_PASSWORD_LENGTH) {
          showToast(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`, 'warning')
          setLoading(false)
          return
        }

        const signupCheck = checkSignupRateLimit('client')
        if (!signupCheck.allowed) {
          showToast(signupCheck.message, 'warning')
          setLoading(false)
          return
        }

        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name || email.split('@')[0],
              // Davet kodu önceden tarayıcıda saklanıp HİÇBİR YERE gönderilmiyordu:
              // davetle gelen kimse davet edene bağlanmıyordu. Davet kaydını artık
              // sunucu (handle_new_user) oluşturur; kod yanlışsa kayıt yine tamamlanır.
              ...(referralCode ? { referral_code: String(referralCode).trim().slice(0, 40) } : {})
            }
          }
        })

        if (authError) throw authError

        showToast(
          'Kayıt alındı. E-posta adresinize gönderdiğimiz doğrulama bağlantısına tıklayın (gelmediyse spam klasörünü kontrol edin).',
          'success'
        )
        localStorage.removeItem('qrtim_referral_code')
        localStorage.removeItem('qartim_referral_code')
        navigate('/login')

      } else {
        const loginCheck = checkLoginRateLimit(email)
        if (!loginCheck.allowed) {
          showToast(loginCheck.message, 'warning')
          setLoading(false)
          return
        }

        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) throw error

        const cb = sessionStorage.getItem('partner_callback')
        if (cb && isSafeCallback(cb)) {
          const partnerName = detectPartnerSource(cb)
          if (partnerName && signInData?.session) {
            // Belirteç onay ekranından sonra üretilir.
            setOnay({ partnerName, cb, session: signInData.session })
            return
          }
          sessionStorage.removeItem('partner_callback')
          window.location.href = cb
          return
        }
      }
    } catch (error) {
      console.error('Auth error:', error)
      showToast(friendlyAuthError(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  const switchMode = () => {
    setName('')
    setEmail('')
    setPassword('')
    if (mode === 'login') {
      navigate('/signup')
    } else {
      navigate('/login')
    }
  }

  if (onay) {
    const partnerAdi = PARTNER_BILGI[onay.partnerName]?.ad ?? onay.partnerName
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-xl font-bold text-gray-900 text-center mb-2">
            {partnerAdi} QRtım hesabınızla giriş yapmak istiyor
          </h1>
          <p className="text-sm text-gray-600 text-center mb-6">
            <span className="font-semibold">{onay.session.user?.email}</span> olarak giriş yapılacak.
          </p>
          <p className="text-sm font-semibold text-gray-700 mb-2">{partnerAdi} şu bilgileri alacak:</p>
          <ul className="text-sm text-gray-700 space-y-1 mb-6 list-disc pl-5">
            {PAYLASILAN_ALANLAR.map((a) => <li key={a}>{a}</li>)}
          </ul>
          <div className="flex gap-3">
            <button
              type="button" onClick={partneriReddet} disabled={loading}
              className="flex-1 py-3 border-2 border-gray-200 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 disabled:opacity-50"
            >
              Vazgeç
            </button>
            <button
              type="button" onClick={partnereGonder} disabled={loading}
              className="flex-1 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg disabled:opacity-50"
            >
              {loading ? 'Yönlendiriliyor...' : 'İzin ver'}
            </button>
          </div>
          <p className="mt-4 text-xs text-gray-500 text-center">
            Bu isteği siz başlatmadıysanız Vazgeç'e basın.
          </p>
        </div>
      </div>
    )
  }

  if (sifirlama) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
          <h1 className="text-xl font-bold text-gray-900 text-center mb-6">Şifremi unuttum</h1>
          {sifirlama === 'gonderildi' ? (
            <p className="text-sm text-gray-700 text-center">
              Bu adres kayıtlıysa parola sıfırlama bağlantısı gönderdik. E-postanızı (ve spam klasörünü) kontrol edin.
            </p>
          ) : (
            <form onSubmit={sifirlamaIste} className="space-y-4">
              <input
                type="email" required autoComplete="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="ornek@email.com"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
              />
              <button
                type="submit" disabled={loading}
                className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
              >
                {loading ? 'Gönderiliyor...' : 'Sıfırlama bağlantısı gönder'}
              </button>
            </form>
          )}
          <div className="mt-6 text-center">
            <button onClick={() => setSifirlama(null)} className="text-blue-600 hover:underline text-sm font-medium">
              Giriş ekranına dön
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            QRtım
          </h1>
          <p className="text-gray-600">
            {mode === 'login' ? 'Hesabınıza giriş yapın' : 'Yeni hesap oluşturun'}
          </p>
        </div>

        {arkuCallback && (
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center">
            <p className="text-sm text-blue-800 font-medium">
              Giriş yaptıktan sonra uygulamaya yönlendirileceksiniz.
            </p>
          </div>
        )}

        {referralCode && mode === 'signup' && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-sm text-green-800 font-medium">
              🎉 Referans kod ile kayıt oluyorsunuz!
            </p>
          </div>
        )}

        <form onSubmit={handleAuth} className="space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Ad Soyad
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                placeholder="Ahmet Yılmaz"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
              placeholder="ornek@email.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Şifre
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
              placeholder={`En az ${MIN_PASSWORD_LENGTH} karakter`}
              required
              minLength={mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            />
            {mode === 'login' && (
              <div className="mt-2 text-right">
                <button
                  type="button" onClick={() => setSifirlama('form')}
                  className="text-sm text-blue-600 hover:underline"
                >
                  Şifremi unuttum
                </button>
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50"
          >
            {loading ? 'Yükleniyor...' : (mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol')}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={switchMode}
            className="text-blue-600 hover:underline text-sm font-medium"
            disabled={loading}
          >
            {mode === 'login' ? 'Hesabınız yok mu? Kayıt olun' : 'Zaten hesabınız var mı? Giriş yapın'}
          </button>
        </div>
      </div>
    </div>
  )
}
