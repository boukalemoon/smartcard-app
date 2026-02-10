import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import { 
  CreditCard, Sparkles, Leaf, Diamond, Zap,
  ArrowRight, CheckCircle, Mail, Phone, Moon, Sun
} from 'lucide-react';

export default function NFCCardsPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const cardTypes = [
    {
      id: 'pvc',
      name: 'Renkli PVC Kart',
      icon: CreditCard,
      gradient: 'from-blue-500 to-purple-600',
      description: 'Dayanıklı plastik malzeme, canlı renkler',
      features: ['Su geçirmez', 'Çizilmeye dayanıklı', 'Uygun fiyat'],
      price: '₺899',
      priceValue: 899
    },
    {
      id: 'metal',
      name: 'Metal Kart',
      icon: Sparkles,
      gradient: 'from-gray-700 to-gray-900',
      description: 'Premium metal, lüks his',
      features: ['Prestijli görünüm', 'Ağır ve kaliteli', 'Uzun ömürlü'],
      price: '₺1499',
      priceValue: 1499,
      popular: true
    },
    {
      id: 'transparent',
      name: 'Şeffaf Kart',
      icon: Diamond,
      gradient: 'from-cyan-400 to-blue-500',
      description: 'Modern şeffaf tasarım',
      features: ['Benzersiz görünüm', 'Hafif', 'Dikkat çekici'],
      price: '₺1699',
      priceValue: 1699
    },
    {
      id: 'bamboo',
      name: 'Bambu Kart',
      icon: Leaf,
      gradient: 'from-green-600 to-emerald-700',
      description: 'Doğa dostu, organik malzeme',
      features: ['Çevre dostu', 'Doğal doku', 'Sürdürülebilir'],
      price: '₺2299',
      priceValue: 2299
    },
    {
      id: 'custom',
      name: 'Özel Tasarım',
      icon: Zap,
      gradient: 'from-orange-500 to-red-600',
      description: 'Tamamen size özel tasarım',
      features: ['İstediğiniz tasarım', 'Logo baskı', 'Özel renk'],
      price: 'Fiyat Teklifi',
      priceValue: 0
    }
  ];

  const faqs = [
    {
      q: 'NFC kartlar nasıl çalışır?',
      a: 'NFC kartlar, telefonla dokunduğunuzda otomatik olarak dijital kartvizitinizi açar. QR kod taramaya gerek kalmaz.'
    },
    {
      q: 'Tüm telefonlarla uyumlu mu?',
      a: 'Evet! NFC özelliği olan tüm akıllı telefonlar (iPhone, Android) ile uyumludur. NFC olmayan telefonlarda QR kod ile kullanılabilir.'
    },
    {
      q: 'Kart bilgilerini güncelleyebilir miyim?',
      a: 'Evet! Kartınızdaki bilgiler dijital olduğu için istediğiniz zaman Qartim panelinden güncelleyebilirsiniz. Yeni kart bastırmaya gerek yok!'
    },
    {
      q: 'Teslimat süresi ne kadar?',
      a: 'Standart kartlar 3-5 iş günü, özel tasarım kartlar 7-10 iş günü içinde kargoya verilir.'
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <button 
              onClick={() => navigate('/')}
              className="flex items-center gap-2"
            >
              <img 
                src="/qartim-logo.jpg" 
                alt="Qartim Logo" 
                className="h-12 w-auto"
              />
            </button>
            <div className="flex items-center gap-3">
              {/* Dark Mode Toggle */}
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                title={theme === 'light' ? 'Karanlık mod' : 'Aydınlık mod'}
              >
                {theme === 'light' ? (
                  <Moon size={20} className="text-gray-700 dark:text-gray-300" />
                ) : (
                  <Sun size={20} className="text-yellow-400" />
                )}
              </button>
              
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Giriş Yap
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-20 pb-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full mb-6">
            <Sparkles size={16} />
            <span className="text-sm font-medium">Dijitalden Fiziksel'e Geçin</span>
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            NFC Kartlarınızı
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Özelleştirin
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto">
            Dijital kartvizitinizi fiziksel bir karta dönüştürün. 
            Dokunmatik paylaşım ile networkünüzü genişletin.
          </p>

          {/* Coming Soon Badge */}
          <div className="inline-block mb-8 px-8 py-4 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-2xl shadow-2xl">
            <p className="text-2xl font-bold">🎉 ÇOK YAKINDA!</p>
            <p className="text-sm mt-1">Kart siparişleri yakında açılacak</p>
          </div>
        </div>
      </section>

      {/* Card Types */}
      <section className="py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-4">
            Kart Seçenekleri
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 mb-12">
            Size uygun kartı seçin, kişiselleştirin
          </p>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cardTypes.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-400 transition-all hover:shadow-xl"
                >
                  {card.popular && (
                    <div className="absolute -top-4 right-4 px-4 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm font-bold rounded-full">
                      Popüler
                    </div>
                  )}
                  
                  {card.comingSoon && (
                    <div className="absolute -top-3 -right-3 px-3 py-1 bg-yellow-500 text-white text-xs font-bold rounded-full rotate-12">
                      Yakında
                    </div>
                  )}

                  <div className={`w-16 h-16 bg-gradient-to-br ${card.gradient} rounded-xl flex items-center justify-center mb-4`}>
                    <Icon className="text-white" size={32} />
                  </div>

                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                    {card.name}
                  </h3>
                  
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    {card.description}
                  </p>

                  <div className="space-y-2 mb-6">
                    {card.features.map((feature, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                    <div className="flex items-baseline justify-between mb-4">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">
                        {card.price}
                      </span>
                      {card.price.includes('₺') && (
                        <span className="text-sm text-gray-500">/adet</span>
                      )}
                    </div>
                    
                    <button
  onClick={() => {
    // Login kontrolü
    const isLoggedIn = false // TODO: Auth kontrol et
    if (isLoggedIn) {
      navigate(`/nfc-designer?type=${card.id}`)
    } else {
      navigate('/login')
    }
  }}
  className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
>
  Sipariş Ver
</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Contact Form */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl font-bold mb-4">
            Bilgi Almak İster misiniz?
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            NFC kartlarımız hakkında detaylı bilgi için bizimle iletişime geçin
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:info@qartim.com"
              className="flex items-center justify-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:shadow-2xl transition-all"
            >
              <Mail size={20} />
              info@qartim.com
            </a>
            <a
              href="tel:+905301234567"
              className="flex items-center justify-center gap-2 px-8 py-4 bg-white/10 backdrop-blur text-white border-2 border-white rounded-xl font-semibold hover:bg-white/20 transition-all"
            >
              <Phone size={20} />
              +90 530 123 4567
            </a>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-bold text-center text-gray-900 dark:text-white mb-12">
            Sık Sorulan Sorular
          </h2>
          
          <div className="space-y-6">
            {faqs.map((faq, index) => (
              <div 
                key={index}
                className="p-6 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  {faq.q}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {faq.a}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <img 
            src="/qartim-logo.jpg" 
            alt="Qartim" 
            className="h-12 w-auto mx-auto mb-4"
          />
          <p className="text-sm">
            &copy; 2026 Qartim. Tüm hakları saklıdır.
          </p>
        </div>
      </footer>
    </div>
  );
}