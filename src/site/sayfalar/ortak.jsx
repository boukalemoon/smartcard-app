// Site sayfalarının ortak küçük parçaları: sayfa başlığı bloğu, durum kartı,
// satır içi mesaj, QR bulucu kare motifi ve NFC kart görseli.
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react'
import { birlestir } from '../../panel/bicim'
import { UST_ETIKET } from './siniflar'

// Sayfa başlığı: küçük aksan üst etiket + büyük Manrope başlık + açıklama.
export function SayfaUst({ ust, ustTon = 'aksan', baslik, alt, children, className, ortali }) {
  return (
    <div className={birlestir('flex flex-col gap-3', ortali && 'items-center text-center', className)}>
      {ust && <span className={birlestir(UST_ETIKET, ustTon === 'vurgu' ? 'text-vurgu' : 'text-aksan')}>{ust}</span>}
      <h1 className="font-baslik text-[34px] sm:text-[44px] leading-[1.08] font-extrabold tracking-[-0.02em] text-metin text-balance">
        {baslik}
      </h1>
      {alt && <p className={birlestir('text-[17px] leading-relaxed text-metin-2', ortali ? 'max-w-[620px]' : 'max-w-[680px]')}>{alt}</p>}
      {children}
    </div>
  )
}

// QR "bulucu kare" motifi: iç içe yuvarlatılmış kareler, ince beyaz çizgi.
// Yalnız koyu bloklarda dekor olarak kullanılır (ekran okuyucudan gizli).
export function QrMotif({ className, boyut = 200 }) {
  return (
    <svg aria-hidden="true" width={boyut} height={boyut} viewBox="0 0 100 100" className={birlestir('pointer-events-none', className)} fill="none">
      <rect x="2" y="2" width="96" height="96" rx="22" stroke="currentColor" strokeWidth="1.2" />
      <rect x="20" y="20" width="60" height="60" rx="14" stroke="currentColor" strokeWidth="1.2" />
      <rect x="36" y="36" width="28" height="28" rx="7" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}

// Kartın üstündeki küçük QR deseni (dekor; gerçek kod değil).
const QR_DOLU = [0, 1, 3, 4, 5, 7, 9, 11, 12, 13, 15, 17, 19, 20, 21, 23, 24]
function MiniQr({ className }) {
  return (
    <span aria-hidden="true" className={birlestir('grid grid-cols-5 gap-[2px] p-[5px] bg-white rounded-md', className)}>
      {Array.from({ length: 25 }, (_, i) => (
        <i key={i} className={QR_DOLU.includes(i) ? 'bg-lacivert-950' : ''} />
      ))}
    </span>
  )
}

// NFC kart görseli (Landing NFC bölümünün dili): her iki temada koyu lacivert
// kart, bakır çip, köşede bulucu kare motifi; arkasında eğik marka bloğu.
export function NfcKartGorseli({ ad = 'Ad Soyad', alt = 'Ünvan · Şirket', kucuk, arka = true, className }) {
  const g = kucuk ? 'w-[272px] h-[172px] p-[18px] rounded-[16px]' : 'w-[300px] sm:w-[340px] h-[190px] sm:h-[214px] p-[22px] rounded-[18px]'
  return (
    <div className={birlestir('relative flex items-center justify-center', className)} aria-hidden="true">
      {arka && <div className={birlestir('absolute bg-marka opacity-35 -rotate-6', g)} />}
      <div className={birlestir('relative bg-lacivert-950 dark:bg-lacivert-900 dark:ring-1 dark:ring-white/10 text-white flex flex-col justify-between overflow-hidden shadow-[0_24px_48px_rgb(14_23_51/0.25)]', g)}>
        <QrMotif className="absolute -right-8 -bottom-8 text-white/10" boyut={kucuk ? 160 : 200} />
        <div className="relative flex items-center justify-between">
          <span className="inline-flex w-[30px] h-[30px] rounded-[9px] border-[1.8px] border-vurgu items-center justify-center">
            <span className="w-3 h-3 rounded-[3px] border-2 border-lacivert-100" />
          </span>
          <span className="w-9 h-[26px] rounded-[5px] bg-vurgu" />
        </div>
        <div className="relative flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="font-baslik font-bold text-[18px] leading-tight text-lacivert-50 truncate">{ad}</div>
            <div className="text-xs text-lacivert-200 truncate">{alt}</div>
          </div>
          <MiniQr className={kucuk ? 'w-11 h-11 shrink-0' : 'w-[52px] h-[52px] shrink-0'} />
        </div>
      </div>
    </div>
  )
}

// Satır içi mesaj (Bileşenler: "Toast ve satır içi mesaj").
const MESAJ_TON = {
  hata: { ikon: XCircle, sinif: 'bg-red-50 border-red-200 text-red-800 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-200', ikonSinif: 'text-red-600 dark:text-red-400' },
  uyari: { ikon: AlertTriangle, sinif: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-400/10 dark:border-amber-400/30 dark:text-amber-100', ikonSinif: 'text-amber-600 dark:text-amber-300' },
  olumlu: { ikon: CheckCircle2, sinif: 'bg-emerald-50 border-emerald-200 text-emerald-900 dark:bg-emerald-400/10 dark:border-emerald-400/30 dark:text-emerald-100', ikonSinif: 'text-emerald-600 dark:text-emerald-300' },
  bilgi: { ikon: Info, sinif: 'bg-aksan-acik border-aksan/20 text-metin', ikonSinif: 'text-aksan' },
}
export function Mesaj({ ton = 'bilgi', baslik, children, className, rol }) {
  const t = MESAJ_TON[ton]
  const Ikon = t.ikon
  return (
    <div role={rol} className={birlestir('flex items-start gap-3 rounded-xl border px-4 py-3 text-sm', t.sinif, className)}>
      <Ikon size={18} className={birlestir('shrink-0 mt-px', t.ikonSinif)} aria-hidden="true" />
      <div className="min-w-0 flex flex-col gap-0.5">
        {baslik && <strong className="font-semibold">{baslik}</strong>}
        {children && <div className="leading-relaxed">{children}</div>}
      </div>
    </div>
  )
}

// Ortalanmış durum kartı (ödeme sonucu, kurum bulunamadı, 404).
const DURUM_IKON = {
  olumlu: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300',
  hata: 'bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-300',
  uyari: 'bg-amber-50 text-amber-700 dark:bg-amber-400/15 dark:text-amber-300',
  aksan: 'bg-aksan-acik text-aksan',
  notr: 'bg-yuzey-2 text-metin-2',
}
export function DurumKarti({ ikon, ton = 'aksan', ust, baslik, children, eylemler, alt, className, baslikSeviye = 'h1', donen }) {
  const Ikon = ikon
  const Baslik = baslikSeviye
  return (
    <div className={birlestir('w-full max-w-[480px] mx-auto rounded-2xl border border-cizgi bg-yuzey px-6 py-10 sm:px-10 flex flex-col items-center text-center gap-4', className)}>
      {Ikon && (
        <span className={birlestir('w-14 h-14 rounded-2xl inline-flex items-center justify-center', DURUM_IKON[ton])}>
          <Ikon size={26} className={donen ? 'animate-spin' : undefined} aria-hidden="true" />
        </span>
      )}
      {ust && <span className={birlestir(UST_ETIKET, 'text-metin-2')}>{ust}</span>}
      <Baslik className="font-baslik text-[26px] leading-tight font-extrabold tracking-[-0.01em] text-metin text-balance">{baslik}</Baslik>
      {children && <div className="text-[15px] leading-relaxed text-metin-2 max-w-[380px]">{children}</div>}
      {eylemler && <div className="mt-2 flex flex-wrap items-center justify-center gap-3">{eylemler}</div>}
      {alt && <div className="text-[13px] text-metin-2">{alt}</div>}
    </div>
  )
}
