import { useDashboardMode } from '../contexts/DashboardModeContext'
import { User, Building2 } from 'lucide-react'

export default function DashboardModeToggle({ hasOrganizations = false, profile }) {
  const { toggleMode, isIndividual } = useDashboardMode()

  // Ölçü kişisel abonelik DEĞİL, bir organizasyona bağlı olmak. Eskiden
  // kişinin planı stk/business değilse düğme hiç görünmüyordu; kimsenin
  // böyle bir aboneliği olmadığı için kurumsal panele giren olmamıştı.
  const canSeeCorporate = hasOrganizations || ['admin', 'superadmin'].includes(profile?.role)

  if (!canSeeCorporate) return null

  return (
    <button
      onClick={toggleMode}
      className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-all border border-gray-300 dark:border-gray-600"
      title={isIndividual ? 'Kurumsal Moda Geç' : 'Bireysel Moda Geç'}
    >
      {isIndividual ? (
        <>
          <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          <span className="font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">
            Bireysel
          </span>
        </>
      ) : (
        <>
          <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <span className="font-medium text-gray-700 dark:text-gray-300 hidden sm:inline">
            Kurumsal
          </span>
        </>
      )}
    </button>
  )
}