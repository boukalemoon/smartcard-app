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
      className="flex gap-1 overflow-x-auto pb-1 -mx-1 px-1 mb-6"
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
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors ${
              secili
                ? 'bg-gray-900 text-white dark:bg-gray-100 dark:text-gray-900'
                : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Simge size={16} />
            {bolum.ad}
            {/* Sayaç yalnızca İLGİLENİLECEK bir şey varken çıkar. Sıfır
                göstermek, bakılacak bir şey varmış izlenimi verir. */}
            {sayi > 0 && (
              <span
                className={`min-w-[20px] px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  secili
                    ? 'bg-white/20'
                    : 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300'
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
