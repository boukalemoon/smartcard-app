import { useNavigate } from 'react-router-dom';
import { useTheme } from '../contexts/ThemeContext';
import {
  CreditCard, Sparkles, Zap, ArrowRight,
  CheckCircle, Mail, Moon, Sun, Wifi, Check, Clock
} from 'lucide-react';

export default function NFCCardsPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const cardTypes = [
    {
      id: 'pvc',
      name: 'Standart PVC Kart',
      tagline: 'Uygun Fiyatlı & Dayanıklı',
      gradient: 'from-blue-500 via-blue-600 to-purple-600',
      bgGradient: 'from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20',
      borderColor: 'border-blue-200 dark:border-blue-800',
      price: '₺799',
      badge: null,
      comingSoon: false,
      cardBg: 'from-blue-500 to-purple-600',
      metal: false,
      features: [
        'Su geçirmez PVC malzeme',
        'Canlı renkli baskı',
        'Çizilmeye dayanıklı',
        'NFC çip dahil',
        'QR kod baskısı',
        '3-5 iş günü teslimat'
      ],
      specs: [
        { label: 'Malzeme', value: 'PVC Plastik' },
        { label: 'Boyut', value: '85.6×54 mm' },
        { label: 'Kalınlık', value: '0.76 mm' }
      ]
    },
    {
      id: 'metal',
      name: 'Premium Metal Kart',
      tagline: 'Prestij & Lüks',
      gradient: 'from-gray-600 via-gray-700 to-gray-900',
      bgGradient: 'from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50',
      borderColor: 'border-gray-300 dark:border-gray-600',
      price: '₺1.490',
      badge: 'Popüler',
      comingSoon: false,
      cardBg: 'from-gray-600 to-gray-900',
      metal: true,
      features: [
        'Paslanmaz çelik malzeme',
        'Lazer gravür baskı',
        'Ağır ve kaliteli his',
        'NFC çip dahil',
        'Mat veya parlak yüzey',
        '5-7 iş günü teslimat'
      ],
      specs: [
        { label: 'Malzeme', value: 'Paslanmaz Çelik' },
        { label: 'Boyut', value: '85.6×54 mm' },
        { label: 'Kalınlık', value: '0.8 mm' }
      ]
    },
    {
      id: 'transparent',
      name: 'Şeffaf Kart',
      tagline: 'Modern & Dikkat Çekici',
      gradient: 'from-cyan-400 to-blue-500',
      bgGradient: 'from-cyan-50 to-blue-50 dark:from-cyan-900/20 dark:to-blue-900/20',
      borderColor: 'border-cyan-200 dark:border-cyan-800',
      price: '₺999',
      badge: null,
      comingSoon: true,
      cardBg: 'from-cyan-400 to-blue-500',
      metal: false,
      features: [
        'Şeffaf PVC malzeme',
        'Benzersiz görünüm',
        'Hafif yapı',
        'NFC çip dahil',
        'Dikkat çekici tasarım',
        'Kargo ücretsiz'
      ],
      specs: [
        { label: 'Malzeme', value: 'Şeffaf PVC' },
        { label: 'Boyut', value: '85.6×54 mm' },
        { label: 'Kalınlık', value: '0.76 mm' }
      ]
    },
    {
      id: 'bamboo',
      name: 'Bambu Kart',
      tagline: 'Çevre Dostu & Doğal',
      gradient: 'from-green-600 to-emerald-700',
      bgGradient: 'from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      price: '₺1.290',
      badge: null,
      comingSoon: true,
      cardBg: 'from-green-600 to-emerald-700',
      metal: false,
      features: [
        'Doğal bambu malzeme',
        'Çevre dostu üretim',
        'Organik doku',
        'NFC çip dahil',
        'Sürdürülebilir',
        'Kargo ücretsiz'
      ],
      specs: [
        { label: 'Malzeme', value: 'Bambu' },
        { label: 'Boyut', value: '85.6×54 mm' },
        { label: 'Kalınlık', value: '1.0 mm' }
      ]
    },
    {
      id: 'custom',
      name: 'Özel Tasarım',
      tagline: 'Tamamen Size Özel',
      gradient: 'from-orange-500 to-red-600',
      bgGradient: 'from-orange-50 to-red-50 dark:from-orange-900/20 dark:to-red-900/20',
      borderColor: 'border-orange-200 dark:border-orange-800',
      price: 'Fiyat Teklifi',
      badge: null,
      comingSoon: true,
      cardBg: 'from-orange-500 to-red-600',
      metal: false,
      features: [
        'İstediğiniz malzeme',
        'Logo ve marka baskısı',
        'Özel renk & tasarım',
        'NFC çip dahil',
        'Kurumsal sipariş',
        'Proje bazlı fiyat'
      ],
      specs: [
        { label: 'Malzeme', value: 'Seçime göre' },
        { label: 'Adet', value: 'Min. 10 adet' },
        { label: 'Süre', value: '10-15 gün' }
      ]
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
      a: 'Evet! Kartınızdaki bilgiler dijital olduğu için istediğiniz zaman QRtım panelinden güncelleyebilirsiniz. Yeni kart bastırmaya gerek yok!'
    },
    {
      q: 'Teslimat süresi ne kadar?',
      a: 'PVC kartlar 3-5 iş günü, metal kartlar 5-7 iş günü içinde kargoya verilir. Kargo ücretsizdir.'
    },
    {
      q: 'Yıllık abonelikte kart hediye mi geliyor?',
      a: 'Evet! Profesyonel yıllık abonelikte 1 PVC kart, STK yıllık abonelikte 6 kart, Kurumsal yıllık abonelikte 10 kart ücretsiz gönderilir.'
    }
  ];

  const activeCards = cardTypes.filter(c => !c.comingSoon);
  const comingSoonCards = cardTypes.filter(c => c.comingSoon);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800">

      {/* Header */}
      <header className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-lg border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <button onClick={() => navigate('/')} className="flex items-center gap-2">
              <img src="/qrtım-logo.png" alt="QRtım Logo" className="h-12 w-auto" />
            </button>
            <div className="flex items-center gap-3">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              >
                {theme === 'light' ? (
                  <Moon size={20} className="text-gray-700" />
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

      {/* Hero */}
      <section className="pt-20 pb-12 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full mb-6">
            <Sparkles size={16} />
            <span className="text-sm font-medium">Fiziksel + Dijital Kartvizit</span>
          </div>
          <h1 className="text-5xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6">
            NFC Kartınızı
            <br />
            <span className="bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              Seçin & Sipariş Verin
            </span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-6 max-w-3xl mx-auto">
            Dijital kartvizitinizi fiziksel bir karta dönüştürün.
            Dokunuşla paylaşın, anında etki bırakın.
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full">
            <CheckCircle size={16} />
            <span className="text-sm font-medium">Yıllık aboneliklerde kart hediye!</span>
          </div>
        </div>
      </section>

      {/* Aktif Kartlar */}
      <section className="py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-2xl font-bold text-center text-gray-900 dark:text-white mb-2">
            Şu An Sipariş Verebilirsiniz
          </h2>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-10">
            Stokta mevcut, hızlı teslimat
          </p>

          <div className="grid md:grid-cols-2 gap-10">
            {activeCards.map((card) => (
              <div
                key={card.id}
                className={`relative bg-gradient-to-br ${card.bgGradient} rounded-3xl p-8 border-2 ${card.borderColor} hover:shadow-2xl transition-all`}
              >
                {card.badge && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-6 py-1.5 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-sm font-bold rounded-full shadow-lg">
                    ⭐ {card.badge}
                  </div>
                )}

                {/* Kart Görseli */}
                <div className="mb-8 flex justify-center">
                  <div className="relative">
                    <div className={`w-64 h-40 bg-gradient-to-br ${card.cardBg} rounded-2xl shadow-2xl flex flex-col justify-between p-5 relative overflow-hidden`}>
                      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20 rounded-2xl" />
                      {card.metal && (
                        <div className="absolute inset-0 opacity-10 rounded-2xl"
                          style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(255,255,255,0.3) 2px, rgba(255,255,255,0.3) 4px)' }}
                        />
                      )}
                      <div className="relative z-10 flex justify-between items-start">
                        <div>
                          <div className="text-white/60 text-xs font-medium mb-0.5">QRtım</div>
                          <div className="text-white font-bold text-sm">Ad Soyad</div>
                          <div className="text-white/70 text-xs">Ünvan</div>
                        </div>
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                          <Wifi size={16} className="text-white" />
                        </div>
                      </div>
                      <div className="relative z-10 flex justify-between items-end">
                        <div className="text-white/50 text-xs">qartim.com/profil</div>
                        <div className="w-8 h-8 bg-white/90 rounded-md p-1">
                          <div className="w-full h-full grid grid-cols-3 gap-px">
                            {[...Array(9)].map((_, i) => (
                              <div key={i} className={`${[0,2,4,6,8].includes(i) ? 'bg-gray-800' : 'bg-transparent'} rounded-sm`} />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className={`absolute -bottom-2 -right-2 w-64 h-40 bg-gradient-to-br ${card.cardBg} rounded-2xl opacity-25 -z-10`} />
                  </div>
                </div>

                <div className="text-center mb-5">
                  <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-1">{card.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-sm">{card.tagline}</p>
                </div>

                <div className="space-y-2 mb-5">
                  {card.features.map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <CheckCircle size={15} className="text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-3 gap-2 mb-5 p-3 bg-white/50 dark:bg-gray-800/50 rounded-xl">
                  {card.specs.map((spec, i) => (
                    <div key={i} className="text-center">
                      <div className="text-xs text-gray-500 dark:text-gray-400">{spec.label}</div>
                      <div className="text-xs font-semibold text-gray-800 dark:text-gray-200 mt-0.5">{spec.value}</div>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-5">
                  <div className="flex items-baseline justify-between mb-4">
                    <div>
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">{card.price}</span>
                      <span className="text-sm text-gray-500 ml-1">/adet</span>
                    </div>
                    <span className="text-xs text-green-600 dark:text-green-400 font-medium">Kargo ücretsiz</span>
                  </div>
                  <button
                    onClick={() => navigate('/signup')}
                    className={`w-full py-3 bg-gradient-to-r ${card.gradient} text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center justify-center gap-2`}
                  >
                    Sipariş Ver
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Yakında Gelecek Kartlar */}
      <section className="py-12 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <Clock size={20} className="text-orange-500" />
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Yakında Geliyor</h2>
          </div>
          <p className="text-center text-gray-500 dark:text-gray-400 text-sm mb-10">
            Hazırlık aşamasındaki kartlarımızı keşfedin
          </p>

          <div className="grid md:grid-cols-3 gap-6">
            {comingSoonCards.map((card) => (
              <div
                key={card.id}
                className={`relative bg-gradient-to-br ${card.bgGradient} rounded-2xl p-6 border-2 ${card.borderColor} opacity-75`}
              >
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-orange-400 to-yellow-500 text-white text-xs font-bold rounded-full shadow">
                  🔜 Yakında
                </div>

                <div className="mb-5 flex justify-center">
                  <div className={`w-full h-24 bg-gradient-to-br ${card.cardBg} rounded-xl shadow-lg flex items-center justify-center relative overflow-hidden`}>
                    <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-white/20" />
                    <div className="relative z-10 text-center">
                      <div className="text-white font-bold text-sm">QRtım</div>
                      <div className="text-white/70 text-xs mt-0.5">{card.name}</div>
                    </div>
                    <div className="absolute bottom-2 right-2">
                      <Wifi size={14} className="text-white/40" />
                    </div>
                  </div>
                </div>

                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">{card.name}</h3>
                  <p className="text-gray-500 dark:text-gray-400 text-xs">{card.tagline}</p>
                </div>

                <div className="space-y-1.5 mb-4">
                  {card.features.slice(0, 4).map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                      <Check size={12} className="text-green-500 flex-shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <span className="text-xl font-bold text-gray-700 dark:text-gray-300">{card.price}</span>
                    {card.price.includes('₺') && <span className="text-xs text-gray-400">/adet</span>}
                  </div>
                  <button
                    disabled
                    className="w-full py-2.5 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-xl font-semibold text-sm cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <Clock size={14} />
                    Yakında Açılacak
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Toplu Sipariş */}
      <section className="py-8 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="p-6 bg-gradient-to-r from-gray-800 to-gray-900 rounded-2xl text-white text-center">
            <Zap className="mx-auto mb-3 text-yellow-400" size={32} />
            <h3 className="text-xl font-bold mb-2">Toplu Sipariş & Kurumsal</h3>
            <p className="text-gray-300 text-sm mb-4">
              10+ kart siparişlerinde özel fiyatlandırma. Şirket logolu özel tasarım seçenekleri.
            </p>
            <a
              href="mailto:info@qartim.com"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-semibold hover:shadow-xl transition-all"
            >
              <Mail size={18} />
              Teklif Al
            </a>
          </div>
        </div>
      </section>

      {/* Nasıl Çalışır */}
      <section className="py-16 px-4 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-12">Nasıl Çalışır?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: '1', icon: CreditCard, title: 'Kart Seç & Sipariş Ver', desc: 'İstediğin kart türünü seçin, siparişinizi oluşturun.' },
              { step: '2', icon: Sparkles, title: 'Tasarımını Özelleştir', desc: 'QRtım panelinden profilinizi güncelleyin, kart hazırlanır.' },
              { step: '3', icon: Wifi, title: 'Dokunuşla Paylaş', desc: 'Kartvizitinizi telefona dokundurarak anında paylaşın.' }
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.step} className="text-center">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <Icon className="text-white" size={28} />
                  </div>
                  <div className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-2">ADIM {item.step}</div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">{item.title}</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-sm">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 px-4 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center text-gray-900 dark:text-white mb-10">Sık Sorulan Sorular</h2>
          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div key={index} className="p-5 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="text-base font-bold text-gray-900 dark:text-white mb-2">{faq.q}</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* İletişim */}
      <section className="py-16 px-4 bg-gradient-to-r from-blue-600 to-purple-600">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-3xl font-bold mb-4">Sorunuz mu var?</h2>
          <p className="text-blue-100 mb-8">Hemen iletişime geçin, size yardımcı olalım.</p>
          <a
            href="mailto:info@qartim.com"
            className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-600 rounded-xl font-semibold hover:shadow-2xl transition-all"
          >
            <Mail size={20} />
            info@qartim.com
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-10 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <img src="/qrtım-logo.png" alt="QRtım" className="h-10 w-auto mx-auto mb-4" />
          <p className="text-sm">&copy; 2026 QRtım. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  );
}