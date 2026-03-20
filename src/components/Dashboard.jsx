import ReadyPlayerMeAvatar from './ReadyPlayerMeAvatar'
import ImageUpload from './ImageUpload'
import PublicCardPreview from './PublicCardPreview'
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
import { validateCatalogLink, validateService, validateProfile } from '../utils/inputValidation'
import { checkProfileUpdateRateLimit } from '../utils/rateLimiting'

export default function Dashboard({ session }) {
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [themeColor, setThemeColor] = useState('#3B82F6')
  const [showPayment, setShowPayment] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [socialLinks, setSocialLinks] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [orgCount, setOrgCount] = useState(0)

  // Hizmet düzenleme
  const [editingServiceIndex, setEditingServiceIndex] = useState(null)
  const [editingService, setEditingService] = useState({})

  // Katalog düzenleme
  const [editingCatalogIndex, setEditingCatalogIndex] = useState(null)
  const [editingCatalog, setEditingCatalog] = useState({})

  // Dashboard mode
  const { mode, isIndividual, isCorporate, initMode } = useDashboardMode()

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

// Subscription plan gelince modu otomatik ayarla
useEffect(() => {
  if (subscription?.plan) {
    initMode(subscription.plan)
  }
}, [subscription?.plan])

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (profile?.role === 'admin') setIsAdmin(true)
  }, [profile])

  useEffect(() => {
    if (profile?.id) loadOrganizationCount()
  }, [profile?.id])

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
        setThemeColor(data.theme_color || '#3B82F6')
        setName(data.name || '')
        setTitle(data.title || '')
        setCompany(data.company || '')
        setPhone(data.phone || '')
        setBio(data.bio || '')

        // Social links yükle
        const { data: linksData } = await supabase
          .from('social_links')
          .select('*')
          .eq('profile_id', data.id)
          .order('display_order')
        if (linksData) setSocialLinks(linksData)

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

  const loadOrganizationCount = async () => {
    if (!profile?.id) return
    try {
      const { data } = await supabase
        .from('members')
        .select('organization_id')
        .eq('profile_id', profile.id)
      const uniqueOrgs = new Set(data?.map(m => m.organization_id) || [])
      setOrgCount(uniqueOrgs.size)
    } catch (error) {
      console.error('Error counting organizations:', error)
    }
  }

  const saveProfile = async () => {
    try {
      setLoading(true)
      const rateCheck = checkProfileUpdateRateLimit(session.user.id)
      if (!rateCheck.allowed) {
        alert(`⏳ ${rateCheck.message}`)
        setLoading(false)
        return
      }
      const validation = validateProfile({ name, title, company, phone, bio })
      if (!validation.valid) {
        alert('❌ Hata:\n' + Object.values(validation.errors).join('\n'))
        setLoading(false)
        return
      }
      if (profile) {
        const { error } = await supabase
          .from('profiles')
          .update({ ...validation.sanitized, updated_at: new Date().toISOString() })
          .eq('user_id', session.user.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('profiles')
          .insert({ user_id: session.user.id, email: session.user.email, ...validation.sanitized })
        if (error) throw error
      }
      alert('✅ Profil kaydedildi!')
      setEditing(false)
      loadProfile()
    } catch (error) {
      alert('❌ Hata: ' + error.message)
    } finally {
      setLoading(false)
    }
  }

  const updateAvatar = async (avatarUrl) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('user_id', session.user.id)
      if (error) throw error
      setProfile({ ...profile, avatar_url: avatarUrl })
      alert('Profil fotoğrafı güncellendi!')
    } catch (error) {
      alert('Hata: ' + error.message)
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

  return (
    <>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <img src="/qrtım-logo.png" alt="QRtım" className="h-16 w-auto" />
              <div className="flex items-center gap-3">
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

        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">

          {/* Subscription Info */}
          {subscription && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-blue-900 dark:text-blue-100">
                    📊 {limits?.name || subscription.plan} {isCorporate && '- Kurumsal Mod'}
                  </h3>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Organizasyonlar: {orgCount}/{subscription.organizations_limit === 999 ? '∞' : subscription.organizations_limit} •
                    Sosyal Medya: {subscription.social_links_limit === 999 ? '∞' : subscription.social_links_limit} •
                    NFC: {subscription.nfc_cards_used}/{subscription.nfc_cards_included}
                  </p>
                </div>
                {subscription.plan === 'free' && (
                  <button
                    onClick={() => { setSelectedPlan({ plan: 'professional', billingCycle: 'yearly' }); setShowPayment(true) }}
                    className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm"
                  >
                    Planı Yükselt
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Admin */}
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

          {isCorporate ? (
            <CorporateDashboard profile={profile} subscription={subscription} />
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">

              {/* Sol Panel */}
              <div className="lg:col-span-2 space-y-6">

                {/* Profil Kartı */}
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profil Bilgileri</h2>
                    {!editing ? (
                      <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all">
                        Düzenle
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={saveProfile} disabled={loading} className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all disabled:opacity-50">
                          Kaydet
                        </button>
                        <button onClick={() => { setEditing(false); loadProfile() }} className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all">
                          İptal
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Avatar */}
                    <div className="flex justify-center pb-4 border-b border-gray-200 dark:border-gray-700">
                      <ImageUpload currentImageUrl={profile?.avatar_url} onUploadSuccess={updateAvatar} bucket="avatars" label="Profil Fotoğrafı" maxSize={2} />
                    </div>

                    {/* 3D Avatar */}
                    <div className="flex justify-center pb-4 border-b border-gray-200 dark:border-gray-700">
                      <ReadyPlayerMeAvatar
                        profileId={profile?.id}
                        currentAvatarUrl={profile?.avatar_3d_url}
                        onAvatarUpdate={(url) => setProfile({ ...profile, avatar_3d_url: url })}
                        type="profile"
                      />
                    </div>

                    {/* Tema Rengi */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">🎨 Tema Rengi</label>
                        {themeColor !== profile?.theme_color && (
                          <button
                            onClick={async () => {
                              try {
                                const { error } = await supabase.from('profiles').update({ theme_color: themeColor }).eq('user_id', session.user.id)
                                if (error) throw error
                                setProfile(prev => ({ ...prev, theme_color: themeColor }))
                                alert('✅ Tema rengi kaydedildi!')
                              } catch (error) {
                                alert('Hata: ' + error.message)
                              }
                            }}
                            className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-all animate-pulse"
                          >
                            Kaydet
                          </button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 justify-center">
                        {['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'].map(color => (
                          <button
                            key={color}
                            onClick={() => setThemeColor(color)}
                            className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${themeColor === color ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-900 dark:ring-white' : 'border-gray-300'}`}
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <label className="text-sm text-gray-600 dark:text-gray-400">Özel Renk:</label>
                        <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-16 h-10 rounded cursor-pointer border-2 border-gray-300" />
                        <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{themeColor}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                        {themeColor !== profile?.theme_color ? '⚠️ Değişiklikler kaydedilmedi!' : '✅ Kaydedildi'}
                      </p>
                    </div>

                    {/* Önizleme */}
                    <PublicCardPreview profile={profile} themeColor={themeColor} socialLinks={socialLinks} />

                    {/* Arka Plan Resmi */}
                    <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">🖼️ Arka Plan Resmi</label>
                        {profile?.background_image_url && (
                          <button
                            onClick={async () => {
                              try {
                                const { error } = await supabase.from('profiles').update({ background_image_url: null }).eq('user_id', session.user.id)
                                if (error) throw error
                                setProfile(prev => ({ ...prev, background_image_url: null }))
                                alert('✅ Arka plan resmi kaldırıldı!')
                              } catch (error) {
                                alert('Hata: ' + error.message)
                              }
                            }}
                            className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors"
                          >
                            🗑️ Resmi Kaldır
                          </button>
                        )}
                      </div>
                      {profile?.background_image_url && (
                        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                          <img src={profile.background_image_url} alt="Arka plan" className="w-full h-24 object-cover" />
                        </div>
                      )}
                      <ImageUpload
                        currentImageUrl={profile?.background_image_url}
                        onUploadSuccess={async (url) => {
                          try {
                            const { error } = await supabase.from('profiles').update({ background_image_url: url }).eq('user_id', session.user.id)
                            if (error) throw error
                            setProfile(prev => ({ ...prev, background_image_url: url }))
                            alert('✅ Arka plan resmi güncellendi!')
                          } catch (error) {
                            alert('Hata: ' + error.message)
                          }
                        }}
                        bucket="backgrounds"
                        label="Arka Plan"
                        maxSize={5}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">Kartınızın arka plan resmini yükleyin (Maksimum 5MB)</p>
                    </div>

                    {/* Ad Soyad */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ad Soyad</label>
                      {editing ? (
                        <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="Ahmet Yılmaz" />
                      ) : (
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{name || '-'}</p>
                      )}
                    </div>

                    {/* Ünvan */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ünvan</label>
                      {editing ? (
                        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="Yazılım Geliştirici" />
                      ) : (
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{title || '-'}</p>
                      )}
                    </div>

                    {/* Şirket */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Şirket</label>
                      {editing ? (
                        <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="Tech Startup" />
                      ) : (
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{company || '-'}</p>
                      )}
                    </div>

                    {/* Telefon */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Telefon</label>
                      {editing ? (
                        <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="+90 555 123 4567" />
                      ) : (
                        <p className="text-gray-900 dark:text-gray-100 font-medium">{phone || '-'}</p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email</label>
                      <p className="text-gray-900 dark:text-gray-100 font-medium">{session.user.email}</p>
                    </div>

                    {/* Hakkımda */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Hakkımda</label>
                      {editing ? (
                        <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={4} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="Kendinizden bahsedin..." />
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
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{analytics?.profile_views || 0}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-green-500">
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">QR Kod Tarama</div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{analytics?.qr_scans || 0}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-purple-500">
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">vCard İndirme</div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{analytics?.vcard_downloads || 0}</div>
                  </div>
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-yellow-500">
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Link Tıklama</div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{analytics?.link_clicks || 0}</div>
                  </div>
                </div>

                {/* Username Editor */}
                {profile && (
                  <UsernameEditor
                    currentUsername={profile.username}
                    profileId={profile.id}
                    onUpdate={(newUsername) => setProfile({ ...profile, username: newUsername })}
                  />
                )}

                {/* Social Links */}
                {profile && <SocialLinksManager profileId={profile.id} subscriptionPlan={subscription?.plan || 'free'} />}

                {/* Organization Manager */}
                {profile && <OrganizationManager profileId={profile.id} subscriptionPlan={subscription?.plan || 'free'} />}

                {/* Referral */}
                {profile && <ReferralDashboard profile={profile} />}
              </div>

              {/* Sağ Panel */}
              <div className="space-y-6">

                {profile && profile.username && (
                  <>
                    {/* QR Özelleştirme */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">🎨 QR Kod Özelleştirme</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">QR Kod Rengi</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={profile.qr_foreground_color || '#000000'}
                              onChange={async (e) => {
                                const color = e.target.value
                                try {
                                  const { error } = await supabase.from('profiles').update({ qr_foreground_color: color }).eq('user_id', session.user.id)
                                  if (error) throw error
                                  setProfile(prev => ({ ...prev, qr_foreground_color: color }))
                                } catch (error) { console.error(error) }
                              }}
                              className="w-16 h-10 rounded cursor-pointer border-2 border-gray-300"
                            />
                            <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{profile.qr_foreground_color || '#000000'}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">QR Arka Plan Rengi</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="color"
                              value={profile.qr_background_color || '#FFFFFF'}
                              onChange={async (e) => {
                                const color = e.target.value
                                try {
                                  const { error } = await supabase.from('profiles').update({ qr_background_color: color }).eq('user_id', session.user.id)
                                  if (error) throw error
                                  setProfile(prev => ({ ...prev, qr_background_color: color }))
                                } catch (error) { console.error(error) }
                              }}
                              className="w-16 h-10 rounded cursor-pointer border-2 border-gray-300"
                            />
                            <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{profile.qr_background_color || '#FFFFFF'}</span>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={profile.qr_logo_enabled || false}
                              onChange={async (e) => {
                                const enabled = e.target.checked
                                try {
                                  const { error } = await supabase.from('profiles').update({ qr_logo_enabled: enabled }).eq('user_id', session.user.id)
                                  if (error) throw error
                                  setProfile(prev => ({ ...prev, qr_logo_enabled: enabled }))
                                } catch (error) { console.error(error) }
                              }}
                              className="w-5 h-5 rounded border-gray-300"
                            />
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">QR Kod ortasına profil fotoğrafı ekle</span>
                          </label>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-8">
                            {subscription?.plan === 'free' ? '⚠️ Premium özellik - Profesyonel plana yükseltin' : '✅ Profil fotoğrafınız QR kodun ortasında gösterilecek'}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Katalog & Dökümanlar */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">📁 Katalog & Dökümanlar</h3>
                      <div className="space-y-3 mb-4">
                        {(profile.catalog_links || []).map((link, index) => (
                          <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            {editingCatalogIndex === index ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editingCatalog.title}
                                  onChange={(e) => setEditingCatalog({ ...editingCatalog, title: e.target.value })}
                                  className="w-full px-3 py-2 border-2 border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg outline-none text-sm font-semibold"
                                  placeholder="Döküman başlığı"
                                />
                                <input
                                  type="url"
                                  value={editingCatalog.url}
                                  onChange={(e) => setEditingCatalog({ ...editingCatalog, url: e.target.value })}
                                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg outline-none text-sm"
                                  placeholder="https://..."
                                />
                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={async () => {
                                      const newLinks = [...(profile.catalog_links || [])]
                                      newLinks[index] = { ...link, title: editingCatalog.title, url: editingCatalog.url }
                                      const { error } = await supabase.from('profiles').update({ catalog_links: newLinks }).eq('user_id', session.user.id)
                                      if (error) { alert('Hata: ' + error.message); return }
                                      setProfile(prev => ({ ...prev, catalog_links: newLinks }))
                                      setEditingCatalogIndex(null)
                                    }}
                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700"
                                  >
                                    ✓ Kaydet
                                  </button>
                                  <button
                                    onClick={() => setEditingCatalogIndex(null)}
                                    className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-semibold hover:bg-gray-600"
                                  >
                                    İptal
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-3">
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{link.title}</p>
                                  <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline block truncate" title={link.url}>
                                    {link.url}
                                  </a>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    onClick={() => { setEditingCatalogIndex(index); setEditingCatalog({ title: link.title || '', url: link.url || '' }) }}
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                    title="Düzenle"
                                  >
                                    ✏️
                                  </button>
                                  <button
                                    onClick={async () => {
                                      const newLinks = profile.catalog_links.filter((_, i) => i !== index)
                                      const { error } = await supabase.from('profiles').update({ catalog_links: newLinks }).eq('user_id', session.user.id)
                                      if (error) { alert('Hata: ' + error.message); return }
                                      setProfile(prev => ({ ...prev, catalog_links: newLinks }))
                                    }}
                                    className="text-red-600 hover:text-red-700 text-sm font-semibold"
                                  >
                                    Sil
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={async () => {
                          const rateCheck = checkProfileUpdateRateLimit(session.user.id)
                          if (!rateCheck.allowed) { alert(`⏳ ${rateCheck.message}`); return }
                          const t = prompt('Döküman başlığı (örn: Ürün Kataloğu):')
                          if (!t) return
                          const u = prompt('Döküman linki (Google Drive, Dropbox, vb.):')
                          if (!u) return
                          const validation = validateCatalogLink({ title: t, url: u, type: 'document' })
                          if (!validation.valid) { alert('❌ Hata:\n' + validation.errors.join('\n')); return }
                          const newLinks = [...(profile.catalog_links || []), validation.sanitized]
                          try {
                            const { error } = await supabase.from('profiles').update({ catalog_links: newLinks }).eq('user_id', session.user.id)
                            if (error) throw error
                            setProfile(prev => ({ ...prev, catalog_links: newLinks }))
                            alert('✅ Katalog eklendi!')
                          } catch (error) {
                            alert('❌ Hata: ' + error.message)
                          }
                        }}
                        className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors text-sm"
                      >
                        + Döküman Ekle
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">💡 Google Drive, Dropbox veya kendi web sitenizden link ekleyin</p>
                    </div>

                    {/* Hizmetlerim */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">🛍️ Hizmetlerim</h3>
                      <div className="space-y-3 mb-4">
                        {(profile.services || []).map((service, index) => (
                          <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            {editingServiceIndex === index ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editingService.title}
                                  onChange={(e) => setEditingService({ ...editingService, title: e.target.value })}
                                  className="w-full px-3 py-2 border-2 border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg outline-none text-sm font-semibold"
                                  placeholder="Hizmet adı"
                                />
                                <textarea
                                  value={editingService.description}
                                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                                  rows={2}
                                  className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg outline-none text-sm"
                                  placeholder="Açıklama"
                                />
                                <div className="flex gap-2">
                                  <input
                                    type="number"
                                    value={editingService.price}
                                    onChange={(e) => setEditingService({ ...editingService, price: e.target.value })}
                                    className="w-24 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg outline-none text-sm"
                                    placeholder="Fiyat"
                                  />
                                  <input
                                    type="text"
                                    value={editingService.delivery_time}
                                    onChange={(e) => setEditingService({ ...editingService, delivery_time: e.target.value })}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-600 text-gray-900 dark:text-gray-100 rounded-lg outline-none text-sm"
                                    placeholder="Teslim süresi (örn: 3-5 gün)"
                                  />
                                </div>
                                <div className="flex gap-2 pt-1">
                                  <button
                                    onClick={async () => {
                                      const newServices = [...(profile.services || [])]
                                      newServices[index] = { ...service, title: editingService.title, description: editingService.description, price: Number(editingService.price), delivery_time: editingService.delivery_time }
                                      const { error } = await supabase.from('profiles').update({ services: newServices }).eq('user_id', session.user.id)
                                      if (error) { alert('Hata: ' + error.message); return }
                                      setProfile(prev => ({ ...prev, services: newServices }))
                                      setEditingServiceIndex(null)
                                    }}
                                    className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700"
                                  >
                                    ✓ Kaydet
                                  </button>
                                  <button onClick={() => setEditingServiceIndex(null)} className="px-3 py-1.5 bg-gray-500 text-white rounded-lg text-xs font-semibold hover:bg-gray-600">
                                    İptal
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between mb-2 gap-2">
  <div className="flex-1 min-w-0 overflow-hidden">
    <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{service.title}</h4>
    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{service.description}</p>
  </div>
  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      onClick={() => { setEditingServiceIndex(index); setEditingService({ title: service.title || '', description: service.description || '', price: service.price || '', delivery_time: service.delivery_time || '' }) }}
                                      className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                      title="Düzenle"
                                    >
                                      ✏️
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const newServices = profile.services.filter((_, i) => i !== index)
                                        const { error } = await supabase.from('profiles').update({ services: newServices }).eq('user_id', session.user.id)
                                        if (error) { alert('Hata: ' + error.message); return }
                                        setProfile(prev => ({ ...prev, services: newServices }))
                                      }}
                                      className="text-red-600 hover:text-red-700 text-sm font-semibold"
                                    >
                                      Sil
                                    </button>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm">
                                  <span className="font-bold text-blue-600">₺{service.price}</span>
                                  {service.delivery_time && <span className="text-gray-500">⏱️ {service.delivery_time}</span>}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={async () => {
                          const rateCheck = checkProfileUpdateRateLimit(session.user.id)
                          if (!rateCheck.allowed) { alert(`⏳ ${rateCheck.message}`); return }
                          const t = prompt('Hizmet adı (örn: Logo Tasarımı):')
                          if (!t) return
                          const d = prompt('Açıklama:')
                          if (!d) return
                          const p = prompt('Fiyat (TL):')
                          if (!p) return
                          const dt = prompt('Teslim süresi (örn: 3-5 gün):')
                          const validation = validateService({ title: t, description: d, price: p, delivery_time: dt, currency: 'TRY', category: 'general' })
                          if (!validation.valid) { alert('❌ Hata:\n' + validation.errors.join('\n')); return }
                          const newServices = [...(profile.services || []), validation.sanitized]
                          try {
                            const { error } = await supabase.from('profiles').update({ services: newServices }).eq('user_id', session.user.id)
                            if (error) throw error
                            setProfile(prev => ({ ...prev, services: newServices }))
                            alert('✅ Hizmet eklendi!')
                          } catch (error) {
                            alert('❌ Hata: ' + error.message)
                          }
                        }}
                        className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors text-sm"
                      >
                        + Hizmet Ekle
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">💡 Freelance hizmetlerinizi ekleyin ve profilinizde sergileyin</p>
                    </div>

                    {/* Google Yorumlar */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">⭐ Google Yorumlar</h3>
                      {profile.google_review_link ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">Google Yorum Linki:</p>
                            <a href={profile.google_review_link} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm block truncate">{profile.google_review_link}</a>
                          </div>
                          <button
                            onClick={async () => {
                              if (!confirm('Google yorum linkini kaldırmak istediğinize emin misiniz?')) return
                              const { error } = await supabase.from('profiles').update({ google_review_link: null, google_place_id: null }).eq('user_id', session.user.id)
                              if (error) { alert('Hata: ' + error.message); return }
                              setProfile(prev => ({ ...prev, google_review_link: null, google_place_id: null }))
                            }}
                            className="w-full py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors"
                          >
                            Linki Kaldır
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Profilinize Google İşletme yorumlarınızı ekleyin</p>
                          <button
                            onClick={() => {
                              const link = prompt('Google İşletme yorum sayfası linkini yapıştırın:\n\n(Örnek: https://g.page/r/...)')
                              if (!link) return
                              supabase.from('profiles').update({ google_review_link: link }).eq('user_id', session.user.id)
                                .then(({ error }) => {
                                  if (error) { alert('Hata: ' + error.message); return }
                                  setProfile(prev => ({ ...prev, google_review_link: link }))
                                  alert('✅ Google yorum linki eklendi!')
                                })
                            }}
                            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors text-sm"
                          >
                            + Google Yorum Linki Ekle
                          </button>
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              💡 <strong>Nasıl bulunur?</strong><br />
                              1. Google'da işletmenizi arayın<br />
                              2. "Yorum yaz" butonuna tıklayın<br />
                              3. Açılan sayfanın linkini kopyalayın
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* QR & NFC */}
                    <QRCodeDisplay
                      username={profile.username}
                      fullName={profile.name || session.user.email}
                      qrForegroundColor={profile.qr_foreground_color}
                      qrBackgroundColor={profile.qr_background_color}
                      qrLogoEnabled={profile.qr_logo_enabled}
                      profileImage={profile.avatar_url}
                    />
                    <NFCWriter username={profile.username} />

                    {/* NFC Kart */}
                    {subscription?.plan === 'free' ? (
                      <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg p-6 text-white">
                        <h2 className="text-xl font-semibold mb-2">💳 NFC Kart</h2>
                        <p className="text-purple-100 text-sm mb-4">Professional planla ücretsiz NFC kart kazanın!</p>
                        <button onClick={() => { setSelectedPlan({ plan: 'professional', billingCycle: 'yearly' }); setShowPayment(true) }} className="w-full py-3 bg-white text-purple-600 rounded-xl font-semibold hover:shadow-xl transition-all">
                          Planı Yükselt
                        </button>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg p-6 text-white">
                        <h2 className="text-xl font-semibold mb-2">💳 NFC Kartınız</h2>
                        <p className="text-purple-100 text-sm mb-4">Dijital kartvizitinizi fiziksel karta dönüştürün</p>
                        <button onClick={() => window.location.href = '/nfc-designer'} className="w-full py-3 bg-white text-purple-600 rounded-xl font-semibold hover:shadow-xl transition-all">
                          Kart Tasarla
                        </button>
                      </div>
                    )}
                  </>
                )}

                {!profile?.username && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-300 mb-2">⚠️ Username Gerekli</h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-400">QR kod ve NFC özelliklerini kullanmak için bir username oluşturulması gerekiyor.</p>
                  </div>
                )}

                {/* Abonelik */}
                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
                  <h3 className="text-xl font-bold mb-2">Abonelik</h3>
                  {subLoading ? (
                    <p className="text-blue-100 text-sm">Yükleniyor...</p>
                  ) : (
                    <>
                      <p className="text-blue-100 text-sm mb-1 font-semibold">
                        {subscription?.plan === 'professional' ? '⭐ Profesyonel Plan' :
                          subscription?.plan === 'stk' ? '🏢 STK Özel Plan' :
                            subscription?.plan === 'business' ? '🚀 Kurumsal Plan' :
                              '🆓 Başlangıç Planı'}
                      </p>
                      <div className="space-y-2 text-sm mt-3">
                        <div className="flex items-center gap-2">
                          <span>✓</span>
                          <span>{(subscription?.organizations_limit ?? 2) === 999 ? 'Sınırsız organizasyon' : `${subscription?.organizations_limit ?? 2} organizasyon`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>✓</span>
                          <span>{(subscription?.social_links_limit ?? 3) === 999 ? 'Sınırsız sosyal medya' : `${subscription?.social_links_limit ?? 3} sosyal medya`}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span>✓</span>
                          <span>{(subscription?.nfc_cards_included ?? 0) > 0 ? `${subscription.nfc_cards_included} NFC kart` : 'Temel QR kod'}</span>
                        </div>
                      </div>
                      {(!subscription || subscription.plan === 'free') && (
                        <button
                          onClick={() => { setSelectedPlan({ plan: 'professional', billingCycle: 'yearly' }); setShowPayment(true) }}
                          className="w-full mt-4 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:shadow-lg transition-all"
                        >
                          Planı Yükselt
                        </button>
                      )}
                    </>
                  )}
                </div>

              </div>
            </div>
          )}
        </div>
      </div>

      {showPayment && selectedPlan && (
        <PaymentModal
          plan={selectedPlan.plan}
          billingCycle={selectedPlan.billingCycle}
          profile={profile}
          onSuccess={() => { setShowPayment(false); window.location.reload() }}
          onClose={() => setShowPayment(false)}
        />
      )}
    </>
  )
}