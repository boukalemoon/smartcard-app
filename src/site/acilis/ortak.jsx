import { birlestir } from '../../panel/bicim'
import { H2, UST } from './siniflar'

// QR "bulucu kare" motifi: iç içe yuvarlatılmış kareler. Tasarımdaki elmas
// desenin yerine geçer (kurucu kararı: elmas/baklava kullanılmaz). Rengi
// currentColor'dan alır; saydamlık çağıran tarafta verilir.
export function BulucuDesen({ className, cizgi = 1.2 }) {
  return (
    <svg viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth={cizgi} aria-hidden="true" className={className}>
      <rect x="2" y="2" width="96" height="96" rx="24" />
      <rect x="18" y="18" width="64" height="64" rx="16" />
      <rect x="34" y="34" width="32" height="32" rx="8" />
    </svg>
  )
}

// Küçük, dolu bulucu kare: kart görsellerinde logo yerine işaret.
export function BulucuIsaret({ className }) {
  return (
    <svg viewBox="0 0 28 28" fill="none" aria-hidden="true" className={className}>
      <rect x="2" y="2" width="24" height="24" rx="7" stroke="currentColor" strokeWidth="1.8" />
      <rect x="9" y="9" width="10" height="10" rx="3" fill="currentColor" />
    </svg>
  )
}

export function BolumBasligi({ ust, baslik, aciklama, ustRenk = 'text-aksan', baslikRenk, className, children }) {
  return (
    <div className={birlestir('flex flex-col gap-3 max-w-[640px]', className)}>
      <span className={birlestir(UST, ustRenk)}>{ust}</span>
      <h2 className={birlestir(H2, baslikRenk)}>{baslik}</h2>
      {aciklama && <p className="text-[17px] leading-relaxed text-metin-2">{aciklama}</p>}
      {children}
    </div>
  )
}
