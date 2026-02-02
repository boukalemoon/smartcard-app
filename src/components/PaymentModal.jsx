import { useState } from 'react'
import { PaymentService, PayTRService, IyzicoService } from '../services/paymentService'
import { CreditCard, CheckCircle, AlertCircle } from 'lucide-react'

export default function PaymentModal({ plan, billingCycle, profile, onSuccess, onClose }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('paytr') // 'paytr' veya 'iyzico'

  const amount = PaymentService.calculatePrice(plan, billingCycle)
  const orderId = PaymentService.generateOrderId()

  const planNames = {
    professional: 'Profesyonel',
    stk: 'STK Özel',
    corporate: 'Kurumsal'
  }

  const handlePayment = async () => {
    setLoading(true)
    setError(null)

    try {
      const paymentData = {
        userEmail: profile.email,
        userPhone: profile.phone || '+905551234567',
        userName: profile.name || 'Kullanıcı',
        userAddress: 'Türkiye',
        userCity: 'Istanbul',
        amount: paymentMethod === 'paytr' ? amount * 100 : amount, // PayTR kuruş, iyzico TL
        orderId: orderId,
        productName: `Qartim ${planNames[plan]} - ${billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'}`,
        successUrl: `${window.location.origin}/payment/success?order=${orderId}`,
        failUrl: `${window.location.origin}/payment/fail?order=${orderId}`,
        callbackUrl: `${window.location.origin}/api/payment/callback`
      }

      if (paymentMethod === 'paytr') {
        // PayTR ile ödeme
        const token = await PayTRService.createPayment(paymentData)
        PayTRService.openPaymentIframe(token)
        
        // Ödeme tamamlandıktan sonra subscription güncelle
        // (Gerçekte callback'ten gelecek)
        setTimeout(async () => {
          await PaymentService.updateSubscriptionAfterPayment(
            profile.id,
            plan,
            billingCycle,
            amount
          )
          
          // Referral commission oluştur
          if (profile.referred_by) {
            await PaymentService.createReferralCommission(
              profile.referred_by,
              profile.id,
              plan,
              billingCycle,
              amount
            )
          }
          
          onSuccess()
        }, 5000)
        
      } else if (paymentMethod === 'iyzico') {
        // iyzico ile ödeme
        const result = await IyzicoService.createPayment(paymentData)
        IyzicoService.openCheckoutForm(result.checkoutFormContent)
        
        // Callback'ten sonra subscription güncelle
      }
    } catch (err) {
      console.error('Payment error:', err)
      setError(err.message || 'Ödeme başlatılamadı')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Ödeme
          </h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ✕
          </button>
        </div>

        {/* Plan Özeti */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-700 dark:text-gray-300 font-semibold">
              {planNames[plan]} Plan
            </span>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              {billingCycle === 'yearly' ? 'Yıllık' : 'Aylık'}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-gray-900 dark:text-white">
              ₺{amount.toLocaleString('tr-TR')}
            </span>
            <span className="text-gray-600 dark:text-gray-400">
              /{billingCycle === 'yearly' ? 'yıl' : 'ay'}
            </span>
          </div>
          
          {billingCycle === 'yearly' && (
            <div className="mt-3 flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
              <CheckCircle size={16} />
              <span>
                {plan === 'professional' && '1 NFC kart hediye'}
                {plan === 'stk' && '6 NFC kart hediye (Admin + 5 üye)'}
                {plan === 'corporate' && '10 NFC kart hediye'}
              </span>
            </div>
          )}
        </div>

        {/* Ödeme Yöntemi Seçimi */}
        <div className="mb-6">
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Ödeme Yöntemi
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setPaymentMethod('paytr')}
              className={`p-4 border-2 rounded-xl transition-all ${
                paymentMethod === 'paytr'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={20} className={paymentMethod === 'paytr' ? 'text-blue-600' : 'text-gray-600'} />
                <span className={`font-semibold ${paymentMethod === 'paytr' ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>
                  PayTR
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Tüm kartlar
              </p>
            </button>

            <button
              onClick={() => setPaymentMethod('iyzico')}
              className={`p-4 border-2 rounded-xl transition-all ${
                paymentMethod === 'iyzico'
                  ? 'border-blue-600 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <CreditCard size={20} className={paymentMethod === 'iyzico' ? 'text-blue-600' : 'text-gray-600'} />
                <span className={`font-semibold ${paymentMethod === 'iyzico' ? 'text-blue-900 dark:text-blue-100' : 'text-gray-700 dark:text-gray-300'}`}>
                  iyzico
                </span>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400">
                Güvenli ödeme
              </p>
            </button>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-2">
            <AlertCircle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
          >
            İptal
          </button>
          <button
            onClick={handlePayment}
            disabled={loading}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Yükleniyor...' : 'Ödemeye Geç'}
          </button>
        </div>

        {/* Info */}
        <p className="mt-4 text-xs text-center text-gray-500 dark:text-gray-400">
          Ödeme güvenli bir şekilde {paymentMethod === 'paytr' ? 'PayTR' : 'iyzico'} üzerinden yapılacaktır.
        </p>
      </div>
    </div>
  )
}