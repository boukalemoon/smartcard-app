import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { useToast } from './Toast'
import { checkLoginRateLimit, checkSignupRateLimit } from '../utils/rateLimiting'

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

async function issuePartnerToken(partnerName, session) {
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
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export default function Auth({ initialMode = 'signup' }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState(initialMode)
  const [referralCode, setReferralCode] = useState(null)
  const [arkuCallback, setArkuCallback] = useState(null)

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

    const savedRef = localStorage.getItem('qartim_referral_code')
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
      sessionStorage.removeItem('partner_callback')
      const tokenData = await issuePartnerToken(partnerName, session)
      const redirectUrl = new URL(cb)
      if (tokenData?.token) {
        redirectUrl.searchParams.set('qrtim_token', tokenData.token)
        redirectUrl.searchParams.set('qrtim_email', tokenData.email ?? '')
        redirectUrl.searchParams.set('qrtim_name', tokenData.name ?? '')
        redirectUrl.searchParams.set('qrtim_username', tokenData.username ?? '')
      }
      window.location.href = redirectUrl.toString()
    }
    autoLinkIfLoggedIn()
  }, [])

  useEffect(() => {
  setMode(initialMode)
}, [initialMode])

  useEffect(() => {
    if (referralCode) {
      localStorage.setItem('qartim_referral_code', referralCode)
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
          sessionStorage.removeItem('partner_callback')
          const partnerName = detectPartnerSource(cb)
          if (partnerName && signInData?.session) {
            const tokenData = await issuePartnerToken(partnerName, signInData.session)
            if (tokenData?.token) {
              const redirectUrl = new URL(cb)
              redirectUrl.searchParams.set('qrtim_token', tokenData.token)
              redirectUrl.searchParams.set('qrtim_email', tokenData.email)
              redirectUrl.searchParams.set('qrtim_name', tokenData.name)
              redirectUrl.searchParams.set('qrtim_username', tokenData.username ?? '')
              window.location.href = redirectUrl.toString()
              return
            }
          }
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
