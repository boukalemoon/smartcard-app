import { useEffect, useState } from 'react'
import { Star, Pause } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { cardUrl, personaUrl, kartKoduUrl } from '../lib/siteUrl'
import QRCodeDisplay from './QRCodeDisplay'

// QR paylaşımı — ÖNCE profil seçilir, SONRA QR üretilir.
//
// Kullanıcının tarifi: "QR paylaşırken kendi profilinde önce seçim yapacak,
// sonra QR paylaşacak." Böylece iş toplantısında yanlışlıkla kişisel profil
// paylaşılmaz; paylaşılan QR yalnızca seçilen profilin açık bilgilerini açar.

export default function PersonaShare({ profile, fallbackName }) {
  const [personas, setPersonas] = useState([])
  const [seciliId, setSeciliId] = useState(null)

  useEffect(() => {
    let iptal = false
    supabase.rpc('persona_list').then(({ data }) => {
      if (iptal) return
      const liste = data || []
      setPersonas(liste)
      setSeciliId(liste.find(p => p.is_primary)?.id || liste[0]?.id || null)
    })
    return () => { iptal = true }
  }, [profile?.id])

  const secili = personas.find(p => p.id === seciliId)
  // Ana profilin QR'ı KALICI kart koduna bakar: kullanıcı adı değişse de
  // basılmış kartlar çalışmaya devam eder. Kod yoksa (çok eski kayıt)
  // kullanıcı adına düşülür.
  const url = !secili || secili.is_primary
    ? (profile.card_code ? kartKoduUrl(profile.card_code) : cardUrl(profile.username))
    : personaUrl(secili.share_code)

  return (
    <div className="space-y-3">
      {personas.length > 1 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Hangi profilinizi paylaşacaksınız?</p>
          <div className="flex flex-wrap gap-2">
            {personas.map(p => (
              <button key={p.id} onClick={() => setSeciliId(p.id)}
                disabled={p.status === 'paused'}
                title={p.status === 'paused' ? 'Duraklatılmış profil paylaşılamaz' : ''}
                className={`px-3 py-1.5 rounded-full text-sm flex items-center gap-1.5 border transition-colors disabled:opacity-40 ${
                  p.id === seciliId
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:border-indigo-400'
                }`}>
                {p.is_primary && <Star size={12} className={p.id === seciliId ? 'fill-white' : 'fill-amber-400 text-amber-400'} />}
                {p.name}
                {p.status === 'paused' && <Pause size={12} />}
              </button>
            ))}
          </div>
          {secili && !secili.is_primary && (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Bu QR yalnızca "{secili.name}" profilinde görünür işaretlediğiniz bilgileri açar.
            </p>
          )}
        </div>
      )}

      <QRCodeDisplay
        key={url}
        url={url}
        username={profile.username}
        fileLabel={secili && !secili.is_primary ? `${profile.username}-${secili.name}` : profile.username}
        fullName={profile.name || fallbackName}
        qrForegroundColor={profile.qr_foreground_color}
        qrBackgroundColor={profile.qr_background_color}
        qrLogoEnabled={profile.qr_logo_enabled}
        profileImage={profile.avatar_url}
      />
    </div>
  )
}
