import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Lock } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import NFCCardDesigner from '../components/NFCCardDesigner'
import { useSubscription } from '../hooks/useSubscription'
import SiteKabugu from '../site/SiteKabugu'
import { SayfaUst } from '../site/sayfalar/ortak'
import { dugme, KAP } from '../site/sayfalar/siniflar'
import { birlestir } from '../panel/bicim'

export default function NFCCard() {
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const { subscription } = useSubscription(profile?.id)

  useEffect(() => {
    const loadProfile = async (userId) => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('user_id', userId)
          .single()

        if (error) throw error
        setProfile(data)
      } catch (error) {
        console.error('Profile load error:', error)
      } finally {
        setLoading(false)
      }
    }

    // Oturum yoksa giriş sayfasına; varsa profil yüklenir.
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        loadProfile(session.user.id)
      } else {
        navigate('/login')
      }
    })
  }, [navigate])

  if (loading) {
    return (
      <SiteKabugu className="flex items-center justify-center">
        <span className="w-8 h-8 rounded-full border-2 border-cizgi border-t-aksan animate-spin" role="status" aria-label="Yükleniyor" />
      </SiteKabugu>
    )
  }

  return (
    <SiteKabugu>
      <div className={birlestir(KAP, 'py-10 sm:py-14 flex flex-col gap-8')}>
        <div className="flex flex-col gap-5">
          <Link to="/dashboard" className="inline-flex items-center gap-2 self-start text-sm font-semibold text-metin-2 hover:text-aksan transition-colors">
            <ArrowLeft size={16} aria-hidden="true" />
            Panele dön
          </Link>
          <SayfaUst
            ust="NFC kart"
            ustTon="vurgu"
            baslik="NFC kart tasarla"
            alt="Kart türünü, yüzeyi ve yerleşimi seçin; önizleme anında güncellenir."
          />
        </div>

        {/* Ücretsiz plan uyarısı */}
        {subscription?.plan === 'free' && (
          <div className="rounded-2xl border border-vurgu/40 bg-vurgu-acik px-6 py-5 flex flex-col sm:flex-row sm:items-center gap-4">
            <span className="w-11 h-11 shrink-0 rounded-xl bg-vurgu text-white dark:text-zemin inline-flex items-center justify-center">
              <Lock size={20} aria-hidden="true" />
            </span>
            <div className="flex-1 min-w-0">
              <h2 className="font-baslik text-[17px] font-bold text-metin">Premium Özellik</h2>
              <p className="mt-0.5 text-[15px] text-metin-2">
                NFC kart siparişi vermek için Profesyonel veya Kurumsal plana yükseltmeniz gerekiyor.
              </p>
            </div>
            <button type="button" onClick={() => navigate('/dashboard')} className={dugme('vurgu', 'shrink-0')}>
              Planı yükselt
            </button>
          </div>
        )}

        <NFCCardDesigner profile={profile} subscription={subscription} />
      </div>
    </SiteKabugu>
  )
}
