import { exportToCSV, verifyPasswordForExport } from '../utils/exportHelpers'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Users, DollarSign, CreditCard, TrendingUp, Search, RefreshCw, Trash2, Shield, ShieldOff } from 'lucide-react'

export default function AdminCRM() {
  const [users, setUsers] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [commissions, setCommissions] = useState([])
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('users')
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')
  const [actionLoading, setActionLoading] = useState(null)
  const [stats, setStats] = useState({ totalUsers: 0, activeSubscriptions: 0, totalRevenue: 0, pendingCommissions: 0 })

  useEffect(() => { loadAllData() }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)
      const { data: usersData } = await supabase.from('profiles').select('*').order('created_at', { ascending: false })
      const { data: subsData } = await supabase.from('subscriptions').select('*, profiles(name, email)').order('created_at', { ascending: false })
      const { data: commissionsData } = await supabase.from('commissions').select('*, profiles(name, email)').order('created_at', { ascending: false })
      const { data: referralsData } = await supabase.from('referrals').select('*, referrer:profiles!referrals_referrer_id_fkey(name, email), referee:profiles!referrals_referee_id_fkey(name, email)').order('created_at', { ascending: false })

      setUsers(usersData || [])
      setSubscriptions(subsData || [])
      setCommissions(commissionsData || [])
      setReferrals(referralsData || [])

      const activeSubsCount = subsData?.filter(s => s.status === 'active' && s.plan !== 'free').length || 0
      const totalRevenue = subsData?.filter(s => s.status === 'active' && s.plan !== 'free').reduce((sum, s) => {
        const prices = { student: 99, professional: 249, stk: 449, business: 899 }
        return sum + (prices[s.plan] || 0)
      }, 0) || 0
      const pendingComm = commissionsData?.filter(c => c.status === 'pending' || c.status === 'approved').reduce((sum, c) => sum + parseFloat(c.amount || 0), 0) || 0

      setStats({ totalUsers: usersData?.length || 0, activeSubscriptions: activeSubsCount, totalRevenue, pendingCommissions: pendingComm })
    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (user) => {
    if (!confirm(`"${user.name || user.email}" kullanıcısını silmek istediğinize emin misiniz?\n\nBu işlem geri alınamaz!`)) return
    setActionLoading(user.id)
    try {
      // Önce bağlı tabloları temizle
      await supabase.from('referrals').delete().or(`referrer_id.eq.${user.id},referee_id.eq.${user.id}`)
      await supabase.from('social_links').delete().eq('profile_id', user.id)
      await supabase.from('members').delete().eq('profile_id', user.id)
      await supabase.from('subscriptions').delete().eq('profile_id', user.id)
      await supabase.from('referral_codes').delete().eq('profile_id', user.id)
      await supabase.from('profiles').delete().eq('id', user.id)
      setUsers(prev => prev.filter(u => u.id !== user.id))
      alert('✅ Kullanıcı silindi. Supabase Dashboard → Authentication → Users kısmından da auth kaydını silin.')
    } catch (error) {
      alert('Hata: ' + error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleChangeRole = async (user, newRole) => {
    if (!confirm(`"${user.name || user.email}" kullanıcısının rolünü "${newRole}" olarak değiştirmek istediğinize emin misiniz?`)) return
    setActionLoading(user.id)
    try {
      const { error } = await supabase.from('profiles').update({ role: newRole }).eq('id', user.id)
      if (error) throw error
      setUsers(prev => prev.map(u => u.id === user.id ? { ...u, role: newRole } : u))
      alert(`✅ Rol "${newRole}" olarak güncellendi!`)
    } catch (error) {
      alert('Hata: ' + error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleChangePlan = async (userId, newPlan) => {
    setActionLoading(userId)
    try {
      const { error } = await supabase.from('subscriptions').update({ plan: newPlan }).eq('profile_id', userId)
      if (error) throw error
      setSubscriptions(prev => prev.map(s => s.profile_id === userId ? { ...s, plan: newPlan } : s))
      alert(`✅ Plan "${newPlan}" olarak güncellendi!`)
    } catch (error) {
      alert('Hata: ' + error.message)
    } finally {
      setActionLoading(null)
    }
  }

  const handleExportUsers = async () => {
    const verified = await verifyPasswordForExport(supabase)
    if (!verified) return
    exportToCSV(users.map(u => ({ 'Ad Soyad': u.name, 'Email': u.email, 'Rol': u.role, 'Kayıt': new Date(u.created_at).toLocaleDateString('tr-TR') })), 'users')
  }

  const handleExportSubscriptions = async () => {
    const verified = await verifyPasswordForExport(supabase)
    if (!verified) return
    exportToCSV(subscriptions.map(s => ({ 'Kullanıcı': s.profiles?.name, 'Email': s.profiles?.email, 'Plan': s.plan, 'Durum': s.status, 'Tarih': new Date(s.created_at).toLocaleDateString('tr-TR') })), 'subscriptions')
  }

  const filteredUsers = users.filter(u => u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  const filteredSubscriptions = subscriptions.filter(s => {
    const matchSearch = s.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || s.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchPlan = filterPlan === 'all' || s.plan === filterPlan
    return matchSearch && matchPlan
  })

  if (loading) {
    return <div className="flex items-center justify-center min-h-[400px]"><div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin CRM</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Tüm kullanıcıları ve ödemeleri yönetin</p>
        </div>
        <button onClick={loadAllData} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm">
          <RefreshCw size={16} /> Yenile
        </button>
      </div>

      {/* Stats */}
      <div className="grid md:grid-cols-4 gap-4">
        {[
          { label: 'Toplam Kullanıcı', value: stats.totalUsers, icon: Users, color: 'blue' },
          { label: 'Aktif Abonelik', value: stats.activeSubscriptions, icon: CreditCard, color: 'green' },
          { label: 'Aylık Gelir', value: `₺${stats.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: 'purple' },
          { label: 'Bekleyen Komisyon', value: `₺${stats.pendingCommissions.toFixed(0)}`, icon: DollarSign, color: 'yellow' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className={`bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-${color}-500`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">{label}</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">{value}</p>
              </div>
              <Icon className={`w-10 h-10 text-${color}-600`} />
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
          {[
            { id: 'users', label: 'Kullanıcılar', count: users.length },
            { id: 'subscriptions', label: 'Abonelikler', count: subscriptions.length },
            { id: 'commissions', label: 'Komisyonlar', count: commissions.length },
            { id: 'referrals', label: 'Referanslar', count: referrals.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setSelectedTab(tab.id)}
              className={`px-4 py-2 font-semibold whitespace-nowrap transition-all ${selectedTab === tab.id ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600' : 'text-gray-600 dark:text-gray-400'}`}>
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Export */}
        <div className="flex gap-2 mb-4 flex-wrap">
          <button onClick={handleExportUsers} className="px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700">📥 Kullanıcılar</button>
          <button onClick={handleExportSubscriptions} className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700">📥 Abonelikler</button>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input type="text" placeholder="Ara..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100" />
          </div>
          {selectedTab === 'subscriptions' && (
            <select value={filterPlan} onChange={(e) => setFilterPlan(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
              <option value="all">Tüm Planlar</option>
              <option value="free">Başlangıç</option>
              <option value="student">Öğrenci</option>
              <option value="professional">Profesyonel</option>
              <option value="stk">STK</option>
              <option value="business">Kurumsal</option>
            </select>
          )}
        </div>

        {/* Users Tab */}
        {selectedTab === 'users' && (
          <div className="space-y-3">
            {filteredUsers.length === 0 && <p className="text-center text-gray-400 py-8">Kullanıcı bulunamadı</p>}
            {filteredUsers.map(user => (
              <div key={user.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{user.name || 'İsimsiz'}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                    <p className="text-xs text-gray-500 mt-1">Kayıt: {new Date(user.created_at).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'superadmin' ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' :
                      user.role === 'admin' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                      'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {user.role || 'user'}
                    </span>

                    {/* Rol değiştir */}
                    {user.role !== 'admin' && user.role !== 'superadmin' && (
                      <button onClick={() => handleChangeRole(user, 'admin')}
                        disabled={actionLoading === user.id}
                        className="flex items-center gap-1 px-2 py-1 bg-orange-100 text-orange-700 rounded-lg text-xs font-semibold hover:bg-orange-200 transition-colors disabled:opacity-50">
                        <Shield size={12} /> Admin Yap
                      </button>
                    )}
                    {(user.role === 'admin') && (
                      <button onClick={() => handleChangeRole(user, 'user')}
                        disabled={actionLoading === user.id}
                        className="flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold hover:bg-gray-200 transition-colors disabled:opacity-50">
                        <ShieldOff size={12} /> Admin Kaldır
                      </button>
                    )}

                    {/* Sil */}
                    {user.role !== 'superadmin' && (
                      <button onClick={() => handleDeleteUser(user)}
                        disabled={actionLoading === user.id}
                        className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 rounded-lg text-xs font-semibold hover:bg-red-200 transition-colors disabled:opacity-50">
                        <Trash2 size={12} />
                        {actionLoading === user.id ? '...' : 'Sil'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Subscriptions Tab */}
        {selectedTab === 'subscriptions' && (
          <div className="space-y-3">
            {filteredSubscriptions.length === 0 && <p className="text-center text-gray-400 py-8">Abonelik bulunamadı</p>}
            {filteredSubscriptions.map(sub => (
              <div key={sub.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{sub.profiles?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{sub.profiles?.email}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs rounded font-semibold">{sub.plan?.toUpperCase()}</span>
                      <span className={`px-2 py-1 text-xs rounded font-semibold ${sub.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>{sub.status}</span>
                    </div>
                  </div>
                  <div className="flex flex-col gap-2 items-end">
                    <p className="text-xs text-gray-500">{new Date(sub.created_at).toLocaleDateString('tr-TR')}</p>
                    <select
                      value={sub.plan}
                      onChange={(e) => handleChangePlan(sub.profile_id, e.target.value)}
                      disabled={actionLoading === sub.profile_id}
                      className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-xs"
                    >
                      <option value="free">Başlangıç</option>
                      <option value="student">Öğrenci</option>
                      <option value="professional">Profesyonel</option>
                      <option value="stk">STK</option>
                      <option value="business">Kurumsal</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Commissions Tab */}
        {selectedTab === 'commissions' && (
          <div className="space-y-3">
            {commissions.length === 0 && <p className="text-center text-gray-400 py-8">Komisyon bulunamadı</p>}
            {commissions.map(comm => (
              <div key={comm.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{comm.profiles?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{comm.description}</p>
                    <p className="text-xs text-gray-500 mt-1">{new Date(comm.created_at).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">₺{parseFloat(comm.amount || 0).toFixed(2)}</p>
                    <span className={`inline-block px-2 py-1 text-xs rounded mt-1 ${comm.status === 'paid' ? 'bg-green-100 text-green-800' : comm.status === 'approved' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {comm.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Referrals Tab */}
        {selectedTab === 'referrals' && (
          <div className="space-y-3">
            {referrals.length === 0 && <p className="text-center text-gray-400 py-8">Referans bulunamadı</p>}
            {referrals.map(ref => (
              <div key={ref.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{ref.referrer?.name}</span>
                      {' → '}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{ref.referee?.name}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-1">Kod: {ref.referral_code} • {new Date(ref.created_at).toLocaleDateString('tr-TR')}</p>
                  </div>
                  <div className="text-right">
                    <span className={`px-2 py-1 text-xs rounded ${ref.status === 'active' ? 'bg-green-100 text-green-800' : ref.status === 'completed' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'}`}>
                      {ref.status}
                    </span>
                    {ref.commission_amount > 0 && <p className="text-sm font-semibold text-green-600 mt-1">+₺{parseFloat(ref.commission_amount).toFixed(2)}</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}