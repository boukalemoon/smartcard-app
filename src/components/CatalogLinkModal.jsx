import { useState, useEffect } from 'react'
import Modal from './Modal'
import { useToast } from './Toast'
import { ExternalLink } from 'lucide-react'

export default function CatalogLinkModal({ isOpen, onClose, link = null, linkIndex = null, onSave }) {
  const { showToast } = useToast()
  const isEditMode = link !== null

  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setTitle(link?.title || '')
      setUrl(link?.url || '')
      setErrors({})
    }
  }, [isOpen, link])

  const handleUrlBlur = () => {
    if (url && !url.match(/^https?:\/\//i)) {
      setUrl(`https://${url}`)
    }
  }

  const validate = () => {
    const newErrors = {}

    if (!title.trim()) {
      newErrors.title = 'Başlık zorunludur'
    } else if (title.trim().length < 2) {
      newErrors.title = 'Başlık en az 2 karakter olmalı'
    }

    if (!url.trim()) {
      newErrors.url = 'URL zorunludur'
    } else {
      let testUrl = url.trim()
      if (!testUrl.match(/^https?:\/\//i)) {
        testUrl = `https://${testUrl}`
      }
      try {
        const parsed = new URL(testUrl)
        if (!parsed.hostname.includes('.')) {
          newErrors.url = 'Geçerli bir URL girin'
        }
      } catch {
        newErrors.url = 'Geçersiz URL formatı'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    let finalUrl = url.trim()
    if (!finalUrl.match(/^https?:\/\//i)) {
      finalUrl = `https://${finalUrl}`
    }

    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        url: finalUrl,
        type: 'document',
      }, linkIndex)
      showToast(
        isEditMode ? 'Link güncellendi' : 'Link eklendi',
        'success'
      )
      onClose()
    } catch (error) {
      showToast('Hata: ' + error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = (hasError) => {
    const base = 'w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none transition-colors text-base'
    const borderClass = hasError
      ? 'border-red-500 focus:border-red-500'
      : 'border-gray-200 dark:border-gray-600 focus:border-blue-500'
    return `${base} ${borderClass}`
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? '✏️ Linki Düzenle' : '📁 Yeni Döküman / Link'}
      size="md"
      closeOnOverlayClick={!saving}
      footer={
        <div className="flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving && (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            {isEditMode ? 'Güncelle' : 'Kaydet'}
          </button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Başlık <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (errors.title) setErrors(prev => ({ ...prev, title: null }))
            }}
            className={inputClass(errors.title)}
            placeholder="örn: Ürün Kataloğu 2025, Sunum Dosyası"
            maxLength={80}
            autoFocus
          />
          {errors.title && (
            <p className="text-xs text-red-500 mt-1">⚠️ {errors.title}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            URL <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <ExternalLink
              size={18}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => {
                setUrl(e.target.value)
                if (errors.url) setErrors(prev => ({ ...prev, url: null }))
              }}
              onBlur={handleUrlBlur}
              className={`${inputClass(errors.url)} pl-11`}
              placeholder="drive.google.com/file/..."
              maxLength={500}
            />
          </div>
          {errors.url ? (
            <p className="text-xs text-red-500 mt-1">⚠️ {errors.url}</p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              💡 https:// otomatik eklenir
            </p>
          )}
        </div>

        {url && !errors.url && (
          <div className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg p-3">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Açılacak link:</p>
            <a
              href={url.match(/^https?:\/\//i) ? url : `https://${url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 dark:text-blue-400 hover:underline break-all flex items-center gap-1"
            >
              <span className="truncate">{url}</span>
              <ExternalLink size={14} className="shrink-0" />
            </a>
          </div>
        )}

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 mb-1">
            💡 Nereden link alabilirsin?
          </p>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            Google Drive, Dropbox, OneDrive, Notion veya kendi web sitenizden paylaşım linki alıp yapıştırabilirsiniz.
          </p>
        </div>
      </div>
    </Modal>
  )
}