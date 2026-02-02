import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import PublicMemberDirectory from '../components/PublicMemberDirectory'
import { ArrowLeft } from 'lucide-react'

export default function PublicMemberDirectoryPage() {
  const { orgSlug } = useParams()
  const navigate = useNavigate()
  const [organization, setOrganization] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    loadOrganization()
  }, [orgSlug])

  const loadOrganization = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', orgSlug)
        .single()

      if (error) throw error

      // Sadece STK'lar için public directory
      if (!['association', 'foundation', 'community', 'union'].includes(data.type)) {
        setError('Bu organizasyonun üye listesi herkese açık değil.')
        return
      }

      setOrganization(data)
    } catch (err) {
      console.error('Error loading organization:', err)
      setError('Organizasyon bulunamadı.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !organization) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            {error || 'Organizasyon Bulunamadı'}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Lütfen doğru linki kullandığınızdan emin olun.
          </p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            <ArrowLeft size={20} />
            Ana Sayfaya Dön
          </button>

          <div className="text-right">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              {organization.name}
            </h1>
            {organization.description && (
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {organization.description}
              </p>
            )}
          </div>
        </div>

        <PublicMemberDirectory
          organizationId={organization.id}
          organizationName={organization.name}
        />
      </div>
    </div>
  )
}