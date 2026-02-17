import { useState } from 'react'
import { X, CreditCard, Check } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

export default function PaymentModal({ isOpen, onClose, selectedPlan, isRenewal = false, currentSubscription = null, profile }) {
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

  // Yenileme kontrolü
  const hasOrderedNFCBefore = currentSubscription?.nfc_cards_used > 0
  const showNFCOption = !isRenewal || !hasOrderedNFCBefore

  const planPrice = planPricing[selectedPlan]?.[selectedPeriod] || 0
  const nfcPrice = (showNFCOption && includeNFC) ? NFC_PRICE : 0
  const totalPrice = planPrice + nfcPrice

  const monthlyTotal = planPricing[selectedPlan]?.monthly * 12
  const yearlyDiscount = selectedPeriod === 'yearly' ? monthlyTotal - planPricing[selectedPlan]?.yearly : 0

  // Plan ile gelen NFC kart sayısı
  const getPlanNFCCards = () => {
    if (selectedPeriod !== 'yearly') return 0
    return selectedPlan === 'professional' ? 1 : selectedPlan === 'enterprise' ? 10 : 0
  }

  // ⭐ NFC KART TRACKING FONKSİYONU
  const updateNFCCardTracking = async () => {
    try {
      const planNFCCards = getPlanNFCCards()
      const extraNFCCards = (showNFCOption && includeNFC) ? 1 : 0
      const totalNFCCards = planNFCCards + extraNFCCards

      if (totalNFCCards > 0 && profile?.id) {
        const { error } = await supabase
          .from('subscriptions')
          .update({
            nfc_cards_used: totalNFCCards,
            updated_at: new Date().toISOString()
          })
          .eq('profile_id', profile.id)

        if (error) {
          console.error('❌ NFC tracking error:', error)
        } else {
          console.log('✅ NFC Cards tracked:', totalNFCCards)
        }
      }
    } catch (error) {
      console.error('❌ NFC tracking failed:', error)
    }
  }

  const handlePayment = async () => {
    try {
      setLoading(true)
      
      console.log('💳 Ödeme başlatılıyor:', {
        plan: selectedPlan,
        period: selectedPeriod,
        includeNFC: showNFCOption ? includeNFC : false,
        totalPrice: totalPrice,
        isRenewal: isRenewal
      })

      // Mock ödeme başarılı
      const paymentSuccess = true

      if (paymentSuccess) {
        // ⭐ NFC KART TRACKING
        await updateNFCCardTracking()
        
        alert(`${isRenewal ? 'Yenileme' : 'Ödeme'} başarılı! Toplam: ₺${totalPrice.toLocaleString('tr-TR')}`)
        onClose()
        window.location.reload()
      }
      
    } catch (error) {
      console.error('❌ Ödeme hatası:', error)
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
          
          {isRenewal && (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
              <p className="text-sm text-blue-900 dark:text-blue-100">
                ℹ️ Mevcut aboneliğinizi yeniliyorsunuz.
              </p>
            </div>
          )}

          {/* Periyot Seçimi */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Abonelik Periyodu
            </label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedPeriod('monthly')}
                className={`p-4 rounded-xl border-2 transition-all ${
                  selectedPeriod === 'monthly'
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-gray-900 dark:text-gray-100">📅 Aylık</span>
                  {selectedPeriod === 'monthly' && <Check size={18} className="text-blue-500" />}
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  ₺{planPricing[selectedPlan]?.monthly.toLocaleString('tr-TR')}
                  <span className="text-sm text-gray-500">/ay</span>
                </p>
              </button>

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
                  <span className="font-semibold text-gray-900 dark:text-gray-100">🎯 Yıllık</span>
                  {selectedPeriod === 'yearly' && <Check size={18} className="text-blue-500" />}
                </div>
                <p className="text-2xl font-bold text-blue-600">
                  ₺{planPricing[selectedPlan]?.yearly.toLocaleString('tr-TR')}
                  <span className="text-sm text-gray-500">/yıl</span>
                </p>
                {getPlanNFCCards() > 0 && (
                  <div className="mt-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg p-2">
                    <p className="text-xs font-semibold text-yellow-800 dark:text-yellow-200">
                      🎁 {getPlanNFCCards()} NFC Kart Hediye!
                    </p>
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* NFC Kart */}
          {showNFCOption && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Ekstra NFC Kart (Opsiyonel)
              </label>
              <div 
                onClick={() => setIncludeNFC(!includeNFC)}
                className={`p-4 rounded-xl border-2 transition-all cursor-pointer ${
                  includeNFC
                    ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <CreditCard size={24} className={includeNFC ? 'text-purple-600' : 'text-gray-400'} />
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">Ekstra Premium NFC Kart</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Fiziksel akıllı kartvizit</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-bold text-purple-600">+₺{NFC_PRICE.toLocaleString('tr-TR')}</p>
                    {includeNFC && <Check size={18} className="text-purple-500 ml-auto mt-1" />}
                  </div>
                </div>
              </div>
            </div>
          )}

          {!showNFCOption && isRenewal && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <p className="text-sm text-green-900 dark:text-green-100">
                ✅ NFC kartınız mevcut.
              </p>
            </div>
          )}

          {/* Fiyat Özeti */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 space-y-3">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Fiyat Özeti</h3>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600 dark:text-gray-400">
                {selectedPlan === 'professional' ? 'Professional' : 'Enterprise'} Plan
                ({selectedPeriod === 'yearly' ? 'Yıllık' : 'Aylık'})
              </span>
              <span className="font-semibold text-gray-900 dark:text-gray-100">
                ₺{planPrice.toLocaleString('tr-TR')}
              </span>
            </div>

            {getPlanNFCCards() > 0 && (
              <div className="flex items-center justify-between text-sm bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded">
                <span className="text-yellow-700 dark:text-yellow-300 flex items-center gap-1">
                  <span>🎁</span> {getPlanNFCCards()} NFC Kart (Hediye)
                </span>
                <span className="font-semibold text-green-600 dark:text-green-400">ÜCRETSİZ</span>
              </div>
            )}

            {showNFCOption && includeNFC && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600 dark:text-gray-400">Ekstra Premium NFC Kart</span>
                <span className="font-semibold text-gray-900 dark:text-gray-100">₺{NFC_PRICE.toLocaleString('tr-TR')}</span>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-gray-600 pt-3">
              <div className="flex items-center justify-between">
                <span className="text-lg font-bold text-gray-900 dark:text-gray-100">Toplam</span>
                <span className="text-2xl font-bold text-blue-600">₺{totalPrice.toLocaleString('tr-TR')}</span>
              </div>
            </div>
          </div>

          <button
            onClick={handlePayment}
            disabled={loading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold text-lg transition-all disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                İşleniyor...
              </span>
            ) : (
              `${isRenewal ? 'Yenile' : 'Ödemeyi Tamamla'} - ₺{totalPrice.toLocaleString('tr-TR')}`
            )}
          </button>

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