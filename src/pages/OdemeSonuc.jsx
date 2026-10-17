import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle, Loader2, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import SiteKabugu from '../site/SiteKabugu'
import { DurumKarti } from '../site/sayfalar/ortak'
import { dugme } from '../site/sayfalar/siniflar'

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

  const [yoklananDurum, setDurum] = useState('dogrulaniyor')
  const [detay, setDetay] = useState(null)

  // Niyet kimliği yoksa yoklanacak bir şey yok; sonuç doğrudan adresten
  // türetilir (eskiden effect içinde set ediliyordu, davranış aynı).
  const durum = niyetId ? yoklananDurum : (MESAJLAR[donenDurum] ? 'hata' : 'bilinmiyor')

  useEffect(() => {
    if (!niyetId) return

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

  const panelDugmesi = <Link to="/dashboard" className={dugme('ana')}>Panele dön</Link>

  let kart
  if (durum === 'dogrulaniyor') {
    kart = (
      <DurumKarti ikon={Loader2} donen ton="aksan" ust="Ödeme" baslik="Ödemeniz doğrulanıyor">
        Bankadan onay bekleniyor. Bu sayfayı kapatmayın.
      </DurumKarti>
    )
  } else if (durum === 'odendi') {
    kart = (
      <DurumKarti ikon={CheckCircle2} ton="olumlu" ust="Ödeme" baslik="Ödeme tamamlandı" eylemler={panelDugmesi}>
        {tutar && <>{tutar} tutarındaki ödemeniz alındı. </>}
        Planınız hesabınıza tanımlandı.
      </DurumKarti>
    )
  } else if (durum === 'hata') {
    kart = (
      <DurumKarti ikon={XCircle} ton="hata" ust="Ödeme" baslik="Ödeme tamamlanamadı" eylemler={panelDugmesi}>
        {MESAJLAR[donenDurum] || MESAJLAR.basarisiz}
      </DurumKarti>
    )
  } else {
    // gecikti | bilinmiyor | oturum_gerekli
    const oturum = durum === 'oturum_gerekli'
    kart = (
      <DurumKarti
        ikon={AlertTriangle}
        ton="uyari"
        ust="Ödeme"
        baslik={oturum ? 'Oturum açmanız gerekiyor' : 'Sonuç henüz netleşmedi'}
        eylemler={panelDugmesi}
      >
        {oturum
          ? 'Ödeme sonucunu görmek için hesabınıza giriş yapın.'
          : 'Banka onayı gecikiyor. Kartınızdan çekim yapıldıysa planınız birkaç dakika içinde tanımlanır; panelinizden kontrol edebilirsiniz. Lütfen tekrar ödeme yapmayın.'}
      </DurumKarti>
    )
  }

  return (
    <SiteKabugu className="flex items-center">
      <div className="w-full px-4 py-16 sm:py-24" aria-live="polite">{kart}</div>
    </SiteKabugu>
  )
}
