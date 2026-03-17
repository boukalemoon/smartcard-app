import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { checkLoginRateLimit, checkSignupRateLimit } from '../utils/rateLimiting'

export default function Auth() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState('signup')
  const [referralCode, setReferralCode] = useState(null)

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const ref = urlParams.get('ref')
    if (ref) {
      setReferralCode(ref)
      setMode('signup')
      console.log('✅ Referral code captured:', ref)
    }

    const savedRef = localStorage.getItem('qartim_referral_code')
    if (savedRef && !ref) {
      setReferralCode(savedRef)
      setMode('signup')
      console.log('✅ Referral code from localStorage:', savedRef)
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
        // Signup rate limiting
        const signupCheck = checkSignupRateLimit('client')
        if (!signupCheck.allowed) {
          alert(`⏳ ${signupCheck.message}`)
          setLoading(false)
          return
        }

        // 1. Auth signup
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name || email.split('@')[0]
            }
          }
        })
        
        if (authError) throw authError

        if (authData.user) {
          console.log('✅ Auth user created:', authData.user.id)

          // 2. Profile oluştur
          const { data: profileData, error: profileError } = await supabase
            .from('profiles')
            .insert({
              id: authData.user.id,
              user_id: authData.user.id,
              email: email,
              name: name || email.split('@')[0],
              subscription_plan: 'free',
              subscription_status: 'active'
            })
            .select()

          if (profileError) {
            console.error('❌ Profile error:', profileError)
            throw profileError
          }

          console.log('✅ Profile created:', profileData)

          // profileData array olabilir, ilk elemanı al
          const profile = Array.isArray(profileData) ? profileData[0] : profileData

          // 3. Free subscription oluştur
          const { error: subError } = await supabase
            .from('subscriptions')
            .insert({
              profile_id: profile.id,
              plan: 'free',
              status: 'active',
              organizations_limit: 2,
              social_links_limit: 3,
              nfc_cards_included: 0,
              organizations_used: 0,
              social_links_used: 0,
              nfc_cards_used: 0
            })

          if (subError) {
            console.error('❌ Subscription error:', subError)
            throw subError
          }

          console.log('✅ Subscription created')

          // 4. Referral code varsa kaydet
          if (referralCode) {
            console.log('💾 Saving referral with code:', referralCode)
            await saveReferral(profile.id, referralCode)
          }
        }
        
        alert('🎉 Kayıt başarılı!\n\n📧 Email adresinize doğrulama linki gönderdik.\n\nLütfen email kutunuzu kontrol edin ve linke tıklayarak hesabınızı aktif edin.\n\n💡 Email gelmedi mi? Spam klasörünü kontrol edin.')
        localStorage.removeItem('qartim_referral_code')
        setMode('login')

      } else {
        // Login rate limiting
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
      alert('Hata: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const saveReferral = async (newProfileId, refCode) => {
    try {
      const { data: referrer, error: refError } = await supabase
        .from('referral_codes')
        .select('profile_id')
        .eq('code', refCode)
        .single()

      if (refError || !referrer) {
        console.log('❌ Referral code not found:', refCode)
        return
      }

      console.log('✅ Referrer found:', referrer.profile_id)

      const { error: referralError } = await supabase
        .from('referrals')
        .insert({
          referrer_id: referrer.profile_id,
          referee_id: newProfileId,
          referral_code: refCode,
          status: 'pending',
          commission_amount: 0
        })

      if (referralError) {
        console.error('❌ Referral insert error:', referralError)
        throw referralError
      }

      await supabase
        .from('referral_codes')
        .update({ usage_count: supabase.rpc('increment', { x: 1 }) })
        .eq('code', refCode)

      console.log('✅ Referral saved successfully!')
    } catch (error) {
      console.error('❌ FULL ERROR:', error)
  console.error('❌ ERROR TYPE:', error.constructor.name)
  console.error('❌ ERROR MESSAGE:', error.message)
  console.error('❌ ERROR STATUS:', error.status)
   // Detaylı alert
  alert(`HATA DETAYI:
Type: ${error.constructor.name}
Message: ${error.message || 'Bilinmeyen hata'}
Status: ${error.status || 'Yok'}
`)
} finally {
  setLoading(false)

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

        {referralCode && mode === 'signup' && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-center">
            <p className="text-sm text-green-800 font-medium">
              🎉 Referans kod ile kayıt oluyorsunuz!
            </p>
            <p className="text-xs text-green-600 mt-1">
              Kayıt sonrası her iki taraf da kazanacak!
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
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login')
              setName('')
              setEmail('')
              setPassword('')
            }}
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