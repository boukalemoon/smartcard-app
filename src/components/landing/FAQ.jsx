// src/components/landing/FAQ.jsx

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState(null);

  const faqs = [
    {
      category: '🌱 Çevre & Sürdürülebilirlik',
      icon: '🌍',
      questions: [
        {
          q: 'Dijital kartvizit gerçekten çevre dostu mu?',
          a: 'Evet! Bir kişi yılda ortalama 200 kartvizit kullanır (1 kg kağıt). Dijital kartvizit kullanarak bu kağıt israfını %100 önlersiniz. 42 dijital kart kullanıcısı = 1 ağaç kurtarılır.'
        },
        {
          q: 'NFC kartlar da çevre dostu mu?',
          a: 'NFC kartlar PVC malzemeden yapılır ancak yıllarca kullanılabilir ve sonsuz kez paylaşılabilir. Bir NFC kart, minimum 500 kağıt kartvizit yerine geçer. Ayrıca geri dönüştürülebilir malzeme kullanıyoruz.'
        },
        {
          q: 'Çevre katkınızı nasıl hesaplıyorsunuz?',
          a: 'Hesaplamalarımız EPA (U.S. Environmental Protection Agency) ve Carbon Trust verilerine dayanır. 1 kartvizit = 5g kağıt, 1 ağaç = 42kg kağıt formülü kullanılır. Tüm kaynaklar sayfamızda detaylıca belirtilmiştir.'
        }
      ]
    },
    {
      category: '🔒 Güvenlik & Gizlilik',
      icon: '🛡️',
      questions: [
        {
          q: 'Verilerim güvende mi?',
          a: 'Evet! 256-bit şifreleme, RLS (Row Level Security) database koruması ve GDPR uyumlu altyapı kullanıyoruz. Verileriniz sadece sizin erişiminizde, üçüncü taraflarla paylaşılmaz.'
        },
        {
          q: 'Kağıt kartvizite göre güvenlik avantajı nedir?',
          a: 'Kağıt kartvizitler kaybolabilir, çalınabilir veya çöpe atılabilir. Dijital kartvizitiniz şifreli ve güvenli sunucularda saklanır. Kartınızı kaybetseniz bile verileriniz güvende kalır.'
        },
        {
          q: 'GDPR uyumlu musunuz?',
          a: 'Evet, tamamen GDPR uyumluyuz. Kullanıcılarımızın verilerini korumak bizim önceliğimizdir. Verilerinizi istediğiniz zaman indirebilir veya silebilirsiniz.'
        }
      ]
    },
    {
      category: '💰 Fiyatlar & Planlar',
      icon: '💳',
      questions: [
        {
          q: 'Ücretsiz plan yeterli mi?',
          a: 'Ücretsiz plan bireysel kullanıcılar için idealdir. 1 dijital kart, 3 sosyal medya linki ve 2 organizasyon yönetebilirsiniz. Temel QR kod ve analytics özelliklerine erişebilirsiniz.'
        },
        {
          q: 'Yıllık abonelik avantajları neler?',
          a: 'Yıllık abonelikte %17 indirim kazanırsınız. Ayrıca Professional planda 1, Enterprise planda 10 adet NFC kart tamamen ücretsiz! Aylık ödemeyle bu kartlar ₺899/adet.'
        },
        {
          q: 'İptal edersem ne olur?',
          a: 'Aboneliğinizi istediğiniz zaman iptal edebilirsiniz. Mevcut dönem sonuna kadar tüm özellikleri kullanmaya devam edersiniz. İptal sonrası otomatik olarak ücretsiz plana geçersiniz.'
        },
        {
          q: 'Fatura alabilir miyim?',
          a: 'Evet! Tüm ödemelerde otomatik fatura kesilir. Kurumsal plan kullanıcıları için özel faturalama ve toplu ödeme seçenekleri mevcuttur.'
        }
      ]
    },
    {
      category: '⚙️ Teknik & Kullanım',
      icon: '🔧',
      questions: [
        {
          q: 'NFC kartı nasıl kullanırım?',
          a: 'NFC kartınızı telefonun arkasına dokundurmanız yeterli. Android ve iOS (iPhone XR ve üzeri) cihazlarda otomatik çalışır. Uygulama indirmeye gerek yok!'
        },
        {
          q: 'QR kod nasıl çalışır?',
          a: 'QR kodunuzu telefonun kamera uygulaması ile taratın. Otomatik olarak dijital kartvizit sayfanıza yönlendirir. İndirme, kaydetme ve iletişim bilgilerini direkt telefona aktarma seçenekleri sunar.'
        },
        {
          q: 'Bilgilerimi nasıl güncellerim?',
          a: 'Dashboard\'unuzdan istediğiniz zaman güncelleyebilirsiniz. Değişiklikler anında tüm paylaştığınız kartlara yansır. Yeniden basım gerekmez!'
        },
        {
          q: 'Analytics ne gösterir?',
          a: 'Profil görüntülenme sayısı, tıklanan linkler, vCard indirmeleri ve zaman bazlı istatistikler. Kim baktı göremezsiniz (gizlilik), sadece toplam sayılar.'
        }
      ]
    }
  ];

  const toggleQuestion = (categoryIndex, questionIndex) => {
    const key = `${categoryIndex}-${questionIndex}`;
    setOpenIndex(openIndex === key ? null : key);
  };

  return (
    <section className="py-20 bg-white dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Sıkça Sorulan Sorular
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            Merak ettiklerinizin cevapları burada
          </p>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-8">
          {faqs.map((category, categoryIndex) => (
            <div key={categoryIndex}>
              {/* Category Header */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-3xl">{category.icon}</span>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {category.category}
                </h3>
              </div>

              {/* Questions */}
              <div className="space-y-3">
                {category.questions.map((faq, questionIndex) => {
                  const key = `${categoryIndex}-${questionIndex}`;
                  const isOpen = openIndex === key;

                  return (
                    <div
                      key={questionIndex}
                      className="bg-gray-50 dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden transition-all"
                    >
                      {/* Question */}
                      <button
                        onClick={() => toggleQuestion(categoryIndex, questionIndex)}
                        className="w-full px-6 py-4 flex items-center justify-between text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        <span className="font-semibold text-gray-900 dark:text-white pr-4">
                          {faq.q}
                        </span>
                        {isOpen ? (
                          <ChevronUp className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={24} />
                        ) : (
                          <ChevronDown className="text-gray-400 flex-shrink-0" size={24} />
                        )}
                      </button>

                      {/* Answer */}
                      <div
                        className={`transition-all duration-300 ease-in-out ${
                          isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
                        } overflow-hidden`}
                      >
                        <div className="px-6 pb-4 pt-2">
                          <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                            {faq.a}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Bottom CTA */}
        <div className="mt-12 text-center p-8 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-2xl border border-blue-200 dark:border-blue-800">
          <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Başka sorularınız mı var?
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Size yardımcı olmaktan mutluluk duyarız!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:destek@qartim.com"
              className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all"
            >
              📧 E-posta Gönder
            </a>
            <a
              href="https://wa.me/905551234567"
              target="_blank"
              rel="noopener noreferrer"
              className="px-6 py-3 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition-all"
            >
              💬 WhatsApp Destek
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}