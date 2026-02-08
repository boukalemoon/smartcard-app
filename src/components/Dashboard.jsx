import { getAnalyticsSummary } from '../utils/analyticsHelpers'
import AdminCRM from './AdminCRM'
import ReferralDashboard from './ReferralDashboard'
import OrganizationManager from './OrganizationManager'
import CorporateDashboard from './CorporateDashboard'
import { useState, useEffect } from 'react'
import PaymentModal from './PaymentModal'
import { supabase } from '../lib/supabaseClient'
import { useSubscription } from '../hooks/useSubscription'
import { useDashboardMode } from '../contexts/DashboardModeContext'
import ThemeToggle from './ThemeToggle'
import DashboardModeToggle from './DashboardModeToggle'
import QRCodeDisplay from './QRCodeDisplay'
import NFCWriter from './NFCWriter'
import SocialLinksManager from './SocialLinksManager'
import UsernameEditor from './UsernameEditor'

export default function Dashboard({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [showPayment, setShowPayment] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  
  
  // Dashboard mode
  const { mode, isIndividual, isCorporate } = useDashboardMode()
  
  // Form states
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')

  // Subscription hook
  const { 
    subscription, 
    loading: subLoading, 
    getLimits,
    canAdd,
    isPremium 
  } = useSubscription(profile?.id)

  const [orgCount, setOrgCount] = useState(0)  // ← Burası doğru


useEffect(() => {
  if (profile?.role === 'admin') {
    setIsAdmin(true)
  }
}, [profile])
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
      // Analytics yükle
  const analyticsData = await getAnalyticsSummary(data.id)
  setAnalytics(analyticsData)
    }
  } catch (error) {
    console.error('Error loading profile:', error)
  } finally {
    setLoading(false)
  }
}

// YENİ FONKSİYON EKLE (loadProfile'dan SONRA)
const loadOrganizationCount = async () => {
  if (!profile?.id) return
  
  try {
    const { data, error } = await supabase
      .from('members')
      .select('organization_id')
      .eq('profile_id', profile.id)
    
    if (error) throw error
    
    const uniqueOrgs = new Set(data?.map(m => m.organization_id) || [])
    setOrgCount(uniqueOrgs.size)
  } catch (error) {
    console.error('Error counting organizations:', error)
  }
}
 
// useEffect EKLE (loadOrganizationCount'dan SONRA)
useEffect(() => {
  if (profile?.id) {
    loadOrganizationCount()
  }
}, [profile])
useEffect(() => {
  if (profile?.role === 'admin') {
    setIsAdmin(true)
  }
}, [profile])

  const saveProfile = async () => {
    try {
      setLoading(true)
      
      if (profile) {
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
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  const limits = getLimits()
  console.log('Limits:', limits)  // EKLE
  console.log('Subscription:', subscription)  // EKLE

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img 
                  src="/qartim-logo.jpg" 
                  alt="Qartim" 
                  className="h-16 w-auto"
                />
              </div>
              <div className="flex items-center gap-3">
                {/* Dashboard Mode Toggle */}
                <DashboardModeToggle subscription={subscription} />
                
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
          
          {/* Subscription Info Card */}
          {subscription && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-blue-900 dark:text-blue-100">
                    📊 {limits?.name || subscription.plan} Plan {isCorporate && '- Kurumsal Mod'}
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Organizasyonlar: {orgCount}/{subscription.organizations_limit === 999 ? '∞' : subscription.organizations_limit} • 
                    Sosyal Medya: {subscription.social_links_limit === 999 ? '∞' : subscription.social_links_limit} • 
                    NFC: {subscription.nfc_cards_used}/{subscription.nfc_cards_included}
                  </p>
                </div>
                {subscription.plan === 'free' && (
                  <button 
                    onClick={() => {
                      setSelectedPlan({ plan: 'professional', billingCycle: 'yearly' })
                      setShowPayment(true)
                    }}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
                  >
                    Planı Yükselt
                  </button>
                )}
              </div>
            </div>
          )}
          {/* Admin CRM Button */}
{isAdmin && (
  <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-bold text-red-900 dark:text-red-100">🔐 Admin Yetkisi</h3>
        <p className="text-sm text-red-700 dark:text-red-300">Tüm kullanıcıları ve ödemeleri yönetin</p>
      </div>
      <button
        onClick={() => window.location.href = '/admin'}
        className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
      >
        Admin Paneline Git →
      </button>
    </div>
  </div>
)}
          {/* Conditional Content Based on Mode */}
          {isCorporate ? (
            /* CORPORATE DASHBOARD */
            <CorporateDashboard 
              profile={profile}
              subscription={subscription}
            />
          ) : (
            /* INDIVIDUAL DASHBOARD */
            <div className="grid lg:grid-cols-3 gap-6">
              {/* Sol Panel - Profil Bilgileri */}
              <div className="lg:col-span-2 space-y-6">
                {/* Profil Kartı */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profil Bilgileri</h2>
                    {!editing ? (
                      <button
                        onClick={() => setEditing(true)}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all"
                      >
                        Düzenle
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
                          İptal
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Ad Soyad
                      </label>
                      {editing ? (
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                          placeholder="Ahmet Yılmaz"
                        />
                      ) : (
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{name || '-'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Ünvan
                      </label>
                      {editing ? (
                        <input
                          type="text"
                          value={title}
                          onChange={(e) => setTitle(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                          placeholder="Yazılım Geliştirici"
                        />
                      ) : (
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{title || '-'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Şirket
                      </label>
                      {editing ? (
                        <input
                          type="text"
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                          placeholder="Tech Startup"
                        />
                      ) : (
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{company || '-'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Telefon
                      </label>
                      {editing ? (
                        <input
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                          placeholder="+90 555 123 4567"
                        />
                      ) : (
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{phone || '-'}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Email
                      </label>
                      <p className="text-gray-900 dark:text-gray-100 font-medium">{session.user.email}</p>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                        Hakkımda
                      </label>
                      {editing ? (
                        <textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          rows={4}
                          className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                          placeholder="Kendinizden bahsedin..."
                        />
                      ) : (
                        <p className="text-gray-900 dark:text-gray-100">{bio || '-'}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* İstatistikler */}
<div className="grid md:grid-cols-4 gap-4">
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-blue-500">
    <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Profil Görüntülenme</div>
    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
      {analytics?.profile_views || 0}
    </div>
  </div>
  
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-green-500">
    <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">QR Kod Tarama</div>
    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
      {analytics?.qr_scans || 0}
    </div>
  </div>
  
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-purple-500">
    <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">vCard İndirme</div>
    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
      {analytics?.vcard_downloads || 0}
    </div>
  </div>
  
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-yellow-500">
    <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Link Tıklama</div>
    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">
      {analytics?.link_clicks || 0}
    </div>
  </div>
</div>

                {/* Username Editor */}
                {profile && (
                  <UsernameEditor 
                    currentUsername={profile.username}
                    profileId={profile.id}
                    onUpdate={(newUsername) => {
                      setProfile({ ...profile, username: newUsername });
                    }}
                  />
                )}

                {/* Social Links Manager */}
                {profile && (
                  <SocialLinksManager 
                    profileId={profile.id}
                    subscriptionPlan={subscription?.plan || 'free'}
                  />
                )}

                {/* Organization Manager */}
                {profile && (
                  <OrganizationManager 
                    profileId={profile.id}
                    subscriptionPlan={subscription?.plan || 'free'}
                  />
                )}  
            
                {/* Referral Dashboard */}
                {profile && <ReferralDashboard profile={profile} />}
              </div>

              {/* Sağ Panel - QR Kod ve Abonelik */}
              <div className="space-y-6">
                {/* QR Kod ve NFC */}
                {profile && profile.username && (
                  <>
                    <QRCodeDisplay 
                      username={profile.username} 
                      fullName={profile.name || session.user.email} 
                    />
                    <NFCWriter username={profile.username} />
                  </>
                )}

                {!profile?.username && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-300 mb-2">⚠️ Username Gerekli</h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-400">
                      QR kod ve NFC özelliklerini kullanmak için bir username oluşturulması gerekiyor.
                      Lütfen profil bilgilerinizi güncelleyin.
                    </p>
                  </div>
                )}

                {/* Abonelik Kartı */}
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
                  <h3 className="text-xl font-bold mb-2">Abonelik</h3>
                  {subscription ? (
                    <>
                      <p className="text-blue-100 text-sm mb-4">
                        {limits?.name || 'Yükleniyor...'}
                      </p>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                          <span>✓</span>
                          <span>
                            {subscription.organizations_limit === 999 
                              ? 'Sınırsız organizasyon' 
                              : `${subscription.organizations_limit} organizasyon`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>✓</span>
                          <span>
                            {subscription.social_links_limit === 999 
                              ? 'Sınırsız sosyal medya' 
                              : `${subscription.social_links_limit} sosyal medya`}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>✓</span>
                          <span>
                            {subscription.nfc_cards_included > 0 
                              ? `${subscription.nfc_cards_included} NFC kart` 
                              : 'Temel QR kod'}
                          </span>
                        </div>
                      </div>
                      {subscription.plan === 'free' && (
                        <button 
                          onClick={() => {
                            setSelectedPlan({ plan: 'professional', billingCycle: 'yearly' })
                            setShowPayment(true)
                          }}
                          className="w-full mt-4 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:shadow-lg transition-all"
                        >
                          Planı Yükselt
                        </button>
                      )}
                    </>
                  ) : (
                    <p className="text-blue-100 text-sm">Yükleniyor...</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Payment Modal */}
      {showPayment && selectedPlan && (
        <PaymentModal
          plan={selectedPlan.plan}
          billingCycle={selectedPlan.billingCycle}
          profile={profile}
          onSuccess={() => {
            setShowPayment(false)
            window.location.reload()
          }}
          onClose={() => setShowPayment(false)}
        />
      )}
    </>
  )
}