import { ToastProvider } from './components/Toast'
import AdminPage from './pages/AdminPage'
import LandingPage from './pages/LandingPage'
import { ThemeProvider } from './contexts/ThemeContext'
import { DashboardModeProvider } from './contexts/DashboardModeContext'
import NFCCardsPage from './pages/NFCCardsPage'
import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { ozelAlanAdiMi } from './lib/ozelAlanAdi'
import { supabase } from './lib/supabaseClient'
import PublicApplicationPage from './pages/PublicApplicationPage'
import PublicMemberDirectoryPage from './pages/PublicMemberDirectoryPage'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import PublicCard from './pages/PublicCard'
import NFCCard from './pages/NFCCard'
import AuthConfirm from './components/AuthConfirm'
import GizlilikPolitikasi from './pages/GizlilikPolitikasi'
import KullanimSartlari from './pages/KullanimSartlari'
import KVKKAydinlatma from './pages/KVKKAydinlatma'
import CerezPolitikasi from './pages/CerezPolitikasi'
import Iletisim from './pages/Iletisim'
import BrowserLogin from './pages/BrowserLogin'
import OdemeSonuc from './pages/OdemeSonuc'
import SifreYenile from './pages/SifreYenile'
import { ShieldAuthSaglayici } from './contexts/ShieldAuthContext'
import MfaKapisi from './components/MfaKapisi'

function App() {
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      // Parola sıfırlama bağlantısı Supabase'in izin listesinde olmayan bir
      // adrese düşerse oturum yine açılır ama form görünmez. Hangi sayfaya
      // inerse insin kişiyi yeni parola formuna götür.
      if (event === 'PASSWORD_RECOVERY' && window.location.pathname !== '/sifre-yenile') {
        window.location.replace('/sifre-yenile')
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-xl font-semibold text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  // Partner (Arku vb.) bağlama akışında, kullanıcı zaten giriş yapmış olsa bile
  // /login sayfası Auth bileşenini göstermeli ki token üretilip partner'a
  // geri dönülebilsin. Aksi halde session varken /dashboard'a yönlenip akış kopar.
  // Callback adres çubuğunda olmayabilir: kişi giriş/kayıt arasında geçince
  // yalnızca sessionStorage'da kalır. İkisine de bakılmazsa giriş sonrası
  // /dashboard'a atlanır ve partner onay ekranı hiç görünmez.
  const hasPartnerCallback = !!new URLSearchParams(window.location.search).get('callback') ||
    !!sessionStorage.getItem('partner_callback')

  return (
    <ToastProvider>
      <ThemeProvider>
        <ShieldAuthSaglayici>
        <DashboardModeProvider>
          <Router>
            {/* ÖZEL ALAN ADI: kişinin kendi adresinde YALNIZCA kart açılır.
                Panel, giriş ve yönetim tek adreste (QRtım) kalır — oturum
                tarayıcıda adrese göre ayrıldığı için, kişi kendi alan adında
                giriş yapsa "giriş yaptım ama panelim boş" durumuna düşerdi.
                Hangi kartın açılacağını sunucu HOST'tan çözer. */}
            {ozelAlanAdiMi() ? (
              <Routes>
                <Route path="*" element={<PublicCard />} />
              </Routes>
            ) : (
            <Routes>
              {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/card/:username" element={<PublicCard />} />
            <Route path="/k/:code" element={<PublicCard />} />
            <Route path="/nfc-cards" element={<NFCCardsPage />} />
            <Route path="/nfc-designer" element={<NFCCard />} />
            <Route path="/org/:orgSlug/apply" element={<PublicApplicationPage />} />
            <Route path="/org/:orgSlug/members" element={<PublicMemberDirectoryPage />} />

            {/* Yasal sayfalar */}
            <Route path="/gizlilik" element={<GizlilikPolitikasi />} />
            <Route path="/kullanim-sartlari" element={<KullanimSartlari />} />
            <Route path="/kvkk" element={<KVKKAydinlatma />} />
            <Route path="/cerez-politikasi" element={<CerezPolitikasi />} />

            {/* Auth routes */}
            <Route path="/login" element={!session || hasPartnerCallback ? <Auth initialMode="login" /> : <Navigate to="/dashboard" />} />
            <Route path="/signup" element={!session || hasPartnerCallback ? <Auth initialMode="signup" /> : <Navigate to="/dashboard" />} />
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            <Route path="/sifre-yenile" element={<SifreYenile />} />

            {/* İlgezdi tarayıcısı QR giriş onayı (girişli/girişsiz her durumda render edilir) */}
            <Route path="/browser-login" element={<BrowserLogin />} />
            <Route path="/odeme/sonuc" element={<OdemeSonuc />} />

            {/* Protected routes */}
            <Route 
  path="/dashboard" 
  element={session ? <MfaKapisi><Dashboard session={session} /></MfaKapisi> : <Navigate to="/" replace />} 
/>
<Route 
  path="/admin" 
  element={session ? <MfaKapisi><AdminPage session={session} /></MfaKapisi> : <Navigate to="/" replace />} 
/>

<Route path="/iletisim" element={<Iletisim />} />
          </Routes>
            )}
        </Router>
      </DashboardModeProvider>
        </ShieldAuthSaglayici>
    </ThemeProvider>
    </ToastProvider>
  )
}

export default App
