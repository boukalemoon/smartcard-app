// Açılış sayfası bölümlerinin paylaştığı sınıf dizgeleri. Bileşen dosyaları
// yalnız bileşen dışa aktarsın diye (react-refresh) ayrı dosyada.

// Üst çubukla aynı 1120px içerik genişliği. Geniş ekranda yan boşluk sıfırlanır
// ki bölümler logonun ve menünün hizasında başlasın.
export const KAP = 'max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-0'

// Bölümler yapışkan üst çubuğun (72px) altında kalmasın.
export const BOLUM_KAYMA = 'scroll-mt-[88px]'

export const ODAK = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksan'
export const ODAK_KOYU = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

const DUGME_TEMEL = 'inline-flex items-center justify-center gap-2 h-12 px-[22px] rounded-xl text-[15px] font-semibold border whitespace-nowrap transition-colors'

export const DUGME = {
  ana: `${DUGME_TEMEL} ${ODAK} bg-aksan text-white dark:text-zemin border-transparent hover:bg-aksan-koyu`,
  ikincil: `${DUGME_TEMEL} ${ODAK} bg-yuzey text-metin border-cizgi hover:bg-yuzey-2`,
  vurgu: `${DUGME_TEMEL} ${ODAK} bg-vurgu text-white dark:text-lacivert-950 border-transparent hover:opacity-90`,
  // Koyu/marka zeminli bloklarda: beyaz düğme, beyaz odak halkası.
  beyaz: `${DUGME_TEMEL} ${ODAK_KOYU} bg-white text-marka-koyu border-transparent hover:bg-marka-acik`,
  vurguKoyu: `${DUGME_TEMEL} ${ODAK_KOYU} bg-vurgu text-white dark:text-lacivert-950 border-transparent hover:opacity-90`,
  anaKoyu: `${DUGME_TEMEL} ${ODAK_KOYU} bg-aksan text-white dark:text-zemin border-transparent hover:bg-aksan-koyu`,
}

// Bölüm üst etiketi: küçük, büyük harf, aralıklı.
export const UST = 'text-xs font-semibold tracking-[0.08em] uppercase'

export const H2 = 'font-baslik font-extrabold text-[30px] sm:text-[40px] leading-[1.12] tracking-[-0.015em]'
