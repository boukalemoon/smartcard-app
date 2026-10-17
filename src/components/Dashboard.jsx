import { useToast } from '../components/Toast'
import { ConfirmModal } from './Modal'
import BankAccountModal from './BankAccountModal'
import BillingInfoModal from './BillingInfoModal'
import ServiceModal from './ServiceModal'
import CatalogLinkModal from './CatalogLinkModal'
import { useAdimAtlama } from '../hooks/useAdimAtlama'
import { odemeBilgisiniYaz } from '../lib/odemeBilgisi'
import { useState, useEffect, useCallback } from 'react'
import PaymentModal from './PaymentModal'
import { supabase } from '../lib/supabaseClient'
import { useSubscription } from '../hooks/useSubscription'
import { useDashboardMode } from '../contexts/DashboardModeContext'
import { validateProfile } from '../utils/inputValidation'
import { checkProfileUpdateRateLimit } from '../utils/rateLimiting'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { gecerliBolum } from '../lib/dashboardBolumler'

import { LogOut, ShieldCheck, User as UserIcon } from 'lucide-react'
import PanelKabugu from '../panel/PanelKabugu'
import { bireyselMenu } from '../panel/menuler'
import { cardUrl } from '../lib/siteUrl'
import PlanKarti from '../panel/bireysel/PlanKarti'
import DavetBandi from '../panel/bireysel/DavetBandi'
import GenelBakis from '../panel/bireysel/GenelBakis'
import Kartim from '../panel/bireysel/Kartim'
import Paylasim from '../panel/bireysel/Paylasim'
import Kimlik from '../panel/bireysel/Kimlik'
import Gelenler from '../panel/bireysel/Gelenler'
import Olcum from '../panel/bireysel/Olcum'
import Partner from '../panel/bireysel/Partner'
import Hesap from '../panel/bireysel/Hesap'
import KurumPaneli from '../panel/kurumsal/KurumPaneli'

export default function Dashboard({ session }) {
  const navigate = useNavigate()
  // Bölüm adreste tutuluyor: sayfa yenilenince yerinde kalır, geri tuşu
  // çalışır ve bir bölümün bağlantısı paylaşılabilir.
  const [aramaParam, setAramaParam] = useSearchParams()
  const bolum = gecerliBolum(aramaParam.get('bolum'))
  const bolumDegistir = (yeni) => {
    setAramaParam({ bolum: yeni }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const { showToast } = useToast()
  const { adimAtla } = useAdimAtlama()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [themeColor, setThemeColor] = useState('#3B82F6')
  const [showPayment, setShowPayment] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [analytics, setAnalytics] = useState(null)
  // Dönem seçimi: eskiden panel HER ZAMAN tüm zamanları gösteriyordu.
  const [analizAralik, setAnalizAralik] = useState({ from: null, to: null })
  const [orgCount, setOrgCount] = useState(0)
  // Kurum sayısı sunucudan gelmeden yetki kararı verilmez: aksi hâlde sayfa
  // her yenilendiğinde kurumsal moddaki kişi bireysele geri atılıyordu.
  const [orgSayisiGeldi, setOrgSayisiGeldi] = useState(false)
  // Plan sınırları TEK kaynaktan (my_plan_limits): eskiden aynı sayı üç ayrı
  // yerde farklı yazıyordu ve kullanıcıya yanlış gösteriliyordu.
  const [planBilgisi, setPlanBilgisi] = useState(null)
  // Kuruma üyelik artık kişinin onayıyla başlıyor.
  const [davetler, setDavetler] = useState([])
  const [davetIsleniyor, setDavetIsleniyor] = useState(null)
  // Menüdeki "Gelenler" sayacı: onay bekleyen randevular.
  const [gelenSayisi, setGelenSayisi] = useState(0)
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

  const { isCorporate, ensureAllowed, setIndividual, setCorporate } = useDashboardMode()
  const { subscription, loading: subLoading } = useSubscription(profile?.id)

  useEffect(() => { loadProfile() }, [])
  useEffect(() => {
    if (profile?.role && ['admin', 'superadmin'].includes(profile.role)) setIsAdmin(true)
  }, [profile])
  useEffect(() => {
    if (profile?.id) {
      loadOrganizationCount()
      planSinirlariniYukle()
      davetleriYukle()
      supabase.rpc('my_appointments').then(({ data }) => {
        setGelenSayisi((Array.isArray(data) ? data : []).filter((r) => r.durum === 'bekliyor').length)
      })
    }
  }, [profile?.id])
  // Kurumsal panel yetkisi: bir organizasyona bağlı olmak (ya da platform
  // yöneticisi). Yetki yoksa kayıtlı mod bireysele çekilir; aksi hâlde
  // kullanıcı panele erişemeden kilitli kalıyordu.
  useEffect(() => {
    if (!profile?.id || !orgSayisiGeldi) return
    ensureAllowed(orgCount > 0 || ['admin', 'superadmin'].includes(profile?.role))
  }, [orgCount, orgSayisiGeldi, profile?.id, profile?.role])

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

  // Analiz SUNUCUDA toplanır: istemcide sayarken 1000 olaydan sonrası
  // sessizce eksik görünüyordu; tarih filtresi de uygulanmıyordu.
  const analiziYukle = useCallback(async () => {
    const { data, error } = await supabase.rpc('my_card_analytics', {
      p_from: analizAralik.from,
      p_to: analizAralik.to,
    })
    if (error) { console.error('Analiz alınamadı:', error); return }
    if (data?.ok) setAnalytics(data)
  }, [analizAralik])

  useEffect(() => { if (profile?.id) analiziYukle() }, [profile?.id, analiziYukle])

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
    finally { setOrgSayisiGeldi(true) }
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


  // Temel bilgileri (ad, unvan, şirket, telefon, hakkımda) değerleriyle kaydet.
  // Kartım düzenleyicisi kendi formunu tutar; doğrulama ve hız sınırı burada.
  const temelBilgileriKaydet = async (degerler) => {
    const { data: sessionData } = await supabase.auth.getSession()
    const userId = sessionData?.session?.user?.id
    if (!userId) throw new Error('Oturum süresi dolmuş, sayfayı yenileyin')
    const rateCheck = checkProfileUpdateRateLimit(userId)
    if (!rateCheck.allowed) throw new Error(rateCheck.message)
    const validation = validateProfile(degerler)
    if (!validation.valid) throw new Error(Object.values(validation.errors).join(', '))
    const { data, error } = await supabase
      .from('profiles')
      .update({ ...validation.sanitized, updated_at: new Date().toISOString() })
      .eq('user_id', userId)
      .select('id')
    if (error) throw error
    if (!data || data.length === 0) throw new Error('Profil kaydedilemedi — oturumunuzu yenileyip tekrar deneyin.')
    setProfile((prev) => ({ ...prev, ...validation.sanitized }))
    setName(validation.sanitized.name ?? name); setTitle(validation.sanitized.title ?? title)
    setCompany(validation.sanitized.company ?? company); setPhone(validation.sanitized.phone ?? phone); setBio(validation.sanitized.bio ?? bio)
    return true
  }

  const odemeyiAc = (plan = 'professional', billingCycle = 'yearly') => {
    setSelectedPlan({ plan, billingCycle })
    setShowPayment(true)
  }

  if (!profile && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zemin">
        <div className="w-12 h-12 border-[3px] border-aksan border-t-transparent rounded-full animate-spin" aria-label="Yükleniyor"></div>
      </div>
    )
  }

  // Sayfalara giden ortak veri ve işlemler. Her sayfa yalnızca ihtiyacını alır.
  const ctx = {
    session, profile, setProfile, subscription, subLoading, planBilgisi, planSinirlariniYukle,
    analytics, analizAralik, setAnalizAralik, socialLinks, setSocialLinks, loadProfile,
    profilAlaniKaydet, temelBilgileriKaydet, updateAvatar, themeColor, setThemeColor,
    showToast, adimAtla, odemeyiAc, bolumDegistir, isAdmin, orgCount,
    davetler, daveteYanitVer, davetIsleniyor,
    bankaDuzenle: (account = null, index = null) => setBankModal({ isOpen: true, account, index }),
    faturaDuzenle: () => setBillingModal({ isOpen: true }),
    hizmetDuzenle: (service = null, index = null) => setServiceModal({ isOpen: true, service, index }),
    belgeDuzenle: (link = null, index = null) => setCatalogModal({ isOpen: true, link, index }),
    onayIste: (secenek) => setConfirmDialog({ isOpen: true, variant: 'danger', ...secenek }),
  }

  const SAYFALAR = {
    genel: GenelBakis, kartim: Kartim, paylasim: Paylasim, kimlik: Kimlik,
    gelenler: Gelenler, olcum: Olcum, partner: Partner, hesap: Hesap,
  }
  const Sayfa = SAYFALAR[bolum] || GenelBakis
  const kurumsalAcik = orgCount > 0 || isAdmin
  const cikis = async () => { await supabase.auth.signOut(); navigate('/') }
  const hesapMenusu = [
    { ad: 'Hesap ve güvenlik', ikon: UserIcon, onClick: () => bolumDegistir('hesap') },
    isAdmin && { ad: 'Yönetici paneli', ikon: ShieldCheck, onClick: () => navigate('/admin') },
    { ad: 'Çıkış yap', ikon: LogOut, onClick: cikis, tehlike: true },
  ]
  const kullanici = { ad: profile?.name || session.user.email, avatar: profile?.avatar_url, eposta: session.user.email }

  return (
    <>
      {isCorporate ? (
        <KurumPaneli
          profile={profile}
          session={session}
          kullanici={kullanici}
          hesapMenusu={hesapMenusu}
          onModDegistir={(m) => (m === 'bireysel' ? setIndividual() : setCorporate())}
        />
      ) : (
        <PanelKabugu
          menu={bireyselMenu({ gelenSayisi })}
          aktif={bolum}
          onSec={bolumDegistir}
          mod="bireysel"
          kurumsalAcik={kurumsalAcik}
          onModDegistir={(m) => (m === 'kurumsal' ? setCorporate() : setIndividual())}
          kartUrl={profile?.username ? cardUrl(profile.username) : null}
          kullanici={kullanici}
          hesapMenusu={hesapMenusu}
          altSlot={<PlanKarti ctx={ctx} />}
        >
          <DavetBandi ctx={ctx} />
          <Sayfa ctx={ctx} />
        </PanelKabugu>
      )}
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
          // show_bank_accounts BİLEREK yazılmıyor: kullanıcı görünürlüğü
          // kapatmışsa hesap eklemek onu geri açmamalı (IBAN herkese açık
          // karta düşerdi). Görünürlük yalnızca kendi anahtarından değişir.
          const { error } = await odemeBilgisiniYaz(adimAtla,
            { profile_id: profile.id, bank_accounts: newAccounts, updated_at: new Date().toISOString() })
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
          const { error } = await odemeBilgisiniYaz(adimAtla,
            { profile_id: profile.id, billing_info: data, show_billing_info: true, updated_at: new Date().toISOString() })
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
        confirmText={confirmDialog.confirmText || "Evet, sil"}
        cancelText="İptal"
        onConfirm={() => confirmDialog.onConfirm?.()}
      />
    </>
  )
}