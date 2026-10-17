import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useNavigate } from 'react-router-dom'
import AdminCRM from '../components/AdminCRM'
import ThemeToggle from '../components/ThemeToggle'

import { bildir } from '../lib/bildirim'
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

      if (!['admin', 'superadmin'].includes(profileData?.role)) {
        bildir('Admin yetkisi gerekli!')
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
      <div className="bg-white/95 dark:bg-gray-900/95 backdrop-blur border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => navigate('/')} aria-label="QRtım ana sayfa" className="shrink-0 rounded-md dark:bg-white dark:px-2 dark:py-1">
                <img src="/qrtim-logo.png" alt="QRtım" className="h-9 sm:h-11 w-auto" />
              </button>
              <span className="px-2.5 py-0.5 bg-lacivert-900 text-white text-xs font-semibold rounded-full">
                Yönetici
              </span>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="h-10 px-3 sm:px-4 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-semibold text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                ← Panel
              </button>
              <ThemeToggle />
              <button
                onClick={async () => {
                await supabase.auth.signOut()
                navigate('/')
                }}
                className="h-10 px-3 sm:px-4 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 rounded-lg font-semibold text-sm hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                Çıkış
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
