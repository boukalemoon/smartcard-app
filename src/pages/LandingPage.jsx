import FAQ from '../components/landing/FAQ';
import ScrollAnimations from '../components/landing/ScrollAnimations';
import AnimatedHero from '../components/landing/AnimatedHero';
import UseCases from '../components/landing/UseCases';
import ComparisonTable from '../components/landing/ComparisonTable';
import ImpactMetrics from '../components/landing/ImpactMetrics';
import { useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react' // zaten var
import { 
  QrCode, Nfc, Share2, BarChart3, 
  Building2, Users, Zap, Shield,
  Check, ArrowRight, Moon, Sun, CreditCard, Gift
} from 'lucide-react';
import { useTheme } from '../contexts/ThemeContext';

export default function LandingPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [billingCycle, setBillingCycle] = useState('monthly') // monthly | yearly
  const [includeCard, setIncludeCard] = useState(false)

  // Yardımcı fonksiyon — referral kodu varsa URL'e ekle
  const goTo = (path) => {
    const ref = new URLSearchParams(window.location.search).get('ref')
    navigate(ref ? `${path}?ref=${ref}` : path)
  }

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
    id: 'free',
    name: 'Başlangıç',
    price: { monthly: 0, yearly: 0, yearlyWithCard: null },
    cardGift: null,
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
    id: 'student',
    name: 'Öğrenci',
    price: { monthly: 99, yearly: 990, yearlyWithCard: 1789 },
    cardGift: '1 PVC Kart dahil',
    studentOnly: true,
    features: [
      '1 dijital kartvizit',
      '5 sosyal medya hesabı',
      '1 organizasyon',
      'Temel QR kod',
      'Profil analytics',
      '.edu mail doğrulaması'
    ],
    cta: 'Öğrenci Planı',
    popular: false,
    badge: '🎓 Öğrenci'
  },
  {
    id: 'professional',
    name: 'Profesyonel',
    price: { monthly: 249, yearly: 2490, yearlyWithCard: 3289 },
    cardGift: '1 PVC Kart dahil',
    features: [
      'Sınırsız sosyal medya',
      'Detaylı kişisel analytics',
      'QR kod özelleştirme',
      'Referral & Davet et kazan',
      'Öncelikli destek',
      'Özel QR tasarımı'
    ],
    cta: "Profesyonel'e Geç",
    popular: true,
    badge: 'Popüler'
  },
  {
    id: 'stk',
    name: 'STK Özel',
    price: { monthly: 449, yearly: 4290, yearlyWithCard: 5089 },
    cardGift: '6 PVC Kart dahil',
    features: [
      'Sınırsız üye',
      'Başvuru sistemi',
      'Üye onay yönetimi',
      'Rol atama (Yönetici/Üye)',
      'Toplu üye yönetimi',
      'Public üye dizini',
      'Öncelikli destek ticket'
    ],
    cta: 'STK Planına Geç',
    popular: false,
    badge: "STK'lar İçin"
  },
  {
    id: 'business',
    name: 'Kurumsal',
    price: { monthly: 899, yearly: 8990, yearlyWithCard: 9789 },
    cardGift: '10 NFC Kart dahil',
    features: [
      'Sınırsız üye',
      'Öncelikli Teknik Destek',
      'Dedike destek & SLA',
      'Özel entegrasyon',
      'Kurumsal faturalama',
      'Üye analytics & export',
      'Özel eğitim'
    ],
    cta: 'İletişime Geç',
    popular: false,
    badge: 'En Güçlü'
  }
]

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">
      
      {/* Header */}
      <header className="fixed top-0 w-full bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
  <a href="/" aria-label="Anasayfa">
    <img 
      src="/qrtım-logo.png?v=2"
      alt="Qartim Logo" 
      className="h-16 w-auto cursor-pointer"
    />
  </a>
</div>
            <div className="flex items-center gap-3">
              {/* Tema Toggle */}
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
              
              {/* NFC Kartlar */}
              <button
                onClick={() => navigate('/nfc-cards')}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium flex items-center gap-2 transition-colors"
              >
                <CreditCard size={18} />
                <span className="hidden sm:inline">NFC Kartlar</span>
              </button>
              
              {/* Giriş Yap → /login */}
              <button
                onClick={() => goTo('/login')}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 font-medium"
              >
                Giriş Yap
              </button>

              {/* Ücretsiz Başla → /signup */}
              <button
                onClick={() => goTo('/signup')}
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
            {/* Ücretsiz Başla → /signup */}
            <button
              onClick={() => goTo('/signup')}
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

          <div className="mt-32 relative">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-purple-600 blur-3xl opacity-20"></div>
            <AnimatedHero />
          </div>
        </div>
      </section>

      {/* Impact Metrics */}
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

      {/* Comparison Table */}
      <ComparisonTable />

      {/* Use Cases */}
      <UseCases />

      {/* Pricing Section */}
<section className="py-20 px-4" id="pricing">
  <div className="max-w-7xl mx-auto">
    <div className="text-center mb-10">
      <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
        Planlar ve Fiyatlar
      </h2>
      <p className="text-xl text-gray-600 dark:text-gray-400 mb-8">
        İhtiyacınıza uygun planı seçin
      </p>

      {/* Toggle grubu */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
        
        {/* Aylık / Yıllık */}
        <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          <button
            onClick={() => setBillingCycle('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              billingCycle === 'monthly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Aylık
          </button>
          <button
            onClick={() => setBillingCycle('yearly')}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              billingCycle === 'yearly'
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                : 'text-gray-500 dark:text-gray-400'
            }`}
          >
            Yıllık
            <span className="ml-1.5 px-1.5 py-0.5 bg-green-100 text-green-700 text-xs rounded-md">
              %17 İndirim
            </span>
          </button>
        </div>

        {/* Dijital Only / + NFC Kart */}
        {billingCycle === 'yearly' && (
          <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            <button
              onClick={() => setIncludeCard(false)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                !includeCard
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              💻 Dijital Only
            </button>
            <button
              onClick={() => setIncludeCard(true)}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                includeCard
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow'
                  : 'text-gray-500 dark:text-gray-400'
              }`}
            >
              💳 + NFC Kart
            </button>
          </div>
        )}
      </div>

      {/* Kart toggle aktifken bilgi notu */}
      {billingCycle === 'yearly' && includeCard && (
        <div className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-sm font-semibold">
          <Gift size={16} />
          Yıllık + NFC Kart paketlerinde kart bedava gelir!
        </div>
      )}
    </div>

    {/* Plan kartları */}
    <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-5">
      {plans.map((plan) => {
        // Fiyat hesapla
        let displayPrice
        let displayPeriod
        if (billingCycle === 'monthly') {
          displayPrice = plan.price.monthly === 0 ? '₺0' : `₺${plan.price.monthly}`
          displayPeriod = '/ay'
        } else if (includeCard && plan.price.yearlyWithCard) {
          displayPrice = `₺${plan.price.yearlyWithCard}`
          displayPeriod = '/yıl'
        } else {
          displayPrice = plan.price.yearly === 0 ? '₺0' : `₺${plan.price.yearly}`
          displayPeriod = '/yıl'
        }

        return (
          <div
            key={plan.id}
            className={`relative p-6 rounded-2xl border-2 transition-all flex flex-col ${
              plan.popular
                ? 'border-blue-600 bg-white dark:bg-gray-800 shadow-2xl scale-105'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-blue-400'
            }`}
          >
            {plan.badge && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-semibold rounded-full whitespace-nowrap">
                {plan.badge}
              </div>
            )}

            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-3">
              {plan.name}
            </h3>

            <div className="mb-4">
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-bold text-gray-900 dark:text-white">
                  {displayPrice}
                </span>
                <span className="text-gray-500 dark:text-gray-400 text-sm">{displayPeriod}</span>
              </div>
              {billingCycle === 'monthly' && plan.price.yearly > 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  veya ₺{plan.price.yearly}/yıl
                </p>
              )}
            </div>

            {/* NFC kart hediye bilgisi */}
            {billingCycle === 'yearly' && includeCard && plan.cardGift && (
              <div className="mb-4 p-2 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-yellow-800 dark:text-yellow-300">
                  <Gift size={12} />
                  {plan.cardGift}
                </div>
              </div>
            )}

            {/* Öğrenci notu */}
            {plan.studentOnly && (
              <div className="mb-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  🎓 .edu uzantılı mail ile doğrulama gerekir
                </p>
              </div>
            )}

            <ul className="space-y-2 mb-6 flex-1">
              {plan.features.map((feature, i) => (
                <li key={i} className="flex items-start gap-2">
                  <Check className="text-green-600 flex-shrink-0 mt-0.5" size={14} />
                  <span className="text-xs text-gray-700 dark:text-gray-300">{feature}</span>
                </li>
              ))}
            </ul>

            <button
              onClick={() => goTo('/signup')}
              className={`w-full py-2.5 rounded-xl font-semibold transition-all text-sm ${
                plan.popular
                  ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-xl'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {plan.cta}
            </button>
          </div>
        )
      })}
    </div>

    {/* NFC Kart ayrı sipariş */}
    {/* ... mevcut NFC kart bölümü buraya gelecek */}
  </div>
</section>

      {/* FAQ */}
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
          {/* CTA → /signup */}
          <button
            onClick={() => goTo('/signup')}
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
              <h3 className="text-white font-bold mb-4">QRtım</h3>
              <p className="text-sm">
                Türkiye'nin dijital kartvizit platformu
              </p>
            </div>
            <div>
  <h4 className="text-white font-semibold mb-4">Ürün</h4>
  <ul className="space-y-2 text-sm">
    <li><button onClick={() => navigate('/nfc-cards')} className="hover:text-white">NFC Kartlar</button></li>
    <li><a href="#pricing" className="hover:text-white">Fiyatlar</a></li>
  </ul>
</div>
<div>
  <h4 className="text-white font-semibold mb-4">Destek</h4>
  <ul className="space-y-2 text-sm">
    <li><button onClick={() => navigate('/iletisim')} className="hover:text-white">İletişim</button></li>
  </ul>
</div>
<div>
  <h4 className="text-white font-semibold mb-4">Yasal</h4>
  <ul className="space-y-2 text-sm">
    <li><button onClick={() => navigate('/gizlilik')} className="hover:text-white">Gizlilik Politikası</button></li>
    <li><button onClick={() => navigate('/kullanim-sartlari')} className="hover:text-white">Kullanım Şartları</button></li>
    <li><button onClick={() => navigate('/kvkk')} className="hover:text-white">KVKK</button></li>
    <li><button onClick={() => navigate('/cerez-politikasi')} className="hover:text-white">Çerez Politikası</button></li>
  </ul>
</div>
          </div>
          <div className="pt-8 border-t border-gray-800 text-center text-sm">
            <p>&copy; 2026 QRtım. Tüm hakları saklıdır.</p>
          </div>
        </div>
      </footer>

      {/* Scroll Animations */}
      <ScrollAnimations />
    </div>
  );
}
