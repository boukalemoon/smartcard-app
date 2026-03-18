import AvatarFlipCard from './AvatarFlipCard'

export default function PublicCardPreview({ profile, themeColor }) {
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
          {/* Arka plan resmi */}
          {hasBackground && (
            <div
              className="absolute inset-0 bg-cover bg-center"
              style={{ backgroundImage: `url(${profile.background_image_url})` }}
            />
          )}

          {/* Resim varsa karartma katmanı — yazılar okunsun */}
          {hasBackground && (
            <div className="absolute inset-0 bg-black/40" />
          )}

          {/* İçerik */}
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

        {/* Contact Info */}
        <div className="p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span>📧</span>
            <span>{profile?.email || 'email@example.com'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
            <span>📱</span>
            <span>{profile?.phone || '+90 5XX XXX XX XX'}</span>
          </div>
        </div>

      </div>
    </div>
  )
}