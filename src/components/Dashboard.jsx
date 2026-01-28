import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function Dashboard({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  
  // Form states
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', session.user.id)
        .single()

      if (error && error.code !== 'PGRST116') throw error

      if (data) {
        setProfile(data)
        setName(data.name || '')
        setTitle(data.title || '')
        setCompany(data.company || '')
        setPhone(data.phone || '')
        setBio(data.bio || '')
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveProfile = async () => {
    try {
      setLoading(true)
      
      if (profile) {
        // Profil varsa UPDATE
        const { error } = await supabase
          .from('profiles')
          .update({
            name,
            title,
            company,
            phone,
            bio,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', session.user.id)

        if (error) throw error
      } else {
        // Profil yoksa INSERT
        const { error } = await supabase
          .from('profiles')
          .insert({
            user_id: session.user.id,
            email: session.user.email,
            name,
            title,
            company,
            phone,
            bio,
          })

        if (error) throw error
      }

      alert('Profil kaydedildi!')
      setEditing(false)
      loadProfile()
    } catch (error) {
      alert('Hata: ' + error.message)
    } finally {
      setLoading(false)
    }
  } 

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                SmartCard
              </h1>
              <p className="text-sm text-gray-600 mt-1">Bireysel Dashboard</p>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all"
            >
              Cikis Yap
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Sol Panel - Profil Bilgileri */}
          <div className="lg:col-span-2 space-y-6">
            {/* Profil Kartı */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Profil Bilgileri</h2>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all"
                  >
                    Duzenle
                  </button>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={saveProfile}
                      disabled={loading}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all disabled:opacity-50"
                    >
                      Kaydet
                    </button>
                    <button
                      onClick={() => {
                        setEditing(false)
                        loadProfile()
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all"
                    >
                      Iptal
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Ad Soyad
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                      placeholder="Ahmet Yilmaz"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{name || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Unvan
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                      placeholder="Yazilim Gelistirici"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{title || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Sirket
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                      placeholder="Tech Startup"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{company || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Telefon
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                      placeholder="+90 555 123 4567"
                    />
                  ) : (
                    <p className="text-gray-900 font-medium">{phone || '-'}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <p className="text-gray-900 font-medium">{session.user.email}</p>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Hakkimda
                  </label>
                  {editing ? (
                    <textarea
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      rows={4}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 transition-all outline-none"
                      placeholder="Kendinizden bahsedin..."
                    />
                  ) : (
                    <p className="text-gray-900">{bio || '-'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* İstatistikler */}
            <div className="grid md:grid-cols-3 gap-4">
              <div className="bg-white rounded-xl shadow p-6 border-l-4 border-blue-500">
                <div className="text-sm font-semibold text-gray-600 mb-1">Profil Goruntulenme</div>
                <div className="text-3xl font-bold text-gray-900">0</div>
              </div>
              <div className="bg-white rounded-xl shadow p-6 border-l-4 border-green-500">
                <div className="text-sm font-semibold text-gray-600 mb-1">QR Tarama</div>
                <div className="text-3xl font-bold text-gray-900">0</div>
              </div>
              <div className="bg-white rounded-xl shadow p-6 border-l-4 border-purple-500">
                <div className="text-sm font-semibold text-gray-600 mb-1">Link Tiklama</div>
                <div className="text-3xl font-bold text-gray-900">0</div>
              </div>
            </div>
          </div>

          {/* Sağ Panel - QR Kod ve Diğer */}
          <div className="space-y-6">
            {/* QR Kod Önizleme */}
            <div className="bg-white rounded-2xl shadow-lg p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">QR Kod</h3>
              <div className="bg-gray-100 rounded-xl p-8 flex items-center justify-center">
                <div className="w-48 h-48 bg-white rounded-lg shadow-lg flex items-center justify-center">
                  <div className="text-center text-gray-400">
                    <div className="text-4xl mb-2">📱</div>
                    <p className="text-sm">QR Kod</p>
                    <p className="text-xs">Cok yakinda</p>
                  </div>
                </div>
              </div>
              <button className="w-full mt-4 py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg transition-all">
                QR Kodu Indir
              </button>
            </div>

            {/* Abonelik Durumu */}
            <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
              <h3 className="text-xl font-bold mb-2">Abonelik</h3>
              <p className="text-blue-100 text-sm mb-4">Ucretsiz Plan</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>2 sirket kaydi</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>4 sosyal medya</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>✓</span>
                  <span>Basit QR kod</span>
                </div>
              </div>
              <button className="w-full mt-4 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:shadow-lg transition-all">
                Planı Yukselt
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}