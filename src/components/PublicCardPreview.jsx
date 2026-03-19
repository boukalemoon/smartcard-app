import AvatarFlipCard from './AvatarFlipCard'
import { Linkedin, Facebook, Twitter, Instagram, Youtube, Github, Globe, Twitch, Music, Camera, Send } from 'lucide-react'

const PLATFORM_CONFIG = {
  linkedin:  { icon: Linkedin,  color: '#0A66C2', label: 'LinkedIn' },
  facebook:  { icon: Facebook,  color: '#1877F2', label: 'Facebook' },
  twitter:   { icon: Twitter,   color: '#000000', label: 'Twitter/X' },
  instagram: { icon: Instagram, color: '#E4405F', label: 'Instagram' },
  youtube:   { icon: Youtube,   color: '#FF0000', label: 'YouTube' },
  tiktok:    { icon: Music,     color: '#000000', label: 'TikTok' },
  pinterest: { icon: Camera,    color: '#E60023', label: 'Pinterest' },
  twitch:    { icon: Twitch,    color: '#9146FF', label: 'Twitch' },
  kick:      { icon: Send,      color: '#53FC18', label: 'Kick' },
  snapchat:  { icon: Camera,    color: '#FFFC00', label: 'Snapchat' },
  github:    { icon: Github,    color: '#333333', label: 'GitHub' },
  website:   { icon: Globe,     color: '#6B7280', label: 'Website' },
}

export default function PublicCardPreview({ profile, themeColor, socialLinks = [] }) {
  const adjustColor = (color, percent) => {
    const num = parseInt(color.replace("#",""), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) + amt
    const G = (num >> 8 & 0x00FF) + amt
    const B = (num & 0x0000FF) + amt
    return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 
      + (G<255?G<1?0:G:255)*0x100 
      + (B<255?B<1?0:B:255))
      .toString(16).slice(1)
  }

  const hasBackground = !!profile?.background_image_url

  return (
    <div className="bg-gray-100 dark:bg-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 text-center font-semibold">
        📱 Kartınızın Önizlemesi
      </p>
      
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl overflow-hidden max-w-sm mx-auto">
        
        {/* Hero Section */}
        <div
          className="p-6 text-white text-center relative overflow-hidden"
          style={{
            background: hasBackground
              ? 'transparent'
              : `linear-gradient(135deg, ${themeColor}, ${adjustColor(themeColor, -40)})`
          }}
        >
          {hasBackground && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${profile.background_image_url})` }}
            />
          )}
          {hasBackground && (
            <div className="absolute inset-0 bg-black/40" />
          )}
          <div className="relative z-10">
            <AvatarFlipCard
              profileImage={profile?.avatar_url}
              avatar3dUrl={profile?.avatar_3d_url}
              name={profile?.name}
            />
            <h1 className="text-xl font-bold mt-2">{profile?.name || 'İsminiz'}</h1>
            <p className="text-sm opacity-90">{profile?.title || 'Ünvanınız'}</p>
            <p className="text-xs opacity-75 mt-1">{profile?.company || 'Şirketiniz'}</p>
          </div>
        </div>

        {/* İletişim */}
        <div className="px-4 pt-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span>📧</span>
            <span className="truncate">{profile?.email || 'email@example.com'}</span>
          </div>
          {profile?.phone && (
            <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
              <span>📱</span>
              <span>{profile.phone}</span>
            </div>
          )}
        </div>

        {/* Sosyal Medya */}
        <div className="px-4 pt-3 pb-4">
          {socialLinks.length > 0 ? (
            <>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2 font-medium">
                Sosyal Medya
              </p>
              <div className="flex flex-wrap gap-2">
                {socialLinks.map((link) => {
                  const config = PLATFORM_CONFIG[link.platform] || {
                    icon: Globe,
                    color: '#6B7280',
                    label: link.platform
                  }
                  const Icon = config.icon
                  return (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={config.label}
                      className="w-8 h-8 rounded-lg flex items-center justify-center text-white hover:opacity-80 transition-opacity"
                      style={{ backgroundColor: config.color }}
                    >
                      <Icon size={14} />
                    </a>
                  )
                })}
              </div>
            </>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500 italic text-center pt-1">
              Sosyal medya hesabı eklenmedi
            </p>
          )}
        </div>

      </div>
    </div>
  )
}