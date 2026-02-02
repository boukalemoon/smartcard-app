import CryptoJS from 'crypto-js'

// ============================================
// PAYTR ENTEGRASYONU
// ============================================

export const PayTRService = {
  /**
   * PayTR ödeme formu oluştur
   * @param {Object} paymentData - Ödeme bilgileri
   * @returns {Promise<string>} - PayTR iframe token
   */
  createPayment: async (paymentData) => {
    const {
      userEmail,
      userPhone,
      userName,
      amount, // Kuruş cinsinden (örn: 29900 = 299TL)
      orderId,
      productName,
      successUrl,
      failUrl,
      callbackUrl
    } = paymentData

    const merchantId = import.meta.env.VITE_PAYTR_MERCHANT_ID
    const merchantKey = import.meta.env.VITE_PAYTR_MERCHANT_KEY
    const merchantSalt = import.meta.env.VITE_PAYTR_MERCHANT_SALT

    // PayTR hash oluştur
    const hashStr = `${merchantId}${userEmail}${orderId}${amount}${successUrl}${failUrl}${productName}${callbackUrl}${merchantSalt}`
    const paytrToken = CryptoJS.HmacSHA256(hashStr, merchantKey).toString(CryptoJS.enc.Base64)

    // PayTR API isteği
    const requestData = {
      merchant_id: merchantId,
      user_ip: '127.0.0.1', // Gerçek IP backend'den alınmalı
      merchant_oid: orderId,
      email: userEmail,
      payment_amount: amount,
      paytr_token: paytrToken,
      user_basket: JSON.stringify([[productName, amount, 1]]),
      debug_on: 1, // Test modunda 1, canlıda 0
      no_installment: 0, // Taksit: 0 = var, 1 = yok
      max_installment: 12,
      user_name: userName,
      user_address: 'Türkiye',
      user_phone: userPhone,
      merchant_ok_url: successUrl,
      merchant_fail_url: failUrl,
      timeout_limit: 30,
      currency: 'TL',
      test_mode: 1, // Test modunda 1, canlıda 0
      lang: 'tr'
    }

    try {
      // PayTR'ye POST isteği (backend'den yapılmalı!)
      const response = await fetch('https://www.paytr.com/odeme/api/get-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams(requestData)
      })

      const result = await response.json()

      if (result.status === 'success') {
        return result.token
      } else {
        throw new Error(result.reason || 'PayTR hatası')
      }
    } catch (error) {
      console.error('PayTR Error:', error)
      throw error
    }
  },

  /**
   * PayTR iframe'i aç
   * @param {string} token - PayTR token
   */
  openPaymentIframe: (token) => {
    const iframe = document.createElement('iframe')
    iframe.src = `https://www.paytr.com/odeme/guvenli/${token}`
    iframe.id = 'paytriframe'
    iframe.style.width = '100%'
    iframe.style.height = '100%'
    iframe.style.border = 'none'
    iframe.style.position = 'fixed'
    iframe.style.top = '0'
    iframe.style.left = '0'
    iframe.style.zIndex = '9999'
    
    document.body.appendChild(iframe)

    // Kapatma butonu ekle
    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '✕'
    closeBtn.style.position = 'fixed'
    closeBtn.style.top = '20px'
    closeBtn.style.right = '20px'
    closeBtn.style.zIndex = '10000'
    closeBtn.style.background = 'white'
    closeBtn.style.border = '2px solid #ccc'
    closeBtn.style.borderRadius = '50%'
    closeBtn.style.width = '40px'
    closeBtn.style.height = '40px'
    closeBtn.style.cursor = 'pointer'
    closeBtn.onclick = () => {
      document.body.removeChild(iframe)
      document.body.removeChild(closeBtn)
    }
    
    document.body.appendChild(closeBtn)
  }
}

// ============================================
// IYZICO ENTEGRASYONU
// ============================================

export const IyzicoService = {
  /**
   * iyzico ödeme formu oluştur
   * @param {Object} paymentData - Ödeme bilgileri
   * @returns {Promise<Object>} - iyzico checkout form
   */
  createPayment: async (paymentData) => {
    const {
      userEmail,
      userPhone,
      userName,
      userAddress,
      userCity,
      userCountry = 'Turkey',
      amount, // TL cinsinden (örn: 299.00)
      orderId,
      productName,
      callbackUrl
    } = paymentData

    const apiKey = import.meta.env.VITE_IYZICO_API_KEY
    const secretKey = import.meta.env.VITE_IYZICO_SECRET_KEY

    // iyzico request
    const requestData = {
      locale: 'tr',
      conversationId: orderId,
      price: amount.toFixed(2),
      paidPrice: amount.toFixed(2),
      currency: 'TRY',
      basketId: orderId,
      paymentGroup: 'SUBSCRIPTION',
      callbackUrl: callbackUrl,
      enabledInstallments: [1, 2, 3, 6, 9, 12],
      buyer: {
        id: 'BY' + Date.now(),
        name: userName.split(' ')[0] || userName,
        surname: userName.split(' ')[1] || 'User',
        gsmNumber: userPhone,
        email: userEmail,
        identityNumber: '11111111111', // Gerçek TCKN kullanılmalı
        registrationAddress: userAddress || 'Türkiye',
        ip: '127.0.0.1', // Gerçek IP backend'den alınmalı
        city: userCity || 'Istanbul',
        country: userCountry,
        zipCode: '34000'
      },
      shippingAddress: {
        contactName: userName,
        city: userCity || 'Istanbul',
        country: userCountry,
        address: userAddress || 'Türkiye',
        zipCode: '34000'
      },
      billingAddress: {
        contactName: userName,
        city: userCity || 'Istanbul',
        country: userCountry,
        address: userAddress || 'Türkiye',
        zipCode: '34000'
      },
      basketItems: [
        {
          id: 'BI' + orderId,
          name: productName,
          category1: 'Subscription',
          itemType: 'VIRTUAL',
          price: amount.toFixed(2)
        }
      ]
    }

    try {
      // iyzico API'ye POST isteği (BACKEND'DEN YAPILMALI!)
      // Bu kısım güvenlik açısından backend'de olmalı
      
      // ÖNEMLİ: Frontend'den direkt iyzico API'ye istek GÜVENLİ DEĞİL!
      // Aşağıdaki kod sadece yapı göstermek için
      
      const response = await fetch('/api/iyzico/create-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData)
      })

      const result = await response.json()

      if (result.status === 'success') {
        return result
      } else {
        throw new Error(result.errorMessage || 'iyzico hatası')
      }
    } catch (error) {
      console.error('iyzico Error:', error)
      throw error
    }
  },

  /**
   * iyzico checkout form'unu aç
   * @param {string} checkoutFormContent - iyzico form HTML
   */
  openCheckoutForm: (checkoutFormContent) => {
    const modal = document.createElement('div')
    modal.innerHTML = checkoutFormContent
    modal.style.position = 'fixed'
    modal.style.top = '0'
    modal.style.left = '0'
    modal.style.width = '100%'
    modal.style.height = '100%'
    modal.style.zIndex = '9999'
    modal.style.background = 'rgba(0,0,0,0.5)'
    
    document.body.appendChild(modal)
  }
}

// ============================================
// GENERIC PAYMENT HELPER
// ============================================

export const PaymentService = {
  /**
   * Plan fiyatını hesapla
   */
  calculatePrice: (plan, billingCycle) => {
    const prices = {
      free: { monthly: 0, yearly: 0 },
      professional: { monthly: 299, yearly: 2990 },
      stk: { monthly: 499, yearly: 4490 },
      corporate: { monthly: 999, yearly: 9990 }
    }

    return prices[plan]?.[billingCycle] || 0
  },

  /**
   * Sipariş ID oluştur
   */
  generateOrderId: () => {
    return 'QRT' + Date.now() + Math.random().toString(36).substr(2, 9).toUpperCase()
  },

  /**
   * Ödeme sonrası subscription güncelle
   */
  updateSubscriptionAfterPayment: async (profileId, plan, billingCycle, amount) => {
    const { supabase } = await import('../lib/supabaseClient')

    const expiresAt = billingCycle === 'yearly' 
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)

    const nfcCards = {
      free: 0,
      professional: billingCycle === 'yearly' ? 1 : 0,
      stk: billingCycle === 'yearly' ? 6 : 0,
      corporate: billingCycle === 'yearly' ? 10 : 0
    }

    const orgLimit = plan === 'free' ? 2 : plan === 'professional' ? 15 : 999
    const socialLimit = plan === 'free' ? 3 : 999

    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({
          plan: plan,
          billing_cycle: billingCycle,
          status: 'active',
          started_at: new Date().toISOString(),
          expires_at: expiresAt.toISOString(),
          organizations_limit: orgLimit,
          social_links_limit: socialLimit,
          nfc_cards_included: nfcCards[plan],
          amount_paid: amount,
          updated_at: new Date().toISOString()
        })
        .eq('profile_id', profileId)

      if (error) throw error
      return true
    } catch (error) {
      console.error('Subscription update error:', error)
      return false
    }
  },

  /**
   * Referral commission oluştur
   */
  createReferralCommission: async (referrerId, referredId, plan, billingCycle, amount) => {
    if (!referrerId) return

    const { supabase } = await import('../lib/supabaseClient')

    const commissionRate = 10 // %10
    const commissionAmount = (amount * commissionRate) / 100

    try {
      const { error } = await supabase
        .from('referral_transactions')
        .insert({
          referrer_id: referrerId,
          referred_id: referredId,
          transaction_type: 'subscription',
          amount: amount,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          plan_type: plan,
          billing_cycle: billingCycle,
          status: 'approved'
        })

      if (error) throw error
      return true
    } catch (error) {
      console.error('Referral commission error:', error)
      return false
    }
  }
}

export default PaymentService