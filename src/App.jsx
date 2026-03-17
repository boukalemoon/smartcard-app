import AdminPage from './pages/AdminPage'
import LandingPage from './pages/LandingPage'
import { ThemeProvider } from './contexts/ThemeContext'
import { DashboardModeProvider } from './contexts/DashboardModeContext'
import NFCCardsPage from './pages/NFCCardsPage'
import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import PublicApplicationPage from './pages/PublicApplicationPage'
import PublicMemberDirectoryPage from './pages/PublicMemberDirectoryPage'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import PublicCard from './pages/PublicCard'
import NFCCard from './pages/NFCCard'

// Auth Confirm Component
function AuthConfirm() {
  const navigate = useNavigate()

  useEffect(() => {
    // URL'den token al ve confirm et
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const access_token = hashParams.get('access_token')
    
    if (access_token) {
      // Token varsa dashboard'a yönlendir
      navigate('/dashboard')
    } else {
      // Token yoksa login'e yönlendir
      navigate('/login')
    }
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="text-center bg-white p-8 rounded-2xl shadow-2xl">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <h2 className="text-2xl font-bold mb-2">Email Doğrulanıyor...</h2>
        <p className="text-gray-600">Lütfen bekleyin, yönlendiriliyorsunuz...</p>
      </div>
    </div>
  )
}

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
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
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

  return (
    <ThemeProvider>
      <DashboardModeProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/card/:username" element={<PublicCard />} />
            <Route path="/nfc-cards" element={<NFCCardsPage />} />  
            <Route path="/nfc-designer" element={<NFCCard />} />
            <Route path="/org/:orgSlug/apply" element={<PublicApplicationPage />} />
            <Route path="/org/:orgSlug/members" element={<PublicMemberDirectoryPage />} />
            
            {/* Auth routes */}
            <Route 
              path="/login" 
              element={!session ? <Auth /> : <Navigate to="/dashboard" />} 
            />
            <Route path="/auth/confirm" element={<AuthConfirm />} />
            
            {/* Protected routes */}
            <Route 
              path="/dashboard" 
              element={session ? <Dashboard session={session} /> : <Navigate to="/login" />} 
            />
            <Route 
              path="/admin" 
              element={session ? <AdminPage session={session} /> : <Navigate to="/login" />} 
            />
          </Routes> 
        </Router>
      </DashboardModeProvider>
    </ThemeProvider>
  )
}

export default App