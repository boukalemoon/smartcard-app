import { useState, useEffect } from 'react'
import Modal from './Modal'
import { useToast } from './Toast'
import { User, Building2 } from 'lucide-react'

/**
 * BillingInfoModal
 *
 * Props:
 * - isOpen, onClose
 * - billingInfo: object | null — düzenleme modunda mevcut bilgi, ekleme modunda null
 * - onSave: (billingData) => Promise<void> — kaydet callback
 */
export default function BillingInfoModal({ isOpen, onClose, billingInfo = null, onSave }) {
  const { showToast } = useToast()
  const isEditMode = !!billingInfo

  const [isIndividual, setIsIndividual] = useState(true)
  const [companyTitle, setCompanyTitle] = useState('')
  const [taxOffice, setTaxOffice] = useState('')
  const [taxNumber, setTaxNumber] = useState('')
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Modal açıldığında form'u doldur (edit) veya temizle (add)
  useEffect(() => {
    if (isOpen) {
      setIsIndividual(billingInfo?.is_individual ?? true)
      setCompanyTitle(billingInfo?.company_title || '')
      setTaxOffice(billingInfo?.tax_office || '')
      setTaxNumber(billingInfo?.tax_number || '')
      setAddress(billingInfo?.address || '')
      setErrors({})
    }
  }, [isOpen, billingInfo])

  // Vergi/TC numarası: sadece rakam, 11 veya 10 hane
  const handleTaxNumberChange = (e) => {
    const cleaned = e.target.value.replace(/\D/g, '')
    const maxLength = isIndividual ? 11 : 10
    setTaxNumber(cleaned.slice(0, maxLength))
    if (errors.taxNumber) setErrors(prev => ({ ...prev, taxNumber: null }))
  }

  const validate = () => {
    const newErrors = {}

    if (!companyTitle.trim()) {
      newErrors.companyTitle = isIndividual ? 'Ad Soyad zorunludur' : 'Şirket ünvanı zorunludur'
    } else if (companyTitle.trim().length < 2) {
      newErrors.companyTitle = 'En az 2 karakter olmalı'
    }

    // Vergi/TC numarası opsiyonel ama girilmişse format kontrol
    if (taxNumber) {
      const expectedLength = isIndividual ? 11 : 10
      if (taxNumber.length !== expectedLength) {
        newErrors.taxNumber = isIndividual
          ? 'TC Kimlik No 11 hane olmalı'
          : 'Vergi numarası 10 hane olmalı'
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
        company_title: companyTitle.trim(),
        tax_office: taxOffice.trim() || null,
        tax_number: taxNumber || null,
        address: address.trim() || null,
        is_individual: isIndividual,
      })
      showToast(
        isEditMode ? 'Fatura bilgileri güncellendi' : 'Fatura bilgileri eklendi',
        'success'
      )
      onClose()
    } catch (error) {
      showToast('Hata: ' + error.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Bireysel ↔ Şirket geçişinde, geçişe uymayan tax_number'ı temizle
  const handleTypeToggle = (newIsIndividual) => {
    if (newIsIndividual !== isIndividual) {
      setIsIndividual(newIsIndividual)
      // Eğer mevcut numara yeni türe uymuyorsa temizle
      const expectedLength = newIsIndividual ? 11 : 10
      if (taxNumber && taxNumber.length !== expectedLength) {
        setTaxNumber('')
      }
      setErrors(prev => ({ ...prev, taxNumber: null }))
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
      title={isEditMode ? '✏️ Fatura Bilgilerini Düzenle' : '📋 Fatura Bilgileri'}
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
        {/* Bireysel / Şirket Toggle */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Tür
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleTypeToggle(true)}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                isIndividual
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              <User size={18} />
              <span>Bireysel</span>
            </button>
            <button
              type="button"
              onClick={() => handleTypeToggle(false)}
              className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl border-2 font-semibold transition-all ${
                !isIndividual
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'
                  : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300'
              }`}
            >
              <Building2 size={18} />
              <span>Şirket</span>
            </button>
          </div>
        </div>

        {/* Ünvan / Ad Soyad */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {isIndividual ? 'Ad Soyad' : 'Şirket Ünvanı'} <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={companyTitle}
            onChange={(e) => {
              setCompanyTitle(e.target.value)
              if (errors.companyTitle) setErrors(prev => ({ ...prev, companyTitle: null }))
            }}
            className={inputClass(errors.companyTitle)}
            placeholder={isIndividual ? 'Ahmet Yılmaz' : 'Sognare Ltd. Şti.'}
            maxLength={150}
            autoFocus
          />
          {errors.companyTitle && (
            <p className="text-xs text-red-500 mt-1">⚠️ {errors.companyTitle}</p>
          )}
        </div>

        {/* Vergi Dairesi */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Vergi Dairesi <span className="text-gray-400 font-normal">(opsiyonel)</span>
          </label>
          <input
            type="text"
            value={taxOffice}
            onChange={(e) => setTaxOffice(e.target.value)}
            className={inputClass(false)}
            placeholder="örn: Beşiktaş, Mecidiyeköy"
            maxLength={50}
          />
        </div>

        {/* TC Kimlik / Vergi Numarası */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            {isIndividual ? 'TC Kimlik No' : 'Vergi Numarası'}{' '}
            <span className="text-gray-400 font-normal">(opsiyonel)</span>
          </label>
          <input
            type="tel"
            inputMode="numeric"
            pattern="[0-9]*"
            value={taxNumber}
            onChange={handleTaxNumberChange}
            className={`${inputClass(errors.taxNumber)} font-mono`}
            placeholder={isIndividual ? '12345678901' : '1234567890'}
            maxLength={isIndividual ? 11 : 10}
          />
          {errors.taxNumber ? (
            <p className="text-xs text-red-500 mt-1">⚠️ {errors.taxNumber}</p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              💡 {isIndividual ? '11 haneli TC Kimlik numaranız' : '10 haneli vergi numaranız'}{' '}
              {taxNumber && (
                <span className={taxNumber.length === (isIndividual ? 11 : 10) ? 'text-green-600' : 'text-orange-500'}>
                  ({taxNumber.length}/{isIndividual ? 11 : 10})
                </span>
              )}
            </p>
          )}
        </div>

        {/* Adres */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Fatura Adresi <span className="text-gray-400 font-normal">(opsiyonel)</span>
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={3}
            className={`${inputClass(false)} resize-none`}
            placeholder="Mah. Sok. No: 1, İlçe / İl"
            maxLength={300}
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">
            {address.length}/300
          </p>
        </div>

        {/* Bilgi Kutusu */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            💡 Bu bilgiler kartvizitinizde görünür ve müşterileriniz tek tıkla kopyalayabilir. e-Fatura kesilirken hız sağlar.
          </p>
        </div>
      </div>
    </Modal>
  )
}