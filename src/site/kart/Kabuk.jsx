// Kart sayfasının kabuğu: ortalanmış sütun, alt bilgi, yükleniyor iskeleti
// ve "bulunamadı / duraklatıldı" durumları. Mobilde tam genişlik; masaüstünde
// ortada ~440px sütun, arkada zemin rengi.
import { Link } from 'react-router-dom'
import { PauseCircle, RefreshCw, SearchX } from 'lucide-react'
import { birlestir } from '../../panel/bicim'
import { BTN, BTN_ANA, BTN_IKINCIL, ODAK } from './yardim'
import { QrMotif } from './parcalar'

export function Sutun({ children, ...p }) {
  return (
    <div className="min-h-screen bg-zemin sm:py-8" {...p}>
      <div className="mx-auto w-full max-w-[440px] min-h-screen sm:min-h-0 bg-zemin sm:rounded-3xl sm:overflow-hidden sm:border sm:border-cizgi">
        {children}
      </div>
    </div>
  )
}

// İç bağlantı: kendi alan adında açılan kartta site sayfaları yoktur
// (yalnız kart açılır), bu yüzden orada tam QRtım adresine gidilir.
export function SiteBaglantisi({ yol, dis, className, children }) {
  if (dis) return <a href={dis + yol} className={className}>{children}</a>
  return <Link to={yol} className={className}>{children}</Link>
}

export function KartAlti({ kayitYolu, disAdres }) {
  const b = birlestir('rounded hover:underline', ODAK)
  return (
    <footer className="flex flex-col items-center gap-2 pt-2 pb-1 text-xs text-metin-2 text-center">
      <span>
        Bu kart <b className="text-metin font-semibold">QRtım</b> ile oluşturuldu ·{' '}
        <SiteBaglantisi yol={kayitYolu} dis={disAdres} className={birlestir('text-aksan', b)}>Siz de kartınızı oluşturun</SiteBaglantisi>
      </span>
      <span>
        <SiteBaglantisi yol="/gizlilik" dis={disAdres} className={b}>Gizlilik</SiteBaglantisi>
        {' · '}
        <SiteBaglantisi yol="/iletisim" dis={disAdres} className={b}>Bildir</SiteBaglantisi>
      </span>
    </footer>
  )
}

// Yükleniyor: kartın iskeleti — ziyaretçi neyin geleceğini görür, sayfa
// yüklendiğinde yerleşim zıplamaz.
export function Iskelet() {
  const cubuk = 'rounded-full bg-white/25 animate-pulse'
  const kutu = 'rounded-2xl border border-cizgi bg-yuzey animate-pulse'
  return (
    <Sutun aria-busy="true">
      <span className="sr-only" role="status">Kart yükleniyor…</span>
      <div className="relative overflow-hidden bg-marka pt-14 pb-[22px] px-5 flex flex-col items-center gap-3" aria-hidden="true">
        <QrMotif className="absolute -right-12 -top-12 w-[240px] h-[240px] opacity-[0.14] text-white" />
        <span className="w-24 h-24 rounded-full bg-white/20 border-4 border-white/30 animate-pulse" />
        <span className={birlestir(cubuk, 'h-6 w-44')} />
        <span className={birlestir(cubuk, 'h-3.5 w-32')} />
        <span className={birlestir(cubuk, 'h-3 w-48')} />
      </div>
      <div className="p-4 flex flex-col gap-3" aria-hidden="true">
        <div className="flex gap-2.5"><span className="flex-1 h-12 rounded-xl bg-yuzey-2 animate-pulse" /><span className="flex-1 h-12 rounded-xl bg-yuzey-2 animate-pulse" /></div>
        <span className="h-4 w-4/5 rounded-full bg-yuzey-2 animate-pulse" />
        <span className={birlestir(kutu, 'h-40')} />
        <span className={birlestir(kutu, 'h-32')} />
      </div>
    </Sutun>
  )
}

const DURUM = {
  yok: { ikon: SearchX, baslik: 'Kart bulunamadı', metin: 'Bu adreste bir kart yok. Bağlantı yanlış yazılmış ya da kart sahibi adresini değiştirmiş olabilir.' },
  durdu: { ikon: PauseCircle, baslik: 'Bu kart şu an paylaşılmıyor', metin: 'Kart sahibi bu bağlantıyı geçici olarak duraklatmış. Daha sonra tekrar deneyebilirsiniz.' },
  yogun: { ikon: RefreshCw, baslik: 'Çok fazla istek', metin: 'Kısa sürede çok sayıda kart açıldı. Biraz bekleyip yeniden deneyin.' },
}

export function DurumEkrani({ tur = 'yok', disAdres, kayitYolu, onYenile }) {
  const d = DURUM[tur] || DURUM.yok
  const Ikon = d.ikon
  return (
    <Sutun>
      <div className="relative overflow-hidden bg-marka pt-14 pb-8 px-5 flex flex-col items-center gap-3 text-center">
        <QrMotif className="absolute -right-12 -top-12 w-[240px] h-[240px] opacity-[0.14] text-white" />
        <SiteBaglantisi yol="/" dis={disAdres} className="absolute left-4 top-3.5 inline-flex items-center rounded-md bg-white px-1.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
          <img src="/qrtim-logo.png" alt="QRtım ana sayfa" width="240" height="68" className="h-4 w-auto" />
        </SiteBaglantisi>
        <span className="relative w-24 h-24 rounded-full bg-white/15 border-4 border-white/35 inline-flex items-center justify-center text-white" aria-hidden="true">
          <Ikon size={36} strokeWidth={1.75} />
        </span>
        <h1 className="relative font-baslik text-2xl font-extrabold tracking-[-0.015em] text-white">{d.baslik}</h1>
      </div>
      <main className="p-4 flex flex-col gap-3">
        <p className="text-[14px] text-metin-2 px-1">{d.metin}</p>
        <div className="flex gap-2.5">
          {tur === 'yogun' && onYenile ? (
            <button type="button" onClick={onYenile} className={birlestir(BTN, BTN_ANA, 'flex-1')}>Yeniden dene</button>
          ) : (
            <SiteBaglantisi yol="/" dis={disAdres} className={birlestir(BTN, BTN_ANA, 'flex-1')}>Ana sayfaya dön</SiteBaglantisi>
          )}
          <SiteBaglantisi yol={kayitYolu} dis={disAdres} className={birlestir(BTN, BTN_IKINCIL, 'flex-1')}>Kartınızı oluşturun</SiteBaglantisi>
        </div>
      </main>
    </Sutun>
  )
}
