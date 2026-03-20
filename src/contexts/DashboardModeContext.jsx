import { createContext, useContext, useState, useEffect } from 'react'

const DashboardModeContext = createContext()

export function DashboardModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('dashboardMode') || 'individual'
  })

  // Subscription plan gelince otomatik mod belirle
  const initMode = (plan) => {
    const saved = localStorage.getItem('dashboardMode')
    // STK veya Kurumsal planı → kurumsal mod varsayılan
    if (!saved && (plan === 'stk' || plan === 'business')) {
      setMode('corporate')
    }
  }

  useEffect(() => {
    localStorage.setItem('dashboardMode', mode)
  }, [mode])

  const toggleMode = () => {
    setMode(prev => prev === 'individual' ? 'corporate' : 'individual')
  }

  const setIndividual = () => setMode('individual')
  const setCorporate = () => setMode('corporate')

  const value = {
    mode,
    isIndividual: mode === 'individual',
    isCorporate: mode === 'corporate',
    toggleMode,
    setIndividual,
    setCorporate,
    initMode
  }

  return (
    <DashboardModeContext.Provider value={value}>
      {children}
    </DashboardModeContext.Provider>
  )
}

export function useDashboardMode() {
  const context = useContext(DashboardModeContext)
  if (!context) {
    throw new Error('useDashboardMode must be used within DashboardModeProvider')
  }
  return context
}