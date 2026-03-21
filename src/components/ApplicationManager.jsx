import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Clock, CheckCircle, XCircle, Mail, Phone, MessageSquare } from 'lucide-react'

export default function ApplicationManager({ organizationId }) {
  const [applications, setApplications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('pending') // pending, approved, rejected, all

  useEffect(() => {
    loadApplications()
  }, [organizationId, filter])

  const loadApplications = async () => {
    try {
      setLoading(true)
      
      let query = supabase
        .from('applications')
        .select('*')
        .eq('organization_id', organizationId)
        .order('applied_at', { ascending: false })

      if (filter !== 'all') {
        query = query.eq('status', filter)
      }

      const { data, error } = await query

      if (error) throw error
      setApplications(data || [])
    } catch (error) {
      console.error('Error loading applications:', error)
    } finally {
      setLoading(false)
    }
  }

  const updateApplicationStatus = async (applicationId, newStatus) => {
    try {
      const { error } = await supabase
        .from('applications')
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', applicationId)

      if (error) throw error

      // Eğer onaylandıysa, member olarak ekle
      if (newStatus === 'approved') {
        const application = applications.find(app => app.id === applicationId)
        
        if (application) {
          const { data: profileData } = await supabase
  .from('profiles')
  .select('id')
  .eq('email', application.applicant_email)
  .single()

if (profileData) {
  await supabase
    .from('members')
    .insert({
      organization_id: organizationId,
      profile_id: profileData.id,
      role: 'member',
      status: 'active'
    })
} else {
  alert('⚠️ Başvuru sahibi henüz QRtım hesabı oluşturmamış. Üye eklenemedi.')
}
        }
      }

      loadApplications()
      alert(newStatus === 'approved' ? 'Başvuru onaylandı ve üye eklendi!' : 'Başvuru reddedildi')
    } catch (error) {
      alert('Hata: ' + error.message)
    }
  }

  const getStatusBadge = (status) => {
    const badges = {
      pending: { label: 'Bekliyor', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', icon: Clock },
      approved: { label: 'Onaylandı', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300', icon: CheckCircle },
      rejected: { label: 'Reddedildi', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300', icon: XCircle }
    }
    return badges[status] || badges.pending
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Filter Tabs */}
      <div className="flex gap-2 border-b border-gray-200 dark:border-gray-700">
        {[
          { id: 'pending', label: 'Bekleyenler' },
          { id: 'approved', label: 'Onaylananlar' },
          { id: 'rejected', label: 'Reddedilenler' },
          { id: 'all', label: 'Tümü' }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setFilter(tab.id)}
            className={`px-4 py-2 font-medium transition-colors ${
              filter === tab.id
                ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400'
                : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Applications List */}
      {applications.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <MessageSquare size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Henüz başvuru yok</p>
          <p className="text-sm mt-1">
            {filter === 'pending' && 'Bekleyen başvuru bulunmuyor'}
            {filter === 'approved' && 'Onaylanan başvuru bulunmuyor'}
            {filter === 'rejected' && 'Reddedilen başvuru bulunmuyor'}
            {filter === 'all' && 'Hiç başvuru yapılmamış'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {applications.map((app) => {
            const statusBadge = getStatusBadge(app.status)
            const StatusIcon = statusBadge.icon

            return (
              <div
                key={app.id}
                className="bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-xl p-6 hover:border-blue-300 dark:hover:border-blue-700 transition-all"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                      {app.applicant_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Başvuru Tarihi: {new Date(app.applied_at).toLocaleDateString('tr-TR', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-semibold ${statusBadge.color}`}>
                    <StatusIcon size={14} />
                    {statusBadge.label}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <Mail size={16} className="text-gray-400" />
                    <a href={`mailto:${app.applicant_email}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                      {app.applicant_email}
                    </a>
                  </div>
                  {app.applicant_phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                      <Phone size={16} className="text-gray-400" />
                      <a href={`tel:${app.applicant_phone}`} className="hover:text-blue-600 dark:hover:text-blue-400">
                        {app.applicant_phone}
                      </a>
                    </div>
                  )}
                </div>

                {app.applicant_message && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>Mesaj:</strong> {app.applicant_message}
                    </p>
                  </div>
                )}

                {app.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateApplicationStatus(app.id, 'approved')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                    >
                      <CheckCircle size={18} />
                      Onayla
                    </button>
                    <button
                      onClick={() => updateApplicationStatus(app.id, 'rejected')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                    >
                      <XCircle size={18} />
                      Reddet
                    </button>
                  </div>
                )}

                {app.reviewed_at && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">
                    İncelenme: {new Date(app.reviewed_at).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}