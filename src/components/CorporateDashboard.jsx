import OrganizationProfileManager from './OrganizationProfileManager'
import ImageUpload from './ImageUpload'
import { exportToCSV, verifyPasswordForExport } from '../utils/exportHelpers'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import MemberManager from './MemberManager'
import ApplicationManager from './ApplicationManager'
import { Building2, Users, UserCheck, ChevronRight, MessageSquare } from 'lucide-react'

export default function CorporateDashboard({ profile, subscription }) {
  const [organizations, setOrganizations] = useState([])
  const [selectedOrg, setSelectedOrg] = useState(null)
  const [showMemberManager, setShowMemberManager] = useState(false)
  const [showApplications, setShowApplications] = useState(false)
  const [loading, setLoading] = useState(true)
  const [orgCommissions, setOrgCommissions] = useState([])
  const [showOrgProfile, setShowOrgProfile] = useState(false)
  const [stats, setStats] = useState({
    totalOrgs: 0,
    totalMembers: 0,
    activeMembers: 0
  })

  const [orgAnalytics, setOrgAnalytics] = useState([])
const [totalAnalytics, setTotalAnalytics] = useState({
  qr_scans: 0,
  profile_views: 0,
  vcard_downloads: 0,
  link_clicks: 0
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

    // Organizational commissions yükle
    if (orgs && orgs.length > 0) {
      const orgIds = orgs.map(o => o.id)
      
      const { data: commissionsData } = await supabase
        .from('organizational_commissions')
        .select('*')
        .in('organization_id', orgIds)
        .order('created_at', { ascending: false })
      
      console.log('🔍 Org IDs:', orgIds)
      console.log('💰 Org Commissions:', commissionsData)
      
      setOrgCommissions(commissionsData || [])
      
      // YENİ - Analytics yükle
      await loadOrganizationAnalytics(orgs)
    }

  } catch (error) {
    console.error('Error loading organizations:', error)
  } finally {
    setLoading(false)
  }
}

// YENİ FONKSİYON - loadOrganizations'tan SONRA ekle
const loadOrganizationAnalytics = async (orgs) => {
  try {
    const analyticsData = []
    let totalQR = 0, totalProfile = 0, totalVCard = 0, totalLink = 0

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

    // Local state güncelle
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
    // Tüm organizasyonların üyelerini topla
    const allMembers = []
    
    for (const org of organizations) {
      const { data: members } = await supabase
        .from('members')
        .select(`
          *,
          profiles (name, email)
        `)
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
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
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

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* ... mevcut 3 kart ... */}
      </div>

      {/* TOPLAM ANALYTICS KARTLARI - Sadece Premium */}
      {(subscription?.plan === 'professional' || subscription?.plan === 'enterprise') && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            📊 Toplam Analytics
          </h2>
          <div className="grid md:grid-cols-4 gap-4">
            {/* ... 4 kart ... */}
          </div>
        </div>
      )}  {/* ← BURASI KAPANMALI! */}

      {/* ÜYE BAZLI ANALYTICS - Sadece Premium */}
      {(subscription?.plan === 'professional' || subscription?.plan === 'enterprise') && orgAnalytics.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
    <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
      👥 Üye Bazlı Analytics
          </h2>

          {/* FREE PLAN UYARISI */}
{subscription?.plan === 'free' && (
  <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl shadow-lg p-6 text-white">
    <h3 className="text-xl font-bold mb-2">📊 Kurumsal Analytics</h3>
    <p className="text-purple-100 mb-4">
      Organizasyon üyelerinin detaylı istatistiklerini görmek için planınızı yükseltin
    </p>
    <button
      onClick={() => window.location.href = '/dashboard'}
      className="px-6 py-3 bg-white text-purple-600 rounded-xl font-semibold hover:shadow-xl transition-all"
    >
      Planı Yükselt
    </button>
  </div>
)}
          
          {orgAnalytics.map((orgData) => (
            <div key={orgData.orgId} className="mb-6 last:mb-0">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-3 pb-2 border-b border-gray-200 dark:border-gray-700">
                {orgData.orgName}
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                        Üye
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                        QR Tarama
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                        Profil Görüntüleme
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                        vCard İndirme
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                        Link Tıklama
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {orgData.members.map((member) => (
                      <tr key={member.profile_id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            {member.avatar_url ? (
                              <img 
                                src={member.avatar_url} 
                                alt={member.name}
                                className="w-8 h-8 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                                <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
                                  {member.name?.charAt(0) || '?'}
                                </span>
                              </div>
                            )}
                            <span className="font-medium text-gray-900 dark:text-gray-100">
                              {member.name || 'İsimsiz'}
                            </span>
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
<div className="flex gap-2 mb-4">
  <button
    onClick={handleExportMembers}
    className="px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-all text-sm flex items-center gap-2"
  >
    📥 Üyeleri Export Et
  </button>

  {/* YENİ — Analytics Export */}
  {orgAnalytics.length > 0 && (
    <button
      onClick={handleExportAnalytics}
      className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm flex items-center gap-2"
    >
      📊 Üye Analytics Export Et
    </button>
  )}

  {orgCommissions.length > 0 && (
    <button
      onClick={handleExportCommissions}
      className="px-4 py-2 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-all text-sm flex items-center gap-2"
    >
      📥 Hakediş Export Et
    </button>
  )}
</div>
      {/* Organizational Commissions */}
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
      onClose={() => {
        setShowOrgProfile(false)
        setSelectedOrg(null)
      }}
      onUpdate={() => {
        loadOrganizations()
      }}
    />
  </div>
)}


      {/* Member Manager */}
      {showMemberManager && selectedOrg && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <button
              onClick={() => {
                setShowMemberManager(false)
                setSelectedOrg(null)
              }}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-2"
            >
              ← Organizasyonlara Dön
            </button>
          </div>
          <MemberManager
            organizationId={selectedOrg.id}
            onClose={() => {
              setShowMemberManager(false)
              setSelectedOrg(null)
              loadOrganizations()
            }}
          />
        </div>
      )}

      {/* Application Manager */}
      {showApplications && selectedOrg && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="mb-4">
            <button
              onClick={() => {
                setShowApplications(false)
                setSelectedOrg(null)
              }}
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
      {!showMemberManager && !showApplications && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
              Organizasyonlarım
            </h2>
          </div>

          {organizations.length === 0 ? (
            <div className="text-center py-12">
              <Building2 className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                Henüz organizasyon yok
              </h3>
              <p className="text-gray-500 dark:text-gray-400 mb-6">
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
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                          {org.name}
                        </h3>
                        {org.description && (
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                            {org.description}
                          </p>
                        )}
                      </div>
                      <div className="relative group">
  {org.logo_url ? (
    <img 
      src={org.logo_url} 
      alt={org.name}
      className="w-12 h-12 object-cover rounded-lg"
    />
  ) : (
    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
      <Building2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
    </div>
  )}
  
</div>
                    </div>

                    <div className="space-y-2">
  {/* Organization Profile Button */}
  <button
    onClick={() => {
      setSelectedOrg(org)
      setShowOrgProfile(true)
      setShowMemberManager(false)
      setShowApplications(false)
    }}
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