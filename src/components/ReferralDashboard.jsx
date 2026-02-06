import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Copy, Users, DollarSign, TrendingUp, Check, ExternalLink } from 'lucide-react'

export default function ReferralDashboard({ profile }) {
  const [referralCode, setReferralCode] = useState(null)
  const [stats, setStats] = useState({
    totalReferrals: 0,
    activeReferrals: 0,
    totalEarnings: 0,
    pendingEarnings: 0
  })
  const [referrals, setReferrals] = useState([])
  const [commissions, setCommissions] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (profile?.id) {
      loadReferralData()
    }
  }, [profile])

  const loadReferralData = async () => {
    try {
      setLoading(true)

      // Referral code'u getir veya oluştur
      let { data: codeData, error: codeError } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('profile_id', profile.id)
        .single()

      if (codeError && codeError.code === 'PGRST116') {
        // Kod yok, oluştur
        const newCode = generateReferralCode()
        const { data: newCodeData, error: createError } = await supabase
          .from('referral_codes')
          .insert({
            profile_id: profile.id,
            code: newCode
          })
          .select()
          .single()

        if (createError) throw createError
        codeData = newCodeData
      } else if (codeError) {
        throw codeError
      }

      setReferralCode(codeData)

      // Referral'ları getir
      const { data: referralsData, error: referralsError } = await supabase
        .from('referrals')
        .select(`
          *,
          referee:profiles!referrals_referee_id_fkey(name, email)
        `)
        .eq('referrer_id', profile.id)
        .order('created_at', { ascending: false })

      if (referralsError) throw referralsError
      setReferrals(referralsData || [])

      // Komisyonları getir
      const { data: commissionsData, error: commissionsError } = await supabase
        .from('commissions')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })

      if (commissionsError) throw commissionsError
      setCommissions(commissionsData || [])

      // İstatistikleri hesapla
      const totalEarnings = commissionsData?.filter(c => c.status === 'paid' || c.status === 'approved').reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0
      const pendingEarnings = commissionsData?.filter(c => c.status === 'pending').reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0
      
      setStats({
        totalReferrals: referralsData?.length || 0,
        activeReferrals: referralsData?.filter(r => r.status === 'active').length || 0,
        totalEarnings,
        pendingEarnings
      })
      console.log('📊 Commissions Data:', commissionsData)
      console.log('💰 Total Earnings:', totalEarnings)
      console.log('⏳ Pending Earnings:', pendingEarnings)
    } catch (error) {
      console.error('Error loading referral data:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateReferralCode = () => {
    const name = profile.name?.toLowerCase().replace(/\s+/g, '') || 'user'
    const random = Math.random().toString(36).substring(2, 6).toUpperCase()
    return `${name}-${random}`
  }

  const copyReferralLink = () => {
    const link = `${window.location.origin}/?ref=${referralCode?.code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
      active: { label: 'Aktif', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      completed: { label: 'Tamamlandı', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' }
    }
    return badges[status] || badges.pending
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Referans Sistemi</h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Arkadaşlarını davet et, kazanç elde et!
        </p>
      </div>

      {/* Referral Link */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
          Senin Referans Linkin
        </h3>
        <div className="flex gap-2">
          <input
            type="text"
            value={`${window.location.origin}/?ref=${referralCode?.code}`}
            readOnly
            className="flex-1 px-4 py-2 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={copyReferralLink}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Kopyalandı!' : 'Kopyala'}
          </button>
        </div>
        <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
          📌 Referans kodun: <strong>{referralCode?.code}</strong>
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4 mb-6">
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Toplam Davet</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.totalReferrals}</p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Aktif</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats.activeReferrals}</p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Kazanç</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">₺{stats.totalEarnings.toFixed(2)}</p>
        </div>

        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-yellow-600" />
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Bekleyen</span>
          </div>
          <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">₺{stats.pendingEarnings.toFixed(2)}</p>
        </div>
      </div>

      {/* Referrals List */}
      <div className="mb-6">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">Davetlerim</h3>
        {referrals.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users size={48} className="mx-auto mb-3 opacity-50" />
            <p>Henüz davet ettiğin kimse yok</p>
            <p className="text-sm mt-1">Yukarıdaki linki paylaş ve kazanmaya başla!</p>
          </div>
        ) : (
          <div className="space-y-3">
            {referrals.map((ref) => {
              const statusBadge = getStatusBadge(ref.status)
              return (
                <div key={ref.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">
                        {ref.referee?.name || 'İsimsiz Kullanıcı'}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">{ref.referee?.email}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                        {new Date(ref.created_at).toLocaleDateString('tr-TR')}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${statusBadge.color}`}>
                        {statusBadge.label}
                      </span>
                      {ref.commission_amount > 0 && (
                        <p className="text-sm font-bold text-green-600 dark:text-green-400 mt-2">
                          +₺{parseFloat(ref.commission_amount).toFixed(2)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">💰 Nasıl Kazanılır?</h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Referans linkini paylaş</li>
          <li>• Arkadaşın kayıt olup ücretli plana geçsin</li>
          <li>• Sen komisyon kazan!</li>
          <li>• Kazancını istediğin zaman çek</li>
        </ul>
      </div>
    </div>
  )
}