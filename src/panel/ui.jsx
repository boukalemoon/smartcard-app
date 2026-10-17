// QRtım PANEL TASARIM DİLİ — temel bileşenler
//
// Tasarım panosundaki (Claude Design · "QRtım — Yeni Tasarım") bileşenlerin kod
// karşılığı. Renkler yalnızca anlamlı adlarla verilir (bg-yuzey, text-metin-2,
// bg-aksan…); değerler src/index.css'teki --renk-* değişkenlerinden gelir, bu
// yüzden açık ve koyu tema aynı sınıflarla çalışır.
import { forwardRef } from 'react'
import { Lock } from 'lucide-react'
import { basHarf, birlestir } from './bicim'

// ---------------------------------------------------------------- yüzeyler
export function Kart({ as, className, vurgu, koyu, kesik, children, ...p }) {
  const Etiket = as || 'section'
  return (
    <Etiket
      className={birlestir(
        'rounded-2xl border min-w-0',
        koyu
          ? 'bg-lacivert-900 dark:bg-lacivert-950 border-lacivert-900 dark:border-cizgi text-white'
          : 'bg-yuzey text-metin',
        !koyu && (vurgu === 'aksan' ? 'border-aksan' : vurgu === 'vurgu' ? 'border-vurgu' : vurgu === 'tehlike' ? 'border-red-300 dark:border-red-500/40' : kesik ? 'border-dashed border-cizgi' : 'border-cizgi'),
        className,
      )}
      {...p}
    >
      {children}
    </Etiket>
  )
}

export function KartBaslik({ baslik, alt, sag, id, className, ikon }) {
  return (
    <div className={birlestir('flex items-start justify-between gap-3 flex-wrap', className)}>
      <div className="flex items-start gap-3 min-w-0">
        {ikon}
        <div className="min-w-0">
          <h2 id={id} className="font-baslik text-[17px] font-bold leading-tight">{baslik}</h2>
          {alt && <p className="mt-1 text-[13px] text-metin-2">{alt}</p>}
        </div>
      </div>
      {sag && <div className="flex items-center gap-2 shrink-0">{sag}</div>}
    </div>
  )
}

export function SayfaBaslik({ ust, baslik, alt, sag, solEk }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        {ust && <span className="text-xs font-semibold tracking-[.08em] uppercase text-metin-2">{ust}</span>}
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="font-baslik text-[28px] font-extrabold leading-tight text-metin">{baslik}</h1>
          {solEk}
        </div>
        {alt && <p className="mt-1 text-[13.5px] text-metin-2">{alt}</p>}
      </div>
      {sag && <div className="flex items-center gap-2 flex-wrap">{sag}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- düğmeler
const DUGME_TUR = {
  ana: 'bg-aksan text-white dark:text-zemin hover:bg-aksan-koyu border-transparent',
  ikincil: 'bg-yuzey text-metin border-cizgi hover:bg-yuzey-2',
  sessiz: 'bg-transparent text-aksan border-transparent hover:bg-aksan-acik',
  tehlike: 'bg-yuzey text-red-600 dark:text-red-400 border-red-200 dark:border-red-500/40 hover:bg-red-50 dark:hover:bg-red-500/10',
  tehlikeSessiz: 'bg-transparent text-red-600 dark:text-red-400 border-transparent hover:bg-red-50 dark:hover:bg-red-500/10',
  vurgu: 'bg-vurgu text-white border-transparent hover:opacity-90',
  koyuIkincil: 'bg-white/10 text-white border-white/15 hover:bg-white/15',
  beyaz: 'bg-white text-lacivert-900 border-transparent hover:bg-lacivert-50',
}
const DUGME_BOYUT = {
  b: 'h-11 px-5 text-[15px] rounded-xl gap-2',
  m: 'h-10 px-4 text-sm rounded-[10px] gap-2',
  k: 'h-8 px-3 text-[13px] rounded-lg gap-1.5',
}

export const Dugme = forwardRef(function Dugme(
  { tur = 'ikincil', boyut = 'm', ikon: Ikon, sagIkon: SagIkon, className, children, as: Etiket = 'button', type, ...p },
  ref,
) {
  return (
    <Etiket
      ref={ref}
      type={Etiket === 'button' ? type || 'button' : undefined}
      className={birlestir(
        'inline-flex items-center justify-center font-semibold border whitespace-nowrap transition-colors disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksan',
        DUGME_TUR[tur], DUGME_BOYUT[boyut], className,
      )}
      {...p}
    >
      {Ikon && <Ikon size={boyut === 'k' ? 14 : 16} aria-hidden="true" />}
      {children}
      {SagIkon && <SagIkon size={boyut === 'k' ? 14 : 16} aria-hidden="true" />}
    </Etiket>
  )
})

export function IkonDugme({ etiket, ikon, className, ...p }) {
  const Ikon = ikon
  return (
    <button
      type="button"
      aria-label={etiket}
      title={etiket}
      className={birlestir('inline-flex items-center justify-center w-9 h-9 rounded-[10px] border border-cizgi bg-yuzey text-metin-2 hover:text-metin hover:bg-yuzey-2 transition-colors', className)}
      {...p}
    >
      <Ikon size={16} aria-hidden="true" />
    </button>
  )
}

// ---------------------------------------------------------------- rozet
const ROZET = {
  notr: 'bg-yuzey-2 text-metin-2',
  aksan: 'bg-aksan-acik text-aksan-koyu dark:text-aksan',
  olumlu: 'bg-emerald-50 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-300',
  uyari: 'bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300',
  vurgu: 'bg-vurgu-acik text-vurgu',
  tehlike: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  koyu: 'bg-murekkep text-yuzey',
  vurguDolu: 'bg-vurgu text-white',
}
export function Rozet({ ton = 'notr', ikon, className, children }) {
  const Ikon = ikon
  return (
    <span className={birlestir('inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-semibold whitespace-nowrap', ROZET[ton], className)}>
      {Ikon && <Ikon size={12} strokeWidth={3} aria-hidden="true" />}
      {children}
    </span>
  )
}

export function Sayac({ deger, ton = 'vurgu' }) {
  if (!deger) return null
  return (
    <span className={birlestir('min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-bold', ton === 'vurgu' ? 'bg-vurgu text-white' : 'bg-white/20 text-current')}>
      {deger > 99 ? '99+' : deger}
    </span>
  )
}

// ---------------------------------------------------------------- istatistik
const ALT_TON = {
  notr: 'text-metin-2',
  olumlu: 'text-emerald-700 dark:text-emerald-300',
  vurgu: 'text-vurgu',
  aksan: 'text-aksan',
  tehlike: 'text-red-600 dark:text-red-400',
}
export function Istatistik({ etiket, deger, birim, alt, altTon = 'notr', kilitli, kilitMetni = 'Profesyonel ile aç', onKilit, vurgu, onClick, href }) {
  const Etiket = href ? 'a' : onClick ? 'button' : 'div'
  return (
    <Kart
      as={Etiket}
      href={href}
      onClick={onClick}
      kesik={kilitli}
      vurgu={vurgu}
      className={birlestir('p-5 flex flex-col gap-1 text-left', (onClick || href) && 'hover:border-aksan transition-colors cursor-pointer')}
    >
      <span className="text-[13px] text-metin-2 flex items-center gap-1.5">
        {kilitli && <Lock size={13} aria-hidden="true" />}
        {etiket}
      </span>
      {kilitli ? (
        <>
          <span className="font-baslik text-[28px] font-extrabold tracking-tight text-cizgi select-none" aria-hidden="true">••</span>
          <button type="button" onClick={onKilit} className="text-left text-xs font-semibold text-aksan hover:underline">{kilitMetni}</button>
        </>
      ) : (
        <>
          <span className={birlestir('font-baslik text-[28px] font-extrabold tracking-tight tabular-nums leading-tight', vurgu === 'vurgu' ? 'text-vurgu' : 'text-metin')}>
            {deger}{birim && <span className="text-sm font-semibold text-metin-2 ml-1">{birim}</span>}
          </span>
          {alt && <span className={birlestir('text-xs font-semibold', ALT_TON[altTon])}>{alt}</span>}
        </>
      )}
    </Kart>
  )
}

// ---------------------------------------------------------------- avatar
const AVATAR_TON = [
  'bg-aksan-acik text-aksan-koyu dark:text-aksan',
  'bg-vurgu-acik text-vurgu',
  'bg-yuzey-2 text-metin-2',
  'bg-lacivert-100 text-lacivert-800 dark:bg-lacivert-800 dark:text-lacivert-100',
]
export function Avatar({ ad, url, boyut = 36, kare, ton, className }) {
  const i = ton ?? (ad ? [...String(ad)].reduce((a, c) => a + c.charCodeAt(0), 0) % AVATAR_TON.length : 0)
  const stil = { width: boyut, height: boyut, fontSize: Math.max(10, Math.round(boyut * 0.34)) }
  const sekil = kare ? 'rounded-xl' : 'rounded-full'
  if (url) {
    return <img src={url} alt="" style={stil} className={birlestir('object-cover shrink-0', sekil, className)} />
  }
  return (
    <span style={stil} className={birlestir('inline-flex items-center justify-center font-bold shrink-0 font-baslik', sekil, typeof ton === 'string' ? ton : AVATAR_TON[i], className)} aria-hidden="true">
      {basHarf(ad)}
    </span>
  )
}

// ---------------------------------------------------------------- form
export function Anahtar({ acik, onChange, etiket, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={!!acik}
      aria-label={etiket}
      disabled={disabled}
      onClick={() => onChange?.(!acik)}
      className={birlestir(
        'relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors disabled:opacity-40',
        acik ? 'bg-aksan' : 'bg-cizgi',
      )}
    >
      <span className={birlestir('inline-block h-[18px] w-[18px] rounded-full bg-white shadow transition-transform', acik ? 'translate-x-[19px]' : 'translate-x-[3px]')} />
    </button>
  )
}

export function Secim({ value, onChange, children, etiket, className, disabled }) {
  return (
    <select
      aria-label={etiket}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
      className={birlestir('h-9 rounded-lg border border-cizgi bg-yuzey text-metin text-[13px] pl-3 pr-8 focus:outline-none focus:ring-2 focus:ring-aksan/40 disabled:opacity-50', className)}
    >
      {children}
    </select>
  )
}

export const Girdi = forwardRef(function Girdi({ className, ...p }, ref) {
  return (
    <input
      ref={ref}
      className={birlestir('h-11 w-full rounded-[10px] border border-cizgi bg-yuzey px-3.5 text-[15px] text-metin placeholder:text-metin-2/70 focus:outline-none focus:ring-2 focus:ring-aksan/40 focus:border-aksan', className)}
      {...p}
    />
  )
})

export function Alan({ etiket, ipucu, hata, children, id }) {
  return (
    <div className="flex flex-col gap-1.5">
      {etiket && <label htmlFor={id} className="text-[13px] font-semibold text-metin">{etiket}</label>}
      {children}
      {hata ? <span className="text-xs text-red-600 dark:text-red-400">{hata}</span> : ipucu && <span className="text-xs text-metin-2">{ipucu}</span>}
    </div>
  )
}

// Segment: "7 gün | 30 gün | 90 gün", "Bireysel | Kurumsal"
export function Segment({ secenekler, deger, onChange, etiket, boyut = 'm' }) {
  return (
    <div role="group" aria-label={etiket} className="inline-flex items-center bg-yuzey-2 rounded-xl p-1 gap-0.5">
      {secenekler.map((s) => {
        const sec = s.deger === deger
        return (
          <button
            key={s.deger}
            type="button"
            aria-pressed={sec}
            disabled={s.kapali}
            onClick={() => onChange?.(s.deger)}
            className={birlestir(
              'inline-flex items-center gap-1.5 rounded-lg font-semibold transition-colors disabled:opacity-45',
              boyut === 'k' ? 'h-7 px-2.5 text-xs' : 'h-8 px-3.5 text-[13px]',
              sec ? 'bg-yuzey text-metin shadow-sm' : 'text-metin-2 hover:text-metin',
            )}
          >
            {s.ad}
            {s.sayi ? <Sayac deger={s.sayi} /> : null}
          </button>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- liste/tablo
export function Satir({ children, className }) {
  return <div className={birlestir('flex items-center gap-3 py-3 border-b border-cizgi/70 last:border-b-0 min-w-0', className)}>{children}</div>
}

export function Tablo({ children, className }) {
  return (
    <div className="overflow-x-auto">
      <table className={birlestir('w-full border-collapse text-sm', className)}>{children}</table>
    </div>
  )
}
export function Th({ children, sag, className }) {
  return (
    <th className={birlestir('px-4 py-2.5 text-[11.5px] font-semibold tracking-[.06em] uppercase text-metin-2 bg-yuzey-2/60 border-b border-cizgi whitespace-nowrap', sag ? 'text-right' : 'text-left', className)}>
      {children}
    </th>
  )
}
export function Td({ children, sag, className, ...p }) {
  return (
    <td className={birlestir('px-4 py-3 border-b border-cizgi/70 align-middle', sag && 'text-right tabular-nums', className)} {...p}>
      {children}
    </td>
  )
}

export function Ilerleme({ oran, ton = 'aksan', etiket }) {
  const yuz = Math.max(0, Math.min(100, Math.round((oran || 0) * 100)))
  return (
    <div className="h-1.5 rounded-full bg-yuzey-2 overflow-hidden" role="progressbar" aria-valuenow={yuz} aria-valuemin={0} aria-valuemax={100} aria-label={etiket}>
      <span className={birlestir('block h-full rounded-full', ton === 'vurgu' ? 'bg-vurgu' : 'bg-aksan')} style={{ width: `${yuz}%` }} />
    </div>
  )
}

export function BosDurum({ ikon, baslik, aciklama, eylem, className }) {
  const Ikon = ikon
  return (
    <div className={birlestir('flex flex-col items-center text-center gap-2 py-8 px-4', className)}>
      {Ikon && (
        <span className="w-11 h-11 rounded-xl bg-yuzey-2 text-metin-2 inline-flex items-center justify-center">
          <Ikon size={20} aria-hidden="true" />
        </span>
      )}
      <h3 className="font-baslik text-[15px] font-bold text-metin">{baslik}</h3>
      {aciklama && <p className="text-[13px] text-metin-2 max-w-sm">{aciklama}</p>}
      {eylem && <div className="mt-1">{eylem}</div>}
    </div>
  )
}

export function Yukleniyor({ className }) {
  return (
    <div className={birlestir('flex items-center justify-center py-10', className)}>
      <span className="w-8 h-8 border-[3px] border-aksan border-t-transparent rounded-full animate-spin" aria-label="Yükleniyor" />
    </div>
  )
}

// Kilitli içerik: arkadaki örnek bulanık, ortada açıklama ve çağrı.
export function KilitliAlan({ baslik, aciklama, eylemler, not, children }) {
  return (
    <div className="relative">
      <div className="blur-[6px] opacity-60 pointer-events-none select-none" aria-hidden="true">{children}</div>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center gap-3 px-6">
        <span className="w-12 h-12 rounded-xl bg-murekkep text-yuzey inline-flex items-center justify-center">
          <Lock size={20} aria-hidden="true" />
        </span>
        <h3 className="font-baslik text-xl font-extrabold text-metin">{baslik}</h3>
        {aciklama && <p className="text-sm text-metin-2 max-w-lg">{aciklama}</p>}
        {eylemler && <div className="flex gap-2 flex-wrap justify-center">{eylemler}</div>}
        {not && <p className="text-xs text-metin-2">{not}</p>}
      </div>
    </div>
  )
}

