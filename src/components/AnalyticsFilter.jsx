import { useState } from 'react'
import { Calendar, Download } from 'lucide-react'

export default function AnalyticsFilter({ onFilterChange, onExport, isPremium }) {
  const [filterType, setFilterType] = useState('monthly') // monthly | range | yearly
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear())
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - i)

  const handleApply = () => {
    let filter = { type: filterType }
    if (filterType === 'monthly') {
      const [year, month] = selectedMonth.split('-')
      filter = { type: 'monthly', year: parseInt(year), month: parseInt(month) }
    } else if (filterType === 'yearly') {
      filter = { type: 'yearly', year: selectedYear }
    } else if (filterType === 'range') {
      if (!startDate || !endDate) { alert('Başlangıç ve bitiş tarihi seçin'); return }
      filter = { type: 'range', startDate, endDate }
    }
    onFilterChange(filter)
  }

  if (!isPremium) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4 mb-4">
      <div className="flex flex-wrap items-end gap-3">
        {/* Filtre tipi */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Dönem</label>
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            {[
              { id: 'monthly', label: 'Aylık' },
              { id: 'yearly', label: 'Yıllık' },
              { id: 'range', label: 'Tarih Aralığı' }
            ].map(opt => (
              <button
                key={opt.id}
                onClick={() => setFilterType(opt.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  filterType === opt.id
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Aylık seçim */}
        {filterType === 'monthly' && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Ay</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm outline-none focus:border-blue-500"
            />
          </div>
        )}

        {/* Yıllık seçim */}
        {filterType === 'yearly' && (
          <div>
            <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Yıl</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value))}
              className="px-3 py-1.5 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm outline-none focus:border-blue-500"
            >
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        )}

        {/* Tarih aralığı */}
        {filterType === 'range' && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Başlangıç</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Bitiş</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm outline-none focus:border-blue-500"
              />
            </div>
          </>
        )}

        <button
          onClick={handleApply}
          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-all flex items-center gap-1"
        >
          <Calendar size={14} />
          Uygula
        </button>

        {onExport && (
          <button
            onClick={onExport}
            className="px-4 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700 transition-all flex items-center gap-1"
          >
            <Download size={14} />
            Export
          </button>
        )}
      </div>
    </div>
  )
}