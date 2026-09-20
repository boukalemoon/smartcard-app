import AvatarFlipCard from '../components/AvatarFlipCard'
import ContactExchange from '../components/ContactExchange'
import VerifiedBadges from '../components/VerifiedBadges'
import { trackCardEvent, kaynagiCoz } from '../utils/analyticsHelpers'
import { useEffect, useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { SITE_URL } from '../lib/siteUrl'
import { useToast } from '../components/Toast'
import { Linkedin, Facebook, Twitter, Instagram, Play, Github, Globe, Music, Twitch, ExternalLink, ArrowLeft, Download, Mail, Phone, MapPin, ChevronDown, ChevronUp } from 'lucide-react'

const PLATFORM_CONFIG = {
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
  trendyol:     { icon: Globe, color: '#F27A1A', label: 'Trendyol' },
  hepsiburada:  { icon: Globe, color: '#FF6000', label: 'Hepsiburada' },
  n11:          { icon: Globe, color: '#1B5FAD', label: 'N11' },
  amazon_tr:    { icon: Globe, color: '#FF9900', label: 'Amazon TR' },
  etsy:         { icon: Globe, color: '#F56400', label: 'Etsy' },
  shopify:      { icon: Globe, color: '#96BF48', label: 'Shopify' },
  woocommerce:  { icon: Globe, color: '#7F54B3', label: 'WooCommerce' },
  katalog_link: { icon: Globe, color: '#6B7280', label: 'Katalog' },
}

// Kullanıcı tarafından girilen adresler doğrudan href'e yazılmamalı:
// 'javascript:' ve 'data:' şemaları kartı açan ziyaretçide kod çalıştırabilir
// (bulgu Y-5). Yalnızca http/https geçer; diğerleri bağlantı olarak render
// edilmez. Sunucu tarafında da süzülür, bu ikinci savunma katmanıdır.
function safeUrl(url) {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url.trim())
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null
  } catch {
    return null
  }
}

export default function PublicCard() {
  // /card/:username → ana profil, /k/:code → seçilmiş profil (persona)
  const { username, code } = useParams()
  const [duraklatildi, setDuraklatildi] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  // Ziyaretçi karta nereden geldi: QR mı, NFC kart mı, paylaşılan bağlantı mı?
  // QR ve NFC adresine ?k=qr / ?k=nfc basılır; işaret yoksa doğrudan sayılır.
  const hedef = { username: username || null, code: code || null, source: kaynagiCoz(location.search, Boolean(code)) }
  const { showToast } = useToast()
  const [profile, setProfile] = useState(null)
  // Alan bazlı gizlilik: yalnızca görünürlüğü 'public' olan alanlar sunucudan
  // gelir. Gizli alanlar istemciye HİÇ ulaşmaz (bkz. bulgu K-1 / K-2).
  const [fields, setFields] = useState({})
  const [socialLinks, setSocialLinks] = useState([])
  const [organizations, setOrganizations] = useState([])
  // Doğrulamalar sunucuda üretilir; istemci rozet uyduramaz.
  const [dogrulamalar, setDogrulamalar] = useState([])
  const [expandedOrg, setExpandedOrg] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  // Ödeme/fatura bilgisi profiles'ta değil; onaya bağlı güvenli RPC ile alınır.
  const [paymentInfo, setPaymentInfo] = useState(null)

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
  useEffect(() => { if (username || code) loadProfile() }, [username, code])

  const loadProfile = async () => {
    try {
      setLoading(true)

      // Kartın TEK veri kaynağı. Görünürlük filtresi, plan bazlı organizasyon
      // sınırı ve ödeme onayı kontrolü sunucuda uygulanır; istemci artık
      // profiles/social_links/members/organizations tablolarına dokunmuyor.
      // Persona bağlantısı kodla çözülür; profil ADIYLA başka profile ulaşılamaz.
      const { data, error: rpcError } = code
        ? await supabase.rpc('get_public_card_by_code', { p_code: code })
        : await supabase.rpc('get_public_card', { p_username: username })
      if (rpcError) throw rpcError
      if (!data) { setError('Profil bulunamadı'); return }
      if (data.paused) { setDuraklatildi(true); return }

      setProfile(data)
      setFields(data.fields || {})
      setSocialLinks(data.social_links || [])
      setOrganizations(data.organizations || [])
      setDogrulamalar(data.dogrulamalar || [])
      setPaymentInfo(data.payment || null)

      // Görüntülenme, sayaç ve hız sınırı TEK çağrıda, sunucuda. Eskiden
      // olay istemciden tabloya yazılıyor (sahte veri yazılabiliyordu),
      // sayaç ise ayrı bir RPC ile artıyordu; ikisi birbirini tutmuyordu.
      trackCardEvent('profile_view', hedef)
    } catch (err) {
      console.error('Profil yükleme hatası:', err)
      setError('Profil bulunamadı')
    } finally {
      setLoading(false)
    }
  }

  // Pano yazma izin verilmediğinde ya da güvenli bağlam dışında sessizce
  // başarısız olur; kullanıcı ne olduğunu anlayabilsin diye geri bildirim verilir.
  const copyToClipboard = async (text, basariMesaji) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast(basariMesaji, 'success')
    } catch {
      showToast('Kopyalanamadı — metni elle seçip kopyalayabilirsiniz.', 'warning')
    }
  }

  const downloadVCard = () => {
    if (!profile) return
    const nameParts = (profile.name || 'Unknown').split(' ')
    const lastName = nameParts.length > 1 ? nameParts.pop() : ''
    const firstName = nameParts.join(' ') || 'Unknown'
    // vCard yalnızca herkese açık alanlardan üretilir; gizli tutulan bir alan
    // zaten istemciye hiç gelmediği için kişi kartına da yazılamaz.
    const vCard = ['BEGIN:VCARD','VERSION:3.0',`FN:${profile.name||''}`,`N:${lastName};${firstName};;;`,`TEL:${fields.phone||''}`,`EMAIL:${fields.email||''}`,`TITLE:${fields.title||''}`,`ORG:${fields.company||''}`,`NOTE:${fields.bio||''}`,`URL:${SITE_URL}${profile.share_path || `/card/${profile.username}`}`,'END:VCARD'].join('\n')
    const blob = new Blob([vCard], { type: 'text/vcard;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${profile.username||'contact'}.vcf`
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    trackCardEvent('vcard_download', hedef)
  }

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Yükleniyor...</p>
      </div>
    </div>
  )

  if (duraklatildi) return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-4">⏸️</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Bu profil şu an paylaşılmıyor</h1>
        <p className="text-gray-600 mb-6">Profil sahibi bu bağlantıyı geçici olarak duraklatmış.</p>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Ana Sayfaya Dön</button>
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
              {fields.title && <p className="text-blue-100 text-lg mb-1">{fields.title}</p>}
              {fields.company && <p className="text-blue-200">{fields.company}</p>}
              {fields.department && <p className="text-blue-200 text-sm">{fields.department}</p>}
              {fields.city && <p className="text-blue-200 text-sm flex items-center justify-center gap-1"><MapPin size={14} />{fields.city}</p>}
              {dogrulamalar.length > 0 && (
                <div className="mt-3">
                  <VerifiedBadges dogrulamalar={dogrulamalar} temaRengi={themeColor} />
                </div>
              )}
            </div>
          </div>

          <div className="p-6 space-y-4">

            {/* Bio */}
            {fields.bio && (
              <div className="pb-4 border-b border-gray-200">
                <p className="text-gray-700 text-center">{fields.bio}</p>
              </div>
            )}

            {/* İletişim — bu alanlar yalnızca kullanıcı 'herkese açık'
                işaretlediyse sunucudan gelir; ayrıca istemci kontrolü yok. */}
            <div className="grid gap-3">
              {fields.email && (
                <a href={`mailto:${fields.email}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <Mail size={20} style={{ color: themeColor }} />
                  <span className="text-gray-700">{fields.email}</span>
                </a>
              )}
              {fields.phone && (
                <a href={`tel:${fields.phone}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <Phone size={20} style={{ color: themeColor }} />
                  <span className="text-gray-700">{fields.phone}</span>
                </a>
              )}
              {fields.whatsapp && (
                <a href={`https://wa.me/${String(fields.whatsapp).replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <Phone size={20} style={{ color: '#25D366' }} />
                  <span className="text-gray-700">WhatsApp: {fields.whatsapp}</span>
                </a>
              )}
              {safeUrl(fields.website) && (
                <a href={safeUrl(fields.website)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <Globe size={20} style={{ color: themeColor }} />
                  <span className="text-gray-700 truncate">{fields.website.replace(/^https?:\/\//, '')}</span>
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
                    const href = safeUrl(link.url)
                    if (!href) return null
                    return (
                      <a key={link.id} href={href} target="_blank" rel="noopener noreferrer" title={config.label}
                        onClick={() => trackCardEvent('link_click', { ...hedef, meta: { label: config.label, platform: link.platform } })}
                        className="w-10 h-10 rounded-lg flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                        style={{ backgroundColor: config.color }}>
                        <Icon size={18} />
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Organizasyonlar */}
            {organizations.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">🏢 Şirketler & Organizasyonlar</h3>
                <div className="grid gap-3">
                  {organizations.map((org) => (
                    <div key={org.id} className="rounded-lg border border-gray-200 overflow-hidden">
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
                          {safeUrl(org.website) && (
                            <a href={safeUrl(org.website)} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-sm text-blue-600 hover:underline">
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

            {/* Banka Hesapları */}
            {paymentInfo?.bank_accounts && paymentInfo.bank_accounts.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">🏦 Banka Hesapları</h3>
                <div className="grid gap-3">
                  {paymentInfo.bank_accounts.map((account, index) => (
                    <div key={index} className="p-3 rounded-lg" style={{ backgroundColor: `${themeColor}10` }}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div>
                          <p className="font-semibold text-gray-900 text-sm">{account.bank_name}</p>
                          <p className="text-xs text-gray-600">{account.account_holder}</p>
                        </div>
                        <button
                          onClick={() => {
                            copyToClipboard(account.iban, 'IBAN kopyalandı')
                          }}
                          className="px-3 py-1 text-white text-xs font-semibold rounded-lg shrink-0"
                          style={{ backgroundColor: themeColor }}
                        >
                          📋 Kopyala
                        </button>
                      </div>
                      <p className="text-xs font-mono text-gray-700 break-all mt-2">{account.iban}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Fatura Bilgileri */}
            {paymentInfo?.billing_info && (
              <div className="pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-gray-800">📋 Fatura Bilgileri</h3>
                  <button
                    onClick={() => {
                      const text = [
                        paymentInfo.billing_info.company_title,
                        paymentInfo.billing_info.tax_office && `Vergi Dairesi: ${paymentInfo.billing_info.tax_office}`,
                        paymentInfo.billing_info.tax_number && `${paymentInfo.billing_info.is_individual ? 'TC' : 'Vergi No'}: ${paymentInfo.billing_info.tax_number}`,
                        paymentInfo.billing_info.address
                      ].filter(Boolean).join('\n')
                      copyToClipboard(text, 'Fatura bilgileri kopyalandı')
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
                    <p className="text-sm font-semibold text-gray-900">{paymentInfo.billing_info.company_title}</p>
                  </div>
                  {paymentInfo.billing_info.tax_office && (
                    <div>
                      <p className="text-xs text-gray-500">Vergi Dairesi:</p>
                      <p className="text-sm text-gray-900">{paymentInfo.billing_info.tax_office}</p>
                    </div>
                  )}
                  {paymentInfo.billing_info.tax_number && (
                    <div>
                      <p className="text-xs text-gray-500">{paymentInfo.billing_info.is_individual ? 'TC Kimlik:' : 'Vergi No:'}</p>
                      <p className="text-sm font-mono text-gray-900">{paymentInfo.billing_info.tax_number}</p>
                    </div>
                  )}
                  {paymentInfo.billing_info.address && (
                    <div>
                      <p className="text-xs text-gray-500">Adres:</p>
                      <p className="text-sm text-gray-900">{paymentInfo.billing_info.address}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Katalog */}
            {Array.isArray(fields.catalog_links) && fields.catalog_links.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">📁 Katalog & Dokümanlar</h3>
                <div className="grid gap-2">
                  {fields.catalog_links.map((link, index) => {
                    const href = safeUrl(link.url)
                    if (!href) return null
                    return (
                      <a key={index} href={href} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                        <span style={{ color: themeColor }}>📄</span>
                        <span className="text-gray-700 font-medium">{link.title}</span>
                        <ExternalLink className="ml-auto text-gray-400" size={16} />
                      </a>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Hizmetler */}
            {Array.isArray(fields.services) && fields.services.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">🛍️ Hizmetlerim</h3>
                <div className="grid gap-3">
                  {fields.services.map((service, index) => (
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
            {safeUrl(fields.google_review_link) && (
              <div className="pt-4 border-t border-gray-200">
                <a href={safeUrl(fields.google_review_link)} target="_blank" rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-4 rounded-lg"
                  style={{ background: `linear-gradient(to right, ${themeColor}, ${adjustColor(themeColor, -30)})` }}>
                  <span className="text-white text-2xl">⭐</span>
                  <span className="text-white font-semibold">Google'da Yorum Yap</span>
                </a>
              </div>
            )}

            {/* vCard + Paylaşım Butonları */}
            <div className="space-y-2 mt-6">
              <button onClick={downloadVCard}
                className="w-full flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-semibold hover:shadow-xl transition-all"
                style={{ background: `linear-gradient(to right, ${themeColor}, ${adjustColor(themeColor, -30)})` }}>
                <Download size={20} />
                Kişilere Kaydet (vCard)
              </button>

              <div className="grid grid-cols-3 gap-2">
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(`${profile.name || 'Profil'} - ${window.location.href}`)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => trackCardEvent('share', { ...hedef, meta: { channel: 'whatsapp' } })}
                  className="flex items-center justify-center gap-2 py-2.5 bg-green-500 hover:bg-green-600 text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  💬 WhatsApp
                </a>
                <a
                  href={`sms:?body=${encodeURIComponent(`${profile.name || 'Profil'} - ${window.location.href}`)}`}
                  onClick={() => trackCardEvent('share', { ...hedef, meta: { channel: 'sms' } })}
                  className="flex items-center justify-center gap-2 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  📱 SMS
                </a>
                <a
                  href={`mailto:?subject=${encodeURIComponent(profile.name || 'Profil')}&body=${encodeURIComponent(`${profile.name || ''} dijital kartvizitini gör:\n${window.location.href}`)}`}
                  onClick={() => trackCardEvent('share', { ...hedef, meta: { channel: 'eposta' } })}
                  className="flex items-center justify-center gap-2 py-2.5 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-semibold text-sm transition-colors"
                >
                  ✉️ E-posta
                </a>
              </div>

              <button
                onClick={() => {
                  copyToClipboard(window.location.href, 'Bağlantı kopyalandı')
                  trackCardEvent('share', { ...hedef, meta: { channel: 'kopyala' } })
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-semibold text-sm transition-colors"
              >
                🔗 Linki Kopyala
              </button>

              {/* Karşılıklı kartvizit değişimi: kartı gören kişi de kendini
                  tanıtabilsin. Kağıt kartvizitte doğal olan şey dijitalde
                  tek yönlü kalıyordu. */}
              <ContactExchange
                hedef={hedef}
                kartSahibi={profile.name}
                temaRengi={themeColor}
              />
            </div>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm mb-2">Sen de dijital kartvizitini oluştur!</p>
          {/* Davet kodu yoksa ?ref boş bırakılır: eskiden profil kimliği
              yazılıyordu, sunucu onu tanımadığı için davet sessizce kayboluyordu. */}
          <button onClick={() => navigate(profile?.referral_code ? `/signup?ref=${profile.referral_code}` : '/signup')}
            className="text-blue-600 hover:text-blue-700 font-medium">Ücretsiz Kaydol →</button>
          <p className="text-xs text-gray-500 mt-2">{profile?.name} tarafından davet edildiniz! 🎁</p>
        </div>
      </div>
    </div>
  )
}