import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import NFCCardDesigner from '../components/NFCCardDesigner'
import { ArrowLeft } from 'lucide-react'
import { useSubscription } from '../hooks/useSubscription'

export default function NFCCard() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const { subscription } = useSubscription(profile?.id)

  useEffect(() => {
    // Check auth
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        loadProfile(session.user.id)
      } else {
        navigate('/login')
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  const loadProfile = async (userId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single()

      if (error) throw error
      setProfile(data)
    } catch (error) {
      console.error('Profile load error:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              <ArrowLeft size={20} />
              <span>Dashboard'a Dön</span>
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              NFC Kart Tasarla
            </h1>
            <div className="w-32"></div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Ücretsiz Plan Uyarısı - YENİ! */}
  {subscription?.plan === 'free' && (
    <div className="mb-6 p-6 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-2xl">
      <div className="flex items-start gap-4">
        <div className="text-4xl">⚠️</div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-300 mb-2">
            Premium Özellik
          </h3>
          <p className="text-yellow-800 dark:text-yellow-400 mb-4">
            NFC kart siparişi vermek için Profesyonel veya Kurumsal plana yükseltmeniz gerekiyor.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            Planı Yükselt
          </button>
        </div>
      </div>
    </div>
  )}
        <NFCCardDesigner profile={profile} subscription={subscription} />
      </div>
    </div>
  )
}