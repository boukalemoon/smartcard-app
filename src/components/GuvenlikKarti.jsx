import { useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import { TotpSetup, BackupCodes, useMfaStatus, useShieldAuth } from '../vendor/shieldauth-react/index.js'
import { useAdimAtlama } from '../hooks/useAdimAtlama'
import { useToast } from './Toast'

// HESAP GÜVENLİĞİ — doğrulama uygulaması (TOTP) ve yedek kodlar
//
// QRtım hesabı Arku, İlgezdi ve Tınga'nın da anahtarı. Bu kart kişinin o
// anahtarı ikinci bir faktörle kilitlemesini sağlar. Kapatmak ve yedek kodları
// yenilemek taze doğrulama ister: oturumu çalan biri korumayı kaldıramasın.
export default function GuvenlikKarti() {
  const { data, loading, error, reload } = useMfaStatus()
  const { client } = useShieldAuth()
  const { adimAtla } = useAdimAtlama()
  const { showToast } = useToast()
  const [kurulum, setKurulum] = useState(false)
  const [yeniKodlar, setYeniKodlar] = useState(null)
  const [mesgul, setMesgul] = useState(false)

  const yedekKodlariYenile = async () => {
    if (!(await adimAtla({ sebep: 'Yedek kodları yenilemek', zorla: true }))) return
    setMesgul(true)
    try {
      const r = await client.regenerateBackup()
      setYeniKodlar(r.backupCodes)
      reload()
    } catch {
      showToast('Yedek kodlar yenilenemedi, tekrar deneyin.', 'error')
    }
    setMesgul(false)
  }

  const kapat = async () => {
    if (!(await adimAtla({ sebep: 'İki adımlı doğrulamayı kapatmak', zorla: true }))) return
    setMesgul(true)
    try {
      await client.disableTotp()
      showToast('Doğrulama uygulaması kaldırıldı', 'success')
      reload()
    } catch {
      showToast('İşlem tamamlanamadı, tekrar deneyin.', 'error')
    }
    setMesgul(false)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">İki adımlı doğrulama</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">QRtım ve bağlı uygulamalar (Arku, İlgezdi, Tınga) için ek koruma</p>
        </div>
      </div>

      {loading && <p className="text-sm text-gray-500">Yükleniyor…</p>}
      {error && <p className="text-sm text-red-600">Durum alınamadı. Sayfayı yenileyip tekrar deneyin.</p>}

      {data && !data.totp?.verified && !kurulum && (
        <div className="space-y-3">
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Şifreniz ele geçirilse bile hesabınıza girilemesin: Google Authenticator veya Microsoft Authenticator ile
            ikinci bir doğrulama ekleyin.
          </p>
          <button
            type="button"
            onClick={() => setKurulum(true)}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors"
          >
            Doğrulama uygulamasını kur
          </button>
        </div>
      )}

      {kurulum && (
        <TotpSetup onComplete={() => { setKurulum(false); reload(); showToast('İki adımlı doğrulama açıldı', 'success') }} />
      )}

      {data?.totp?.verified && !kurulum && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300 font-semibold">Açık</span>
            <span className="text-gray-500 dark:text-gray-400">Kalan yedek kod: {data.backupCodesRemaining ?? 0}</span>
          </div>
          {yeniKodlar && <BackupCodes codes={yeniKodlar} onConfirm={() => setYeniKodlar(null)} />}
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={mesgul} onClick={yedekKodlariYenile}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-100 rounded-lg text-sm font-semibold hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50">
              Yedek kodları yenile
            </button>
            <button type="button" disabled={mesgul} onClick={kapat}
              className="px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-900/40 disabled:opacity-50">
              Kapat
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
