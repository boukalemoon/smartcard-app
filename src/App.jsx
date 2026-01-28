import { useState, useEffect } from 'react'
import { supabase } from './lib/supabaseClient'
import Auth from './components/Auth'

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

  if (!session) {
    return <Auth />
  }

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-lg p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SmartCard Dashboard
              </h1>
              <p className="text-gray-600 mt-2">Hoş geldiniz, {session.user.email}</p>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-6 py-3 bg-red-500 text-white rounded-xl font-semibold hover:bg-red-600 transition-all"
            >
              Çıkış Yap
            </button>
          </div>

          <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl p-6 border-2 border-blue-200">
            <h2 className="text-2xl font-bold text-gray-800 mb-4">🎉 Tebrikler!</h2>
            <p className="text-gray-700 mb-4">
              SmartCard sistemi başarıyla kuruldu ve çalışıyor!
            </p>
            <div className="space-y-2 text-sm text-gray-600">
              <p>✅ Supabase bağlantısı aktif</p>
              <p>✅ Authentication çalışıyor</p>
              <p>✅ Database hazır</p>
              <p>✅ Frontend çalışıyor</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default App