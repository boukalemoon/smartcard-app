import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { checkLoginRateLimit, checkSignupRateLimit } from '../utils/rateLimiting'

export default function Auth({ initialMode = 'signup' }) {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState(initialMode)
  const [referralCode, setReferralCode] = useState(null)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const ref = urlParams.get('ref')
    if (ref) {
      setReferralCode(ref)
      setMode('signup')
    }

    const savedRef = localStorage.getItem('qartim_referral_code')
    if (savedRef && !ref) {
      setReferralCode(savedRef)
      if (initialMode === 'signup') setMode('signup')
    }
  }, [])

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
        const signupCheck = checkSignupRateLimit('client')
        if (!signupCheck.allowed) {
          alert(`⏳ ${signupCheck.message}`)
          setLoading(false)
          return
        }

        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name || email.split('@')[0]
            }
          }
        })

        if (authError) throw authError

        alert('🎉 Kayıt başarılı!\n\n📧 Email adresinize doğrulama linki gönderdik.\n\nLütfen email kutunuzu kontrol edin ve linke tıklayarak hesabınızı aktif edin.\n\n💡 Email gelmedi mi? Spam klasörünü kontrol edin.')
        localStorage.removeItem('qartim_referral_code')
        navigate('/login')

      } else {
        const loginCheck = checkLoginRateLimit(email)
        if (!loginCheck.allowed) {
          alert(`⏳ ${loginCheck.message}`)
          setLoading(false)
          return
        }

        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) throw error
      }
    } catch (error) {
      console.error('Auth error:', error)
      alert('Hata: ' + (error.message || 'Bilinmeyen hata oluştu'))
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
            Qartım
          </h1>
          <p className="text-gray-600">
            {mode === 'login' ? 'Hesabınıza giriş yapın' : 'Yeni hesap oluşturun'}
          </p>
        </div>

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
              placeholder="En az 6 karakter"
              required
              minLength={6}
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