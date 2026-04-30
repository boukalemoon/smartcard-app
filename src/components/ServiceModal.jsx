import { useState, useEffect } from 'react'
import Modal from './Modal'
import { useToast } from './Toast'

/**
 * ServiceModal
 *
 * Props:
 * - isOpen, onClose
 * - service: object | null — düzenleme modunda mevcut hizmet, ekleme modunda null
 * - serviceIndex: number | null — düzenleme modunda array içindeki index
 * - onSave: (serviceData, index) => Promise<void> — kaydet callback
 */
export default function ServiceModal({ isOpen, onClose, service = null, serviceIndex = null, onSave }) {
  const { showToast } = useToast()
  const isEditMode = service !== null

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [deliveryTime, setDeliveryTime] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Modal açıldığında form'u doldur (edit) veya temizle (add)
  useEffect(() => {
    if (isOpen) {
      setTitle(service?.title || '')
      setDescription(service?.description || '')
      setPrice(service?.price?.toString() || '')
      setDeliveryTime(service?.delivery_time || '')
      setErrors({})
    }
  }, [isOpen, service])

  // Fiyat: sadece rakam ve nokta (ondalık ayırıcı)
  const handlePriceChange = (e) => {
    let value = e.target.value.replace(',', '.') // virgülü noktaya çevir
    // Sadece rakam ve tek nokta
    value = value.replace(/[^0-9.]/g, '')
    // Birden fazla nokta engelleme
    const parts = value.split('.')
    if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('')
    // Maks 7 hane tam + 2 hane ondalık
    if (parts[0]?.length > 7) value = parts[0].slice(0, 7) + (parts[1] !== undefined ? '.' + parts[1] : '')
    if (parts[1]?.length > 2) value = parts[0] + '.' + parts[1].slice(0, 2)
    setPrice(value)
    if (errors.price) setErrors(prev => ({ ...prev, price: null }))
  }

  const validate = () => {
    const newErrors = {}

    if (!title.trim()) {
      newErrors.title = 'Hizmet adı zorunludur'
    } else if (title.trim().length < 3) {
      newErrors.title = 'Hizmet adı en az 3 karakter olmalı'
    }

    if (!description.trim()) {
      newErrors.description = 'Açıklama zorunludur'
    } else if (description.trim().length < 10) {
      newErrors.description = 'Açıklama en az 10 karakter olmalı'
    }

    if (!price) {
      newErrors.price = 'Fiyat zorunludur'
    } else {
      const priceNum = parseFloat(price)
      if (isNaN(priceNum) || priceNum <= 0) {
        newErrors.price = 'Geçerli bir fiyat girin'
      } else if (priceNum > 9999999) {
        newErrors.price = 'Fiyat çok yüksek'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setSaving(true)
    try {
      await onSave({
        title: title.trim(),
        description: description.trim(),
        price: parseFloat(price),
        delivery_time: deliveryTime.trim() || null,
        currency: 'TRY',
      }, serviceIndex)
      showToast(
        isEditMode ? 'Hizmet güncellendi' : 'Hizmet eklendi',
        'success'
      )
      onClose()
    } catch (error) {
      showToast('Hata: ' + error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const inputClass = (hasError) =>
    `w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none transition-colors text-base ${
      hasError
        ? 'border-red-500 focus:border-red-500'
        : 'border-gray-200 dark:border-gray-600 focus:border-blue-500'
    }`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? '✏️ Hizmeti Düzenle' : '🛍️ Yeni Hizmet'}
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
        {/* Hizmet Adı */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Hizmet Adı <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value)
              if (errors.title) setErrors(prev => ({ ...prev, title: null }))
            }}
            className={inputClass(errors.title)}
            placeholder="örn: Logo Tasarımı, Web Sitesi Geliştirme"
            maxLength={80}
            autoFocus
          />
          {errors.title && (
            <p className="text-xs text-red-500 mt-1">⚠️ {errors.title}</p>
          )}
        </div>

        {/* Açıklama */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Açıklama <span className="text-red-500">*</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              if (errors.description) setErrors(prev => ({ ...prev, description: null }))
            }}
            rows={3}
            className={`${inputClass(errors.description)} resize-none`}
            placeholder="Müşterilerinize ne sunduğunuzu kısaca anlatın..."
            maxLength={300}
          />
          <div className="flex items-center justify-between mt-1">
            {errors.description ? (
              <p className="text-xs text-red-500">⚠️ {errors.description}</p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-400">En az 10 karakter</p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400">{description.length}/300</p>
          </div>
        </div>

        {/* Fiyat & Teslim Süresi (Grid) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Fiyat */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Fiyat (₺) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 dark:text-gray-400 font-semibold">
                ₺
              </span>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={handlePriceChange}
                className={`${inputClass(errors.price)} pl-10 font-mono`}
                placeholder="500"
              />
            </div>
            {errors.price && (
              <p className="text-xs text-red-500 mt-1">⚠️ {errors.price}</p>
            )}
          </div>

          {/* Teslim Süresi */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Teslim Süresi <span className="text-gray-400 font-normal">(opsiyonel)</span>
            </label>
            <input
              type="text"
              value={deliveryTime}
              onChange={(e) => setDeliveryTime(e.target.value)}
              className={inputClass(false)}
              placeholder="örn: 3-5 gün"
              maxLength={30}
            />
          </div>
        </div>

        {/* Önizleme */}
        {(title || description || price) && (
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-800 dark:text-blue-300 mb-2">👀 Önizleme</p>
            <h4 className="font-semibold text-gray-900 dark:text-gray-100">
              {title || 'Hizmet Adı'}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
              {description || 'Hizmet açıklaması burada görünecek'}
            </p>
            <div className="flex items-center gap-3 mt-2">
              <span className="font-bold text-blue-600 dark:text-blue-400">
                ₺{price || '0'}
              </span>
              {deliveryTime && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  ⏱️ {deliveryTime}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}