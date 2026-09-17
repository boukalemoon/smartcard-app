import { createContext, useContext, useState, useEffect } from 'react'

const DashboardModeContext = createContext()

export function DashboardModeProvider({ children }) {
  const [mode, setMode] = useState(() => {
    return localStorage.getItem('dashboardMode') || 'individual'
  })

  // Kurumsal mod yetkisi yoksa bireysele dön.
  //
  // NEDEN: Mod ilk çizimde localStorage'a yazılıyordu; bu yüzden eski
  // "plana göre otomatik seç" mantığı hiçbir zaman çalışmadı (kayıt hep
  // vardı). Daha kötüsü, kayıtlı mod 'corporate' kalmış bir tarayıcıda
  // yetkisi olmayan kullanıcı geçiş düğmesini göremediği için bireysel
  // panele DÖNEMİYORDU. Artık yetki yoksa mod kendiliğinden düzeliyor.
  const ensureAllowed = (canCorporate) => {
    if (!canCorporate) setMode(prev => (prev === 'corporate' ? 'individual' : prev))
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
    ensureAllowed
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