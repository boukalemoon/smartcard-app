import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { bildir } from '../lib/bildirim'
import YoneticiPaneli from '../panel/yonetici/YoneticiPaneli'

// /admin — yalnızca admin/superadmin. Rol kontrolü burada (arayüz kapısı);
// asıl yetki veritabanında: her okuma kuralı ve RPC is_admin() ile denetler.
// Profil okunamazsa ya da rol uygun değilse eski davranış: oturum yoksa
// girişe, varsa kişisel panele yönlendir.
export default function AdminPage() {
  const [profile, setProfile] = useState(null)
  const [session, setSession] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    let iptal = false
    const denetle = async () => {
      try {
        const { data: { session: oturum } } = await supabase.auth.getSession()
        if (iptal) return
        if (!oturum) {
          navigate('/login')
          return
        }
        const { data: profil } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', oturum.user.id)
          .single()
        if (iptal) return
        if (!['admin', 'superadmin'].includes(profil?.role)) {
          bildir('Admin yetkisi gerekli!')
          navigate('/dashboard')
          return
        }
        setSession(oturum)
        setProfile(profil)
      } catch (error) {
        console.error('Error checking admin:', error)
        if (!iptal) navigate('/dashboard')
      }
    }
    denetle()
    return () => { iptal = true }
  }, [navigate])

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-zemin">
        <span className="w-12 h-12 border-4 border-aksan border-t-transparent rounded-full animate-spin" aria-label="Yetki denetleniyor" />
      </div>
    )
  }

  return <YoneticiPaneli profile={profile} session={session} />
}
