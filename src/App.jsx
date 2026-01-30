import { ThemeProvider } from './contexts/ThemeContext'
import { useState, useEffect } from 'react'
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabaseClient'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import PublicCard from './pages/PublicCard'

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
          <p className="text-xl font-semibold text-gray-600">Yukleniyor...</p>
        </div>
      </div>
    )
  }

  return (
    <ThemeProvider>
    <Router>
      <Routes>
        {/* Public route - herkes erişebilir */}
        <Route path="/card/:username" element={<PublicCard />} />
        
        {/* Auth routes */}
        <Route 
          path="/login" 
          element={!session ? <Auth /> : <Navigate to="/dashboard" />} 
        />
        
        {/* Protected routes */}
        <Route 
          path="/dashboard" 
          element={session ? <Dashboard session={session} /> : <Navigate to="/login" />} 
        />
        
        {/* Default route */}
        <Route 
          path="/" 
          element={session ? <Navigate to="/dashboard" /> : <Navigate to="/login" />} 
        />
      </Routes>
    </Router>
    </ThemeProvider>
  )
}

export default App