import FAQ from '../components/landing/FAQ';
import ScrollAnimations from '../components/landing/ScrollAnimations';
import AnimatedHero from '../components/landing/AnimatedHero';
import UseCases from '../components/landing/UseCases';
import ComparisonTable from '../components/landing/ComparisonTable';
import ImpactMetrics from '../components/landing/ImpactMetrics';
import { useNavigate } from 'react-router-dom';
import { 
  QrCode, Nfc, Share2, BarChart3, 
  Building2, Users, Zap, Shield,
  Check, ArrowRight, Moon, Sun, CreditCard, Gift
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
    name: 'Başlangıç',  // ✅ DEĞİŞTİ
    price: '₺0',
    period: '/ay',
    yearlyPrice: null,
    nfcGift: null,
    features: [
      '1 dijital kartvizit',
      '3 sosyal medya hesabı',
      '2 organizasyon',
      'Temel QR kod',
      'Profil analytics'
    ],
    cta: 'Ücretsiz Başla',
    popular: false,
    badge: null
  },
  {
    name: 'Profesyonel',  // ✅ ZATEN DOĞRU
    price: '₺299',
    period: '/ay',
    yearlyPrice: '₺2.990/yıl',
    nfcGift: '1 NFC Kart Hediye*',
    nfcGiftNote: '* Renkli PVC kart',
    features: [
      'Sınırsız sosyal medya',
      'Sınırsız organizasyon',  // ✅ DEĞİŞTİ (15 → Sınırsız)
      'QR kod özelleştirme',
      'Gelişmiş analytics',
      'Öncelikli destek',
      'Özel QR tasarımı'
    ],
    cta: 'Profesyonel\'e Geç',
    popular: true,
    badge: 'Popüler'
  },
  {
    name: 'STK Özel',  // ✅ ZATEN DOĞRU
    price: '₺499',
    period: '/ay',
    yearlyPrice: '₺4.490/yıl',
    nfcGift: 'Admin + 5 Üye Kartı*',
    nfcGiftNote: '* Renkli PVC kart',
    features: [
      'Sınırsız üye',
      'Başvuru sistemi',
      'Üye onay yönetimi',
      'Toplu üye yönetimi',
      'Public üye dizini',
      'Rozet sistemi',
      'Özel alan adı desteği'
    ],
    cta: 'STK Planına Geç',
    popular: false,
    badge: 'STK\'lar İçin'
  },
  {
    name: 'Kurumsal',  // ✅ ZATEN DOĞRU
    price: '₺999',
    period: '/ay',
    yearlyPrice: '₺9.990/yıl',
    nfcGift: '10 NFC Kart Hediye*',
    nfcGiftNote: '* Renkli PVC kart',
    features: [
      '50+ çalışan',
      'API erişimi',
      'White-label çözüm',
      'Özel entegrasyon',
      'Dedike destek',
      'SLA garantisi',
      'Özel eğitim',
      'Kurumsal faturalama'
    ],
    cta: 'İletişime Geç',
    popular: false,
    badge: 'En Güçlü'
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
  src="/qartim-new-logo.png"
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
              
              {/* NFC Kartlar Link */}
              <button
                onClick={() => navigate('/nfc-cards')}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium flex items-center gap-2 transition-colors"
              >
                <CreditCard size={18} />
                <span className="hidden sm:inline">NFC Kartlar</span>
              </button>
              
              <button
                onClick={() => {
                  const ref = new URLSearchParams(window.location.search).get('ref')
                  navigate(ref ? `/login?ref=${ref}` : '/login')
                }}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
              >
                Giriş Yap
              </button>
              <button
                onClick={() => {
                  const ref = new URLSearchParams(window.location.search).get('ref')
                  navigate(ref ? `/login?ref=${ref}` : '/login')
                }}
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
              onClick={() => {
                const ref = new URLSearchParams(window.location.search).get('ref')
                navigate(ref ? `/login?ref=${ref}` : '/login')
              }}
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
          {/* Hero Animation */}
<div className="mt-16 relative">
  <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 blur-3xl opacity-20"></div>
  <AnimatedHero />
           
          </div>
        </div>
      </section>

      {/* YENİ: Impact Metrics */}
<ImpactMetrics />

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

      {/* YENİ: Comparison Table */}
<ComparisonTable />

{/* YENİ: Use Cases */}
<UseCases />

      {/* Pricing Section */}
      <section className="py-20 px-4" id="pricing">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Planlar ve Fiyatlar
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-4">
              İhtiyacınıza uygun planı seçin
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full">
              <Gift size={18} />
              <span className="text-sm font-semibold">Yıllık aboneliklerde NFC kart hediye!</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {plans.map((plan, index) => (
              <div
                key={index}
                className={`relative p-6 rounded-2xl border-2 transition-all ${
                  plan.popular
                    ? 'border-blue-600 bg-white dark:bg-gray-800 shadow-2xl scale-105'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400 dark:hover:border-blue-500'
                }`}
              >
                {plan.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-semibold rounded-full whitespace-nowrap">
                    {plan.badge}
                  </div>
                )}

                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                  {plan.name}
                </h3>
                
                <div className="mb-4">
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold text-gray-900 dark:text-white">
                      {plan.price}
                    </span>
                    <span className="text-gray-600 dark:text-gray-400 ml-1">{plan.period}</span>
                  </div>
                  {plan.yearlyPrice && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      veya {plan.yearlyPrice}
                    </p>
                  )}
                </div>

                {plan.nfcGift && (
                  <div className="mb-4 p-2 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-center gap-2 text-xs font-semibold text-yellow-800 dark:text-yellow-300">
                      <Gift size={14} />
                      <span>{plan.nfcGift}</span>
                    </div>
                    {plan.nfcGiftNote && (
                      <p className="text-xs text-yellow-700 dark:text-yellow-400 mt-1 ml-5">
                        {plan.nfcGiftNote}
                      </p>
                    )}
                  </div>
                )}

                <ul className="space-y-2.5 mb-6">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <Check className="text-green-600 flex-shrink-0 mt-0.5" size={16} />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{feature}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    const ref = new URLSearchParams(window.location.search).get('ref')
                    navigate(ref ? `/login?ref=${ref}` : '/login')
                  }}
                  className={`w-full py-2.5 rounded-xl font-semibold transition-all text-sm ${
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

          {/* Extra NFC Card Pricing */}
          <div className="mt-12 text-center p-6 bg-gradient-to-r from-gray-50 to-blue-50 dark:from-gray-800 dark:to-gray-700 rounded-2xl border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-center gap-3 mb-2">
              <CreditCard className="text-blue-600" size={24} />
              <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                Ekstra NFC Kart
              </h3>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-3">
              İhtiyacınız olduğunda ekstra NFC kart sipariş edebilirsiniz
            </p>
            <div className="inline-flex items-center gap-2 mb-2">
              <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">₺899</span>
              <span className="text-gray-600 dark:text-gray-400">/adet</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              * Renkli PVC kart için geçerlidir
            </p>
          </div>
        </div>
      </section>

      {/* YENİ: FAQ */}
<FAQ />

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
            onClick={() => {
              const ref = new URLSearchParams(window.location.search).get('ref')
              navigate(ref ? `/login?ref=${ref}` : '/login')
          }}
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
              <h3 className="text-white font-bold mb-4">Qartım</h3>
              <p className="text-sm">
                Türkiye'nin dijital kartvizit platformu
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Ürün</h4>
              <ul className="space-y-2 text-sm">
                <li><button onClick={() => navigate('/nfc-cards')} className="hover:text-white">NFC Kartlar</button></li>
                <li><a href="#pricing" className="hover:text-white">Fiyatlar</a></li>
                <li><a href="#features" className="hover:text-white">Özellikler</a></li>
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
            <p>&copy; 2026 Qartım. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </footer>

      {/* YENİ: Scroll Animations */}
      <ScrollAnimations />
    </div>
  );
}