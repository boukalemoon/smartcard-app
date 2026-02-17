// src/components/landing/ComparisonTable.jsx
// DOĞRU VERSİYON - 1 dijital kart = yıllık 200 fiziksel kart tasarrufu

export default function ComparisonTable() {
  const comparisons = [
    {
      feature: '🌍 Çevre Etkisi',
      paper: {
        icon: '❌',
        text: 'Ağaç kesilir',
        subtext: '200 kart/yıl = 1kg kağıt'
      },
      digital: {
        icon: '✅',
        text: '%100 Dijital',
        subtext: '1 dijital = 200 kağıt tasarrufu'
      }
    },
    {
      feature: '🔒 Veri Güvenliği',
      paper: {
        icon: '❌',
        text: 'Kaybolur, yırtılır',
        subtext: 'Veriler açıkta'
      },
      digital: {
        icon: '✅',
        text: '256-bit Şifreleme',
        subtext: 'RLS + GDPR koruması'
      }
    },
    {
      feature: '💰 Maliyet',
      paper: {
        icon: '❌',
        text: '₺500 / 1000 adet',
        subtext: 'Yeniden basım gerekli'
      },
      digital: {
        icon: '✅',
        text: 'Ücretsiz Başlangıç',
        subtext: 'Sınırsız paylaşım'
      }
    },
    {
      feature: '🔄 Güncelleme',
      paper: {
        icon: '❌',
        text: 'Yeniden basım',
        subtext: 'Zaman + maliyet'
      },
      digital: {
        icon: '✅',
        text: 'Anında Güncelleme',
        subtext: 'Tüm kartlarda yansır'
      }
    },
    {
      feature: '📊 Analytics',
      paper: {
        icon: '❌',
        text: 'Takip yok',
        subtext: 'Kim aldı bilinmez'
      },
      digital: {
        icon: '✅',
        text: 'Detaylı İstatistik',
        subtext: 'Görüntülenme + tıklama'
      }
    },
    {
      feature: '🌐 Erişim',
      paper: {
        icon: '❌',
        text: 'Fiziksel gerekli',
        subtext: 'Yanında taşınmalı'
      },
      digital: {
        icon: '✅',
        text: 'QR + NFC + Link',
        subtext: 'Her yerden erişim'
      }
    }
  ];

  return (
    <section className="py-20 bg-white dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Neden Dijital Kartvizit?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Tek bir dijital kart, yüzlerce kağıt kartvizit yerine geçer
          </p>
        </div>

        {/* Comparison Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl overflow-hidden border border-gray-200 dark:border-gray-700">
          
          {/* Table Header */}
          <div className="grid grid-cols-3 gap-4 p-6 bg-gradient-to-r from-blue-600 to-purple-600 text-white">
            <div className="font-bold text-lg">Özellik</div>
            <div className="font-bold text-lg text-center">📄 Kağıt Kartvizit</div>
            <div className="font-bold text-lg text-center">💚 Qartım (Dijital)</div>
          </div>

          {/* Table Rows */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {comparisons.map((item, index) => (
              <div
                key={index}
                className="grid grid-cols-3 gap-4 p-6 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
              >
                {/* Feature */}
                <div className="font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  {item.feature}
                </div>

                {/* Paper */}
                <div className="text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">{item.paper.icon}</span>
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      {item.paper.text}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {item.paper.subtext}
                    </span>
                  </div>
                </div>

                {/* Digital */}
                <div className="text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-3xl">{item.digital.icon}</span>
                    <span className="font-semibold text-green-700 dark:text-green-400">
                      {item.digital.text}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {item.digital.subtext}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom CTA - DOĞRU VERSİYON */}
          <div className="p-6 bg-gradient-to-r from-green-50 to-blue-50 dark:from-green-900/20 dark:to-blue-900/20 border-t border-gray-200 dark:border-gray-700">
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                Tek Dijital Kart = Yüzlerce Kağıt Kartvizit Tasarrufu 🌱
              </p>
              <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
                {/* Box 1 */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
                  <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">
                    1 Kişi
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p className="font-semibold mb-1">Yıllık Tasarruf:</p>
                    <p>→ 200 kağıt kartvizit</p>
                    <p>→ 1 kg kağıt</p>
                    <p>→ 3.8 kg CO₂</p>
                  </div>
                </div>

                {/* Box 2 */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
                  <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                    42 Kişi
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p className="font-semibold mb-1">Yıllık Tasarruf:</p>
                    <p>→ 8,400 kağıt kartvizit</p>
                    <p>→ 42 kg kağıt</p>
                    <p>→ <strong className="text-green-600 dark:text-green-400">1 Ağaç 🌳</strong></p>
                  </div>
                </div>

                {/* Box 3 */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-md">
                  <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">
                    100 Kişi
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p className="font-semibold mb-1">Yıllık Tasarruf:</p>
                    <p>→ 20,000 kağıt kartvizit</p>
                    <p>→ 100 kg kağıt</p>
                    <p>→ <strong className="text-green-600 dark:text-green-400">2.4 Ağaç 🌲</strong></p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 space-y-1">
                <p><strong>Hesaplama:</strong> 1 kişi yılda ortalama 200 kartvizit kullanır (kaynak: Small Business Trends)</p>
                <p><strong>Çevre Etkisi:</strong> 1 ağaç = 42 kg kağıt üretimi (kaynak: EPA)</p>
                <p><strong>Karbon Ayak İzi:</strong> 1 kg kağıt = 3.8 kg CO₂ emisyonu (kaynak: Carbon Trust)</p>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Optimized View */}
        <div className="mt-12 lg:hidden space-y-6">
          {comparisons.map((item, index) => (
            <div
              key={index}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
            >
              <h3 className="font-bold text-lg text-gray-900 dark:text-gray-100 mb-4">
                {item.feature}
              </h3>
              
              <div className="grid grid-cols-2 gap-4">
                {/* Paper */}
                <div className="text-center p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                  <div className="text-3xl mb-2">{item.paper.icon}</div>
                  <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    📄 Kağıt
                  </div>
                  <div className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                    {item.paper.text}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {item.paper.subtext}
                  </div>
                </div>

                {/* Digital */}
                <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="text-3xl mb-2">{item.digital.icon}</div>
                  <div className="font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    💚 Qartım
                  </div>
                  <div className="text-sm font-medium text-green-600 dark:text-green-400 mb-1">
                    {item.digital.text}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500">
                    {item.digital.subtext}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}