// Yönetici "Platform" sayfası — tasarım: Yonetici.dc.html
// 5 istatistik, plan dağılımı, dikkat gerektirenler ve sekmeli kayıt tablosu.
import { ChevronRight } from 'lucide-react'
import { Kart, Istatistik } from '../ui'
import { sayi, yuzde, birlestir } from '../bicim'

const NOKTA = {
  tehlike: 'bg-red-600 dark:bg-red-400',
  uyari: 'bg-amber-600 dark:bg-amber-400',
}

export function Istatistikler({ t }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3">
      <Istatistik
        etiket="Toplam kullanıcı"
        deger={sayi(t.toplamKullanici)}
        alt={`+${sayi(t.buHafta)} bu hafta`}
        altTon={t.buHafta ? 'olumlu' : 'notr'}
      />
      <Istatistik
        etiket="Aktif abonelik"
        deger={sayi(t.aktifUcretli)}
        alt={t.toplamKullanici ? `kullanıcıların ${yuzde(t.aktifUcretli, t.toplamKullanici)} ücretli` : 'ücretli plan'}
      />
      <Istatistik
        etiket="Aktif abonelik tutarı"
        deger={`₺${sayi(Math.round(t.yillikTutar))}`}
        alt={t.fiyatsiz ? `yıllığa çevrilmiş · ${sayi(t.fiyatsiz)} abonelik fiyatsız` : 'yıllığa çevrilmiş'}
        altTon={t.fiyatsiz ? 'vurgu' : 'notr'}
      />
      <Istatistik
        etiket="Bekleyen komisyon"
        deger={`₺${sayi(Math.round(t.bekleyenTutar))}`}
        alt={`${sayi(t.bekleyenSayi)} hakediş`}
        altTon={t.bekleyenSayi ? 'vurgu' : 'notr'}
      />
      <Istatistik
        etiket="NFC kart"
        deger={t.nfcKart === null ? '—' : sayi(t.nfcKart)}
        alt="kullanılan kart hakkı"
      />
    </div>
  )
}

export function PlanDagilimi({ t }) {
  const toplam = t.dagilim.reduce((a, p) => a + p.sayi, 0)
  const ozet = t.dagilim.map((p) => `${p.ad} ${yuzde(p.sayi, toplam)}`).join(', ')
  return (
    <Kart className="px-4 py-3.5 flex flex-col gap-2.5">
      <div className="flex justify-between gap-3 text-[13px]">
        <b className="text-metin">Plan dağılımı</b>
        <span className="text-metin-2">aktif abonelikler · {sayi(toplam)}</span>
      </div>
      {toplam ? (
        <div className="flex h-2.5 rounded-[5px] overflow-hidden gap-0.5" role="img" aria-label={`Plan dağılımı: ${ozet}`}>
          {t.dagilim.filter((p) => p.sayi).map((p) => (
            <span key={p.deger} className={p.cubuk} style={{ flex: p.sayi }} />
          ))}
        </div>
      ) : (
        <div className="h-2.5 rounded-[5px] bg-yuzey-2" aria-hidden="true" />
      )}
      <ul className="flex gap-x-3 gap-y-1 flex-wrap text-xs text-metin-2">
        {t.dagilim.map((p) => (
          <li key={p.deger} className="inline-flex items-center">
            <i className={birlestir('inline-block w-2 h-2 rounded-sm mr-1.5', p.cubuk)} aria-hidden="true" />
            {p.ad} <span className="ml-1 tabular-nums">{toplam ? yuzde(p.sayi, toplam) : '—'}</span>
          </li>
        ))}
      </ul>
    </Kart>
  )
}

export function DikkatGerektiren({ t, onGit }) {
  const gorunen = t.dikkat.filter((d) => d.sayi > 0)
  return (
    <Kart className="px-4 py-3.5 flex flex-col gap-2.5">
      <div className="flex justify-between gap-3 text-[13px]">
        <b className="text-metin">Dikkat gerektiren</b>
      </div>
      {gorunen.length === 0 ? (
        <p className="text-[13px] text-metin-2">Şu an dikkat gerektiren bir kayıt yok.</p>
      ) : (
        <ul className="flex flex-col gap-1 text-[13px]">
          {gorunen.map((d) => {
            const icerik = (
              <>
                <span className="flex items-center gap-2 min-w-0">
                  <i className={birlestir('w-2 h-2 rounded-full inline-block shrink-0', NOKTA[d.ton])} aria-hidden="true" />
                  <span className="truncate">{d.ad}</span>
                </span>
                <span className="flex items-center gap-1">
                  <b className="tabular-nums">{sayi(d.sayi)}</b>
                  {d.hedef && <ChevronRight size={14} className="text-metin-2" aria-hidden="true" />}
                </span>
              </>
            )
            return (
              <li key={d.anahtar}>
                {d.hedef ? (
                  <button
                    type="button"
                    onClick={() => onGit(d.hedef)}
                    className="w-[calc(100%+0.75rem)] flex justify-between items-center gap-2 text-left rounded-md -mx-1.5 px-1.5 py-0.5 hover:bg-yuzey-2 text-metin"
                  >
                    {icerik}
                  </button>
                ) : (
                  <div className="flex justify-between items-center gap-2 py-0.5 text-metin">{icerik}</div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </Kart>
  )
}
