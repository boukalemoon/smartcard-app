import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import AdminCRM from '../components/AdminCRM'
import ThemeToggle from '../components/ThemeToggle'

export default function AdminPage() {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    checkAdmin()
  }, [])

  const checkAdmin = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      
      if (!session) {
        navigate('/login')
        return
      }

      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (profileData?.role !== 'admin') {
        alert('Admin yetkisi gerekli!')
        navigate('/dashboard')
        return
      }

      setProfile(profileData)
    } catch (error) {
      console.error('Error checking admin:', error)
      navigate('/dashboard')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-16 h-16 border-4 border-red-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img 
                src="/qartim-logo.jpg" 
                alt="QRtım" 
                className="h-16 w-auto"
              />
              <span className="px-3 py-1 bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300 text-sm font-semibold rounded-full">
                ADMIN
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
              >
                ← Dashboard
              </button>
              <ThemeToggle />
              <button
                onClick={() => supabase.auth.signOut()}
                className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all"
              >
                Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <AdminCRM />
      </div>
    </div>
  )
}
