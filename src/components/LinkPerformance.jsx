import { useEffect, useState } from 'react'
import { MousePointerClick, QrCode, Nfc } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// BAĞLANTI PERFORMANSI
//
// Tıklamalar başından beri hangi bağlantıya ait olduğu bilgisiyle
// kaydediliyordu; panel yalnızca toplamı gösteriyordu ("14 tıklama" — neye,
// belli değil). Veri zaten elimizdeydi.
//
// Kaynak kırılımı bizim farkımız: tıklamanın QR okutandan mı, NFC'den mi,
// yoksa bağlantıdan mı geldiğini söyleyebiliyoruz. Bağlantı listesi ürünleri
// bunu yapamaz, çünkü onlarda basılı kart ile bağlantı aynı ölçüm hattında
// değil.

export default function LinkPerformance({ aralik }) {
  const [baglantilar, setBaglantilar] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)

  // Dönem hızlıca değiştirilirse eski isteğin geç dönen cevabı yenisinin
  // üstüne yazabilir; iptal bayrağı bunu engelliyor.
  useEffect(() => {
    let iptal = false
    ;(async () => {
      const { data, error } = await supabase.rpc('my_link_performance', {
        p_from: aralik?.from || null,
        p_to: aralik?.to || null,
      })
      if (iptal) return
      if (error) console.error('Bağlantı performansı alınamadı:', error)
      setBaglantilar(data?.ok ? data.baglantilar : [])
      setYukleniyor(false)
    })()
    return () => { iptal = true }
  }, [aralik?.from, aralik?.to])

  if (yukleniyor) return null
  if (baglantilar.length === 0) return null

  const enYuksek = Math.max(...baglantilar.map((b) => b.toplam), 1)

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-1">
        <MousePointerClick className="text-blue-600 dark:text-blue-400" size={20} />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Hangi bağlantı çalışıyor</h2>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        {aralik?.from ? 'Seçili dönemdeki' : 'Tüm zamanlardaki'} tıklamalar.
      </p>

      <div className="space-y-3">
        {baglantilar.map((b, i) => (
          <div key={`${b.ad}-${i}`}>
            <div className="flex items-center justify-between gap-3 mb-1">
              <div className="min-w-0">
                <span className="font-semibold text-gray-900 dark:text-gray-100">
                  {b.ad || 'Adı kaydedilmemiş bağlantı'}
                </span>
                {/* Silinmiş bağlantının tıklamalarını da gösteriyoruz;
                    yoksa geçmiş toplam ile kalemlerin toplamı tutmazdı. */}
                {!b.hala_var && (
                  <span className="ml-2 text-[11px] text-gray-500">artık kartta değil</span>
                )}
              </div>
              <span className="font-bold text-gray-900 dark:text-gray-100 shrink-0">{b.toplam}</span>
            </div>

            <div className="h-2 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.round((b.toplam / enYuksek) * 100)}%` }}
              />
            </div>

            {(b.qr > 0 || b.nfc > 0) && (
              <div className="flex gap-3 mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                {b.qr > 0 && <span className="flex items-center gap-1"><QrCode size={12} />QR: {b.qr}</span>}
                {b.nfc > 0 && <span className="flex items-center gap-1"><Nfc size={12} />NFC: {b.nfc}</span>}
              </div>
            )}
            {b.kaynaksiz > 0 && b.qr === 0 && b.nfc === 0 && (
              <div className="mt-1 text-[11px] text-gray-400">
                kaynağı ölçülmemiş (ölçüm öncesi kayıtlar)
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
