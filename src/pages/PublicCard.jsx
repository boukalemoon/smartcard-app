import AvatarFlipCard from '../components/AvatarFlipCard'
import { trackEvent } from '../utils/analyticsHelpers'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Linkedin, Facebook, Twitter, Instagram, Play, Github, Globe, Music, Twitch, ExternalLink, ArrowLeft, Download, Mail, Phone, MapPin, ChevronDown, ChevronUp } from 'lucide-react'

const PLATFORM_CONFIG = {
  // mevcut platformlar...
  linkedin:  { icon: Linkedin,  color: '#0A66C2', label: 'LinkedIn' },
  facebook:  { icon: Facebook,  color: '#1877F2', label: 'Facebook' },
  twitter:   { icon: Twitter,   color: '#000000', label: 'Twitter/X' },
  instagram: { icon: Instagram, color: '#E4405F', label: 'Instagram' },
  youtube:   { icon: Play,      color: '#FF0000', label: 'YouTube' },
  tiktok:    { icon: Music,     color: '#000000', label: 'TikTok' },
  github:    { icon: Github,    color: '#333333', label: 'GitHub' },
  website:   { icon: Globe,     color: '#6B7280', label: 'Website' },
  twitch:    { icon: Twitch,    color: '#9146FF', label: 'Twitch' },
  kick:      { icon: Globe,     color: '#53FC18', label: 'Kick' },
  snapchat:  { icon: Globe,     color: '#FFFC00', label: 'Snapchat' },
  pinterest: { icon: Globe,     color: '#E60023', label: 'Pinterest' },
  // E-ticaret platformları
  trendyol:     { icon: Globe, color: '#F27A1A', label: 'Trendyol' },
  hepsiburada:  { icon: Globe, color: '#FF6000', label: 'Hepsiburada' },
  n11:          { icon: Globe, color: '#1B5FAD', label: 'N11' },
  amazon_tr:    { icon: Globe, color: '#FF9900', label: 'Amazon TR' },
  etsy:         { icon: Globe, color: '#F56400', label: 'Etsy' },
  shopify:      { icon: Globe, color: '#96BF48', label: 'Shopify' },
  woocommerce:  { icon: Globe, color: '#7F54B3', label: 'WooCommerce' },
  katalog_link: { icon: Globe, color: '#6B7280', label: 'Katalog' },
}

export default function PublicCard() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [socialLinks, setSocialLinks] = useState([])
  const [organizations, setOrganizations] = useState([])
  const [expandedOrg, setExpandedOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const adjustColor = (color, percent) => {
    if (!color) return '#1e40af'
    const num = parseInt(color.replace('#', ''), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) + amt
    const G = (num >> 8 & 0x00FF) + amt
    const B = (num & 0x0000FF) + amt
    return '#' + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 + (G<255?G<1?0:G:255)*0x100 + (B<255?B<1?0:B:255)).toString(16).slice(1)
  }

  useEffect(() => { document.documentElement.classList.remove('dark') }, [])
  useEffect(() => { if (username) loadProfile() }, [username])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const { data: profileData, error: profileError } = await supabase
        .from('profiles').select('*').eq('username', username).maybeSingle()
      if (profileError) throw profileError
      if (!profileData) { setError('Profil bulunamadı'); return }
      setProfile(profileData)

      const { data: subData } = await supabase
  .from('subscriptions')
  .select('plan')
  .eq('profile_id', profileData.id)
  .eq('status', 'active')
  .maybeSingle()

      
      if (profileData?.id) {
        trackEvent(profileData.id, 'profile_view')
        await supabase.from('profiles')
          .update({ card_views: (profileData.card_views || 0) + 1, last_viewed_at: new Date().toISOString() })
          .eq('id', profileData.id)
      }

      const { data: linksData } = await supabase
        .from('social_links').select('*').eq('profile_id', profileData.id).order('display_order')
      setSocialLinks(linksData || [])

      const { data: memberData } = await supabase
  .from('members')
  .select('role, organizations(id, name, type, description, logo_url, phone, email, website, address, city)')
  .eq('profile_id', profileData.id)

const allOrgs = (memberData || []).map(m => ({ ...m.organizations, role: m.role }))
const activePlan = subData?.plan || profileData?.subscription_plan || 'free'
const orgLimit = ['professional', 'stk', 'business', 'student'].includes(activePlan) ? 999 : 2
setOrganizations(allOrgs.slice(0, orgLimit))
    } catch (err) {
      console.error('Profil yükleme hatası:', err)
      setError('Profil bulunamadı')
    } finally {
      setLoading(false)
    }
  }

  const downloadVCard = () => {
    if (!profile) return
    const nameParts = (profile.name || 'Unknown').split(' ')
    const lastName = nameParts.length > 1 ? nameParts.pop() : ''
    const firstName = nameParts.join(' ') || 'Unknown'
    const vCard = ['BEGIN:VCARD','VERSION:3.0',`FN:${profile.name||''}`,`N:${lastName};${firstName};;;`,`TEL:${profile.phone||''}`,`EMAIL:${profile.email||''}`,`TITLE:${profile.title||''}`,`ORG:${profile.company||''}`,`NOTE:${profile.bio||''}`,`URL:${window.location.origin}/card/${profile.username}`,'END:VCARD'].join('\n')
    const blob = new Blob([vCard], { type: 'text/vcard;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${profile.username||'contact'}.vcf`
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    if (profile?.id) trackEvent(profile.id, 'vcard_download')
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Yükleniyor...</p>
      </div>
    </div>
  )

  if (error || !profile) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">❌</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Profil Bulunamadı</h1>
        <p className="text-gray-600 mb-6">Bu kullanıcı adı mevcut değil.</p>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Ana Sayfaya Dön</button>
      </div>
    </div>
  )

  const themeColor = profile?.theme_color || '#3B82F6'

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">

        <div className="mb-6 flex items-center justify-between">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-gray-600 hover:text-gray-800">
            <ArrowLeft size={20} /><span>Ana Sayfa</span>
          </button>
          <div className="text-sm text-gray-500">Powered by QRtım</div>
        </div>

        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">

          {/* Header */}
          <div className="p-8 text-white text-center relative overflow-hidden"
            style={{ background: profile.background_image_url ? 'transparent' : `linear-gradient(to right, ${themeColor}, ${adjustColor(themeColor, -40)})` }}>
            {profile.background_image_url && <>
              <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${profile.background_image_url})` }} />
              <div className="absolute inset-0 bg-black/40" />
            </>}
            <div className="relative z-10">
              <AvatarFlipCard profileImage={profile.avatar_url} avatar3dUrl={profile.avatar_3d_url} name={profile.name || ''} />
              <h1 className="text-3xl font-bold mb-2">{profile.name || ''}</h1>
              {profile.title && <p className="text-blue-100 text-lg mb-1">{profile.title}</p>}
              {profile.company && <p className="text-blue-200">{profile.company}</p>}
            </div>
          </div>

          <div className="p-6 space-y-4">

            {/* Bio */}
            {profile.bio && (
              <div className="pb-4 border-b border-gray-200">
                <p className="text-gray-700 text-center">{profile.bio}</p>
              </div>
            )}

            {/* İletişim */}
            <div className="grid gap-3">
              {profile.email && profile.show_email !== false && (
  <a href={`mailto:${profile.email}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
    <Mail size={20} style={{ color: themeColor }} />
    <span className="text-gray-700">{profile.email}</span>
  </a>
)}
              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <Phone size={20} style={{ color: themeColor }} />
                  <span className="text-gray-700">{profile.phone}</span>
                </a>
              )}
            </div>

            {/* Sosyal Medya */}
            {socialLinks.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">🔗 Bağlantılar</h3>
                <div className="flex flex-wrap gap-2">
                  {socialLinks.map((link) => {
                    const config = PLATFORM_CONFIG[link.platform] || { icon: Globe, color: '#6B7280', label: link.platform }
                    const Icon = config.icon
                    return (
                      <a key={link.id} href={link.url} target="_blank" rel="noopener noreferrer" title={config.label}
                        onClick={() => trackEvent(profile.id, 'link_click')}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: config.color }}>
                        <Icon size={18} />
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

{/* Banka Hesapları */}
<div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">🏦 Banka Hesapları</h3>
  <div className="space-y-3 mb-4">
    {(profile.bank_accounts || []).map((account, index) => (
      <div key={index} className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 dark:text-gray-100">{account.bank_name}</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">{account.account_holder}</p>
            <p className="text-xs font-mono text-gray-700 dark:text-gray-300 mt-1 break-all">{account.iban}</p>
          </div>
          <div className="flex gap-1 shrink-0">
            <button
              onClick={() => {
                const newName = prompt('Banka adı:', account.bank_name); if (!newName) return
                const newHolder = prompt('Hesap sahibi:', account.account_holder); if (!newHolder) return
                const newIban = prompt('IBAN (TR... formatında):', account.iban); if (!newIban) return
                const newAccounts = [...profile.bank_accounts]
                newAccounts[index] = { bank_name: newName, account_holder: newHolder, iban: newIban.replace(/\s/g, '').toUpperCase() }
                supabase.from('profiles').update({ bank_accounts: newAccounts }).eq('user_id', session.user.id).then(({ error }) => {
                  if (error) { alert('Hata: ' + error.message); return }
                  setProfile(prev => ({ ...prev, bank_accounts: newAccounts }))
                })
              }}
              className="text-blue-600 hover:text-blue-700 text-sm font-semibold"
            >✏️</button>
            <button
              onClick={async () => {
                if (!confirm('Bu banka hesabını silmek istediğinize emin misiniz?')) return
                const newAccounts = profile.bank_accounts.filter((_, i) => i !== index)
                const { error } = await supabase.from('profiles').update({ bank_accounts: newAccounts }).eq('user_id', session.user.id)
                if (error) { alert('Hata: ' + error.message); return }
                setProfile(prev => ({ ...prev, bank_accounts: newAccounts }))
              }}
              className="text-red-600 hover:text-red-700 text-sm font-semibold"
            >Sil</button>
          </div>
        </div>
      </div>
    ))}

    {/* Fatura Bilgileri */}
{profile.billing_info && (
  <div className="pt-4 border-t border-gray-200">
    <div className="flex items-center justify-between mb-3">
      <h3 className="font-semibold text-gray-800">📋 Fatura Bilgileri</h3>
      <button
        onClick={() => {
          const text = [
            profile.billing_info.company_title,
            profile.billing_info.tax_office && `Vergi Dairesi: ${profile.billing_info.tax_office}`,
            profile.billing_info.tax_number && `${profile.billing_info.is_individual ? 'TC' : 'Vergi No'}: ${profile.billing_info.tax_number}`,
            profile.billing_info.address
          ].filter(Boolean).join('\n')
          navigator.clipboard.writeText(text)
          alert('✅ Fatura bilgileri kopyalandı!')
        }}
        className="px-3 py-1 text-white text-xs font-semibold rounded-lg"
        style={{ backgroundColor: themeColor }}
      >
        📋 Tümünü Kopyala
      </button>
    </div>
    <div className="p-3 rounded-lg space-y-2" style={{ backgroundColor: `${themeColor}10` }}>
      <div>
        <p className="text-xs text-gray-500">Ünvan:</p>
        <p className="text-sm font-semibold text-gray-900">{profile.billing_info.company_title}</p>
      </div>
      {profile.billing_info.tax_office && (
        <div>
          <p className="text-xs text-gray-500">Vergi Dairesi:</p>
          <p className="text-sm text-gray-900">{profile.billing_info.tax_office}</p>
        </div>
      )}
      {profile.billing_info.tax_number && (
        <div>
          <p className="text-xs text-gray-500">{profile.billing_info.is_individual ? 'TC Kimlik:' : 'Vergi No:'}</p>
          <p className="text-sm font-mono text-gray-900">{profile.billing_info.tax_number}</p>
        </div>
      )}
      {profile.billing_info.address && (
        <div>
          <p className="text-xs text-gray-500">Adres:</p>
          <p className="text-sm text-gray-900">{profile.billing_info.address}</p>
        </div>
      )}
    </div>
  </div>
)}

  </div>
  <button
    onClick={async () => {
      const bankName = prompt('Banka adı (örn: Garanti BBVA):'); if (!bankName) return
      const holder = prompt('Hesap sahibi adı:'); if (!holder) return
      const iban = prompt('IBAN (TR... formatında):'); if (!iban) return
      const cleanIban = iban.replace(/\s/g, '').toUpperCase()
      if (!/^TR[0-9]{24}$/.test(cleanIban)) {
        alert('❌ Geçersiz IBAN formatı. Türkiye IBAN: TR + 24 rakam (toplam 26 karakter)')
        return
      }
      const newAccounts = [...(profile.bank_accounts || []), { bank_name: bankName, account_holder: holder, iban: cleanIban }]
      try {
        const { error } = await supabase.from('profiles').update({ bank_accounts: newAccounts }).eq('user_id', session.user.id)
        if (error) throw error
        setProfile(prev => ({ ...prev, bank_accounts: newAccounts }))
        alert('✅ Banka hesabı eklendi!')
      } catch (error) { alert('❌ Hata: ' + error.message) }
    }}
    className="w-full py-2 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-600 dark:text-gray-400 hover:border-blue-500 hover:text-blue-500 transition-colors text-sm"
  >+ Banka Hesabı Ekle</button>
  <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">💡 IBAN'larınız kartvizitinizde görünür ve tek tık ile kopyalanabilir.</p>
</div>

            {/* Organizasyonlar — tıkla aç */}
            {organizations.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">🏢 Şirketler & Organizasyonlar</h3>
                <div className="grid gap-3">
                  {organizations.map((org) => (
                    <div key={org.id} className="rounded-lg border border-gray-200 overflow-hidden">
                      {/* Organizasyon başlık — tıkla */}
                      <button
                        onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
                        className="w-full flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                      >
                        {org.logo_url ? (
                          <img src={org.logo_url} alt={org.name} className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center text-white text-lg font-bold flex-shrink-0"
                            style={{ backgroundColor: themeColor }}>
                            {org.name?.charAt(0)}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900">{org.name}</p>
                          {org.description && <p className="text-xs text-gray-500 truncate">{org.description}</p>}
                        </div>
                        {expandedOrg === org.id ? <ChevronUp size={18} className="text-gray-400 flex-shrink-0" /> : <ChevronDown size={18} className="text-gray-400 flex-shrink-0" />}
                      </button>

                      {/* Organizasyon detay — açılır */}
                      {expandedOrg === org.id && (
                        <div className="p-4 space-y-2 bg-white border-t border-gray-100">
                          {org.description && <p className="text-sm text-gray-600 mb-3">{org.description}</p>}
                          {org.phone && (
                            <a href={`tel:${org.phone}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors">
                              <Phone size={16} style={{ color: themeColor }} />
                              <span>{org.phone}</span>
                            </a>
                          )}
                          {org.email && (
                            <a href={`mailto:${org.email}`} className="flex items-center gap-2 text-sm text-gray-700 hover:text-blue-600 transition-colors">
                              <Mail size={16} style={{ color: themeColor }} />
                              <span>{org.email}</span>
                            </a>
                          )}
                          {org.website && (
                            <a href={org.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
                              <Globe size={16} style={{ color: themeColor }} />
                              <span className="truncate">{org.website.replace('https://', '').replace('http://', '')}</span>
                            </a>
                          )}
                          {(org.city || org.address) && (
                            <div className="flex items-start gap-2 text-sm text-gray-600">
                              <MapPin size={16} style={{ color: themeColor }} className="mt-0.5 flex-shrink-0" />
                              <span>{[org.address, org.city].filter(Boolean).join(', ')}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Katalog */}
            {profile.catalog_links && profile.catalog_links.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">📁 Katalog & Dökümanlar</h3>
                <div className="grid gap-2">
                  {profile.catalog_links.map((link, index) => (
                    <a key={index} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <span style={{ color: themeColor }}>📄</span>
                      <span className="text-gray-700 font-medium">{link.title}</span>
                      <ExternalLink className="ml-auto text-gray-400" size={16} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Hizmetler */}
            {profile.services && profile.services.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">🛍️ Hizmetlerim</h3>
                <div className="grid gap-3">
                  {profile.services.map((service, index) => (
                    <div key={index} className="p-4 rounded-lg" style={{ backgroundColor: `${themeColor}10` }}>
                      <h4 className="font-semibold text-gray-900 mb-1">{service.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-bold" style={{ color: themeColor }}>₺{service.price}</span>
                        {service.delivery_time && <span className="text-sm text-gray-500">⏱️ {service.delivery_time}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Google Yorum */}
            {profile.google_review_link && (
              <div className="pt-4 border-t border-gray-200">
                <a href={profile.google_review_link} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-4 rounded-lg"
                  style={{ background: `linear-gradient(to right, ${themeColor}, ${adjustColor(themeColor, -30)})` }}>
                  <span className="text-white text-2xl">⭐</span>
                  <span className="text-white font-semibold">Google'da Yorum Yap</span>
                </a>
              </div>
            )}

            {/* vCard */}
            <button onClick={downloadVCard}
              className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-semibold hover:shadow-xl transition-all"
              style={{ background: `linear-gradient(to right, ${themeColor}, ${adjustColor(themeColor, -30)})` }}>
              <Download size={20} />
              Kişilere Kaydet (vCard)
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm mb-2">Sen de dijital kartvizitini oluştur!</p>
          <button onClick={() => navigate(`/signup?ref=${profile?.referral_code || profile?.id}`)}
            className="text-blue-600 hover:text-blue-700 font-medium">Ücretsiz Kaydol →</button>
          <p className="text-xs text-gray-500 mt-2">{profile?.name} tarafından davet edildiniz! 🎁</p>
        </div>
      </div>
    </div>
  )
}