// E-posta doğrulama / kurtarma bağlantısının döndüğü sayfa (/auth/confirm).
// Görünüm kimlik ekranlarının ortak dilinde (site/giris/parcalar).
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, CircleX } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { KimlikKarti, KimlikSayfasi, Yukleniyor } from '../site/giris/parcalar'

export default function AuthConfirm() {
  const navigate = useNavigate()
  const [status, setStatus] = useState('verifying') // verifying | success | error
  const [message, setMessage] = useState('')

  useEffect(() => {
    const handleConfirm = async () => {
      try {
        // URL'deki token_hash ve type parametrelerini al
        const urlParams = new URLSearchParams(window.location.search)
        const tokenHash = urlParams.get('token_hash') || urlParams.get('token')
        const type = urlParams.get('type')

        if (!tokenHash) {
          // Hash fragment'tan dene (eski format)
          const hashParams = new URLSearchParams(window.location.hash.substring(1))
          const accessToken = hashParams.get('access_token')
          
          if (accessToken) {
            // Eski format — session zaten set edildi
            setTimeout(() => navigate('/dashboard'), 1000)
            setStatus('success')
            return
          }

          setStatus('error')
          setMessage('Doğrulama linki geçersiz veya süresi dolmuş.')
          setTimeout(() => navigate('/login'), 3000)
          return
        }

        // PKCE flow — token'ı exchange et
        const { error } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type || 'signup'
        })

        if (error) {
          console.error('Verify error:', error)
          setStatus('error')
          setMessage(error.message || 'Doğrulama başarısız.')
          setTimeout(() => navigate('/login'), 3000)
          return
        }

        // Session'ın client'a tam yerleşmesini bekle
        let session = null
        for (let i = 0; i < 10; i++) {
          const { data } = await supabase.auth.getSession()
          if (data?.session?.user) { session = data.session; break }
          await new Promise(r => setTimeout(r, 300))
        }

        if (!session) {
          // Session kurulamadı — kullanıcı giriş yaparak devam edebilir
          setStatus('success')
          setTimeout(() => navigate('/login'), 1500)
          return
        }

        setStatus('success')
        // Parola sıfırlama bağlantısı: panele değil, yeni parola formuna.
        setTimeout(() => navigate(type === 'recovery' ? '/sifre-yenile' : '/dashboard'), 800)

      } catch (err) {
        console.error('Confirm error:', err)
        setStatus('error')
        setMessage('Beklenmeyen bir hata oluştu.')
        setTimeout(() => navigate('/login'), 3000)
      }
    }

    handleConfirm()
  }, [navigate])

  return (
    <KimlikSayfasi>
      <KimlikKarti className="items-center text-center" role="status" aria-live="polite">
        {status === 'verifying' && (
          <>
            <Yukleniyor etiket="Doğrulanıyor" />
            <h1 className="font-baslik text-2xl font-extrabold tracking-[-0.015em]">E-posta doğrulanıyor</h1>
            <p className="text-metin-2">Lütfen bekleyin, yönlendiriliyorsunuz.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <span className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300 inline-flex items-center justify-center">
              <CircleCheck size={30} aria-hidden="true" />
            </span>
            <h1 className="font-baslik text-2xl font-extrabold tracking-[-0.015em]">Doğrulandı</h1>
            <p className="text-metin-2">Yönlendiriliyorsunuz…</p>
          </>
        )}
        {status === 'error' && (
          <>
            <span className="w-14 h-14 rounded-full bg-red-50 dark:bg-red-500/15 text-red-700 dark:text-red-300 inline-flex items-center justify-center">
              <CircleX size={30} aria-hidden="true" />
            </span>
            <h1 className="font-baslik text-2xl font-extrabold tracking-[-0.015em]">Doğrulama başarısız</h1>
            <p className="text-metin-2">{message}</p>
            <p className="text-sm text-metin-2">Giriş sayfasına yönlendiriliyorsunuz…</p>
          </>
        )}
      </KimlikKarti>
    </KimlikSayfasi>
  )
}
