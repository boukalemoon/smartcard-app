// src/components/AuthConfirm.jsx - YENİ DOSYA OL
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'

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

        // DEBUG — geçici, sonra sileceğiz
alert('verifyOtp sonucu: ' + (error ? error.message : 'BAŞARILI'))

        if (error) {
          console.error('Verify error:', error)
          setStatus('error')
          setMessage(error.message || 'Doğrulama başarısız.')
          setTimeout(() => navigate('/login'), 3000)
          return
        }

        setStatus('success')
        setTimeout(() => navigate('/dashboard'), 1500)

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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center bg-white p-8 rounded-2xl shadow-2xl max-w-md w-full mx-4">
        {status === 'verifying' && (
          <>
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h2 className="text-2xl font-bold mb-2">Email Doğrulanıyor...</h2>
            <p className="text-gray-600">Lütfen bekleyin, yönlendiriliyorsunuz.</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">✅</span>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-green-600">Email Doğrulandı!</h2>
            <p className="text-gray-600">Dashboard'a yönlendiriliyorsunuz...</p>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">❌</span>
            </div>
            <h2 className="text-2xl font-bold mb-2 text-red-600">Doğrulama Başarısız</h2>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-400 mt-2">Giriş sayfasına yönlendiriliyorsunuz...</p>
          </>
        )}
      </div>
    </div>
  )
}