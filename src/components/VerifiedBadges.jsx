import { useState } from 'react'
import { BadgeCheck, Globe, Building2, X } from 'lucide-react'

// DOĞRULAMA ROZETLERİ (herkese açık kartta)
//
// Rozet genel bir "onaylı hesap" tiki DEĞİL. Her rozet neyin doğrulandığını
// söyler ve tıklanınca kanıtı açılır: ne, nasıl, ne zaman. Ziyaretçi rozetin
// ne kadar ağır bastığına kendisi karar verebilsin diye.
//
// Bizi Linktree'den ayıran nokta burası: orada doğrulama görünmez, burada
// denetlenebilir.

function tarih(t) {
  if (!t) return null
  return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

const YONTEM_ACIKLAMA = {
  dns_txt: 'Alan adının DNS kayıtlarına yalnızca sahibinin yazabileceği bir değer konuldu ve iki bağımsız DNS sunucusunda doğrulandı.',
  kurum_alan_adi: 'Kurumun alan adı doğrulandı ve kurum yöneticisi bu kişinin üyeliğini onayladı.',
  well_known: 'Alan adındaki doğrulama dosyası kontrol edildi.',
}

function rozetBilgisi(d) {
  if (d.tur === 'alan_adi') {
    return {
      simge: Globe,
      baslik: d.konu,
      kisa: 'alan adı doğrulandı',
      uzun: `${d.konu} alan adının sahipliği doğrulandı.`,
    }
  }
  if (d.tur === 'kurum') {
    return {
      simge: Building2,
      baslik: d.konu,
      kisa: d.rol === 'admin' ? 'kurum yöneticisi' : 'kurum üyesi',
      uzun: `${d.konu} kurumunda ${d.rol === 'admin' ? 'yönetici' : 'üye'}. Kurumun alan adı (${d.kurum_alan_adi}) doğrulanmış durumda.`,
    }
  }
  return { simge: BadgeCheck, baslik: d.konu, kisa: 'doğrulandı', uzun: `${d.konu} doğrulandı.` }
}

export default function VerifiedBadges({ dogrulamalar, temaRengi }) {
  const [acik, setAcik] = useState(false)
  if (!dogrulamalar || dogrulamalar.length === 0) return null

  const renk = temaRengi || '#3B82F6'

  return (
    <>
      <div className="flex flex-wrap items-center justify-center gap-1.5">
        {dogrulamalar.map((d, i) => {
          const b = rozetBilgisi(d)
          const Simge = b.simge
          return (
            <button
              key={`${d.tur}-${d.konu}-${i}`}
              onClick={() => setAcik(true)}
              title="Doğrulama ayrıntısı"
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium hover:bg-white/30 transition-colors"
            >
              <Simge size={13} />
              <span className="max-w-[160px] truncate">{b.baslik}</span>
              <BadgeCheck size={13} className="shrink-0" />
            </button>
          )
        })}
      </div>

      {acik && (
        <div
          className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setAcik(false)}
        >
          <div
            className="bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-md max-h-[85vh] overflow-y-auto text-left"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <BadgeCheck size={18} style={{ color: renk }} />
                Neler doğrulandı
              </h3>
              <button onClick={() => setAcik(false)} className="p-1 text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {dogrulamalar.map((d, i) => {
                const b = rozetBilgisi(d)
                const Simge = b.simge
                return (
                  <div key={`ayrinti-${i}`} className="flex gap-3 p-3 rounded-xl border border-gray-200">
                    <Simge size={18} className="shrink-0 mt-0.5" style={{ color: renk }} />
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-900 break-words">{b.baslik}</div>
                      <p className="text-sm text-gray-600 mt-0.5">{b.uzun}</p>
                      <p className="text-xs text-gray-500 mt-1.5">
                        {YONTEM_ACIKLAMA[d.yontem] || 'Doğrulandı.'}
                      </p>
                      {d.dogrulandi_at && (
                        <p className="text-[11px] text-gray-400 mt-1">
                          Doğrulama tarihi: {tarih(d.dogrulandi_at)}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Rozetin sınırını açıkça söylüyoruz. Ziyaretçinin rozete
                  olduğundan fazla anlam yüklemesi, hiç rozet olmamasından
                  kötü: sahte güven gerçek güvenden tehlikelidir. */}
              <p className="text-xs text-gray-500 leading-relaxed pt-1">
                Bu rozetler yukarıda yazan şeyleri doğrular — daha fazlasını değil.
                QRtım kişinin kimliğine kefil olmaz; yalnızca kontrol ettiği şeyi,
                nasıl kontrol ettiğini ve ne zaman kontrol ettiğini gösterir.
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
