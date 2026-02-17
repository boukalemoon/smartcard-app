// src/components/landing/UseCases.jsx

export default function UseCases() {
  const cases = [
    {
      icon: '🌱',
      emoji: '🌍',
      title: 'Çevre Aktivisti',
      name: 'Ayşe K.',
      role: 'Sürdürülebilirlik Danışmanı',
      quote: '"1 yılda 500 kartvizit dağıtıyordum, bu 2.5 kg kağıt demek. Qartım ile artık sıfır atık üretiyorum ve müşterilerime çevre bilinciyle örnek oluyorum."',
      benefit: 'Sıfır Karbon Ayak İzi',
      stats: '500 kart → 2.5 kg kağıt tasarrufu',
      color: 'green'
    },
    {
      icon: '💼',
      emoji: '🏢',
      title: 'Kurumsal Şirket',
      name: 'Mehmet Y.',
      role: 'İK Müdürü - 500 Çalışanlı Şirket',
      quote: '"500 çalışan × 200 kart/yıl × ₺0.50 = Yıllık ₺50.000 harcıyorduk. Qartım ile hem maliyetten kurtulduk, hem de yeşil şirket imajı kazandık."',
      benefit: '₺50.000 Yıllık Tasarruf',
      stats: '100,000 kart → 500 kg kağıt → 12 ağaç',
      color: 'blue'
    },
    {
      icon: '🔒',
      emoji: '🛡️',
      title: 'Veri Güvenliği Uzmanı',
      name: 'Can D.',
      role: 'Siber Güvenlik Danışmanı',
      quote: '"Kağıt kartvizit dağıtmak, müşteri verilerini açıkta bırakmak demek. Qartım ile 256-bit şifreleme + RLS koruması altında güvenli paylaşım yapıyorum."',
      benefit: 'Kurumsal Güvenlik Standardı',
      stats: 'GDPR + ISO 27001 Uyumlu',
      color: 'purple'
    },
    {
      icon: '🚀',
      emoji: '💡',
      title: 'Startup Founder',
      name: 'Zeynep A.',
      role: 'Teknoloji Girişimci',
      quote: '"Networking eventlerde anında güncel bilgimi paylaşıyorum. Analytics ile kimin ilgilendiğini görüp takip ediyorum. Bir toplantıda 50 kişiye ulaştım!"',
      benefit: 'Anlık Güncelleme + Analytics',
      stats: '50 paylaşım → %40 dönüşüm oranı',
      color: 'orange'
    }
  ];

  const getColorClasses = (color) => {
    const colors = {
      green: {
        border: 'border-green-200 dark:border-green-800',
        bg: 'bg-green-50 dark:bg-green-900/20',
        text: 'text-green-700 dark:text-green-300',
        badge: 'bg-green-600'
      },
      blue: {
        border: 'border-blue-200 dark:border-blue-800',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-700 dark:text-blue-300',
        badge: 'bg-blue-600'
      },
      purple: {
        border: 'border-purple-200 dark:border-purple-800',
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        text: 'text-purple-700 dark:text-purple-300',
        badge: 'bg-purple-600'
      },
      orange: {
        border: 'border-orange-200 dark:border-orange-800',
        bg: 'bg-orange-50 dark:bg-orange-900/20',
        text: 'text-orange-700 dark:text-orange-300',
        badge: 'bg-orange-600'
      }
    };
    return colors[color];
  };

  return (
    <section className="py-20 bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Kim Ne Kazanır?
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Gerçek kullanıcılarımızın hikayeleri
          </p>
        </div>

        {/* Use Cases Grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {cases.map((item, index) => {
            const colorClasses = getColorClasses(item.color);
            
            return (
              <div
                key={index}
                className={`bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 border-2 ${colorClasses.border} hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 relative overflow-hidden group`}
              >
                {/* Top Border Animation */}
                <div className={`absolute top-0 left-0 w-full h-1 ${colorClasses.badge} transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300`}></div>

                {/* Icon */}
                <div className="flex items-start gap-4 mb-6">
                  <div className={`text-6xl ${colorClasses.bg} rounded-2xl p-4`}>
                    {item.emoji}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      {item.title}
                    </h3>
                    <div className="space-y-1">
                      <p className="font-semibold text-gray-700 dark:text-gray-300">
                        {item.name}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {item.role}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quote */}
                <blockquote className="mb-6">
                  <p className={`text-gray-700 dark:text-gray-300 italic leading-relaxed ${colorClasses.text} bg-opacity-10 ${colorClasses.bg} p-4 rounded-xl`}>
                    {item.quote}
                  </p>
                </blockquote>

                {/* Stats */}
                <div className={`${colorClasses.bg} rounded-xl p-4 mb-4`}>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    📊 Etki:
                  </p>
                  <p className={`text-sm ${colorClasses.text} font-medium`}>
                    {item.stats}
                  </p>
                </div>

                {/* Benefit Badge */}
                <div className="flex justify-end">
                  <span className={`inline-flex items-center gap-2 px-4 py-2 ${colorClasses.badge} text-white rounded-full font-semibold text-sm shadow-lg`}>
                    <span>✓</span>
                    {item.benefit}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="mt-16 text-center">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 max-w-3xl mx-auto border-2 border-blue-200 dark:border-blue-800">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Siz de Hikayenizin Parçası Olun! 🌟
            </h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Her gün yüzlerce profesyonel, Qartım ile dijitalleşerek hem çevreye katkı sağlıyor, 
              hem de iş süreçlerini geliştiriyor.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => window.location.href = '/login'}
                className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-semibold text-lg transition-all shadow-lg hover:shadow-2xl"
              >
                Ücretsiz Başla →
              </button>
              <button 
                onClick={() => window.location.href = '/card/burak-akmese2025'}
                className="px-8 py-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white border-2 border-gray-300 dark:border-gray-600 rounded-xl font-semibold text-lg hover:shadow-xl transition-all"
              >
                Demo İncele
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}