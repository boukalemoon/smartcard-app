import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Users, TrendingUp, Gift, Copy, Check, RefreshCw } from 'lucide-react'

export default function ReferralDashboard({ profile }) {
  const [referralCode, setReferralCode] = useState(null)
  const [referrals, setReferrals] = useState([])
  const [stats, setStats] = useState({ total: 0, active: 0, earnings: 0 })
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    if (profile?.id) {
      fetchReferralData()
    }
  }, [profile?.id])

  const fetchReferralData = async () => {
    try {
      setLoading(true)

      // referral_codes tablosundan kodu al
      const { data: codeData } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (codeData) {
        setReferralCode(codeData)
      }

      // Referral istatistikleri
      const { data: referralList } = await supabase
        .from('referrals')
        .select(`
          *,
          referee:profiles!referrals_referee_id_fkey(
            name, email, subscription_plan
          )
        `)
        .eq('referrer_id', profile.id)

      if (referralList) {
        setReferrals(referralList)

        const total = referralList.length
        const active = referralList.filter(r => r.status === 'active').length
        const earnings = referralList.reduce((sum, r) => sum + (r.commission_amount || 0), 0)

        setStats({ total, active, earnings })
      }
    } catch (error) {
      console.error('Referral data error:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateReferralCode = async () => {
    setGenerating(true)
    try {
      // Kullanıcı adından kişiye özel kod oluştur
      const baseName = (profile.name || profile.email.split('@')[0])
        .toLowerCase()
        .replace(/\s+/g, '')
        .replace(/[^a-z0-9]/g, '')
        .substring(0, 10)

      const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase()
      const code = `${baseName}-${randomSuffix}`

      const { data, error } = await supabase
        .from('referral_codes')
        .insert({
          profile_id: profile.id,
          code: code,
          usage_count: 0,
          total_earnings: 0
        })
        .select()
        .single()

      if (error) throw error

      setReferralCode(data)
    } catch (error) {
      alert('Kod oluşturulamadı: ' + error.message)
    } finally {
      setGenerating(false)
    }
  }

  const copyReferralLink = () => {
    if (!referralCode) return
    const link = `${window.location.origin}/signup?ref=${referralCode.code}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const copyCode = () => {
    if (!referralCode) return
    navigator.clipboard.writeText(referralCode.code)
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
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-blue-600" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Toplam Davet</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.total}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center mb-4">
            <TrendingUp className="w-6 h-6 text-green-600" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Aktif Davet</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.active}</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center mb-4">
            <Gift className="w-6 h-6 text-purple-600" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Toplam Kazanç</p>
          <p className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            ₺{stats.earnings.toLocaleString('tr-TR', { minimumFractionDigits: 0 })}
          </p>
        </div>
      </div>

      {/* Referral Kodu */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
          Referral Kodunuz
        </h3>

        {referralCode ? (
          <div className="space-y-4">
            {/* Kişiye özel kod */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Referral Kodunuz</p>
              <div className="flex gap-3">
                <div className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-2 border-blue-200 dark:border-blue-700 rounded-lg">
                  <span className="font-mono font-bold text-blue-700 dark:text-blue-300 text-lg tracking-wider">
                    {referralCode.code}
                  </span>
                </div>
                <button
                  onClick={copyCode}
                  className="px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2"
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                </button>
              </div>
            </div>

            {/* Davet linki */}
            <div>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Davet Linki</p>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={`${window.location.origin}/signup?ref=${referralCode.code}`}
                  readOnly
                  className="flex-1 px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-600 dark:text-gray-300"
                />
                <button
                  onClick={copyReferralLink}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-semibold transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  {copied ? (
                    <><Check size={18} /> Kopyalandı</>
                  ) : (
                    <><Copy size={18} /> Kopyala</>
                  )}
                </button>
              </div>
            </div>

            {/* Kullanım istatistiği */}
            <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 pt-2 border-t border-gray-100 dark:border-gray-700">
              <span>📊 Kullanım: <strong>{referralCode.usage_count || 0}</strong></span>
              <span>💰 Kazanç: <strong>₺{(referralCode.total_earnings || 0).toLocaleString('tr-TR')}</strong></span>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              Henüz referral kodunuz yok. Kişiye özel kodunuzu oluşturun!
            </p>
            <button
              onClick={generateReferralCode}
              disabled={generating}
              className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all disabled:opacity-50 flex items-center gap-2 mx-auto"
            >
              {generating ? (
                <><RefreshCw size={18} className="animate-spin" /> Oluşturuluyor...</>
              ) : (
                <><Gift size={18} /> Referral Kodu Oluştur</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Davet Listesi */}
      {referrals.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg">
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
            Davet Ettiğiniz Kullanıcılar
          </h3>
          <div className="space-y-3">
            {referrals.map((referral) => (
              <div
                key={referral.id}
                className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                    {referral.referee?.name?.charAt(0) || '?'}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                      {referral.referee?.name || 'Kullanıcı'}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {referral.referee?.email}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600 text-sm">
                    ₺{(referral.commission_amount || 0).toLocaleString('tr-TR')}
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
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-3">
          ℹ️ Nasıl Çalışır?
        </h4>
        <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-200">
          <li>• Referral kodunuzu veya linkinizi arkadaşlarınızla paylaşın</li>
          <li>• Kodunuzla kayıt olup abonelik satın aldıklarında %10 kazanç elde edersiniz</li>
          <li>• Aylık abonelikler için aylık, yıllık abonelikler için yıllık kazanç alırsınız</li>
        </ul>
      </div>
    </div>
  )
}