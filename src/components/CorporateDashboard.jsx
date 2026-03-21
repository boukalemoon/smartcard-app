import OrganizationProfileManager from './OrganizationProfileManager'
import ImageUpload from './ImageUpload'
import { exportToCSV, verifyPasswordForExport } from '../utils/exportHelpers'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import MemberManager from './MemberManager'
import ApplicationManager from './ApplicationManager'
import { Building2, Users, UserCheck, ChevronRight, MessageSquare } from 'lucide-react'
import AnalyticsFilter from './AnalyticsFilter'

export default function CorporateDashboard({ profile, subscription }) {
  const [organizations, setOrganizations] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [showMemberManager, setShowMemberManager] = useState(false)
  const [showApplications, setShowApplications] = useState(false)
  const [showOrgProfile, setShowOrgProfile] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orgCommissions, setOrgCommissions] = useState([])
  const [orgAnalytics, setOrgAnalytics] = useState([])
  const [totalAnalytics, setTotalAnalytics] = useState({
    qr_scans: 0,
    profile_views: 0,
    vcard_downloads: 0,
    link_clicks: 0
  })

  const [analyticsFilter, setAnalyticsFilter] = useState({
  type: 'monthly',
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1
})
  const [stats, setStats] = useState({
    totalOrgs: 0,
    totalMembers: 0,
    activeMembers: 0
  })

  useEffect(() => {
    loadOrganizations()
  }, [profile])

  const loadOrganizations = async () => {
    if (!profile?.id) return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('members')
        .select(`
          organization_id,
          role,
          organizations (
            id,
            name,
            type,
            description,
            logo_url,
            created_at
          )
        `)
        .eq('profile_id', profile.id)
        .order('created_at', { ascending: false })

      if (error) throw error

      const orgs = data?.map(item => ({
        ...item.organizations,
        role: item.role
      })) || []

      setOrganizations(orgs)

      let totalMembers = 0
      let activeMembers = 0

      if (orgs && orgs.length > 0) {
        for (const org of orgs) {
          const { data: members } = await supabase
            .from('members')
            .select('status')
            .eq('organization_id', org.id)

          if (members) {
            totalMembers += members.length
            activeMembers += members.filter(m => m.status === 'active').length
          }
        }
      }

      setStats({
        totalOrgs: orgs?.length || 0,
        totalMembers,
        activeMembers
      })

      if (orgs && orgs.length > 0) {
        const orgIds = orgs.map(o => o.id)
        const { data: commissionsData } = await supabase
          .from('organizational_commissions')
          .select('*')
          .in('organization_id', orgIds)
          .order('created_at', { ascending: false })

        setOrgCommissions(commissionsData || [])
        await loadOrganizationAnalytics(orgs)
      }
    } catch (error) {
      console.error('Error loading organizations:', error)
    } finally {
      setLoading(false)
    }
  }

const loadOrganizationAnalytics = async (orgs, filter = null) => {
    try {
      const analyticsData = []
      let totalQR = 0, totalProfile = 0, totalVCard = 0, totalLink = 0
const { data } = await supabase.rpc('get_org_member_analytics', {
    org_id: org.id,
    filter_type: filter?.type || 'all',
    filter_year: filter?.year || null,
    filter_month: filter?.month || null,
    filter_start: filter?.startDate || null,
    filter_end: filter?.endDate || null
  })
      for (const org of orgs) {
        const { data } = await supabase.rpc('get_org_member_analytics', {
          org_id: org.id
        })

        if (data && data.length > 0) {
          analyticsData.push({
            orgId: org.id,
            orgName: org.name,
            members: data
          })
          data.forEach(member => {
            totalQR += member.qr_scans || 0
            totalProfile += member.profile_views || 0
            totalVCard += member.vcard_downloads || 0
            totalLink += member.link_clicks || 0
          })
        }
      }

      setOrgAnalytics(analyticsData)
      setTotalAnalytics({
        qr_scans: totalQR,
        profile_views: totalProfile,
        vcard_downloads: totalVCard,
        link_clicks: totalLink
      })
    } catch (error) {
      console.error('Analytics loading error:', error)
    }
  }

  const selectOrganization = (org, showType = 'members') => {
    setSelectedOrg(org)
    if (showType === 'applications') {
      setShowApplications(true)
      setShowMemberManager(false)
    } else {
      setShowMemberManager(true)
      setShowApplications(false)
    }
  }

  const updateOrgLogo = async (orgId, logoUrl) => {
    try {
      const { error } = await supabase
        .from('organizations')
        .update({ logo_url: logoUrl })
        .eq('id', orgId)
      if (error) throw error
      setOrganizations(organizations.map(org =>
        org.id === orgId ? { ...org, logo_url: logoUrl } : org
      ))
      alert('Logo güncellendi!')
    } catch (error) {
      console.error('Logo update error:', error)
      alert('Hata: ' + error.message)
    }
  }

  const handleExportMembers = async () => {
    const verified = await verifyPasswordForExport(supabase)
    if (!verified) return
    try {
      const allMembers = []
      for (const org of organizations) {
        const { data: members } = await supabase
          .from('members')
          .select('*, profiles (name, email)')
          .eq('organization_id', org.id)
        if (members) {
          allMembers.push(...members.map(m => ({
            'Organizasyon': org.name,
            'Ad Soyad': m.profiles?.name || '-',
            'Email': m.profiles?.email || '-',
            'Rol': m.role,
            'Durum': m.status,
            'Katılım Tarihi': new Date(m.joined_at).toLocaleDateString('tr-TR')
          })))
        }
      }
      exportToCSV(allMembers, 'members')
    } catch (error) {
      console.error('Export error:', error)
      alert('Export hatası!')
    }
  }

  const handleExportCommissions = async () => {
    const verified = await verifyPasswordForExport(supabase)
    if (!verified) return
    const exportData = orgCommissions.map(c => {
      const org = organizations.find(o => o.id === c.organization_id)
      return {
        'Organizasyon': org?.name || '-',
        'Dönem': `${c.period_month}/${c.period_year}`,
        'Üye Sayısı': c.member_count,
        'Üye Başı Komisyon': `₺${parseFloat(c.commission_per_member).toFixed(2)}`,
        'Toplam Komisyon': `₺${parseFloat(c.total_commission).toFixed(2)}`,
        'Durum': c.status === 'pending' ? 'Bekliyor' : c.status === 'approved' ? 'Onaylandı' : 'Ödendi',
        'Tarih': new Date(c.created_at).toLocaleDateString('tr-TR')
      }
    })
    exportToCSV(exportData, 'organizational_commissions')
  }

  const handleExportAnalytics = async () => {
    const verified = await verifyPasswordForExport(supabase)
    if (!verified) return
    if (orgAnalytics.length === 0) {
      alert('Export edilecek analytics verisi bulunamadı.')
      return
    }
    const exportData = []
    orgAnalytics.forEach(org => {
      org.members.forEach(member => {
        exportData.push({
          'Organizasyon': org.orgName,
          'Ad Soyad': member.name || '-',
          'Email': member.email || '-',
          'Profil Görüntülenme': member.profile_views || 0,
          'QR Kod Tarama': member.qr_scans || 0,
          'vCard İndirme': member.vcard_downloads || 0,
          'Link Tıklama': member.link_clicks || 0
        })
      })
    })
    exportToCSV(exportData, 'uye_bazli_analytics')
  }

  // ── 1. Loading ──
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  // ── 2. Plan Kontrolü — sadece STK ve Kurumsal ──
  if (!subscription || !['stk', 'business'].includes(subscription.plan)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-center p-8">
        <div className="w-16 h-16 bg-purple-100 dark:bg-purple-900/30 rounded-full flex items-center justify-center mb-4">
          <Building2 className="w-8 h-8 text-purple-600 dark:text-purple-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Organizasyon Paneli
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md">
          Bu özellik STK Özel ve Kurumsal planlara özeldir.
          Organizasyonunuzu yönetmek için planınızı yükseltin.
        </p>
        <button
          onClick={() => window.location.href = '/#pricing'}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
        >
          Planları İncele
        </button>
      </div>
    )
  }

  // ── 3. Ana JSX ──
  return (
    <div className="space-y-6">

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-blue-500">
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Organizasyon</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.totalOrgs}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-green-500">
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Toplam Üye</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.totalMembers}</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-6 border-l-4 border-purple-500">
          <div className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">Aktif Üye</div>
          <div className="text-3xl font-bold text-gray-900 dark:text-gray-100">{stats.activeMembers}</div>
        </div>
      </div>

      {/* Analytics Filtresi */}
<AnalyticsFilter
  isPremium={true}
  onFilterChange={(filter) => {
    loadOrganizationAnalytics(organizations, filter)
  }}
  onExport={handleExportAnalytics}
/>

      {/* Toplam Analytics */}
      {orgAnalytics.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            📊 Toplam Analytics
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg text-center">
              <div className="text-2xl font-bold text-green-700 dark:text-green-300">{totalAnalytics.qr_scans}</div>
              <div className="text-xs text-green-600 dark:text-green-400 mt-1">QR Tarama</div>
            </div>
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg text-center">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-300">{totalAnalytics.profile_views}</div>
              <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">Profil Görüntülenme</div>
            </div>
            <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
              <div className="text-2xl font-bold text-purple-700 dark:text-purple-300">{totalAnalytics.vcard_downloads}</div>
              <div className="text-xs text-purple-600 dark:text-purple-400 mt-1">vCard İndirme</div>
            </div>
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg text-center">
              <div className="text-2xl font-bold text-yellow-700 dark:text-yellow-300">{totalAnalytics.link_clicks}</div>
              <div className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">Link Tıklama</div>
            </div>
          </div>
        </div>
      )}

      {/* Üye Bazlı Analytics */}
      {orgAnalytics.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            👥 Üye Bazlı Analytics
          </h2>
          {orgAnalytics.map((orgData) => (
            <div key={orgData.orgId} className="mb-6 last:mb-0">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                {orgData.orgName}
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Üye</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">QR Tarama</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Profil Görüntüleme</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">vCard İndirme</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Link Tıklama</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {orgData.members.map((member) => (
                      <tr key={member.profile_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {member.avatar_url ? (
                              <img src={member.avatar_url} alt={member.name} className="w-8 h-8 rounded-full object-cover" />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                  {member.name?.charAt(0) || '?'}
                                </span>
                              </div>
                            )}
                            <span className="font-medium text-gray-900 dark:text-gray-100">{member.name || 'İsimsiz'}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">
                            {member.qr_scans || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                            {member.profile_views || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
                            {member.vcard_downloads || 0}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300">
                            {member.link_clicks || 0}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Export Buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleExportMembers}
          className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-sm"
        >
          📥 Üyeleri Export Et
        </button>
        {orgAnalytics.length > 0 && (
          <button
            onClick={handleExportAnalytics}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
          >
            📊 Üye Analytics Export Et
          </button>
        )}
        {orgCommissions.length > 0 && (
          <button
            onClick={handleExportCommissions}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all text-sm"
          >
            📥 Hakediş Export Et
          </button>
        )}
      </div>

      {/* Organizasyon Hakediş */}
      {orgCommissions.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            💰 Organizasyon Hakediş
          </h2>
          <div className="space-y-3">
            {orgCommissions.map(comm => {
              const org = organizations.find(o => o.id === comm.organization_id)
              return (
                <div key={comm.id} className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold text-gray-900 dark:text-gray-100">{org?.name}</p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {comm.period_month}/{comm.period_year} • {comm.member_count} üye × ₺{parseFloat(comm.commission_per_member).toFixed(2)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">
                        ₺{parseFloat(comm.total_commission).toFixed(2)}
                      </p>
                      <span className={`inline-block px-2 py-1 text-xs rounded mt-1 ${
                        comm.status === 'paid'
                          ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
                          : comm.status === 'approved'
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
                      }`}>
                        {comm.status === 'pending' ? 'Bekliyor' : comm.status === 'approved' ? 'Onaylandı' : 'Ödendi'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Organization Profile Manager */}
      {showOrgProfile && selectedOrg && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <OrganizationProfileManager
            organizationId={selectedOrg.id}
            onClose={() => { setShowOrgProfile(false); setSelectedOrg(null) }}
            onUpdate={() => loadOrganizations()}
          />
        </div>
      )}

      {/* Member Manager */}
      {showMemberManager && selectedOrg && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <button
              onClick={() => { setShowMemberManager(false); setSelectedOrg(null) }}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
            >
              ← Organizasyonlara Dön
            </button>
          </div>
          <MemberManager
            organizationId={selectedOrg.id}
            onClose={() => { setShowMemberManager(false); setSelectedOrg(null); loadOrganizations() }}
          />
        </div>
      )}

      {/* Application Manager */}
      {showApplications && selectedOrg && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <button
              onClick={() => { setShowApplications(false); setSelectedOrg(null) }}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
            >
              ← Organizasyonlara Dön
            </button>
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            {selectedOrg.name} - Başvuru Yönetimi
          </h2>
          <ApplicationManager organizationId={selectedOrg.id} />
        </div>
      )}

      {/* Organizations List */}
      {!showMemberManager && !showApplications && !showOrgProfile && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">
            Organizasyonlarım
          </h2>
          {organizations.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Henüz organizasyon yok
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Bireysel moda geçip organizasyon oluşturabilirsiniz
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {organizations.map((org) => {
                const isSTK = ['association', 'foundation', 'community', 'union'].includes(org.type)
                return (
                  <div
                    key={org.id}
                    className="bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-all"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{org.name}</h3>
                        {org.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">{org.description}</p>
                        )}
                      </div>
                      <div className="ml-3">
                        {org.logo_url ? (
                          <img src={org.logo_url} alt={org.name} className="w-12 h-12 object-cover rounded-lg" />
                        ) : (
                          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                            <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <button
                        onClick={() => { setSelectedOrg(org); setShowOrgProfile(true); setShowMemberManager(false); setShowApplications(false) }}
                        className="w-full flex items-center justify-between px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm rounded-lg hover:from-blue-700 hover:to-indigo-700 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4" />
                          <span>Profil Yönet</span>
                        </div>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => selectOrganization(org, 'members')}
                        className="w-full flex items-center justify-between px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4" />
                          <span>Üyeleri Yönet</span>
                        </div>
                        <ChevronRight className="w-4 h-4" />
                      </button>
                      {isSTK && (
                        <button
                          onClick={() => selectOrganization(org, 'applications')}
                          className="w-full flex items-center justify-between px-3 py-2 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" />
                            <span>Başvuruları Yönet</span>
                          </div>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Info Card */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
          💡 Kurumsal Panel Özellikleri
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Organizasyonlarınızı tek yerden yönetin</li>
          <li>• Üyeleri ekleyin, düzenleyin ve silin</li>
          <li>• Üye rollerini ve durumlarını kontrol edin</li>
          <li>• Detaylı istatistikleri görüntüleyin</li>
          {organizations.some(org => ['association', 'foundation', 'community', 'union'].includes(org.type)) && (
            <li>• STK başvurularını yönetin</li>
          )}
        </ul>
      </div>

    </div>
  )
}