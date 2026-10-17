import { useEffect } from 'react'
import { X } from 'lucide-react'

export default function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  closeOnOverlayClick = true,
  showCloseButton = true,
  footer = null,
}) {
  useEffect(() => {
    if (!isOpen) return
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  if (!isOpen) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-2xl',
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-sm animate-fadeIn"
      onClick={closeOnOverlayClick ? onClose : undefined}
    >
      <div
        className={`bg-yuzey text-metin border border-cizgi rounded-t-2xl sm:rounded-2xl shadow-2xl w-full ${sizeClasses[size]} max-h-[90vh] flex flex-col animate-slideUp`}
        onClick={(e) => e.stopPropagation()}
      >
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between px-6 py-4 border-b border-cizgi shrink-0">
            <h2 className="font-baslik text-lg font-bold text-metin">{title}</h2>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="p-1 rounded-lg hover:bg-yuzey-2 transition-colors"
                aria-label="Kapat"
              >
                <X size={20} className="text-metin-2" />
              </button>
            )}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {children}
        </div>

        {footer && (
          <div className="px-6 py-4 border-t border-cizgi shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

export function ConfirmModal({
  isOpen,
  onClose,
  title,
  message,
  confirmText = 'Evet',
  cancelText = 'İptal',
  onConfirm,
  variant = 'primary',
}) {
  const handleConfirm = () => {
    onConfirm()
    onClose()
  }

  const confirmBtnClass = variant === 'danger'
    ? 'bg-red-600 hover:bg-red-700 text-white'
    : 'bg-aksan hover:bg-aksan-koyu text-white dark:text-zemin'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      size="sm"
      footer={
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 h-10 px-4 border border-cizgi bg-yuzey text-metin rounded-[10px] font-semibold hover:bg-yuzey-2 transition-colors"
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className={`h-10 px-4 ${confirmBtnClass} rounded-[10px] font-semibold transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      }
    >
      <p className="text-metin-2">{message}</p>
    </Modal>
  )
}