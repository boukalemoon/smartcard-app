// PANEL KABUĞU — üst çubuk + sol menü + içerik alanı
//
// Bireysel, kurumsal ve yönetici panelleri aynı kabuğu kullanır (tasarım
// panosu: PanelGenel, KurumGenel, Yonetici). Mobilde sol menü, üst çubuğun
// altında yatay kaydırılan bir şeride dönüşür.
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Moon, Sun, ExternalLink, ChevronDown } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { Avatar, Sayac, IkonDugme, Dugme, Segment } from './ui'
import { birlestir } from './bicim'

function Logo() {
  return (
    <Link to="/" aria-label="QRtım ana sayfa" className="shrink-0 rounded-lg dark:bg-white dark:px-2 dark:py-1">
      <img src="/qrtim-logo.png" alt="QRtım" className="h-9 w-auto" />
    </Link>
  )
}

function TemaDugmesi() {
  const { theme, toggleTheme } = useTheme()
  return <IkonDugme etiket={theme === 'dark' ? 'Aydınlık temaya geç' : 'Karanlık temaya geç'} ikon={theme === 'dark' ? Sun : Moon} onClick={toggleTheme} />
}

function HesapMenusu({ ad, avatar, eposta, menu }) {
  const [acik, setAcik] = useState(false)
  const kap = useRef(null)
  useEffect(() => {
    if (!acik) return
    const dis = (e) => { if (kap.current && !kap.current.contains(e.target)) setAcik(false) }
    const esc = (e) => { if (e.key === 'Escape') setAcik(false) }
    document.addEventListener('mousedown', dis)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', dis); document.removeEventListener('keydown', esc) }
  }, [acik])
  return (
    <div className="relative" ref={kap}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={acik}
        aria-label="Hesap menüsü"
        onClick={() => setAcik((a) => !a)}
        className="flex items-center gap-1 rounded-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-aksan"
      >
        <Avatar ad={ad} url={avatar} boyut={36} />
        <ChevronDown size={14} className="text-metin-2 hidden sm:block" aria-hidden="true" />
      </button>
      {acik && (
        <div role="menu" className="absolute right-0 mt-2 w-64 rounded-xl border border-cizgi bg-yuzey shadow-xl p-1.5 z-50">
          <div className="px-3 py-2.5 border-b border-cizgi mb-1">
            <div className="text-sm font-semibold text-metin truncate">{ad}</div>
            {eposta && <div className="text-xs text-metin-2 truncate">{eposta}</div>}
          </div>
          {menu.filter(Boolean).map((m) => (
            <button
              key={m.ad}
              role="menuitem"
              type="button"
              onClick={() => { setAcik(false); m.onClick() }}
              className={birlestir(
                'w-full flex items-center gap-2.5 px-3 h-10 rounded-lg text-sm font-medium text-left hover:bg-yuzey-2',
                m.tehlike ? 'text-red-600 dark:text-red-400' : 'text-metin',
              )}
            >
              <m.ikon size={16} aria-hidden="true" />
              {m.ad}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function MenuOgesi({ m, yatay, aktif, onSec }) {
  const Simge = m.simge
  const sec = aktif === m.anahtar
  return (
    <button
      type="button"
      onClick={() => !m.kapali && onSec(m.anahtar)}
      aria-current={sec ? 'page' : undefined}
      aria-disabled={m.kapali || undefined}
      className={birlestir(
        'flex items-center gap-3 font-medium transition-colors whitespace-nowrap',
        yatay ? 'h-9 px-3 rounded-lg text-sm' : 'w-full h-11 px-3 rounded-xl text-[15px]',
        sec ? 'bg-murekkep text-yuzey font-semibold' : 'text-metin-2 hover:bg-yuzey hover:text-metin',
        m.kapali && 'cursor-default hover:bg-transparent hover:text-metin-2',
      )}
    >
      {Simge && <Simge size={yatay ? 16 : 18} aria-hidden="true" />}
      <span className="flex-1 text-left">{m.ad}</span>
      {m.sayi ? <Sayac deger={m.sayi} ton={sec ? 'acik' : 'vurgu'} /> : null}
      {m.etiket && (
        <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full bg-yuzey-2 text-metin-2">{m.etiket}</span>
      )}
    </button>
  )
}

export default function PanelKabugu({
  menu,
  aktif,
  onSec,
  mod,
  onModDegistir,
  kurumsalAcik,
  ustSlot,
  altSlot,
  sagUst,
  kartUrl,
  kullanici,
  hesapMenusu,
  ustEtiket,
  children,
}) {
  return (
    <div className="min-h-screen bg-zemin text-metin">
      <header className="sticky top-0 z-30 h-[60px] bg-yuzey/95 backdrop-blur border-b border-cizgi">
        <div className="h-full px-4 lg:px-5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo />
            {ustEtiket}
          </div>
          {kurumsalAcik ? (
            <div className="hidden md:block">
              <Segment
                etiket="Panel modu"
                deger={mod}
                onChange={onModDegistir}
                secenekler={[{ deger: 'bireysel', ad: 'Bireysel' }, { deger: 'kurumsal', ad: 'Kurumsal' }]}
              />
            </div>
          ) : <span className="hidden md:block" />}
          <div className="flex items-center gap-2">
            {sagUst}
            {kartUrl && (
              <Dugme as="a" href={kartUrl} target="_blank" rel="noopener noreferrer" tur="ikincil" ikon={ExternalLink} className="hidden sm:inline-flex">
                Kartımı gör
              </Dugme>
            )}
            <TemaDugmesi />
            {kullanici && <HesapMenusu ad={kullanici.ad} avatar={kullanici.avatar} eposta={kullanici.eposta} menu={hesapMenusu || []} />}
          </div>
        </div>
      </header>

      {/* Mobil: mod seçimi + yatay menü */}
      <div className="lg:hidden border-b border-cizgi bg-zemin">
        {kurumsalAcik && (
          <div className="px-4 pt-3 md:hidden">
            <Segment
              etiket="Panel modu"
              deger={mod}
              onChange={onModDegistir}
              secenekler={[{ deger: 'bireysel', ad: 'Bireysel' }, { deger: 'kurumsal', ad: 'Kurumsal' }]}
            />
          </div>
        )}
        {ustSlot && <div className="px-4 pt-3">{ustSlot}</div>}
        <nav aria-label="Panel bölümleri" className="flex gap-1 overflow-x-auto px-3 py-2.5">
          {menu.map((m) => <MenuOgesi key={m.anahtar} m={m} yatay aktif={aktif} onSec={onSec} />)}
        </nav>
      </div>

      <div className="flex">
        <aside className="hidden lg:flex flex-col w-[264px] shrink-0 border-r border-cizgi px-3.5 py-5 sticky top-[60px] h-[calc(100vh-60px)] overflow-y-auto">
          {ustSlot && <div className="mb-4">{ustSlot}</div>}
          <nav aria-label="Panel bölümleri" className="flex flex-col gap-1">
            {menu.map((m) => <MenuOgesi key={m.anahtar} m={m} aktif={aktif} onSec={onSec} />)}
          </nav>
          {altSlot && <div className="mt-auto pt-5">{altSlot}</div>}
        </aside>
        <main className="flex-1 min-w-0 px-4 sm:px-6 lg:px-7 py-6 lg:py-7">
          <div className="max-w-[1180px] mx-auto flex flex-col gap-5">{children}</div>
        </main>
      </div>
    </div>
  )
}
