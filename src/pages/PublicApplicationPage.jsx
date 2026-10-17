import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Users } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import PublicApplicationForm from '../components/PublicApplicationForm'
import SiteKabugu from '../site/SiteKabugu'
import { KurumBasligi, KurumBulunamadi, KurumYukleniyor } from '../site/sayfalar/KurumBasligi'
import { dugme, KAP, UST_ETIKET } from '../site/sayfalar/siniflar'
import { birlestir } from '../panel/bicim'

const ADIMLAR = [
  ['Formu doldurun', 'Ad, e-posta ve isterseniz kısa bir not yeterli.'],
  ['Yönetici inceler', 'Başvurunuz organizasyon yöneticisine iletilir.'],
  ['Üyeliğiniz tanımlanır', 'Onaylandığında üyeliğiniz QRtım hesabınıza tanımlanır.'],
]

export default function PublicApplicationPage() {
  const { orgSlug } = useParams() // URL'den organizasyon slug'ı
  // Sonuç hangi adres için alındıysa onunla saklanır; adres değişince
  // "yükleniyor" kendiliğinden döner (effect içinde senkron set yok).
  const [sonuc, setSonuc] = useState({ slug: null, organization: null, error: null })
  const loading = sonuc.slug !== orgSlug
  const { organization, error } = sonuc

  useEffect(() => {
    let iptal = false
    const loadOrganization = async () => {
      try {
        // Kurum künyesi ve başvuruya açıklık kararı SUNUCUDA veriliyor (bulgu Y-2).
        const { data, error } = await supabase
          .rpc('get_public_organization', { p_org_id: orgSlug })

        if (error) throw error
        if (iptal) return

        if (!data) {
          setSonuc({ slug: orgSlug, organization: null, error: 'Bu organizasyon başvuru kabul etmiyor.' })
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
        <KurumBasligi kurum={organization} ust="Üye başvurusu">
          {organization.allow_public_directory && (
            <Link to={`/org/${orgSlug}/members`} className={dugme('ikincil')}>
              <Users size={18} aria-hidden="true" />
              Üye dizini
            </Link>
          )}
        </KurumBasligi>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <PublicApplicationForm
            organizationId={organization.id}
            organizationName={organization.name}
          />

          <aside aria-labelledby="surec-baslik" className="rounded-2xl border border-cizgi bg-yuzey p-6">
            <span className={birlestir(UST_ETIKET, 'text-metin-2')}>Süreç</span>
            <h2 id="surec-baslik" className="mt-2 font-baslik text-[19px] font-bold text-metin">Başvuru nasıl işler?</h2>
            <ol className="mt-5 flex flex-col gap-5">
              {ADIMLAR.map(([baslik, metin], i) => (
                <li key={baslik} className="flex items-start gap-3.5">
                  <span className="w-8 h-8 shrink-0 rounded-lg bg-aksan-acik text-aksan font-baslik text-sm font-extrabold inline-flex items-center justify-center">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold text-metin">{baslik}</p>
                    <p className="mt-0.5 text-sm leading-relaxed text-metin-2">{metin}</p>
                  </div>
                </li>
              ))}
            </ol>
          </aside>
        </div>
      </div>
    </SiteKabugu>
  )
}
