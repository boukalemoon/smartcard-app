import { useState } from 'react'
import { X, CreditCard, Check } from 'lucide-react'

export default function PaymentModal({ isOpen, onClose, selectedPlan, isRenewal = false, currentSubscription = null }) {
  const [selectedPeriod, setSelectedPeriod] = useState('monthly')
  const [includeNFC, setIncludeNFC] = useState(false)
  const [loading, setLoading] = useState(false)

  if (!isOpen) return null

  // NFC kart fiyatları
  const NFC_PRICE = 899

  // Plan fiyatları
  const planPricing = {
    professional: {
      monthly: 299,
      yearly: 2990
    },
    enterprise: {
      monthly: 999,
      yearly: 9990
    }
  }

  // Yenileme kontrolü: Kullanıcı daha önce NFC kart almış mı?
  const hasOrderedNFCBefore = currentSubscription?.nfc_cards_ordered > 0
  
  // Yenileme işlemiyse ve NFC kart almamışsa NFC seçeneğini göster
  const showNFCOption = !isRenewal || !hasOrderedNFCBefore

  // Seçilen plan fiyatı
  const planPrice = planPricing[selectedPlan]?.[selectedPeriod] || 0
  
  // NFC kart fiyatı (sadece gösterilmesi gerekiyorsa)
  const nfcPrice = (showNFCOption && includeNFC) ? NFC_PRICE : 0
  
  // Toplam fiyat
  const totalPrice = planPrice + nfcPrice

  // Yıllık indirim hesaplama
  const monthlyTotal = planPricing[selectedPlan]?.monthly * 12
  const yearlyDiscount = selectedPeriod === 'yearly' ? monthlyTotal - planPricing[selectedPlan]?.yearly : 0

  const handlePayment = async () => {
    try {
      setLoading(true)
      
      // Ödeme işlemi burada yapılacak
      // Şimdilik mock
      console.log('Ödeme başlatılıyor:', {
        plan: selectedPlan,
        period: selectedPeriod,
        includeNFC: showNFCOption ? includeNFC : false,
        totalPrice: totalPrice,
        isRenewal: isRenewal
      })

      // Başarılı ödeme sonrası
      alert(`${isRenewal ? 'Yenileme' : 'Ödeme'} başarılı! Toplam: ₺${totalPrice.toLocaleString('tr-TR')}`)
      onClose()
      
    } catch (error) {
      console.error('Ödeme hatası:', error)
      alert('Ödeme işlemi başarısız oldu.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        
        {/* Header */}
        <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              {isRenewal ? '🔄 Abonelik Yenileme' : '💳 Ödeme'}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {selectedPlan === 'professional' ? 'Professional' : 'Enterprise'} Plan
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          
          {/* Yenileme Uyarısı */}
          {isRenewal && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                ℹ️ Mevcut aboneliğinizi yeniliyorsunuz. Yeni dönem mevcut sürenizin bitiminde başlayacaktır.
              </p>
            </div>
          )}

          {/* Periyot Seçimi */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Abonelik Periyodu
            </label>
            <div className="grid grid-cols-2 gap-4">
              {/* Aylık */}
              <button
                onClick={() => setSelectedPeriod('monthly')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedPeriod === 'monthly'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    📅 Aylık
                  </span>
                  {selectedPeriod === 'monthly' && <Check size={18} className="text-blue-500" />}
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  ₺{planPricing[selectedPlan]?.monthly.toLocaleString('tr-TR')}
                  <span className="text-sm text-gray-500">/ay</span>
                </p>
              </button>

              {/* Yıllık */}
              <button
                onClick={() => setSelectedPeriod('yearly')}
                className={`p-4 rounded-xl border-2 transition-all relative ${
                  selectedPeriod === 'yearly'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                {yearlyDiscount > 0 && (
                  <div className="absolute -top-3 -right-3 bg-green-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                    ₺{yearlyDiscount.toLocaleString('tr-TR')} İndirim
                  </div>
                )}
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">
                    🎯 Yıllık
                  </span>
                  {selectedPeriod === 'yearly' && <Check size={18} className="text-blue-500" />}
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  ₺{planPricing[selectedPlan]?.yearly.toLocaleString('tr-TR')}
                  <span className="text-sm text-gray-500">/yıl</span>
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  Aylık ~₺{Math.round(planPricing[selectedPlan]?.yearly / 12).toLocaleString('tr-TR')}
                </p>
              </button>
            </div>
          </div>

          {/* NFC Kart Seçeneği - Sadece ilk alımda veya daha önce almamışsa göster */}
          {showNFCOption && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                NFC Kart (Opsiyonel)
              </label>
              <div 
                onClick={() => setIncludeNFC(!includeNFC)}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  includeNFC
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <CreditCard size={24} className={includeNFC ? 'text-purple-600' : 'text-gray-400'} />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        Premium NFC Kart Ekle
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Fiziksel akıllı kartvizit
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-purple-600">
                      +₺{NFC_PRICE.toLocaleString('tr-TR')}
                    </p>
                    {includeNFC && <Check size={18} className="text-purple-500 ml-auto mt-1" />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* NFC Kart Zaten Alınmış Bilgisi */}
          {!showNFCOption && isRenewal && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <p className="text-sm text-green-900 dark:text-green-100">
                ✅ NFC kartınız mevcut. Yenileme işleminde sadece abonelik ücretini ödeyeceksiniz.
              </p>
            </div>
          )}

          {/* Fiyat Özeti */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Fiyat Özeti
            </h3>
            
            {/* Plan Fiyatı */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {selectedPlan === 'professional' ? 'Professional' : 'Enterprise'} Plan
                ({selectedPeriod === 'yearly' ? 'Yıllık' : 'Aylık'})
              </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                ₺{planPrice.toLocaleString('tr-TR')}
              </span>
            </div>

            {/* NFC Kart (varsa) */}
            {showNFCOption && includeNFC && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">
                  Premium NFC Kart
                </span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  ₺{NFC_PRICE.toLocaleString('tr-TR')}
                </span>
              </div>
            )}

            {/* Divider */}
            <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  Toplam
                </span>
                <span className="text-2xl font-bold text-blue-600">
                  ₺{totalPrice.toLocaleString('tr-TR')}
                </span>
              </div>
            </div>
          </div>

          {/* Ödeme Butonu */}
          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                İşleniyor...
              </span>
            ) : (
              `${isRenewal ? 'Yenile' : 'Ödemeyi Tamamla'} - ₺${totalPrice.toLocaleString('tr-TR')}`
            )}
          </button>

          {/* Güvenlik Bilgisi */}
          <div className="text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              🔒 Güvenli ödeme altyapısı ile korunmaktasınız
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}