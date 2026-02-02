import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Copy, Users, TrendingUp, DollarSign, Check } from 'lucide-react'

export default function ReferralDashboard({ profile }) {
  const [stats, setStats] = useState({
    referralCount: 0,
    earnings: 0,
    transactions: []
  })
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  const referralLink = `${window.location.origin}/?ref=${profile.referral_code}`

  useEffect(() => {
    loadReferralStats()
  }, [profile.id])

  const loadReferralStats = async () => {
    try {
      // Profil bilgilerini yenile (referral_count ve referral_earnings)
      const { data: profileData } = await supabase
        .from('profiles')
        .select('referral_count, referral_earnings')
        .eq('id', profile.id)
        .single()

      // Transaction'ları getir
      const { data: transactions } = await supabase
        .from('referral_transactions')
        .select('*')
        .eq('referrer_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(5)

      setStats({
        referralCount: profileData?.referral_count || 0,
        earnings: profileData?.referral_earnings || 0,
        transactions: transactions || []
      })
    } catch (error) {
      console.error('Referral stats error:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Referral Programı
        </h2>
        <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-sm font-semibold rounded-full">
          %10 Komisyon
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Users className="text-blue-600 dark:text-blue-400" size={20} />
            <span className="text-sm text-blue-900 dark:text-blue-100 font-semibold">Davetliler</span>
          </div>
          <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
            {stats.referralCount}
          </div>
        </div>

        <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-xl border border-green-200 dark:border-green-800">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="text-green-600 dark:text-green-400" size={20} />
            <span className="text-sm text-green-900 dark:text-green-100 font-semibold">Kazanç</span>
          </div>
          <div className="text-2xl font-bold text-green-900 dark:text-green-100">
            ₺{stats.earnings.toFixed(2)}
          </div>
        </div>

        <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-xl border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="text-purple-600 dark:text-purple-400" size={20} />
            <span className="text-sm text-purple-900 dark:text-purple-100 font-semibold">İşlemler</span>
          </div>
          <div className="text-2xl font-bold text-purple-900 dark:text-purple-100">
            {stats.transactions.length}
          </div>
        </div>
      </div>

      {/* Referral Link */}
      <div className="mb-6">
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Davet Linkin
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={referralLink}
            readOnly
            className="flex-1 px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl outline-none font-mono text-sm"
          />
          <button
            onClick={copyToClipboard}
            className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all flex items-center gap-2"
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

      {/* How it works */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-4 rounded-xl border border-blue-200 dark:border-blue-800 mb-6">
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
          Nasıl Çalışır?
        </h3>
        <ol className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">1.</span>
            <span>Davet linkini arkadaşlarınla paylaş</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">2.</span>
            <span>Arkadaşın linkinle kayıt olsun</span>
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-blue-600">3.</span>
            <span>Premium plana geçtiğinde %10 komisyon kazan!</span>
          </li>
        </ol>
      </div>

      {/* Commission Table */}
      <div>
        <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
          Komisyon Oranları
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-700 dark:text-gray-300">Profesyonel (Yıllık)</span>
            <span className="font-bold text-green-600 dark:text-green-400">₺299</span>
          </div>
          <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-700 dark:text-gray-300">STK Özel (Yıllık)</span>
            <span className="font-bold text-green-600 dark:text-green-400">₺449</span>
          </div>
          <div className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <span className="text-gray-700 dark:text-gray-300">Kurumsal (Yıllık)</span>
            <span className="font-bold text-green-600 dark:text-green-400">₺999</span>
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      {stats.transactions.length > 0 && (
        <div className="mt-6">
          <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-3">
            Son İşlemler
          </h3>
          <div className="space-y-2">
            {stats.transactions.map((tx) => (
              <div 
                key={tx.id} 
                className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm"
              >
                <div>
                  <div className="font-semibold text-gray-900 dark:text-gray-100">
                    {tx.transaction_type === 'subscription' && 'Abonelik'}
                    {tx.transaction_type === 'upgrade' && 'Yükseltme'}
                    {tx.transaction_type === 'renewal' && 'Yenileme'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {new Date(tx.created_at).toLocaleDateString('tr-TR')}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-green-600 dark:text-green-400">
                    +₺{tx.commission_amount.toFixed(2)}
                  </div>
                  <div className={`text-xs ${
                    tx.status === 'approved' ? 'text-green-600' :
                    tx.status === 'pending' ? 'text-yellow-600' :
                    'text-gray-600'
                  }`}>
                    {tx.status === 'approved' && 'Onaylandı'}
                    {tx.status === 'pending' && 'Bekliyor'}
                    {tx.status === 'paid' && 'Ödendi'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}