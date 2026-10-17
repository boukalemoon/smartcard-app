// WEB SİTESİ KABUĞU — üst çubuk + alt bilgi
//
// Açılış sayfası ve bütün herkese açık sayfalar (yasal metinler, iletişim,
// NFC kart, ödeme sonucu…) aynı üst çubuğu ve alt bilgiyi kullanır; böylece
// ziyaretçi hangi sayfaya düşerse düşsün aynı siteyi görür (tasarım panosu:
// Landing). Panel sayfaları kendi kabuğunu (src/panel/PanelKabugu) kullanır.
import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Menu, Moon, Sun, X } from 'lucide-react'
import { useTheme } from '../contexts/ThemeContext'
import { birlestir } from '../panel/bicim'
import { refliAdres, SITE_MENU } from './yardim'
import { supabase } from '../lib/supabaseClient'

// Logo PNG'si beyaz zeminli; koyu zeminde beyaz bir yüzey içinde durur ki
// lacivert yazı kaybolmasın.
export function SiteLogo({ koyuZemin = false, className }) {
  return (
    <Link
      to="/"
      aria-label="QRtım ana sayfa"
      className={birlestir('inline-flex shrink-0 rounded-lg', koyuZemin ? 'bg-white px-2 py-1' : 'dark:bg-white dark:px-2 dark:py-1', className)}
    >
      <img src="/qrtim-logo.png" alt="QRtım" width="240" height="68" className="h-9 w-auto" />
    </Link>
  )
}

export function TemaDugmesi({ className }) {
  const { theme, toggleTheme } = useTheme()
  const koyu = theme === 'dark'
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={koyu ? 'Aydınlık temaya geç' : 'Karanlık temaya geç'}
      className={birlestir('inline-flex items-center justify-center w-10 h-10 rounded-xl text-metin-2 hover:text-metin hover:bg-yuzey-2 transition-colors', className)}
    >
      {koyu ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
    </button>
  )
}

function MenuBaglantisi({ m, onClick, className }) {
  const { pathname } = useLocation()
  const href = pathname === '/' ? `#${m.bolum}` : `/#${m.bolum}`
  return (
    <a href={href} onClick={onClick} className={className}>
      {m.ad}
    </a>
  )
}

// Oturum açık ziyaretçiye "Giriş yap / Ücretsiz başla" yerine panel bağlantısı
// gösterilir. Durum yalnız okunur; oturum yönetimi App.jsx'te.
function useOturumVar() {
  const [var_, setVar] = useState(false)
  useEffect(() => {
    let canli = true
    supabase.auth.getSession().then(({ data }) => { if (canli) setVar(!!data?.session) })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_olay, oturum) => setVar(!!oturum))
    return () => { canli = false; subscription.unsubscribe() }
  }, [])
  return var_
}

export function SiteUstu() {
  const [acik, setAcik] = useState(false)
  const oturum = useOturumVar()

  // Mobil menü bağlantı tıklamasıyla ya da Escape ile kapanır.
  useEffect(() => {
    if (!acik) return
    const esc = (e) => { if (e.key === 'Escape') setAcik(false) }
    document.addEventListener('keydown', esc)
    return () => document.removeEventListener('keydown', esc)
  }, [acik])

  const kapat = () => setAcik(false)

  return (
    <header className="sticky top-0 z-40 bg-zemin/90 backdrop-blur border-b border-cizgi">
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-0 h-[72px] flex items-center justify-between gap-4">
        <SiteLogo />
        <nav aria-label="Site menüsü" className="hidden lg:flex items-center gap-7">
          {SITE_MENU.map((m) => (
            <MenuBaglantisi key={m.bolum} m={m} className="text-[15px] font-medium text-metin hover:text-aksan transition-colors" />
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <TemaDugmesi />
          {oturum ? (
            <Link
              to="/dashboard"
              className="hidden sm:inline-flex items-center h-11 px-4 rounded-xl bg-aksan text-white dark:text-zemin text-[15px] font-semibold hover:bg-aksan-koyu transition-colors"
            >
              Panelime git
            </Link>
          ) : (
            <>
              <Link
                to={refliAdres('/login')}
                className="hidden sm:inline-flex items-center h-11 px-4 rounded-xl border border-cizgi bg-yuzey text-[15px] font-medium text-metin hover:bg-yuzey-2 transition-colors"
              >
                Giriş yap
              </Link>
              <Link
                to={refliAdres('/signup')}
                className="hidden sm:inline-flex items-center h-11 px-4 rounded-xl bg-aksan text-white dark:text-zemin text-[15px] font-semibold hover:bg-aksan-koyu transition-colors"
              >
                Ücretsiz başla
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setAcik((a) => !a)}
            aria-expanded={acik}
            aria-controls="mobil-menu"
            aria-label={acik ? 'Menüyü kapat' : 'Menüyü aç'}
            className="lg:hidden inline-flex items-center justify-center w-10 h-10 rounded-xl text-metin hover:bg-yuzey-2"
          >
            {acik ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
          </button>
        </div>
      </div>
      {acik && (
        <div id="mobil-menu" className="lg:hidden border-t border-cizgi bg-zemin px-4 pb-4 pt-2">
          <nav aria-label="Site menüsü (mobil)" className="flex flex-col">
            {SITE_MENU.map((m) => (
              <MenuBaglantisi key={m.bolum} m={m} onClick={kapat} className="h-12 flex items-center text-base font-medium text-metin border-b border-cizgi last:border-0" />
            ))}
          </nav>
          {oturum ? (
            <Link to="/dashboard" onClick={kapat} className="mt-3 h-11 flex items-center justify-center rounded-xl bg-aksan text-white dark:text-zemin font-semibold">Panelime git</Link>
          ) : (
            <div className="grid grid-cols-2 gap-2 mt-3">
              <Link to={refliAdres('/login')} onClick={kapat} className="h-11 inline-flex items-center justify-center rounded-xl border border-cizgi bg-yuzey font-medium text-metin">Giriş yap</Link>
              <Link to={refliAdres('/signup')} onClick={kapat} className="h-11 inline-flex items-center justify-center rounded-xl bg-aksan text-white dark:text-zemin font-semibold">Ücretsiz başla</Link>
            </div>
          )}
        </div>
      )}
    </header>
  )
}

const ALT_SUTUNLAR = [
  {
    baslik: 'Ürün',
    ogeler: [
      { ad: 'Bloklar', href: '/#bloklar' },
      { ad: 'Planlar', href: '/#planlar' },
      { ad: 'NFC kart', to: '/nfc-cards' },
      { ad: 'Sıkça sorulanlar', href: '/#sorular' },
      { ad: 'Partner programı', href: '/#partner' },
    ],
  },
  {
    baslik: 'Şirket',
    ogeler: [
      { ad: 'İletişim', to: '/iletisim' },
    ],
  },
  {
    baslik: 'Hukuki',
    ogeler: [
      { ad: 'Gizlilik politikası', to: '/gizlilik' },
      { ad: 'KVKK aydınlatma', to: '/kvkk' },
      { ad: 'Kullanım şartları', to: '/kullanim-sartlari' },
      { ad: 'Çerez politikası', to: '/cerez-politikasi' },
    ],
  },
]

// Alt bilgi her iki temada da koyu lacivert durur (tasarımdaki koyu bant).
export function SiteAlti() {
  const yil = new Date().getFullYear()
  const sinif = 'text-[15px] text-lacivert-200 hover:text-white transition-colors'
  return (
    <footer className="bg-lacivert-950 text-white">
      <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-0 pt-14 pb-10 grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="max-w-sm">
          <SiteLogo koyuZemin />
          <p className="mt-4 text-[15px] leading-relaxed text-lacivert-200">
            Dijital kimlik ve dijital kart, tek yerde. Bir TrendTech Bilişim ürünüdür.
          </p>
        </div>
        {ALT_SUTUNLAR.map((s) => (
          <div key={s.baslik}>
            <h2 className="font-sans text-[15px] font-semibold tracking-normal text-white">{s.baslik}</h2>
            <ul className="mt-3 flex flex-col gap-2.5">
              {s.ogeler.map((o) => (
                <li key={o.ad}>
                  {o.to ? (
                    <Link to={o.to} className={sinif}>{o.ad}</Link>
                  ) : (
                    <a href={o.href} className={sinif} {...(o.dis ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{o.ad}</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="max-w-[1200px] mx-auto border-t border-white/10">
        <div className="max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-0 py-6 flex flex-wrap items-center justify-between gap-3 text-sm text-lacivert-200">
          <span>© {yil} QRtım · qrtim.com.tr</span>
          <span>Türkçe</span>
        </div>
      </div>
    </footer>
  )
}

// Yasal metinler, iletişim, NFC kart gibi sayfalar için ortak sarmalayıcı.
export default function SiteKabugu({ children, className }) {
  return (
    <div className="min-h-screen flex flex-col bg-zemin text-metin">
      <SiteUstu />
      <main id="icerik" className={birlestir('flex-1', className)}>{children}</main>
      <SiteAlti />
    </div>
  )
}
