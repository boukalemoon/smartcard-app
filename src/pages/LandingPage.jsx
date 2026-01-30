import { useNavigate } from 'react-router-dom';
import { 
  QrCode, Nfc, Share2, BarChart3, 
  Building2, Users, Zap, Shield,
  Check, ArrowRight, Moon, Sun
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const features = [
    {
      icon: QrCode,
      title: 'QR Kod',
      description: 'Otomatik QR kod oluşturun, indirin ve paylaşın'
    },
    {
      icon: Nfc,
      title: 'NFC Etiket',
      description: 'Kartvizitinizi NFC etiketlere yazın, dokunmatik paylaşım'
    },
    {
      icon: Share2,
      title: 'Sosyal Medya',
      description: 'Tüm sosyal medya hesaplarınızı tek yerde toplayın'
    },
    {
      icon: BarChart3,
      title: 'Analytics',
      description: 'Profil görüntülenme ve etkileşim istatistikleri'
    },
    {
      icon: Building2,
      title: 'Kurumsal',
      description: 'Şirket ve STK yönetimi için özel araçlar'
    },
    {
      icon: Users,
      title: 'Üye Yönetimi',
      description: 'Organizasyonunuzun üyelerini kolayca yönetin'
    }
  ];

  const plans = [
    {
      name: 'Ücretsiz',
      price: '₺0',
      period: '/ay',
      features: [
        '1 dijital kartvizit',
        '3 sosyal medya hesabı',
        '2 şirket kaydı',
        'Temel QR kod',
        'Profil analytics'
      ],
      cta: 'Ücretsiz Başla',
      popular: false
    },
    {
      name: 'Premium',
      price: '₺99',
      period: '/ay',
      features: [
        'Sınırsız kartvizit',
        'Sınırsız sosyal medya',
        'Sınırsız şirket kaydı',
        'Özelleştirilebilir QR',
        'Gelişmiş analytics',
        'Öncelikli destek'
      ],
      cta: 'Premium\'a Geç',
      popular: true
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <img 
                src="/qartim-logo.jpg" 
                alt="Qartim Logo" 
                className="h-16 w-auto"
              />
            </div>
            <div className="flex items-center gap-3">
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
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
              >
                Giriş Yap
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Ücretsiz Başla
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full mb-6">
            <Zap size={16} />
            <span className="text-sm font-medium">Türkiye'nin dijital kartvizit platformu</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white mb-6">
            Dijital Kartvizitinizi
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Anında Oluşturun
            </span>
          </h1>
          
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-10 max-w-3xl mx-auto">
            QR kod ve NFC teknolojisi ile kartvizitinizi paylaşın. 
            Sosyal medya hesaplarınızı tek yerde toplayın, profesyonel görünün.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => navigate('/login')}
              className="px-8 py-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold text-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              Ücretsiz Başla
              <ArrowRight size={20} />
            </button>
            <button
              onClick={() => navigate('/card/burak-akmese2025')}
              className="px-8 py-4 bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-2 border-gray-200 dark:border-gray-700 rounded-xl font-semibold text-lg hover:shadow-xl transition-all"
            >
              Demo İncele
            </button>
          </div>

          {/* Hero Image/Mockup */}
          <div className="mt-16 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 blur-3xl opacity-20"></div>
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 max-w-4xl mx-auto border border-gray-200 dark:border-gray-700">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-xl">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">
                        B
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900 dark:text-white">Burak Akmeşe</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Founder @ TrendTech</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <span className="px-3 py-1 bg-blue-600 text-white text-xs rounded-full">LinkedIn</span>
                      <span className="px-3 py-1 bg-pink-600 text-white text-xs rounded-full">Instagram</span>
                      <span className="px-3 py-1 bg-gray-800 dark:bg-gray-700 text-white text-xs rounded-full">Website</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-center">
                  <div className="w-48 h-48 bg-white dark:bg-gray-700 p-4 rounded-xl shadow-lg">
                    <div className="w-full h-full bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                      <QrCode className="text-white" size={120} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Güçlü Özellikler
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Dijital kartvizitiniz için ihtiyacınız olan her şey
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <div
                  key={index}
                  className="p-6 bg-gray-50 dark:bg-gray-800 rounded-2xl hover:shadow-xl transition-all border border-gray-200 dark:border-gray-700"
                >
                  <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center mb-4">
                    <Icon className="text-white" size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Planlar ve Fiyatlar
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              İhtiyacınıza uygun planı seçin
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative p-8 rounded-2xl border-2 ${
                  plan.popular
                    ? 'border-blue-600 bg-white dark:bg-gray-800 shadow-2xl'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800'
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold rounded-full">
                    Popüler
                  </div>
                )}

                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  {plan.name}
                </h3>
                <div className="mb-6">
                  <span className="text-5xl font-bold text-gray-900 dark:text-white">
                    {plan.price}
                  </span>
                  <span className="text-gray-600 dark:text-gray-400">{plan.period}</span>
                </div>

                <ul className="space-y-3 mb-8">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <Check className="text-green-600" size={20} />
                      <span className="text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => navigate('/login')}
                  className={`w-full py-3 rounded-xl font-semibold transition-all ${
                    plan.popular
                      ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-xl'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Hemen Başlayın
          </h2>
          <p className="text-xl text-blue-100 mb-8">
            Dijital kartvizitinizi dakikalar içinde oluşturun ve paylaşmaya başlayın
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold text-lg hover:shadow-2xl transition-all inline-flex items-center gap-2"
          >
            Ücretsiz Kayıt Ol
            <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold mb-4">Qartim</h3>
              <p className="text-sm">
                Türkiye'nin dijital kartvizit platformu
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Ürün</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Özellikler</a></li>
                <li><a href="#" className="hover:text-white">Fiyatlar</a></li>
                <li><a href="#" className="hover:text-white">Kurumsal</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Destek</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Yardım Merkezi</a></li>
                <li><a href="#" className="hover:text-white">İletişim</a></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Yasal</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:text-white">Gizlilik</a></li>
                <li><a href="#" className="hover:text-white">Şartlar</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-sm">
            <p>&copy; 2026 Qartim. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}