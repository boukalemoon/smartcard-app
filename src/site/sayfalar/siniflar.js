// Site sayfalarının ortak sınıf dizeleri (tasarım panosu: Landing / Bileşenler).
//
// NEDEN AYRI DOSYA: bileşen dosyalarından bileşen dışı bir şey dışa aktarmak
// hızlı yenilemeyi (react-refresh) bozar; sınıflar bu yüzden burada.
import { birlestir } from '../../panel/bicim'

// Site düğmeleri panelden büyüktür: 48px yükseklik, 12px köşe, 15px yazı.
const DUGME_TEMEL =
  'inline-flex items-center justify-center gap-2 h-12 px-[22px] rounded-xl text-[15px] font-semibold border whitespace-nowrap transition-colors ' +
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksan disabled:opacity-45 disabled:cursor-not-allowed'

const DUGME_TUR = {
  ana: 'bg-aksan text-white dark:text-zemin border-transparent hover:bg-aksan-koyu',
  ikincil: 'bg-yuzey text-metin border-cizgi hover:bg-yuzey-2',
  // Bakır yalnız NFC/fiziksel kart ve ikinci seviye eylemde (tasarım kuralı).
  vurgu: 'bg-vurgu text-white dark:text-zemin border-transparent hover:opacity-90',
  // Koyu lacivert bantların üstünde.
  beyaz: 'bg-white text-lacivert-900 border-transparent hover:bg-lacivert-50',
  koyuIkincil: 'bg-white/10 text-white border-white/20 hover:bg-white/15',
  sessiz: 'bg-transparent text-aksan border-transparent hover:bg-aksan-acik px-3',
}

export const dugme = (tur = 'ana', ek) => birlestir(DUGME_TEMEL, DUGME_TUR[tur], ek)

// Küçük, büyük harfli, harf aralıklı üst etiket ("NFC KART", "İLETİŞİM").
export const UST_ETIKET = 'text-xs font-semibold tracking-[.08em] uppercase'

// Site form alanları: 48px yükseklik, ince çizgi, odakta aksan halkası.
export const GIRDI =
  'w-full rounded-xl border border-cizgi bg-yuzey px-4 text-[15px] text-metin placeholder:text-metin-2/70 ' +
  'focus:outline-none focus:ring-2 focus:ring-aksan/40 focus:border-aksan transition-colors'

export const ETIKET = 'block text-[13px] font-semibold text-metin mb-1.5'

// Sayfa içeriği genişliği (SiteKabugu üst çubuğuyla aynı hiza).
export const KAP = 'max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-0'
