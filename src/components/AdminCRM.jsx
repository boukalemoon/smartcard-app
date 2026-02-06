import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { 
  Users, DollarSign, CreditCard, TrendingUp, 
  Search, Filter, ChevronDown, Check, X, Eye 
} from 'lucide-react'

export default function AdminCRM() {
  const [users, setUsers] = useState([])
  const [subscriptions, setSubscriptions] = useState([])
  const [commissions, setCommissions] = useState([])
  const [referrals, setReferrals] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedTab, setSelectedTab] = useState('users') // users, subscriptions, commissions, referrals
  const [searchTerm, setSearchTerm] = useState('')
  const [filterPlan, setFilterPlan] = useState('all')

  const [stats, setStats] = useState({
    totalUsers: 0,
    activeSubscriptions: 0,
    totalRevenue: 0,
    pendingCommissions: 0
  })

  useEffect(() => {
    loadAllData()
  }, [])

  const loadAllData = async () => {
    try {
      setLoading(true)

      // Users
      const { data: usersData } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })

      // Subscriptions
      const { data: subsData } = await supabase
        .from('subscriptions')
        .select(`
          *,
          profiles (name, email)
        `)
        .order('created_at', { ascending: false })

      // Commissions
      const { data: commissionsData } = await supabase
        .from('commissions')
        .select(`
          *,
          profiles (name, email)
        `)
        .order('created_at', { ascending: false })

      // Referrals
      const { data: referralsData } = await supabase
        .from('referrals')
        .select(`
          *,
          referrer:profiles!referrals_referrer_id_fkey(name, email),
          referee:profiles!referrals_referee_id_fkey(name, email)
        `)
        .order('created_at', { ascending: false })

      setUsers(usersData || [])
      setSubscriptions(subsData || [])
      setCommissions(commissionsData || [])
      setReferrals(referralsData || [])

      // Calculate stats
      const activeSubsCount = subsData?.filter(s => s.status === 'active' && s.plan !== 'free').length || 0
      const totalRevenue = subsData?.filter(s => s.status === 'active' && s.plan !== 'free').reduce((sum, s) => {
        const prices = { professional: 299, stk: 499, business: 999 }
        return sum + (prices[s.plan] || 0)
      }, 0) || 0
      const pendingComm = commissionsData?.filter(c => c.status === 'pending' || c.status === 'approved').reduce((sum, c) => sum + parseFloat(c.amount), 0) || 0

      setStats({
        totalUsers: usersData?.length || 0,
        activeSubscriptions: activeSubsCount,
        totalRevenue,
        pendingCommissions: pendingComm
      })

    } catch (error) {
      console.error('Error loading admin data:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         user.email?.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesSearch
  })

  const filteredSubscriptions = subscriptions.filter(sub => {
    const matchesSearch = sub.profiles?.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         sub.profiles?.email?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesPlan = filterPlan === 'all' || sub.plan === filterPlan
    return matchesSearch && matchesPlan
  })

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Admin CRM</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Tüm kullanıcıları ve ödemeleri yönetin</p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Toplam Kullanıcı</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">{stats.totalUsers}</p>
            </div>
            <Users className="w-10 h-10 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Aktif Abonelik</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">{stats.activeSubscriptions}</p>
            </div>
            <CreditCard className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Aylık Gelir</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">₺{stats.totalRevenue.toLocaleString()}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-purple-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">Bekleyen Komisyon</p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">₺{stats.pendingCommissions.toFixed(2)}</p>
            </div>
            <DollarSign className="w-10 h-10 text-yellow-600" />
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <div className="flex gap-2 mb-6 border-b border-gray-200 dark:border-gray-700">
          {[
            { id: 'users', label: 'Kullanıcılar', count: users.length },
            { id: 'subscriptions', label: 'Abonelikler', count: subscriptions.length },
            { id: 'commissions', label: 'Komisyonlar', count: commissions.length },
            { id: 'referrals', label: 'Referanslar', count: referrals.length }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id)}
              className={`px-4 py-2 font-semibold transition-all ${
                selectedTab === tab.id
                  ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
              }`}
            >
              {tab.label} ({tab.count})
            </button>
          ))}
        </div>

        {/* Search & Filter */}
        <div className="flex gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <input
              type="text"
              placeholder="Ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
          </div>
          {selectedTab === 'subscriptions' && (
            <select
              value={filterPlan}
              onChange={(e) => setFilterPlan(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            >
              <option value="all">Tüm Planlar</option>
              <option value="free">Başlangıç</option>
              <option value="professional">Profesyonel</option>
              <option value="stk">STK</option>
              <option value="business">Kurumsal</option>
            </select>
          )}
        </div>

        {/* Content */}
        {selectedTab === 'users' && (
          <div className="space-y-3">
            {filteredUsers.map(user => (
              <div key={user.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{user.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{user.email}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Kayıt: {new Date(user.created_at).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                      user.role === 'admin' 
                        ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                        : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {user.role === 'admin' ? 'Admin' : 'User'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedTab === 'subscriptions' && (
          <div className="space-y-3">
            {filteredSubscriptions.map(sub => (
              <div key={sub.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{sub.profiles?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{sub.profiles?.email}</p>
                    <div className="flex gap-2 mt-2">
                      <span className="px-2 py-1 bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 text-xs rounded">
                        {sub.plan.toUpperCase()}
                      </span>
                      <span className={`px-2 py-1 text-xs rounded ${
                        sub.status === 'active' 
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                      }`}>
                        {sub.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {sub.organizations_used}/{sub.organizations_limit} Org
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {new Date(sub.created_at).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedTab === 'commissions' && (
          <div className="space-y-3">
            {commissions.map(comm => (
              <div key={comm.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-gray-100">{comm.profiles?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{comm.description}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      {new Date(comm.created_at).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">₺{parseFloat(comm.amount).toFixed(2)}</p>
                    <span className={`inline-block px-2 py-1 text-xs rounded mt-1 ${
                      comm.status === 'paid' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : comm.status === 'approved'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}>
                      {comm.status}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {selectedTab === 'referrals' && (
          <div className="space-y-3">
            {referrals.map(ref => (
              <div key={ref.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{ref.referrer?.name}</span>
                      {' → '}
                      <span className="font-semibold text-gray-900 dark:text-gray-100">{ref.referee?.name}</span>
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                      Kod: {ref.referral_code} • {new Date(ref.created_at).toLocaleDateString('tr-TR')}
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block px-2 py-1 text-xs rounded ${
                      ref.status === 'active' 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                        : ref.status === 'completed'
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                    }`}>
                      {ref.status}
                    </span>
                    {ref.commission_amount > 0 && (
                      <p className="text-sm font-semibold text-green-600 dark:text-green-400 mt-1">
                        +₺{parseFloat(ref.commission_amount).toFixed(2)}
                      </p>
                    )}
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