import { sanitizeHtml } from '../utils/inputValidation'
import AvatarFlipCard from '../components/AvatarFlipCard'
import { trackEvent } from '../utils/analyticsHelpers'
import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { Linkedin, Facebook, Twitter, Instagram, Play, Github, Globe, Music, ExternalLink, ArrowLeft, Download, Mail, Phone } from 'lucide-react'

const PLATFORM_CONFIG = {
  linkedin:  { icon: Linkedin, color: '#0A66C2', label: 'LinkedIn' },
  facebook:  { icon: Facebook, color: '#1877F2', label: 'Facebook' },
  twitter:   { icon: Twitter,  color: '#000000', label: 'Twitter/X' },
  instagram: { icon: Instagram,color: '#E4405F', label: 'Instagram' },
  youtube:   { icon: Play,     color: '#FF0000', label: 'YouTube' },
  tiktok:    { icon: Music,    color: '#000000', label: 'TikTok' },
  github:    { icon: Github,   color: '#333333', label: 'GitHub' },
  website:   { icon: Globe,    color: '#6B7280', label: 'Website' },
}

export default function PublicCard() {
  const { username } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [socialLinks, setSocialLinks] = useState([])
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

  useEffect(() => {
    document.documentElement.classList.remove('dark')
  }, [])

  useEffect(() => {
    if (username) loadProfile()
  }, [username])

  const loadProfile = async () => {
    try {
      setLoading(true)

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .maybeSingle()

      if (profileError) throw profileError
      if (!profileData) { setError('Profil bulunamadı'); return }

      setProfile(profileData)

      if (profileData?.id) {
        trackEvent(profileData.id, 'profile_view')
        await supabase
          .from('profiles')
          .update({ card_views: (profileData.card_views || 0) + 1, last_viewed_at: new Date().toISOString() })
          .eq('id', profileData.id)
      }

      const { data: linksData } = await supabase
        .from('social_links')
        .select('*')
        .eq('profile_id', profileData.id)
        .order('display_order')
      setSocialLinks(linksData || [])

    } catch (error) {
      console.error('Profil yükleme hatası:', error)
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
    const vCard = `BEGIN:VCARD\nVERSION:3.0\nFN:${profile.name || 'Unknown'}\nN:${lastName};${firstName};;;\nTEL:${profile.phone || ''}\nEMAIL:${profile.email || ''}\nTITLE:${profile.title || ''}\nORG:${profile.company || ''}\nNOTE:${profile.bio || ''}\nURL:${window.location.origin}/card/${profile.username}\nEND:VCARD`
    const blob = new Blob([vCard], { type: 'text/vcard;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${profile.username || 'contact'}.vcf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    if (profile?.id) trackEvent(profile.id, 'vcard_download')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    )
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Profil Bulunamadı</h1>
          <p className="text-gray-600 mb-6">Bu kullanıcı adı mevcut değil.</p>
          <button onClick={() => navigate('/')} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Ana Sayfaya Dön</button>
        </div>
      </div>
    )
  }

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
          <div
            className="p-8 text-white text-center relative overflow-hidden"
            style={{ background: profile?.background_image_url ? 'transparent' : `linear-gradient(to right, ${profile?.theme_color || '#3B82F6'}, ${adjustColor(profile?.theme_color || '#3B82F6', -40)})` }}
          >
            {profile?.background_image_url && <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${profile.background_image_url})` }} />}
            {profile?.background_image_url && <div className="absolute inset-0 bg-black/40" />}
            <div className="relative z-10">
              <AvatarFlipCard profileImage={profile.avatar_url} avatar3dUrl={profile.avatar_3d_url} name={profile.name || ''} />
              <h1 className="text-3xl font-bold mb-2">{profile.name || ''}</h1>
              {profile.title && <p className="text-blue-100 text-lg mb-1">{profile.title}</p>}
              {profile.company && <p className="text-blue-200">{profile.company}</p>}
            </div>
          </div>

          {/* İçerik */}
          <div className="p-6 space-y-4">

            {profile.bio && (
              <div className="pb-4 border-b border-gray-200">
                <p className="text-gray-700 text-center">{profile.bio}</p>
              </div>
            )}

            <div className="grid gap-3">
              {profile.email && (
                <a href={`mailto:${profile.email}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <Mail size={20} style={{ color: profile?.theme_color || '#3B82F6' }} />
                  <span className="text-gray-700">{profile.email}</span>
                </a>
              )}
              {profile.phone && (
                <a href={`tel:${profile.phone}`} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                  <Phone size={20} style={{ color: profile?.theme_color || '#10B981' }} />
                  <span className="text-gray-700">{profile.phone}</span>
                </a>
              )}
            </div>

            {/* Sosyal Medya */}
            {socialLinks.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">🔗 Sosyal Medya</h3>
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

            {/* Katalog */}
            {profile.catalog_links && profile.catalog_links.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">📁 Katalog & Dökümanlar</h3>
                <div className="grid gap-2">
                  {profile.catalog_links.map((link, index) => (
                    <a key={index} href={link.url} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                      <span style={{ color: profile?.theme_color || '#6B7280' }}>📄</span>
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
                    <div key={index} className="p-4 rounded-lg" style={{ backgroundColor: `${profile?.theme_color || '#3B82F6'}10` }}>
                      <h4 className="font-semibold text-gray-900 mb-1">{service.title}</h4>
                      <p className="text-sm text-gray-600 mb-2">{service.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="font-bold" style={{ color: profile?.theme_color || '#10B981' }}>₺{service.price}</span>
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
                  className="flex items-center justify-center gap-2 p-4 rounded-lg transition-all"
                  style={{ background: `linear-gradient(to right, ${profile?.theme_color || '#10B981'}, ${adjustColor(profile?.theme_color || '#10B981', -30)})` }}>
                  <span className="text-white text-2xl">⭐</span>
                  <span className="text-white font-semibold">Google'da Yorum Yap</span>
                </a>
              </div>
            )}

            {/* vCard */}
            <button onClick={downloadVCard}
              className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-semibold hover:shadow-xl transition-all"
              style={{ background: `linear-gradient(to right, ${profile?.theme_color || '#10B981'}, ${adjustColor(profile?.theme_color || '#10B981', -30)})` }}>
              <Download size={20} />
              Kişilere Kaydet (vCard)
            </button>
          </div>
        </div>

        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm mb-2">Sen de dijital kartvizitini oluştur!</p>
          <button onClick={() => navigate(`/signup?ref=${profile?.referral_code || profile?.id}`)}
            className="text-blue-600 hover:text-blue-700 font-medium">
            Ücretsiz Kaydol →
          </button>
          <p className="text-xs text-gray-500 mt-2">{profile?.name} tarafından davet edildiniz! 🎁</p>
        </div>
      </div>
    </div>
  )
}