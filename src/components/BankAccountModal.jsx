import { useState, useEffect } from 'react'
import Modal from './Modal'
import { useToast } from './Toast'

/**
 * BankAccountModal
 *
 * Props:
 * - isOpen, onClose
 * - account: object | null — düzenleme modunda mevcut hesap, ekleme modunda null
 * - onSave: (accountData) => Promise<void> — kaydet callback (hata yönetimi parent'ta)
 */
export default function BankAccountModal({ isOpen, onClose, account = null, onSave }) {
  const { showToast } = useToast()
  const isEditMode = !!account

  const [bankName, setBankName] = useState('')
  const [accountHolder, setAccountHolder] = useState('')
  const [iban, setIban] = useState('')
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  // Modal açıldığında form'u doldur (edit) veya temizle (add)
  useEffect(() => {
    if (isOpen) {
      setBankName(account?.bank_name || '')
      setAccountHolder(account?.account_holder || '')
      setIban(account?.iban || '')
      setErrors({})
    }
  }, [isOpen, account])

  // IBAN'ı 4'erli formatla göster (TR12 3456 7890 ...)
  const formatIban = (value) => {
    const clean = value.replace(/\s/g, '').toUpperCase()
    return clean.match(/.{1,4}/g)?.join(' ') || clean
  }

  const handleIbanChange = (e) => {
    const value = e.target.value.toUpperCase()
    // Sadece harf ve rakam kabul et, boşlukları temizle
    const clean = value.replace(/[^A-Z0-9]/g, '').slice(0, 26)
    setIban(formatIban(clean))
    if (errors.iban) setErrors(prev => ({ ...prev, iban: null }))
  }

  const validate = () => {
    const newErrors = {}

    if (!bankName.trim()) {
      newErrors.bankName = 'Banka adı zorunludur'
    } else if (bankName.trim().length < 2) {
      newErrors.bankName = 'Banka adı en az 2 karakter olmalı'
    }

    if (!accountHolder.trim()) {
      newErrors.accountHolder = 'Hesap sahibi zorunludur'
    } else if (accountHolder.trim().length < 3) {
      newErrors.accountHolder = 'Hesap sahibi en az 3 karakter olmalı'
    }

    const cleanIban = iban.replace(/\s/g, '').toUpperCase()
    if (!cleanIban) {
      newErrors.iban = 'IBAN zorunludur'
    } else if (!/^TR[0-9]{24}$/.test(cleanIban)) {
      newErrors.iban = 'Geçersiz IBAN. Format: TR + 24 rakam (toplam 26 karakter)'
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setSaving(true)
    try {
      await onSave({
        bank_name: bankName.trim(),
        account_holder: accountHolder.trim(),
        iban: iban.replace(/\s/g, '').toUpperCase(),
      })
      showToast(
        isEditMode ? 'Banka hesabı güncellendi' : 'Banka hesabı eklendi',
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
    `w-full px-4 py-3 border-2 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 outline-none transition-colors ${
      hasError
        ? 'border-red-500 focus:border-red-500'
        : 'border-gray-200 dark:border-gray-600 focus:border-blue-500'
    }`

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEditMode ? '✏️ Banka Hesabı Düzenle' : '🏦 Yeni Banka Hesabı'}
      size="md"
      closeOnOverlayClick={!saving}
      footer={
        <div className="flex gap-2 justify-end">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            İptal
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center gap-2"
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
        {/* Banka Adı */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Banka Adı <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={bankName}
            onChange={(e) => {
              setBankName(e.target.value)
              if (errors.bankName) setErrors(prev => ({ ...prev, bankName: null }))
            }}
            className={inputClass(errors.bankName)}
            placeholder="örn: Garanti BBVA, İş Bankası"
            maxLength={50}
            autoFocus
          />
          {errors.bankName && (
            <p className="text-xs text-red-500 mt-1">⚠️ {errors.bankName}</p>
          )}
        </div>

        {/* Hesap Sahibi */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Hesap Sahibi <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={accountHolder}
            onChange={(e) => {
              setAccountHolder(e.target.value)
              if (errors.accountHolder) setErrors(prev => ({ ...prev, accountHolder: null }))
            }}
            className={inputClass(errors.accountHolder)}
            placeholder="Ad Soyad veya Şirket Ünvanı"
            maxLength={100}
          />
          {errors.accountHolder && (
            <p className="text-xs text-red-500 mt-1">⚠️ {errors.accountHolder}</p>
          )}
        </div>

        {/* IBAN */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            IBAN <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={iban}
            onChange={handleIbanChange}
            className={`${inputClass(errors.iban)} font-mono`}
            placeholder="TR00 0000 0000 0000 0000 0000 00"
            maxLength={32} // 26 karakter + 6 boşluk
          />
          {errors.iban ? (
            <p className="text-xs text-red-500 mt-1">⚠️ {errors.iban}</p>
          ) : (
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              💡 TR ile başlamalı, toplam 26 karakter (boşluklar otomatik eklenir)
            </p>
          )}
        </div>

        {/* Bilgi Kutusu */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            🔒 Banka bilgileriniz sadece sizin profilinizde görünür. Müşterileriniz tek tıkla IBAN'ı kopyalayabilir.
          </p>
        </div>
      </div>
    </Modal>
  )
}