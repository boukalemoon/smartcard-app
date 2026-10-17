// ÖN-DERLEME GİRİŞİ — yalnız pazarlama sayfaları.
//
// NEDEN: Uygulama tek sayfalık (SPA). İçerik ancak JavaScript çalıştıktan
// sonra var oluyordu. Google JavaScript çalıştırıyor ama üretken arama
// motorlarının (AI Overviews, Perplexity, ChatGPT arama) çoğu çalıştırmıyor —
// onlar HTML'de ne varsa onu okur. Bu giriş, derleme anında bu sayfaların
// HTML'ini üretmek için kullanılır (scripts/on-derle.mjs).
//
// App.jsx'i DEĞİL, yalnız bu sayfaları render ediyoruz: panel, yönetici ve
// ShieldAuth ağacının sunucuda çalışmasına gerek yok, çalışmaya kalkarsa da
// tarayıcıya özel API'lerde patlar.
//
// Sağlayıcılar en aza indirildi: ThemeProvider (SiteKabugu useTheme çağırıyor)
// ve MemoryRouter (Link/useLocation için). MemoryRouter StaticRouter yerine
// bilinçli seçim: react-router 7'de düz render için yeterli ve API'si sabit.
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { ThemeProvider } from './contexts/ThemeContext'
import { ToastProvider } from './components/Toast'
import LandingPage from './pages/LandingPage'
import NFCCardsPage from './pages/NFCCardsPage'
import Iletisim from './pages/Iletisim'

const SAYFALAR = {
  '/': LandingPage,
  '/nfc-cards': NFCCardsPage,
  '/iletisim': Iletisim,
}

export const YOLLAR = Object.keys(SAYFALAR)

export function render(yol) {
  const Sayfa = SAYFALAR[yol]
  if (!Sayfa) throw new Error(`ön-derleme: tanımsız yol ${yol}`)
  return renderToString(
    <ToastProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={[yol]}>
          <Sayfa />
        </MemoryRouter>
      </ThemeProvider>
    </ToastProvider>,
  )
}
