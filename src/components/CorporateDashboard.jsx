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

    } catch (error) {
      console.error('Error loading organizations:', error)
      alert('Organizasyonlar yüklenirken hata: ' + error.message)
    } finally {
      setLoading(false)
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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Toplam Organizasyon
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {stats.totalOrgs}
              </p>
            </div>
            <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Building2 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Toplam Üye
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {stats.totalMembers}
              </p>
            </div>
            <div className="p-3 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Users className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-gray-600 dark:text-gray-400">
                Aktif Üye
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-gray-100 mt-2">
                {stats.activeMembers}
              </p>
            </div>
            <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <UserCheck className="w-8 h-8 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>
      </div>

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
                      <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                        <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                    </div>

                    <div className="space-y-2">
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