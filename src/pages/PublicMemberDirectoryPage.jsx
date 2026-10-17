import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { EyeOff, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import PublicMemberDirectory from '../components/PublicMemberDirectory'
import SiteKabugu from '../site/SiteKabugu'
import { KurumBasligi, KurumBulunamadi, KurumYukleniyor } from '../site/sayfalar/KurumBasligi'
import { dugme, KAP } from '../site/sayfalar/siniflar'
import { birlestir } from '../panel/bicim'
import { BosDurum } from '../panel/ui'

export default function PublicMemberDirectoryPage() {
  const { orgSlug } = useParams()
  // Sonuç hangi adres için alındıysa onunla saklanır; adres değişince
  // "yükleniyor" kendiliğinden döner (effect içinde senkron set yok).
  const [sonuc, setSonuc] = useState({ slug: null, organization: null, error: null })
  const loading = sonuc.slug !== orgSlug
  const { organization, error } = sonuc

  useEffect(() => {
    let iptal = false
    const loadOrganization = async () => {
      try {
        // Kurum tipi ve herkese açıklık kararı artık SUNUCUDA veriliyor.
        // Eskiden tablo doğrudan okunuyor, 'sadece STK' kısıtı istemcide
        // uygulanıyordu — saldırgan tabloyu sorgulayıp 33 kurumun tamamını
        // (telefon/e-posta/adres) alabiliyordu (bulgu Y-2).
        const { data, error } = await supabase
          .rpc('get_public_organization', { p_org_id: orgSlug })

        if (error) throw error
        if (iptal) return

        if (!data) {
          setSonuc({ slug: orgSlug, organization: null, error: 'Bu organizasyonun üye listesi herkese açık değil.' })
          return
        }

        setSonuc({ slug: orgSlug, organization: data, error: null })
      } catch (err) {
        console.error('Error loading organization:', err)
        if (!iptal) setSonuc({ slug: orgSlug, organization: null, error: 'Organizasyon bulunamadı.' })
      }
    }
    loadOrganization()
    return () => { iptal = true }
  }, [orgSlug])

  if (loading) return <KurumYukleniyor />
  if (error || !organization) return <KurumBulunamadi mesaj={error} />

  return (
    <SiteKabugu>
      <div className={birlestir(KAP, 'py-12 sm:py-16 flex flex-col gap-8')}>
        <KurumBasligi kurum={organization} ust="Üye dizini">
          <Link to={`/org/${orgSlug}/apply`} className={dugme('ana')}>
            <UserPlus size={18} aria-hidden="true" />
            Üye olmak için başvur
          </Link>
        </KurumBasligi>

        {/* Kurum dizini kapalıysa sunucu zaten boş liste döner; "henüz üye
            yok" demek yanıltıcı olacağından durum açıkça yazılır. */}
        {organization.allow_public_directory === false ? (
          <div className="rounded-2xl border border-dashed border-cizgi bg-yuzey">
            <BosDurum
              ikon={EyeOff}
              baslik="Üye dizini herkese açık değil"
              aciklama="Bu kurum üye listesini yalnızca üyeleriyle paylaşıyor."
              className="py-14"
            />
          </div>
        ) : (
          <PublicMemberDirectory
            organizationId={organization.id}
            organizationName={organization.name}
          />
        )}
      </div>
    </SiteKabugu>
  )
}
