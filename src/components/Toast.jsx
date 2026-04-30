import { createContext, useContext, useState, useCallback, useEffect } from 'react'

const ToastContext = createContext(null)

// Hook: Herhangi bir component'tan toast göstermek için
export function useToast() {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast hook must be used inside <ToastProvider>')
  }
  return context
}

// Provider: App.jsx'in en dışına sarılacak
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])

  const showToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random()
    setToasts(prev => [...prev, { id, message, type }])
    
    // 3 saniye sonra otomatik kaldır
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  // Manuel kapatma
  const closeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      
      {/* Toast container - sayfanın üstünde sabit */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] flex flex-col gap-2 pointer-events-none w-full max-w-md px-4">
        {toasts.map(toast => (
          <ToastItem 
            key={toast.id} 
            toast={toast} 
            onClose={() => closeToast(toast.id)} 
          />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// Tek bir toast item
function ToastItem({ toast, onClose }) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    // Mount olunca animasyon için kısa gecikme
    const timer = setTimeout(() => setVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const styles = {
    success: 'bg-green-500 text-white',
    error: 'bg-red-500 text-white',
    info: 'bg-blue-500 text-white',
    warning: 'bg-yellow-500 text-white'
  }

  const icons = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️'
  }

  return (
    <div
      className={`
        ${styles[toast.type]} 
        rounded-xl shadow-lg p-4 pointer-events-auto
        flex items-center gap-3
        transition-all duration-300 ease-out
        ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}
      `}
      onClick={onClose}
    >
      <span className="text-xl shrink-0">{icons[toast.type]}</span>
      <p className="flex-1 text-sm font-semibold">{toast.message}</p>
      <button 
        onClick={(e) => { e.stopPropagation(); onClose() }}
        className="text-white/80 hover:text-white shrink-0 text-lg"
      >
        ✕
      </button>
    </div>
  )
}