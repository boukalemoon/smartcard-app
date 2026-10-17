// Kurumun herkese açık sayfalarının (üye başvurusu, üye dizini) ortak parçaları:
// kurum başlık kartı, yükleniyor ve "bulunamadı" durumları.
//
// Veri get_public_organization RPC'sinden gelir (id, name, type, description,
// logo_url, website, city, theme_color, allow_public_directory, auto_approve).
// RPC bir "doğrulandı" alanı döndürmediği için doğrulama rozeti gösterilmez.
import { Link } from 'react-router-dom'
import { ArrowLeft, Building2, Globe, MapPin } from 'lucide-react'
import SiteKabugu from '../SiteKabugu'
import { Avatar } from '../../panel/ui'
import { birlestir } from '../../panel/bicim'
import { DurumKarti } from './ortak'
import { dugme, UST_ETIKET } from './siniflar'

const TUR_ADI = {
  association: 'Dernek', dernek: 'Dernek',
  foundation: 'Vakıf', vakif: 'Vakıf', 'vakıf': 'Vakıf',
  community: 'Topluluk', topluluk: 'Topluluk',
  union: 'Sendika', sendika: 'Sendika',
  stk: 'STK',
}

// Kurumun girdiği web adresi yalnız http(s) bağlantısı olarak açılır
// (javascript: gibi şemalar bağlantıya dönüşmez).
function webAdresi(w) {
  if (!w || typeof w !== 'string') return null
  const t = w.trim()
  if (!/^(https?:\/\/)?[^\s<>"'/]+\.[^\s<>"']+$/i.test(t)) return null
  const href = /^https?:\/\//i.test(t) ? t : `https://${t}`
  try {
    const u = new URL(href)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    return { href: u.href, ad: u.host.replace(/^www\./, '') }
  } catch {
    return null
  }
}

export function KurumBasligi({ kurum, ust, children }) {
  const tur = TUR_ADI[String(kurum.type || '').toLocaleLowerCase('tr-TR')]
  const site = webAdresi(kurum.website)
  return (
    <header className="rounded-2xl border border-cizgi bg-yuzey p-6 sm:p-8 flex flex-col md:flex-row md:items-center gap-6">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-5 min-w-0 flex-1">
        {kurum.logo_url ? (
          <img src={kurum.logo_url} alt="" className="w-16 h-16 rounded-2xl border border-cizgi bg-white object-contain p-1.5 shrink-0" />
        ) : (
          <Avatar ad={kurum.name} kare boyut={64} />
        )}
        <div className="min-w-0 flex flex-col gap-2">
          {ust && <span className={birlestir(UST_ETIKET, 'text-aksan')}>{ust}</span>}
          <h1 className="font-baslik text-[26px] sm:text-[34px] leading-[1.1] font-extrabold tracking-[-0.02em] text-metin break-words">{kurum.name}</h1>
          {(tur || kurum.city || site) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-metin-2">
              {tur && (
                <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-semibold bg-aksan-acik text-aksan-koyu dark:text-aksan">
                  <Building2 size={12} aria-hidden="true" />
                  {tur}
                </span>
              )}
              {kurum.city && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin size={15} aria-hidden="true" />
                  {kurum.city}
                </span>
              )}
              {site && (
                <a href={site.href} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1.5 font-medium text-aksan hover:underline underline-offset-2">
                  <Globe size={15} aria-hidden="true" />
                  {site.ad}
                </a>
              )}
            </div>
          )}
          {kurum.description && <p className="mt-1 text-[15px] leading-relaxed text-metin-2 max-w-[680px]">{kurum.description}</p>}
        </div>
      </div>
      {children && <div className="flex flex-wrap gap-3 shrink-0">{children}</div>}
    </header>
  )
}

export function KurumYukleniyor() {
  return (
    <SiteKabugu className="flex items-center justify-center">
      <span className="w-8 h-8 rounded-full border-2 border-cizgi border-t-aksan animate-spin" role="status" aria-label="Yükleniyor" />
    </SiteKabugu>
  )
}

export function KurumBulunamadi({ mesaj }) {
  return (
    <SiteKabugu className="flex items-center">
      <div className="w-full px-4 py-16 sm:py-24">
        <DurumKarti
          ikon={Building2}
          ton="notr"
          ust="Kurum"
          baslik={mesaj || 'Organizasyon Bulunamadı'}
          eylemler={(
            <Link to="/" className={dugme('ana')}>
              <ArrowLeft size={18} aria-hidden="true" />
              Ana sayfaya dön
            </Link>
          )}
        >
          Lütfen doğru linki kullandığınızdan emin olun.
        </DurumKarti>
      </div>
    </SiteKabugu>
  )
}
