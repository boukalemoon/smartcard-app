import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle, XCircle, Loader, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// Banka ödeme sonrası dönüş sayfası.
//
// ÖNEMLİ: Adres çubuğundaki `durum` parametresine GÜVENİLMEZ — herkes
// `/odeme/sonuc?durum=odendi` yazabilir. Başarı yalnızca veritabanı
// (`payment_status`) ödemenin gerçekten işlendiğini söylediğinde gösterilir.
// Banka bildirimi dönüşten birkaç saniye sonra gelebileceği için kısa bir
// süre yoklanır.

const YOKLAMA_MS = 2000
const EN_FAZLA_DENEME = 15

const MESAJLAR = {
  basarisiz: 'Ödeme banka tarafından onaylanmadı. Kartınızdan çekim yapılmadıysa tekrar deneyebilirsiniz.',
  tutar_uyusmazligi: 'Ödeme tutarı doğrulanamadı. Hesabınıza hak tanımlanmadı; çekim yapıldıysa destek ekibimiz iade sürecini başlatacak.',
  dogrulanamadi: 'Ödeme bildirimi doğrulanamadı. Hesabınıza hak tanımlanmadı.',
  altyapi_hazir_degil: 'Ödeme altyapısı henüz aktif değil.',
}

export default function OdemeSonuc() {
  const [params] = useSearchParams()
  const niyetId = params.get('niyet')
  const donenDurum = params.get('durum')

  const [durum, setDurum] = useState('dogrulaniyor')
  const [detay, setDetay] = useState(null)

  useEffect(() => {
    if (!niyetId) {
      setDurum(MESAJLAR[donenDurum] ? 'hata' : 'bilinmiyor')
      return
    }

    let deneme = 0
    let iptal = false

    const yokla = async () => {
      deneme++
      const { data, error } = await supabase.rpc('payment_status', { p_intent_id: niyetId })
      if (iptal) return

      if (error || !data) {
        // Oturum yoksa veya niyet bu kullanıcıya ait değilse sonuç gösterilmez.
        setDurum('oturum_gerekli')
        return
      }
      setDetay(data)

      if (data.odendi_mi) return setDurum('odendi')
      if (data.durum === 'basarisiz' || data.durum === 'iptal') return setDurum('hata')
      if (deneme >= EN_FAZLA_DENEME) return setDurum('gecikti')
      setTimeout(yokla, YOKLAMA_MS)
    }

    yokla()
    return () => { iptal = true }
  }, [niyetId, donenDurum])

  const tutar = detay?.tutar_kurus != null
    ? (detay.tutar_kurus / 100).toLocaleString('tr-TR', { style: 'currency', currency: 'TRY' })
    : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {durum === 'dogrulaniyor' && (
          <>
            <Loader className="mx-auto mb-4 animate-spin text-indigo-500" size={48} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Ödemeniz doğrulanıyor</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Bankadan onay bekleniyor. Bu sayfayı kapatmayın.
            </p>
          </>
        )}

        {durum === 'odendi' && (
          <>
            <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Ödeme tamamlandı</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {tutar && <>{tutar} tutarındaki ödemeniz alındı. </>}
              Planınız hesabınıza tanımlandı.
            </p>
          </>
        )}

        {durum === 'hata' && (
          <>
            <XCircle className="mx-auto mb-4 text-red-500" size={48} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">Ödeme tamamlanamadı</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {MESAJLAR[donenDurum] || MESAJLAR.basarisiz}
            </p>
          </>
        )}

        {(durum === 'gecikti' || durum === 'bilinmiyor' || durum === 'oturum_gerekli') && (
          <>
            <AlertTriangle className="mx-auto mb-4 text-amber-500" size={48} />
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              {durum === 'oturum_gerekli' ? 'Oturum açmanız gerekiyor' : 'Sonuç henüz netleşmedi'}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
              {durum === 'oturum_gerekli'
                ? 'Ödeme sonucunu görmek için hesabınıza giriş yapın.'
                : 'Banka onayı gecikiyor. Kartınızdan çekim yapıldıysa planınız birkaç dakika içinde tanımlanır; panelinizden kontrol edebilirsiniz. Lütfen tekrar ödeme yapmayın.'}
            </p>
          </>
        )}

        {durum !== 'dogrulaniyor' && (
          <Link
            to="/dashboard"
            className="inline-block px-6 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
          >
            Panele dön
          </Link>
        )}
      </div>
    </div>
  )
}
