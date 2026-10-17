import { BOLUMLER } from '../lib/dashboardBolumler'

// Panel bölüm çubuğu. Bölüm tanımları ayrı dosyada (lib/dashboardBolumler):
// sabitleri bileşenle aynı dosyadan dışa aktarmak hızlı yenilemeyi bozuyor.

export default function DashboardNav({ aktif, onChange, sayilar = {} }) {
  return (
    <nav
      aria-label="Panel bölümleri"
      // Yatay kaydırma mobilde: sekmeler sığmadığında alta taşmak yerine
      // kaydırılır; dar ekranda çok satıra bölünen bir sekme şeridi panelin
      // yarısını yiyordu.
      className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 mb-6 lg:flex-col lg:overflow-visible lg:mx-0 lg:px-0 lg:pb-0 lg:mb-0 lg:sticky lg:top-24 lg:self-start"
    >
      {BOLUMLER.map((bolum) => {
        // Bileşen olarak kullanılacağı için büyük harfle başlayan bir
        // değişkene alınıyor.
        const Simge = bolum.simge
        const secili = aktif === bolum.anahtar
        const sayi = sayilar[bolum.anahtar]
        return (
          <button
            key={bolum.anahtar}
            onClick={() => onChange(bolum.anahtar)}
            aria-current={secili ? 'page' : undefined}
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-lg text-sm font-semibold whitespace-nowrap transition-colors lg:w-full ${
              secili
                ? 'bg-lacivert-900 text-white dark:bg-blue-400/15 dark:text-white'
                : 'text-gray-600 dark:text-gray-400 hover:bg-white hover:text-gray-900 dark:hover:bg-gray-800 dark:hover:text-gray-100'
            }`}
          >
            <Simge size={18} aria-hidden="true" />
            {bolum.ad}
            {/* Sayaç yalnızca İLGİLENİLECEK bir şey varken çıkar. Sıfır
                göstermek, bakılacak bir şey varmış izlenimi verir. */}
            {sayi > 0 && (
              <span
                className={`ml-auto min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  secili
                    ? 'bg-white/20'
                    : 'bg-vurgu text-white'
                }`}
              >
                {sayi > 99 ? '99+' : sayi}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
