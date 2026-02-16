import { useState, useEffect } from 'react'
import { Users, TrendingUp, Gift, Copy, Check } from 'lucide-react'

export default function ReferralDashboard({ userId }) {
  const [referralData, setReferralData] = useState(null)
  const [referralCode, setReferralCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReferralData()
  }, [userId])

  const fetchReferralData = async () => {
    try {
      setLoading(true)
      
      // API endpoint'ten referral verilerini al
      const response = await fetch(`/api/referrals/${userId}`)
      if (!response.ok) throw new Error('Referral verileri alınamadı')
      
      const data = await response.json()
      
      setReferralCode(data.referralCode)
      setReferralData(data.stats)
      
    } catch (error) {
      console.error('Referral verileri alınamadı:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyReferralLink = () => {
    const link = `${window.location.origin}/signup?ref=${referralCode}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl p-6 text-white">
        <h2 className="text-2xl font-bold mb-2">🎁 Referral Programı</h2>
        <p className="text-blue-100">
          Arkadaşlarını davet et, her abonelik için %10 kazanç elde et!
        </p>
      </div>

      {/* İstatistikler */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Toplam Davet</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {referralData?.totalReferrals || 0}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-green-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Aktif Davet</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            {referralData?.activeReferrals || 0}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
              <Gift className="w-6 h-6 text-purple-600" />
            </div>
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Toplam Kazanç (Aylık)</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            ₺{(referralData?.totalEarnings || 0).toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Referral Linki */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Referral Linkiniz
        </h3>
        <div className="flex gap-3">
          <input
            type="text"
            value={`${window.location.origin}/signup?ref=${referralCode}`}
            readOnly
            className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm"
          />
          <button
            onClick={copyReferralLink}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
          >
            {copied ? (
              <>
                <Check size={18} />
                Kopyalandı
              </>
            ) : (
              <>
                <Copy size={18} />
                Kopyala
              </>
            )}
          </button>
        </div>
      </div>

      {/* Referral Listesi */}
      {referralData?.referralsList && referralData.referralsList.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
            Davet Ettiğiniz Kullanıcılar
          </h3>
          <div className="space-y-3">
            {referralData.referralsList.map((referral) => (
              <div
                key={referral.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                    {referral.referred_user?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">
                      {referral.referred_user?.name || 'Kullanıcı'}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {referral.referred_user?.subscription_tier === 'professional' ? 'Professional' : 'Enterprise'}
                      {' - '}
                      {referral.period === 'yearly' ? '🎯 Yıllık' : '📅 Aylık'}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    ₺{referral.earning.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
                    <span className="text-xs text-gray-500 ml-1">
                      {referral.period === 'yearly' ? '/ yıl' : '/ ay'}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {referral.status === 'active' ? '✅ Aktif' : '⏳ Beklemede'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bilgilendirme */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-6">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          ℹ️ Nasıl Çalışır?
        </h4>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li>• Referral linkinizi arkadaşlarınızla paylaşın</li>
          <li>• Linkiniz üzerinden kayıt olup abonelik satın aldıklarında %10 kazanç elde edersiniz</li>
          <li>• Aylık abonelikler için aylık kazanç, yıllık abonelikler için yıllık kazanç alırsınız</li>
          <li>• Kazançlarınız her ay hesabınıza aktarılır</li>
          <li>• Minimum 100 TL kazanç biriktikten sonra ödeme talep edebilirsiniz</li>
        </ul>
      </div>
    </div>
  )
}