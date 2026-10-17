import { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { CheckCircle2, AlertCircle, Info, AlertTriangle, X } from 'lucide-react'
import { bildirimKaydet } from '../lib/bildirim'

const ToastContext = createContext(null)

// Hook: Herhangi bir component'tan toast göstermek için
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast hook must be used inside <ToastProvider>')
  }
  return context
}

// Provider: App.jsx'in en dışına sarılı. bildir() (lib/bildirim) da buraya düşer.
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    // Hata mesajı okunacak kadar uzun kalır.
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, type === 'error' || type === 'warning' ? 6000 : 3500)
  }, [])

  const closeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  useEffect(() => bildirimKaydet(showToast), [showToast])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div
        className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none w-full max-w-md px-4"
        role="status"
        aria-live="polite"
      >
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onClose={() => closeToast(toast.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

const SIMGE = {
  success: { Simge: CheckCircle2, renk: 'text-emerald-400' },
  error: { Simge: AlertCircle, renk: 'text-red-400' },
  info: { Simge: Info, renk: 'text-blue-300' },
  warning: { Simge: AlertTriangle, renk: 'text-amber-400' },
}

function ToastItem({ toast, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const { Simge, renk } = SIMGE[toast.type] || SIMGE.info

  return (
    <div
      className={`bg-lacivert-900 text-white rounded-xl shadow-2xl px-4 py-3 pointer-events-auto flex items-start gap-3 transition-all duration-300 ease-out ${
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'
      }`}
    >
      <Simge size={20} className={`${renk} shrink-0 mt-0.5`} aria-hidden="true" />
      <p className="flex-1 text-sm font-medium whitespace-pre-line">{toast.message}</p>
      <button
        type="button"
        onClick={onClose}
        aria-label="Kapat"
        className="text-white/60 hover:text-white shrink-0"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  )
}
