// Herkese açık kartın ortak yapı taşları (tasarım panosu: KartBireysel /
// KartKurumsal — .blok, .satir, .kop, .btn sınıflarının karşılığı).
import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { birlestir } from '../../panel/bicim'
import { ODAK, panoyaKopyala } from './yardim'


// Bölüm kutusu: yüzey, ince çizgi, 16px köşe.
export function Blok({ baslik, baslikId, sag, className, children, ...p }) {
  return (
    <section
      aria-labelledby={baslik ? baslikId : undefined}
      className={birlestir('bg-yuzey border border-cizgi rounded-2xl p-4 flex flex-col gap-2.5', className)}
      {...p}
    >
      {baslik && (
        <div className="flex items-baseline justify-between gap-3">
          <h2 id={baslikId} className="font-baslik text-[13px] font-bold tracking-[0.06em] uppercase text-metin-2">{baslik}</h2>
          {sag}
        </div>
      )}
      {children}
    </section>
  )
}

// Simge kutusu (36px, ikinci yüzey).
export function SimgeKutu({ ikon: Ikon, className, children }) {
  return (
    <span className={birlestir('w-9 h-9 rounded-[10px] bg-yuzey-2 text-aksan inline-flex items-center justify-center shrink-0', className)} aria-hidden="true">
      {Ikon ? <Ikon size={18} /> : children}
    </span>
  )
}

export function KopyalaDugmesi({ metin, etiket, basari }) {
  const [oldu, setOldu] = useState(false)
  return (
    <button
      type="button"
      aria-label={etiket}
      title={etiket}
      onClick={async () => {
        if (await panoyaKopyala(metin, basari)) {
          setOldu(true)
          setTimeout(() => setOldu(false), 1600)
        }
      }}
      className={birlestir('ml-auto w-10 h-10 rounded-[10px] border border-cizgi bg-yuzey text-metin-2 hover:text-metin hover:bg-yuzey-2 inline-flex items-center justify-center shrink-0 transition-colors', ODAK)}
    >
      {oldu ? <Check size={16} aria-hidden="true" className="text-aksan" /> : <Copy size={16} aria-hidden="true" />}
    </button>
  )
}

// Satır: simge + (etiket / değer) + sağda eylem.
export function Satir({ ikon, simge, etiket, deger, href, dis, mono, sag, onClick, className }) {
  const degerSinif = birlestir('font-semibold text-[14px] text-metin break-words [overflow-wrap:anywhere]', mono && 'font-mono text-[13px]')
  return (
    <div className={birlestir('flex items-center gap-3 min-h-[44px]', className)}>
      {simge || <SimgeKutu ikon={ikon} />}
      <div className="min-w-0 flex-1">
        {etiket && <div className="text-xs text-metin-2">{etiket}</div>}
        {href ? (
          <a
            href={href}
            onClick={onClick}
            {...(dis ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            className={birlestir(degerSinif, 'hover:text-aksan rounded', ODAK)}
          >
            {deger}
          </a>
        ) : (
          <div className={degerSinif}>{deger}</div>
        )}
      </div>
      {sag}
    </div>
  )
}

// QR "bulucu kare" motifi: iç içe yuvarlatılmış kareler, ince beyaz çizgi.
// Elmas desenin yerini alır (kurucu kararı).
export function QrMotif({ className, renk = 'currentColor' }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 28 28" className={className} fill="none" stroke={renk} strokeWidth=".55">
      <rect x="1.5" y="1.5" width="25" height="25" rx="6" />
      <rect x="6" y="6" width="16" height="16" rx="3.5" />
      <rect x="10.5" y="10.5" width="7" height="7" rx="1.6" />
    </svg>
  )
}

// Ad alanı: girdi + görünür etiket.
export function Girdi({ id, etiket, className, ...p }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-metin-2">{etiket}</label>
      <input
        id={id}
        className={birlestir('h-11 w-full rounded-[10px] border border-cizgi bg-zemin px-3 text-[14px] text-metin placeholder:text-metin-2/70 focus:outline-none focus:border-aksan focus:ring-2 focus:ring-aksan/25', className)}
        {...p}
      />
    </div>
  )
}

export function MetinAlani({ id, etiket, ...p }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-xs font-semibold text-metin-2">{etiket}</label>
      <textarea
        id={id}
        rows={2}
        className="w-full rounded-[10px] border border-cizgi bg-zemin px-3 py-2.5 text-[14px] text-metin placeholder:text-metin-2/70 focus:outline-none focus:border-aksan focus:ring-2 focus:ring-aksan/25"
        {...p}
      />
    </div>
  )
}
