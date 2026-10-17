// Yasal metinlerin ortak okuma düzeni (gizlilik, KVKK, kullanım şartları, çerez).
//
// Metinler sayfa dosyalarında olduğu gibi durur; bu bileşen yalnız görünümü
// verir: başlık bloğu, son güncelleme, masaüstünde solda yapışkan içindekiler,
// ~720px okuma sütunu. Tipografi, gövdedeki düz etiketlere (section, h2, p, ul,
// table, a) buradan uygulanır; böylece metin dosyalarında sınıf kalmaz.
import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { CalendarDays, ChevronDown } from 'lucide-react'
import SiteKabugu from '../SiteKabugu'
import { birlestir } from '../../panel/bicim'
import { KAP, UST_ETIKET } from './siniflar'

const YASAL_SAYFALAR = [
  { ad: 'Gizlilik politikası', to: '/gizlilik' },
  { ad: 'KVKK aydınlatma metni', to: '/kvkk' },
  { ad: 'Kullanım şartları', to: '/kullanim-sartlari' },
  { ad: 'Çerez politikası', to: '/cerez-politikasi' },
]

// "1. Veri Sorumlusu" → "veri-sorumlusu": paylaşılabilir, okunur bölüm adresi.
function kisaAd(metin) {
  const tr = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' }
  return metin
    .toLocaleLowerCase('tr-TR')
    .replace(/^\d+\.\s*/, '')
    .replace(/[çğıöşüâîû]/g, (h) => tr[h])
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

// Gövde tipografisi: yazı boyu/rengi sarmalayıcıdan miras alınır ki bilgi
// kutuları (Kutu) kendi küçük boyutunu koruyabilsin.
const GOVDE = birlestir(
  'text-[16px] leading-[1.75] text-metin/85',
  '[&_section]:scroll-mt-28 [&_section]:border-t [&_section]:border-cizgi [&_section]:pt-8 [&_section]:mt-8',
  '[&_section:first-child]:border-t-0 [&_section:first-child]:pt-0 [&_section:first-child]:mt-0',
  '[&_section>*+*]:mt-3',
  '[&_h2]:font-baslik [&_h2]:text-[21px] [&_h2]:leading-snug [&_h2]:font-bold [&_h2]:tracking-[-0.01em] [&_h2]:text-metin',
  '[&_strong]:font-semibold [&_strong]:text-metin',
  '[&_ul]:list-disc [&_ul]:pl-5 [&_ul>li+li]:mt-2 [&_li]:pl-1 [&_li::marker]:text-aksan',
  '[&_a]:font-medium [&_a]:text-aksan [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-aksan-koyu',
  '[&_table]:w-full [&_table]:border-collapse [&_table]:text-sm [&_table]:bg-yuzey',
  '[&_th]:bg-yuzey-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-metin [&_th]:px-3.5 [&_th]:py-2.5 [&_th]:border [&_th]:border-cizgi',
  '[&_td]:px-3.5 [&_td]:py-2.5 [&_td]:border [&_td]:border-cizgi [&_td]:align-top',
)

// Metindeki künye / başvuru / uyarı kutuları.
const KUTU_TON = {
  notr: 'bg-yuzey border-cizgi',
  bilgi: 'bg-aksan-acik border-aksan/25',
  uyari: 'bg-amber-50 border-amber-200 dark:bg-amber-400/10 dark:border-amber-400/30',
}
export function Kutu({ ton = 'notr', ikon, children }) {
  const Ikon = ikon
  return (
    <div className={birlestir('rounded-xl border px-5 py-4 text-[14.5px] leading-relaxed [&>p+p]:mt-1', KUTU_TON[ton], Ikon && 'flex items-start gap-3')}>
      {Ikon && <Ikon size={18} aria-hidden="true" className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-300" />}
      {Ikon ? <div className="min-w-0">{children}</div> : children}
    </div>
  )
}

function DigerMetinler({ className }) {
  const { pathname } = useLocation()
  return (
    <div className={className}>
      <p className={birlestir(UST_ETIKET, 'text-metin-2')}>Diğer metinler</p>
      <ul className="mt-3 flex flex-col gap-1">
        {YASAL_SAYFALAR.filter((s) => s.to !== pathname).map((s) => (
          <li key={s.to}>
            <Link to={s.to} className="text-sm text-metin-2 hover:text-aksan transition-colors">{s.ad}</Link>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default function YasalSayfa({ ust = 'Hukuki', baslik, alt, guncelleme, children }) {
  const [basliklar, setBasliklar] = useState([])
  const [etkin, setEtkin] = useState(null)

  // İçindekiler, gövdedeki bölüm başlıklarından otomatik çıkarılır; metin
  // dosyasında başlık değişirse liste de kendiliğinden güncellenir.
  const govdeRef = useCallback((el) => {
    if (!el) return
    const liste = [...el.querySelectorAll(':scope > section > h2')].map((h) => {
      const bolum = h.parentElement
      if (!bolum.id) bolum.id = kisaAd(h.textContent || '') || `bolum-${Math.random().toString(36).slice(2, 7)}`
      return { id: bolum.id, ad: (h.textContent || '').trim() }
    })
    setBasliklar(liste)
  }, [])

  // Okunan bölümü içindekilerde işaretle.
  useEffect(() => {
    if (!basliklar.length || typeof IntersectionObserver === 'undefined') return
    const gozlemci = new IntersectionObserver(
      (girdiler) => {
        const gorunen = girdiler.filter((g) => g.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (gorunen) setEtkin(gorunen.target.id)
      },
      { rootMargin: '-96px 0px -65% 0px' },
    )
    basliklar.forEach((b) => {
      const el = document.getElementById(b.id)
      if (el) gozlemci.observe(el)
    })
    return () => gozlemci.disconnect()
  }, [basliklar])

  const icindekiler = (mobil) => (
    <ol className={birlestir('flex flex-col', mobil ? 'gap-0.5 mt-2' : 'gap-0.5 border-l border-cizgi')}>
      {basliklar.map((b) => {
        // Sayfa başındayken hiçbir bölüm gözlem alanında değil: ilkini işaretle.
        const secili = !mobil && (etkin ?? basliklar[0]?.id) === b.id
        return (
          <li key={b.id}>
            <a
              href={`#${b.id}`}
              aria-current={secili ? 'location' : undefined}
              className={birlestir(
                'block text-sm leading-snug py-1.5 transition-colors',
                mobil ? 'text-metin-2 hover:text-aksan' : '-ml-px pl-4 border-l-2',
                !mobil && (secili ? 'border-aksan text-aksan font-semibold' : 'border-transparent text-metin-2 hover:text-metin'),
              )}
            >
              {b.ad}
            </a>
          </li>
        )
      })}
    </ol>
  )

  return (
    <SiteKabugu>
      <div className={birlestir(KAP, 'py-12 sm:py-20')}>
        <div className="lg:grid lg:grid-cols-[232px_minmax(0,720px)] lg:gap-x-20 lg:justify-center">
          <aside className="hidden lg:block" aria-label="İçindekiler">
            <div className="sticky top-[104px] flex flex-col gap-8">
              {basliklar.length > 0 && (
                <div>
                  <p className={birlestir(UST_ETIKET, 'text-metin-2 mb-3')}>İçindekiler</p>
                  {icindekiler(false)}
                </div>
              )}
              <DigerMetinler />
            </div>
          </aside>

          <article className="min-w-0">
            <header className="flex flex-col gap-3 pb-8 border-b border-cizgi">
              <span className={birlestir(UST_ETIKET, 'text-aksan')}>{ust}</span>
              <h1 className="font-baslik text-[32px] sm:text-[42px] leading-[1.1] font-extrabold tracking-[-0.02em] text-metin text-balance">{baslik}</h1>
              {alt && <p className="text-[17px] leading-relaxed text-metin-2">{alt}</p>}
              {guncelleme && (
                <p className="inline-flex items-center gap-2 text-sm text-metin-2">
                  <CalendarDays size={16} aria-hidden="true" />
                  Son güncelleme: {guncelleme}
                </p>
              )}
            </header>

            {basliklar.length > 0 && (
              <details className="lg:hidden group mt-6 rounded-xl border border-cizgi bg-yuzey px-4 py-3">
                <summary className="flex items-center justify-between gap-3 cursor-pointer list-none text-[15px] font-semibold text-metin [&::-webkit-details-marker]:hidden">
                  İçindekiler
                  <ChevronDown size={18} aria-hidden="true" className="text-metin-2 transition-transform group-open:rotate-180" />
                </summary>
                {icindekiler(true)}
              </details>
            )}

            <div ref={govdeRef} className={birlestir(GOVDE, 'mt-10')}>
              {children}
            </div>

            <DigerMetinler className="lg:hidden mt-12 pt-8 border-t border-cizgi" />
          </article>
        </div>
      </div>
    </SiteKabugu>
  )
}
