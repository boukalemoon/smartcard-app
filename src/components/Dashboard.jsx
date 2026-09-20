import { useToast } from '../components/Toast'
import Modal, { ConfirmModal } from './Modal'
import BankAccountModal from './BankAccountModal'
import BillingInfoModal from './BillingInfoModal'
import ServiceModal from './ServiceModal'
import CatalogLinkModal from './CatalogLinkModal'
import ImageUpload from './ImageUpload'
import PublicCardPreview from './PublicCardPreview'
import { getAnalyticsSummary } from '../utils/analyticsHelpers'
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
import NFCWriter from './NFCWriter'
import SocialLinksManager from './SocialLinksManager'
import UsernameEditor from './UsernameEditor'
import QrtimIdCard from './QrtimIdCard'
import PersonaManager from './PersonaManager'
import PersonaShare from './PersonaShare'
import ActivityLog from './ActivityLog'
import { validateProfile } from '../utils/inputValidation'
import { checkProfileUpdateRateLimit } from '../utils/rateLimiting'
import { useNavigate } from 'react-router-dom'

// plan_features'ta 999 "sınırsız" anlamına gelir; kullanıcıya sayı olarak
// göstermek yerine kelimeyle yazılır.
function sinirYazi(deger) {
  return deger >= 999 ? 'Sınırsız' : String(deger)
}

export default function Dashboard({ session }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [themeColor, setThemeColor] = useState('#3B82F6')
  const [showPayment, setShowPayment] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  const [orgCount, setOrgCount] = useState(0)
  // Plan sınırları TEK kaynaktan (my_plan_limits): eskiden aynı sayı üç ayrı
  // yerde farklı yazıyordu ve kullanıcıya yanlış gösteriliyordu.
  const [planBilgisi, setPlanBilgisi] = useState(null)
  // Kuruma üyelik artık kişinin onayıyla başlıyor.
  const [davetler, setDavetler] = useState([])
  const [davetIsleniyor, setDavetIsleniyor] = useState(null)
  const [socialLinks, setSocialLinks] = useState([])
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [phone, setPhone] = useState('')
  const [bio, setBio] = useState('')
  // Modal state'leri
  const [bankModal, setBankModal] = useState({ isOpen: false, account: null, index: null })
  const [billingModal, setBillingModal] = useState({ isOpen: false })
  const [serviceModal, setServiceModal] = useState({ isOpen: false, service: null, index: null })
  const [catalogModal, setCatalogModal] = useState({ isOpen: false, link: null, index: null })

  // Confirm dialog state'i (delete onayları için)
  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null,
    variant: 'primary'
  })

  const { isCorporate, ensureAllowed } = useDashboardMode()
  const { subscription, loading: subLoading, getLimits } = useSubscription(profile?.id)

  useEffect(() => { loadProfile() }, [])
  useEffect(() => {
    if (profile?.role && ['admin', 'superadmin'].includes(profile.role)) setIsAdmin(true)
  }, [profile])
  useEffect(() => {
    if (profile?.id) {
      loadOrganizationCount()
      planSinirlariniYukle()
      davetleriYukle()
    }
  }, [profile?.id])
  // Kurumsal panel yetkisi: bir organizasyona bağlı olmak (ya da platform
  // yöneticisi). Yetki yoksa kayıtlı mod bireysele çekilir; aksi hâlde
  // kullanıcı panele erişemeden kilitli kalıyordu.
  useEffect(() => {
    ensureAllowed(orgCount > 0 || ['admin', 'superadmin'].includes(profile?.role))
  }, [orgCount, profile?.role])

  const loadProfile = async () => {
    try {
      const { data, error } = await supabase.from('profiles').select('*').eq('user_id', session.user.id).single()
      if (error && error.code !== 'PGRST116') throw error
      if (data) {
        // Ödeme/fatura ayrı owner-only tablodan gelir (profiles'ta tutulmaz).
        const { data: pay } = await supabase.from('profile_payment').select('*').eq('profile_id', data.id).maybeSingle()
        setProfile({
          ...data,
          bank_accounts: pay?.bank_accounts || [],
          billing_info: pay?.billing_info || null,
          show_bank_accounts: pay?.show_bank_accounts ?? false,
          show_billing_info: pay?.show_billing_info ?? false,
        })
        setThemeColor(data.theme_color || '#3B82F6')
        setName(data.name || '')
        setTitle(data.title || '')
        setCompany(data.company || '')
        setPhone(data.phone || '')
        setBio(data.bio || '')
        const { data: linksData } = await supabase.from('social_links').select('*').eq('profile_id', data.id).order('display_order')
        if (linksData) setSocialLinks(linksData)
        const analyticsData = await getAnalyticsSummary(data.id)
        setAnalytics(analyticsData)
      }
    } catch (error) {
      console.error('Error loading profile:', error)
    } finally {
      setLoading(false)
    }
  }

  // Profil alanı kaydetme — TEK yol.
  //
  // NEDEN: Supabase'de erişim kuralı bir güncellemeyi engellediğinde HATA
  // DÖNMEZ, yalnızca 0 satır günceller. Bu dosyadaki 14 ayrı yazma yalnızca
  // `error` alanına bakıyordu; yetki reddedildiğinde kullanıcıya "kaydedildi"
  // deniyor ama hiçbir şey değişmiyordu. Artık etkilenen satır kontrol edilir.
  const profilAlaniKaydet = async (yama) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(yama)
      .eq('user_id', session.user.id)
      .select('id')
    if (error) throw error
    if (!data || data.length === 0) {
      throw new Error('Değişiklik kaydedilemedi: bu işlem için yetkiniz yok.')
    }
    return true
  }

  const planSinirlariniYukle = async () => {
    const { data, error } = await supabase.rpc('my_plan_limits')
    if (error) { console.error('Plan sınırları alınamadı:', error); return }
    if (data?.ok) setPlanBilgisi(data)
  }

  const davetleriYukle = async () => {
    const { data, error } = await supabase.rpc('my_pending_invitations')
    if (error) { console.error('Davetler alınamadı:', error); return }
    setDavetler(data || [])
  }

  const daveteYanitVer = async (davet, kabul) => {
    setDavetIsleniyor(davet.member_id)
    try {
      const { data, error } = await supabase.rpc('invitation_respond', {
        p_member_id: davet.member_id, p_accept: kabul,
      })
      if (error) throw error
      if (!data?.ok) {
        showToast(data?.hata === 'zaten_uyesiniz' ? 'Zaten bu organizasyonun üyesisiniz.' : 'Davet yanıtlanamadı.', 'error')
        return
      }
      showToast(kabul ? `${data.kurum} üyeliğiniz başladı.` : 'Davet reddedildi.', 'success')
      davetleriYukle()
      loadOrganizationCount()
      planSinirlariniYukle()
    } catch (e) {
      showToast('Hata: ' + e.message, 'error')
    } finally {
      setDavetIsleniyor(null)
    }
  }

  const loadOrganizationCount = async () => {
    if (!profile?.id) return
    try {
      const { data } = await supabase.from('members').select('organization_id').eq('profile_id', profile.id)
      setOrgCount(new Set(data?.map(m => m.organization_id) || []).size)
    } catch (error) { console.error('Error counting organizations:', error) }
  }

  const saveProfile = async () => {
    try {
      setLoading(true)

      // Session geçerliliğini doğrula — email onayı sonrası race condition'ı önler
      const { data: sessionData } = await supabase.auth.getSession()
      const currentSession = sessionData?.session
      if (!currentSession?.user) {
        showToast('Oturum süresi dolmuş, sayfayı yenileyin', 'error')
        return
      }
      const userId = currentSession.user.id

      const rateCheck = checkProfileUpdateRateLimit(userId)
      if (!rateCheck.allowed) {
        showToast(rateCheck.message, 'warning')
        return
      }
      const validation = validateProfile({ name, title, company, phone, bio })
      if (!validation.valid) {
        showToast('Hata: ' + Object.values(validation.errors).join(', '), 'error')
        return
      }

      if (profile) {
        // .select() ŞART: satır sayısı kontrol edilmezse, erişim kuralı
        // güncellemeyi engellediğinde `error` boş döner, 0 satır güncellenir
        // ve kullanıcıya yine "Profil kaydedildi" gösterilirdi. Görüntülenme
        // sayacında aynı sessiz hata aylarca fark edilmeden kalmıştı.
        const { data, error } = await supabase
          .from('profiles')
          .update({ ...validation.sanitized, updated_at: new Date().toISOString() })
          .eq('user_id', userId)
          .select('id')
        if (error) throw error
        if (!data || data.length === 0) {
          showToast('Profil kaydedilemedi — oturumunuzu yenileyip tekrar deneyin.', 'error')
          return
        }
      } else {
        // Trigger'ın oluşturmadığı durum — id'yi açıkça set et (RLS uyumluluğu).
        // Profil zaten varsa birincil anahtar çakışması yerine güncelle:
        // kullanıcılar "kaydedilemiyor" hatasını tam olarak bu yüzden alıyordu.
        const { error } = await supabase.from('profiles').upsert({
          id: userId,
          user_id: userId,
          email: currentSession.user.email,
          ...validation.sanitized
        }, { onConflict: 'id' })
        if (error) throw error
      }

      showToast('Profil kaydedildi', 'success')
      setEditing(false)
      loadProfile()
    } catch (error) {
      showToast('Hata: ' + error.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  const updateAvatar = async (avatarUrl) => {
    try {
      await profilAlaniKaydet({ avatar_url: avatarUrl })
      setProfile({ ...profile, avatar_url: avatarUrl })
      showToast('Profil fotoğrafı güncellendi', 'success')
    } catch (error) {
      showToast('Hata: ' + error.message, 'error')
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
        <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between">
              <img src="/qrtım-logo.png" alt="QRtım" className="h-16 w-auto cursor-pointer" onClick={() => navigate('/')} />
              <div className="flex items-center gap-3">
                <DashboardModeToggle hasOrganizations={orgCount > 0} profile={profile} />
                <ThemeToggle />
                <button onClick={async () => { await supabase.auth.signOut(); navigate('/') }} className="px-6 py-2 bg-red-500 text-white rounded-lg font-semibold hover:bg-red-600 transition-all">Çıkış Yap</button>
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          {subscription && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-blue-900 dark:text-blue-100">📊 {limits?.name || subscription.plan} {isCorporate && '- Kurumsal Mod'}</h3>
                  {/* Sayılar plan_features'tan gelir (my_plan_limits); daha önce
                      abonelik satırındaki kolonlar gösteriliyordu ve sunucunun
                      uyguladığı kuralla çelişiyordu. */}
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    {planBilgisi ? (
                      <>
                        Profiller: {planBilgisi.kullanim.profil}/{sinirYazi(planBilgisi.sinir.profil)}
                        {' • '}Organizasyon: {planBilgisi.kullanim.organizasyon}/{sinirYazi(planBilgisi.sinir.organizasyon)}
                        {' • '}Sosyal medya: {planBilgisi.kullanim.sosyal_medya}/{sinirYazi(planBilgisi.sinir.sosyal_medya)}
                      </>
                    ) : 'Plan bilgileri yükleniyor…'}
                  </p>
                </div>
                {subscription.plan === 'free' && (
                  <button onClick={() => { setSelectedPlan({ plan: 'professional', billingCycle: 'yearly' }); setShowPayment(true) }} className="px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all text-sm">Planı Yükselt</button>
                )}
              </div>
            </div>
          )}

          {isAdmin && (
            <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-2 border-red-200 dark:border-red-800 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold text-red-900 dark:text-red-100">🔐 Admin Yetkisi</h3>
                  <p className="text-sm text-red-700 dark:text-red-300">Tüm kullanıcıları ve ödemeleri yönetin</p>
                </div>
                <button onClick={() => window.location.href = '/admin'} className="px-6 py-3 bg-gradient-to-r from-red-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all">Admin Paneline Git →</button>
              </div>
            </div>
          )}

          {davetler.length > 0 && (
            <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border-2 border-amber-200 dark:border-amber-800 rounded-xl">
              <h3 className="text-lg font-bold text-amber-900 dark:text-amber-100 mb-1">
                ✉️ Organizasyon daveti{davetler.length > 1 ? ` (${davetler.length})` : ''}
              </h3>
              <p className="text-sm text-amber-800 dark:text-amber-200 mb-3">
                Kabul ederseniz üyeliğiniz başlar ve kart hareketleriniz (görüntülenme,
                QR, tıklama) o organizasyonun yöneticisine görünür. Reddederseniz hiçbir
                veriniz paylaşılmaz.
              </p>
              <div className="space-y-2">
                {davetler.map((d) => (
                  <div key={d.member_id} className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-gray-800 rounded-lg p-3">
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">{d.organization_name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {d.invited_by_name ? `${d.invited_by_name} davet etti` : 'Davet edildiniz'}
                        {d.invited_at && ` · ${new Date(d.invited_at).toLocaleDateString('tr-TR')}`}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => daveteYanitVer(d, false)}
                        disabled={davetIsleniyor === d.member_id}
                        className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
                      >
                        Reddet
                      </button>
                      <button
                        onClick={() => daveteYanitVer(d, true)}
                        disabled={davetIsleniyor === d.member_id}
                        className="px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm font-semibold hover:bg-amber-700 disabled:opacity-50"
                      >
                        {davetIsleniyor === d.member_id ? 'İşleniyor…' : 'Kabul Et'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {isCorporate ? (
            <CorporateDashboard profile={profile} />
          ) : (
            <div className="grid lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Profil Bilgileri</h2>
                    {!editing ? (
                      <button onClick={() => setEditing(true)} className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-all">Düzenle</button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={saveProfile} disabled={loading} className="px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition-all disabled:opacity-50">Kaydet</button>
                        <button onClick={() => { setEditing(false); loadProfile() }} className="px-4 py-2 bg-gray-500 text-white rounded-lg font-semibold hover:bg-gray-600 transition-all">İptal</button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Profil Fotoğrafı */}
                    <div className="flex flex-col items-center pb-4 border-b border-gray-200 dark:border-gray-700">
                      <ImageUpload currentImageUrl={profile?.avatar_url} onUploadSuccess={updateAvatar} bucket="avatars" label="Profil Fotoğrafı" maxSize={2} />
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">📐 Önerilen: 400×400px (kare) — Maks 2MB — JPG/PNG</p>
                    </div>

                    {/* Tema Rengi */}
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">🎨 Tema Rengi</label>
                       {themeColor !== profile?.theme_color && (
                          <button onClick={async () => {
                            try {
                              await profilAlaniKaydet({ theme_color: themeColor })
                              setProfile(prev => ({ ...prev, theme_color: themeColor }))
                              showToast('Tema rengi kaydedildi', 'success')
                            } catch (error) {
                              showToast('Hata: ' + error.message, 'error')
                            }
                          }} className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-semibold hover:bg-green-600 transition-all animate-pulse">Kaydet</button>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-3 justify-center">
                        {['#3B82F6', '#8B5CF6', '#EC4899', '#10B981', '#F59E0B', '#EF4444'].map(color => (
                          <button key={color} onClick={() => setThemeColor(color)}
                            className={`w-10 h-10 rounded-full border-2 transition-all hover:scale-110 ${themeColor === color ? 'border-gray-900 dark:border-white ring-2 ring-offset-2 ring-gray-900 dark:ring-white' : 'border-gray-300'}`}
                            style={{ backgroundColor: color }} />
                        ))}
                      </div>
                      <div className="flex items-center justify-center gap-3">
                        <label className="text-sm text-gray-600 dark:text-gray-400">Özel Renk:</label>
                        <input type="color" value={themeColor} onChange={(e) => setThemeColor(e.target.value)} className="w-16 h-10 rounded cursor-pointer border-2 border-gray-300" />
                        <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{themeColor}</span>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 text-center">{themeColor !== profile?.theme_color ? '⚠️ Değişiklikler kaydedilmedi!' : '✅ Kaydedildi'}</p>
                    </div>

                    {/* Önizleme */}
                    <PublicCardPreview profile={profile} themeColor={themeColor} socialLinks={socialLinks} />

                    {/* Arka Plan */}
                    <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                      <div className="flex items-center justify-between">
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">🖼️ Arka Plan Resmi</label>
                        {profile?.background_image_url && (
                          <button onClick={() => setConfirmDialog({
                            isOpen: true,
                            title: 'Arka Plan Resmini Kaldır',
                            message: 'Arka plan resmini kaldırmak istediğinize emin misiniz?',
                            variant: 'danger',
                            confirmText: 'Evet, Kaldır',
                            onConfirm: async () => {
                              try {
                                await profilAlaniKaydet({ background_image_url: null })
                                setProfile(prev => ({ ...prev, background_image_url: null }))
                                showToast('Arka plan resmi kaldırıldı', 'success')
                              } catch (error) {
                                showToast('Hata: ' + error.message, 'error')
                              }
                            }
                          })} className="px-3 py-1 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-xs font-semibold hover:bg-red-100 transition-colors">🗑️ Resmi Kaldır</button>
                        )}
                      </div>
                      {profile?.background_image_url && (
                        <div className="rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700">
                          <img src={profile.background_image_url} alt="Arka plan" className="w-full h-24 object-cover" />
                        </div>
                      )}
                      <ImageUpload currentImageUrl={profile?.background_image_url}
                        onUploadSuccess={async (url) => {
                          try {
                            await profilAlaniKaydet({ background_image_url: url })
                            setProfile(prev => ({ ...prev, background_image_url: url }))
                            showToast('Arka plan resmi güncellendi', 'success')
                          } catch (error) {
                            showToast('Hata: ' + error.message, 'error')
                          }
                        }}
                        bucket="backgrounds" label="Arka Plan" maxSize={5} />
                    </div>

                    {/* Ad Soyad */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ad Soyad</label>
                      {editing ? <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="Ahmet Yılmaz" />
                        : <p className="text-gray-900 dark:text-gray-100 font-medium">{name || '-'}</p>}
                    </div>

                    {/* Ünvan */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ünvan</label>
                      {editing ? <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="Yazılım Geliştirici" />
                        : <p className="text-gray-900 dark:text-gray-100 font-medium">{title || '-'}</p>}
                    </div>

                    {/* Şirket */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Şirket</label>
                      {editing ? <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="Tech Startup" />
                        : <p className="text-gray-900 dark:text-gray-100 font-medium">{company || '-'}</p>}
                    </div>

                    {/* Telefon */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Telefon</label>
                      {editing ? <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="+90 555 123 4567 veya +1 555 123 4567" />
                        : <p className="text-gray-900 dark:text-gray-100 font-medium">{phone || '-'}</p>}
                    </div>

                    {/* Email — görünürlük artık "Profillerim" bölümünden
                        yönetiliyor. Eski buradaki anahtar yalnızca React
                        render'ında çalışıyordu; veri yine de gönderiliyordu. */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Email</label>
                      <p className="text-gray-900 dark:text-gray-100 font-medium">{session.user.email}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Kartınızda görünüp görünmeyeceğini aşağıdaki <strong>Profillerim</strong> bölümünden, her profil için ayrı ayrı belirleyebilirsiniz.
                      </p>
                    </div>

                    {/* Hakkımda */}
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Hakkımda</label>
                      {editing ? (
                        <textarea
                          value={bio}
                          onChange={(e) => setBio(e.target.value)}
                          rows={4}
                          autoComplete="off"
                          autoCorrect="off"
                          autoCapitalize="off"
                          spellCheck="false"
                          className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none"
                          placeholder="Kendinizden bahsedin..."
                        />
                      ) : <p className="text-gray-900 dark:text-gray-100">{bio || '-'}</p>}
                    </div>
                  </div>
                </div>

                {/* İstatistikler */}
                <div className="grid md:grid-cols-4 gap-4">
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-blue-500">
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Profil Görüntülenme</div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{analytics?.profile_views || 0}</div>
                  </div>
                  {/* QR ve NFC ile gelenler artık gerçekten ölçülüyor: koda ve
                      karta yazılan adres kaynağını taşıyor. Daha önce basılmış
                      kartlarda işaret yok, onlar "doğrudan" sayılır. */}
                  <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-green-500">
                    <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">QR / NFC ile Gelen</div>
                    <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{(analytics?.qr_views || 0) + (analytics?.nfc_views || 0)}</div>
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

                {profile?.id && <UsernameEditor currentUsername={profile.username} profileId={profile.id} onUpdate={(newUsername) => setProfile({ ...profile, username: newUsername })} />}
                {profile?.id && <PersonaManager username={profile.username} />}
                {profile?.user_id && <QrtimIdCard userId={profile.user_id} />}
                {profile && <SocialLinksManager profileId={profile.id} subscriptionPlan={subscription?.plan || 'free'} />}
                {profile && <OrganizationManager profileId={profile.id} />}
                {profile && <ReferralDashboard profile={profile} />}
                {profile && <ActivityLog />}
              </div>

              <div className="space-y-6">
                {profile?.username && (
                  <>
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">🎨 QR Kod Özelleştirme</h3>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">QR Kod Rengi</label>
                          <div className="flex items-center gap-3">
                            <input type="color" value={profile.qr_foreground_color || '#000000'} onChange={async (e) => { const color = e.target.value; try { await profilAlaniKaydet({ qr_foreground_color: color }); setProfile(prev => ({ ...prev, qr_foreground_color: color })) } catch (error) { console.error(error) } }} className="w-16 h-10 rounded cursor-pointer border-2 border-gray-300" />
                            <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{profile.qr_foreground_color || '#000000'}</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">QR Arka Plan Rengi</label>
                          <div className="flex items-center gap-3">
                            <input type="color" value={profile.qr_background_color || '#FFFFFF'} onChange={async (e) => { const color = e.target.value; try { await profilAlaniKaydet({ qr_background_color: color }); setProfile(prev => ({ ...prev, qr_background_color: color })) } catch (error) { console.error(error) } }} className="w-16 h-10 rounded cursor-pointer border-2 border-gray-300" />
                            <span className="text-sm font-mono text-gray-600 dark:text-gray-400">{profile.qr_background_color || '#FFFFFF'}</span>
                          </div>
                        </div>
                        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input type="checkbox" checked={profile.qr_logo_enabled || false} onChange={async (e) => { const enabled = e.target.checked; try { await profilAlaniKaydet({ qr_logo_enabled: enabled }); setProfile(prev => ({ ...prev, qr_logo_enabled: enabled })) } catch (error) { console.error(error) } }} className="w-5 h-5 rounded border-gray-300" />
                            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">QR Kod ortasına profil fotoğrafı ekle</span>
                          </label>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 ml-8">{subscription?.plan === 'free' ? 'QR kodun ortasında profil fotoğrafınız görünür' : '✅ Profil fotoğrafınız QR kodun ortasında gösterilecek'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Katalog */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">📁 Katalog & Dokümanlar</h3>
                      <div className="space-y-3 mb-4">
                        {(profile.catalog_links || []).map((link, index) => (
                          <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-gray-900 dark:text-gray-100 mb-1 truncate">{link.title}</p>
                              <a  
                                href={link.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-blue-600 hover:underline block truncate"
                              >
                                {link.url}
                              </a>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => setCatalogModal({ isOpen: true, link, index })}
                                className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                title="Düzenle"
                              >
                                ✏️
                              </button>
                              <button
                                onClick={() => setConfirmDialog({
                                  isOpen: true,
                                  title: 'Linki Sil',
                                  message: `"${link.title}" linkini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                                  variant: 'danger',
                                  onConfirm: async () => {
                                    const newLinks = profile.catalog_links.filter((_, i) => i !== index)
                                    try {

                                      await profilAlaniKaydet({ catalog_links: newLinks })

                                    } catch (e) {

                                      showToast('Hata: ' + e.message, 'error')

                                      return

                                    }
                                    setProfile(prev => ({ ...prev, catalog_links: newLinks }))
                                    showToast('Link silindi', 'success')
                                  }
                                })}
                                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Sil"
                              >
                                🗑️
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setCatalogModal({ isOpen: true, link: null, index: null })}
                        className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors text-sm"
                      >
                        + Doküman Ekle
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">💡 Google Drive, Dropbox veya kendi web sitenizden link ekleyin</p>
                    </div>

                    {/* Banka Hesapları */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">🏦 Banka Hesapları</h3>
                      <label className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={profile.show_bank_accounts ?? false} onChange={async (e) => {
                          const v = e.target.checked
                          const { error } = await supabase.from('profile_payment').upsert({ profile_id: profile.id, show_bank_accounts: v, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })
                          if (error) { showToast('Hata: ' + error.message, 'error'); return }
                          setProfile(prev => ({ ...prev, show_bank_accounts: v }))
                        }} className="w-4 h-4 rounded" />
                        Kartvizitimde herkese göster
                      </label>
                      <div className="space-y-3 mb-4">
                        {(profile.bank_accounts || []).map((account, index) => (
                          <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{account.bank_name}</p>
                                <p className="text-sm text-gray-600 dark:text-gray-400 truncate">{account.account_holder}</p>
                                <p className="text-xs font-mono text-gray-700 dark:text-gray-300 mt-1 break-all">{account.iban}</p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => setBankModal({ isOpen: true, account, index })}
                                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                  title="Düzenle"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => setConfirmDialog({
                                    isOpen: true,
                                    title: 'Banka Hesabını Sil',
                                    message: `"${account.bank_name}" hesabını silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                                    variant: 'danger',
                                    onConfirm: async () => {
                                      const newAccounts = profile.bank_accounts.filter((_, i) => i !== index)
                                      const { error } = await supabase
                                        .from('profile_payment')
                                        .upsert({ profile_id: profile.id, bank_accounts: newAccounts, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })
                                      if (error) {
                                        showToast('Hata: ' + error.message, 'error')
                                        return
                                      }
                                      setProfile(prev => ({ ...prev, bank_accounts: newAccounts }))
                                      showToast('Banka hesabı silindi', 'success')
                                    }
                                  })}
                                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Sil"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setBankModal({ isOpen: true, account: null, index: null })}
                        className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors text-sm"
                      >
                        + Banka Hesabı Ekle
                      </button>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">💡 IBAN'larınız kartvizitinizde görünür ve tek tık ile kopyalanabilir.</p>
                    </div>

                    {/* Fatura Bilgileri */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-2">📋 Fatura Bilgileri</h3>
                      <label className="flex items-center gap-2 mb-4 text-sm text-gray-600 dark:text-gray-400 cursor-pointer">
                        <input type="checkbox" checked={profile.show_billing_info ?? false} onChange={async (e) => {
                          const v = e.target.checked
                          const { error } = await supabase.from('profile_payment').upsert({ profile_id: profile.id, show_billing_info: v, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })
                          if (error) { showToast('Hata: ' + error.message, 'error'); return }
                          setProfile(prev => ({ ...prev, show_billing_info: v }))
                        }} className="w-4 h-4 rounded" />
                        Kartvizitimde herkese göster
                      </label>

                      {profile.billing_info ? (
                        <div className="space-y-3">
                          <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
                            <div>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {profile.billing_info.is_individual ? 'Ad Soyad:' : 'Şirket Ünvanı:'}
                              </p>
                              <p className="font-semibold text-gray-900 dark:text-gray-100">{profile.billing_info.company_title}</p>
                            </div>

                            {profile.billing_info.tax_office && (
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Vergi Dairesi:</p>
                                <p className="text-sm text-gray-900 dark:text-gray-100">{profile.billing_info.tax_office}</p>
                              </div>
                            )}

                            {profile.billing_info.tax_number && (
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  {profile.billing_info.is_individual ? 'TC Kimlik No:' : 'Vergi No:'}
                                </p>
                                <p className="text-sm font-mono text-gray-900 dark:text-gray-100">{profile.billing_info.tax_number}</p>
                              </div>
                            )}

                            {profile.billing_info.address && (
                              <div>
                                <p className="text-xs text-gray-500 dark:text-gray-400">Adres:</p>
                                <p className="text-sm text-gray-900 dark:text-gray-100 whitespace-pre-wrap">{profile.billing_info.address}</p>
                              </div>
                            )}
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={() => setBillingModal({ isOpen: true })}
                              className="flex-1 py-2 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg text-sm font-semibold hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                            >
                              ✏️ Düzenle
                            </button>

                            <button
                              onClick={() => setConfirmDialog({
                                isOpen: true,
                                title: 'Fatura Bilgilerini Sil',
                                message: 'Fatura bilgilerinizi silmek istediğinize emin misiniz? Bu işlem geri alınamaz.',
                                variant: 'danger',
                                onConfirm: async () => {
                                  const { error } = await supabase
                                    .from('profile_payment')
                                    .upsert({ profile_id: profile.id, billing_info: null, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })
                                  if (error) {
                                    showToast('Hata: ' + error.message, 'error')
                                    return
                                  }
                                  setProfile(prev => ({ ...prev, billing_info: null }))
                                  showToast('Fatura bilgileri silindi', 'success')
                                }
                              })}
                              className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
                            >
                              🗑️ Sil
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Fatura/e-Fatura için müşterilerinizin ihtiyaç duyacağı bilgileri ekleyin.
                          </p>

                          <button
                            onClick={() => setBillingModal({ isOpen: true })}
                            className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors text-sm"
                          >
                            + Fatura Bilgileri Ekle
                          </button>

                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            💡 Bu bilgiler kartvizitinizde görünür ve müşterileriniz tek tık ile kopyalayabilir.
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Hizmetler */}
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
                      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">🛍️ Hizmetlerim</h3>
                      <div className="space-y-3 mb-4">
                        {(profile.services || []).map((service, index) => (
                          <div key={index} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                            <div className="flex items-start justify-between mb-2 gap-2">
                              <div className="flex-1 min-w-0">
                                <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">{service.title}</h4>
                                <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{service.description}</p>
                              </div>
                              <div className="flex gap-1 shrink-0">
                                <button
                                  onClick={() => setServiceModal({ isOpen: true, service, index })}
                                  className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                  title="Düzenle"
                                >
                                  ✏️
                                </button>
                                <button
                                  onClick={() => setConfirmDialog({
                                    isOpen: true,
                                    title: 'Hizmeti Sil',
                                    message: `"${service.title}" hizmetini silmek istediğinize emin misiniz? Bu işlem geri alınamaz.`,
                                    variant: 'danger',
                                    onConfirm: async () => {
                                      const newServices = profile.services.filter((_, i) => i !== index)
                                      try {

                                        await profilAlaniKaydet({ services: newServices })

                                      } catch (e) {

                                        showToast('Hata: ' + e.message, 'error')

                                        return

                                      }
                                      setProfile(prev => ({ ...prev, services: newServices }))
                                      showToast('Hizmet silindi', 'success')
                                    }
                                  })}
                                  className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Sil"
                                >
                                  🗑️
                                </button>
                              </div>
                            </div>
                            <div className="flex items-center gap-4 text-sm">
                              <span className="font-bold text-blue-600 dark:text-blue-400">₺{service.price}</span>
                              {service.delivery_time && <span className="text-gray-500 dark:text-gray-400">⏱️ {service.delivery_time}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => setServiceModal({ isOpen: true, service: null, index: null })}
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
                         <button onClick={() => setConfirmDialog({
                            isOpen: true,
                            title: 'Google Yorum Linkini Kaldır',
                            message: 'Google yorum linkini kaldırmak istediğinize emin misiniz?',
                            variant: 'danger',
                            confirmText: 'Evet, Kaldır',
                            onConfirm: async () => {
                              try {

                                await profilAlaniKaydet({ google_review_link: null, google_place_id: null })

                              } catch (e) {

                                showToast('Hata: ' + e.message, 'error')

                                return

                              }
                              setProfile(prev => ({ ...prev, google_review_link: null, google_place_id: null }))
                              showToast('Google yorum linki kaldırıldı', 'success')
                            }
                          })} className="w-full py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-100 transition-colors">Linki Kaldır</button>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          <p className="text-sm text-gray-600 dark:text-gray-400">Profilinize Google İşletme yorumlarınızı ekleyin</p>
                          <button onClick={() => {
                            const link = prompt('Google İşletme yorum sayfası linkini yapıştırın:')
                            if (!link) return
                            profilAlaniKaydet({ google_review_link: link })
                              .then(() => {
                                setProfile(prev => ({ ...prev, google_review_link: link }))
                                showToast('Google yorum linki eklendi', 'success')
                              })
                              .catch((e) => showToast('Hata: ' + e.message, 'error'))
                          }} className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors text-sm">+ Google Yorum Linki Ekle</button>
                          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                            <p className="text-xs text-blue-800 dark:text-blue-200">💡 <strong>Nasıl bulunur?</strong><br />1. Google'da işletmenizi arayın<br />2. "Yorum yaz" butonuna tıklayın<br />3. Açılan sayfanın linkini kopyalayın</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <PersonaShare profile={profile} fallbackName={session.user.email} />
                    <NFCWriter username={profile.username} />

                    {subscription?.plan === 'free' ? (
                      <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg p-6 text-white">
                        <h2 className="text-xl font-semibold mb-2">💳 NFC Kart</h2>
                        <p className="text-purple-100 text-sm mb-4">Yıllık profesyonel abonelikte NFC kart pakete dahil</p>
                        <button onClick={() => { setSelectedPlan({ plan: 'professional', billingCycle: 'yearly' }); setShowPayment(true) }} className="w-full py-3 bg-white text-purple-600 rounded-xl font-semibold hover:shadow-xl transition-all">Planı Yükselt</button>
                      </div>
                    ) : (
                      <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg p-6 text-white">
                        <h2 className="text-xl font-semibold mb-2">💳 NFC Kartınız</h2>
                        <p className="text-purple-100 text-sm mb-4">Dijital kartvizitinizi fiziksel karta dönüştürün</p>
                        <button onClick={() => window.location.href = '/nfc-designer'} className="w-full py-3 bg-white text-purple-600 rounded-xl font-semibold hover:shadow-xl transition-all">Kart Tasarla</button>
                      </div>
                    )}
                  </>
                )}

                {!profile?.username && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-2xl p-6">
                    <h3 className="text-lg font-bold text-yellow-900 dark:text-yellow-300 mb-2">⚠️ Kullanıcı adı gerekli</h3>
                    <p className="text-sm text-yellow-800 dark:text-yellow-400">QR kod ve NFC özelliklerini kullanmak için bir kullanıcı adı belirlemeniz gerekiyor.</p>
                  </div>
                )}

                <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-lg p-6 text-white">
                  <h3 className="text-xl font-bold mb-2">Abonelik</h3>
                  {subLoading ? <p className="text-blue-100 text-sm">Yükleniyor...</p> : (
                    <>
                      <p className="text-blue-100 text-sm mb-1 font-semibold">
                        {subscription?.plan === 'professional' ? '⭐ Profesyonel Plan' : subscription?.plan === 'stk' ? '🏢 STK Özel Plan' : subscription?.plan === 'business' ? '🚀 Kurumsal Plan' : '🆓 Başlangıç Planı'}
                      </p>
                      <div className="space-y-2 text-sm mt-3">
                        <div className="flex items-center gap-2"><span>✓</span><span>{sinirYazi(planBilgisi?.sinir?.profil ?? 2)} profil</span></div>
                        <div className="flex items-center gap-2"><span>✓</span><span>{sinirYazi(planBilgisi?.sinir?.organizasyon ?? 2)} organizasyon</span></div>
                        <div className="flex items-center gap-2"><span>✓</span><span>{sinirYazi(planBilgisi?.sinir?.sosyal_medya ?? 3)} sosyal medya</span></div>
                        {(planBilgisi?.sinir?.nfc_yillik ?? 0) > 0 && (
                          <div className="flex items-center gap-2"><span>✓</span><span>Yıllık abonelikte {planBilgisi.sinir.nfc_yillik} NFC kart</span></div>
                        )}
                      </div>
                      {planBilgisi?.expires_at && (
                        <p className="text-xs text-blue-100 mt-3">
                          Yenileme tarihi: {new Date(planBilgisi.expires_at).toLocaleDateString('tr-TR')}
                        </p>
                      )}
                      {(!subscription || subscription.plan === 'free') && (
                        <button onClick={() => { setSelectedPlan({ plan: 'professional', billingCycle: 'yearly' }); setShowPayment(true) }} className="w-full mt-4 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:shadow-lg transition-all">Planı Yükselt</button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* PaymentModal isOpen/selectedPlan bekliyor; panel plan/billingCycle
          gönderdiği için pencere hiç açılmıyordu — yükseltme düğmelerinin
          üçü de sessizce hiçbir şey yapmıyordu. */}
      <PaymentModal
        isOpen={showPayment && Boolean(selectedPlan)}
        selectedPlan={selectedPlan?.plan}
        initialPeriod={selectedPlan?.billingCycle}
        currentSubscription={subscription}
        isRenewal={Boolean(subscription && subscription.plan !== 'free')}
        onClose={() => setShowPayment(false)}
      />
      {/* Banka Hesabı Modal */}
      <BankAccountModal
        isOpen={bankModal.isOpen}
        onClose={() => setBankModal({ isOpen: false, account: null, index: null })}
        account={bankModal.account}
        onSave={async (data) => {
          let newAccounts
          if (bankModal.index !== null) {
            // Düzenleme
            newAccounts = [...profile.bank_accounts]
            newAccounts[bankModal.index] = data
          } else {
            // Yeni ekleme
            newAccounts = [...(profile.bank_accounts || []), data]
          }
          const { error } = await supabase
            .from('profile_payment')
            // show_bank_accounts BİLEREK yazılmıyor: kullanıcı görünürlüğü
            // kapatmışsa hesap eklemek onu geri açmamalı (IBAN herkese açık
            // karta düşerdi). Görünürlük yalnızca kendi anahtarından değişir.
            .upsert({ profile_id: profile.id, bank_accounts: newAccounts, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })
          if (error) throw error
          setProfile(prev => ({ ...prev, bank_accounts: newAccounts }))
        }}
      />

      {/* Fatura Bilgileri Modal */}
      <BillingInfoModal
        isOpen={billingModal.isOpen}
        onClose={() => setBillingModal({ isOpen: false })}
        billingInfo={profile?.billing_info}
        onSave={async (data) => {
          const { error } = await supabase
            .from('profile_payment')
            .upsert({ profile_id: profile.id, billing_info: data, show_billing_info: true, updated_at: new Date().toISOString() }, { onConflict: 'profile_id' })
          if (error) throw error
          setProfile(prev => ({ ...prev, billing_info: data, show_billing_info: true }))
        }}
      />

      {/* Hizmet Modal */}
      <ServiceModal
        isOpen={serviceModal.isOpen}
        onClose={() => setServiceModal({ isOpen: false, service: null, index: null })}
        service={serviceModal.service}
        serviceIndex={serviceModal.index}
        onSave={async (data, index) => {
          let newServices
          if (index !== null && index !== undefined) {
            // Düzenleme
            newServices = [...profile.services]
            newServices[index] = data
          } else {
            // Yeni ekleme
            newServices = [...(profile.services || []), data]
          }
          await profilAlaniKaydet({ services: newServices })
          setProfile(prev => ({ ...prev, services: newServices }))
        }}
      />

      {/* Katalog Link Modal */}
      <CatalogLinkModal
        isOpen={catalogModal.isOpen}
        onClose={() => setCatalogModal({ isOpen: false, link: null, index: null })}
        link={catalogModal.link}
        linkIndex={catalogModal.index}
        onSave={async (data, index) => {
          let newLinks
          if (index !== null && index !== undefined) {
            // Düzenleme
            newLinks = [...profile.catalog_links]
            newLinks[index] = data
          } else {
            // Yeni ekleme
            newLinks = [...(profile.catalog_links || []), data]
          }
          await profilAlaniKaydet({ catalog_links: newLinks })
          setProfile(prev => ({ ...prev, catalog_links: newLinks }))
        }}
      />

      {/* Confirm Dialog (delete onayları için) */}
      <ConfirmModal
        isOpen={confirmDialog.isOpen}
        onClose={() => setConfirmDialog({ ...confirmDialog, isOpen: false })}
        title={confirmDialog.title}
        message={confirmDialog.message}
        variant={confirmDialog.variant}
        confirmText="Evet, Sil"
        cancelText="İptal"
        onConfirm={() => confirmDialog.onConfirm?.()}
      />
    </>
  )
}