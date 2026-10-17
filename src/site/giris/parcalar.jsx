// Kimlik ekranlarının ortak parçaları (giriş, kayıt, şifre yenileme, bağlı
// uygulama onayı, cihaz girişi, e-posta doğrulama, iki adımlı doğrulama).
//
// Panel bileşenleri (src/panel/ui.jsx) 40-44 px yüksekliğinde; tasarım
// panosundaki kimlik ekranları 48 px alan ve düğme kullanıyor. Bu yüzden
// burada site ölçüsünde yerel parçalar var.
import { useState } from 'react'
import { CircleAlert, Eye, EyeOff, Info, Lock, TriangleAlert, CircleCheck } from 'lucide-react'
import { birlestir } from '../../panel/bicim'
import { SiteLogo, TemaDugmesi } from '../SiteKabugu'
import { sifreGucu } from './kurallar'

// ---------------------------------------------------------------- alanlar
const GIRDI =
  'h-12 w-full rounded-xl border border-cizgi bg-yuzey px-3.5 text-[15px] text-metin placeholder:text-metin-2/70 ' +
  'focus:outline-none focus:ring-[3px] focus:ring-aksan/35 focus:border-aksan disabled:opacity-60'

export function Etiket({ htmlFor, children }) {
  return <label htmlFor={htmlFor} className="text-[13px] font-semibold text-metin">{children}</label>
}

// Etiket satırının sağına bağlantı/düğme konabilir ("Şifremi unuttum").
export function GirisAlani({ id, etiket, sag, className, ...p }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Etiket htmlFor={id}>{etiket}</Etiket>
        {sag}
      </div>
      <input id={id} className={birlestir(GIRDI, className)} {...p} />
    </div>
  )
}

// Göz ikonuyla görünür yapılabilen şifre alanı. `alt` girdinin altına
// (güç çubuğu vb.) yerleşir.
export function SifreAlani({ id, etiket, sag, alt, ...p }) {
  const [gorunur, setGorunur] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between gap-3">
        <Etiket htmlFor={id}>{etiket}</Etiket>
        {sag}
      </div>
      <div className="relative">
        <input id={id} type={gorunur ? 'text' : 'password'} className={birlestir(GIRDI, 'pr-12')} {...p} />
        <button
          type="button"
          onClick={() => setGorunur((g) => !g)}
          aria-label={gorunur ? 'Şifreyi gizle' : 'Şifreyi göster'}
          aria-pressed={gorunur}
          aria-controls={id}
          className="absolute right-1.5 top-1.5 w-9 h-9 inline-flex items-center justify-center rounded-lg text-metin-2 hover:text-metin hover:bg-yuzey-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-aksan"
        >
          {gorunur ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
        </button>
      </div>
      {alt}
    </div>
  )
}

const CUBUK_RENGI = ['bg-yuzey-2', 'bg-red-500 dark:bg-red-400', 'bg-amber-500 dark:bg-amber-400', 'bg-aksan', 'bg-aksan']
const ETIKET_RENGI = ['', 'text-red-700 dark:text-red-300', 'text-amber-800 dark:text-amber-300', 'text-aksan-koyu dark:text-aksan', 'text-aksan-koyu dark:text-aksan']

export function SifreGucuCubugu({ sifre }) {
  const { seviye, etiket } = sifreGucu(sifre)
  return (
    <div className="flex flex-col gap-1.5 mt-1">
      <div className="flex gap-1" aria-hidden="true">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={birlestir('flex-1 h-1 rounded-sm', i <= seviye ? CUBUK_RENGI[seviye] : 'bg-yuzey-2 dark:bg-cizgi')} />
        ))}
      </div>
      <span aria-live="polite" className={birlestir('text-xs font-semibold empty:hidden', ETIKET_RENGI[seviye])}>
        {etiket}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------- düğmeler
const DUGME = {
  ana: 'bg-aksan text-white dark:text-zemin hover:bg-aksan-koyu border-transparent',
  ikincil: 'bg-yuzey text-metin border-cizgi hover:bg-yuzey-2',
}
export function Dugme({ tur = 'ana', className, children, type = 'button', ...p }) {
  return (
    <button
      type={type}
      className={birlestir(
        'h-12 w-full px-5 inline-flex items-center justify-center gap-2 rounded-xl border text-[15px] font-semibold transition-colors',
        'disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksan',
        DUGME[tur], className,
      )}
      {...p}
    >
      {children}
    </button>
  )
}

// Metin görünümlü düğme / bağlantı ("Şifremi unuttum", "Hesap değiştir").
export const METIN_BAGLANTI =
  'text-[13px] font-semibold text-aksan hover:text-aksan-koyu dark:hover:text-aksan-koyu underline-offset-2 hover:underline ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksan rounded'

// ---------------------------------------------------------------- kutular
const KUTU = {
  notr: { sinif: 'bg-yuzey border-cizgi text-metin-2', ikon: Info, ikonSinif: 'text-aksan' },
  uyari: { sinif: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-400/10 dark:border-amber-400/30 dark:text-amber-100', ikon: TriangleAlert, ikonSinif: '' },
  dikkat: { sinif: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-400/10 dark:border-amber-400/30 dark:text-amber-100', ikon: CircleAlert, ikonSinif: '' },
  olumlu: { sinif: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-400/10 dark:border-emerald-400/30 dark:text-emerald-100', ikon: CircleCheck, ikonSinif: '' },
  tehlike: { sinif: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-400/30 dark:text-red-200', ikon: CircleAlert, ikonSinif: '' },
}
export function BilgiKutusu({ ton = 'notr', ikon, rol, className, children }) {
  const k = KUTU[ton]
  const Ikon = ikon || k.ikon
  return (
    <div role={rol} className={birlestir('flex gap-2.5 items-start rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed', k.sinif, className)}>
      <Ikon size={18} aria-hidden="true" className={birlestir('shrink-0 mt-px', k.ikonSinif)} />
      <div className="min-w-0">{children}</div>
    </div>
  )
}

// "veya" ayırıcısı
export function Ayirici({ children }) {
  return (
    <div className="flex items-center gap-3 text-xs text-metin-2">
      <span className="flex-1 h-px bg-cizgi" />
      {children}
      <span className="flex-1 h-px bg-cizgi" />
    </div>
  )
}

// ---------------------------------------------------------------- adım göstergesi
export function AdimGostergesi({ adimlar, aktif }) {
  return (
    <ol aria-label="Adımlar" className="flex flex-wrap items-center gap-2 text-xs font-semibold text-metin-2">
      {adimlar.map((ad, i) => {
        const no = i + 1
        const simdi = no === aktif
        return (
          <li key={ad} className="flex items-center gap-2" aria-current={simdi ? 'step' : undefined}>
            {i > 0 && <span aria-hidden="true" className="text-cizgi">·</span>}
            <span
              aria-hidden="true"
              className={birlestir(
                'w-[22px] h-[22px] rounded-full inline-flex items-center justify-center text-[11px]',
                simdi ? 'bg-aksan text-white dark:text-zemin' : 'bg-yuzey-2 text-metin-2',
              )}
            >
              {no}
            </span>
            <span className={simdi ? 'text-metin' : undefined}>
              <span className="sr-only">{`Adım ${no}: `}</span>{ad}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ---------------------------------------------------------------- işaretler
// Logodaki QR işaretinin tamamı (yazı kısmı olmadan) beyaz kare içinde.
// PNG 240×68; QR işareti soldaki ~8-76 px aralığında, kare biçiminde.
export function QrtimIsaret({ boyut = 56, className }) {
  const ic = Math.round(boyut * 0.72)
  return (
    <span
      role="img"
      aria-label="QRtım"
      style={{ width: boyut, height: boyut }}
      className={birlestir('inline-flex items-center justify-center rounded-2xl bg-white border border-cizgi dark:border-transparent shrink-0', className)}
    >
      <span style={{ width: ic, height: ic }} className="overflow-hidden block">
        <img
          src="/qrtim-logo.png"
          alt=""
          style={{ height: ic, width: 'auto', maxWidth: 'none', marginLeft: -Math.round((ic * 8) / 68) }}
        />
      </span>
    </span>
  )
}

// QR "bulucu kare" motifi: iç içe yuvarlatılmış kareler, ince beyaz çizgi.
// Marka zeminli bloklarda dekor; ekran okuyucudan gizli.
export function BulucuDesen({ className }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 28 28" className={birlestir('pointer-events-none text-white/10', className)}>
      <rect x="2" y="2" width="24" height="24" rx="6" fill="none" stroke="currentColor" strokeWidth=".5" />
      <rect x="6.5" y="6.5" width="15" height="15" rx="3.5" fill="none" stroke="currentColor" strokeWidth=".5" />
      <rect x="10.5" y="10.5" width="7" height="7" rx="1.6" fill="none" stroke="currentColor" strokeWidth=".5" />
    </svg>
  )
}

export function Yukleniyor({ etiket = 'Yükleniyor' }) {
  return (
    <div role="status" className="flex justify-center py-2">
      <span className="w-10 h-10 border-4 border-aksan border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      <span className="sr-only">{etiket}</span>
    </div>
  )
}

// ---------------------------------------------------------------- sayfa
// Ortalanmış tek kartlı kimlik sayfaları için üst satır: logo + alan adı
// (kişi adres satırını kontrol etsin) + tema düğmesi.
export function KimlikUstu({ className }) {
  return (
    <header className={birlestir('w-full flex items-center justify-between gap-3', className)}>
      <SiteLogo />
      <div className="flex items-center gap-2">
        <span className="hidden min-[360px]:inline-flex items-center gap-1.5 text-xs text-metin-2">
          <Lock size={12} aria-hidden="true" />qrtim.com.tr
        </span>
        <TemaDugmesi />
      </div>
    </header>
  )
}

export function KimlikSayfasi({ children, genislik = 'max-w-[520px]', ust = true }) {
  return (
    <div className="min-h-screen flex flex-col bg-zemin text-metin">
      {ust && <KimlikUstu className="max-w-[1200px] mx-auto px-4 sm:px-6 pt-5 sm:pt-8" />}
      <main className={birlestir('flex-1 w-full mx-auto flex flex-col px-4 sm:px-6 pt-6 pb-10 sm:pt-14 gap-5', genislik)}>
        {children}
      </main>
    </div>
  )
}

export function KimlikKarti({ as, className, children, ...p }) {
  const Kok = as || 'div'
  return (
    <Kok className={birlestir('bg-yuzey border border-cizgi rounded-[20px] p-6 sm:p-9 flex flex-col gap-5', className)} {...p}>
      {children}
    </Kok>
  )
}
