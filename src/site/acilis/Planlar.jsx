import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, ChartLine, RefreshCw, X } from 'lucide-react'
import { birlestir } from '../../panel/bicim'
import { PLANLAR, yillikKartHediyesiVar } from '../../lib/planlar'
import { refliAdres } from '../yardim'
import { BOLUM_KAYMA, DUGME, H2, KAP, ODAK, UST } from './siniflar'

const sayiBicimi = new Intl.NumberFormat('tr-TR')
const tutar = (n) => `₺${sayiBicimi.format(n)}`

// Ücretli plan düğmesi kayıt sayfasına plan anahtarıyla gider; partner kodu
// (?ref=) refliAdres ile korunur. Kurumsal satış görüşmeyle başlar.
function planAdresi(plan) {
  if (plan.iletisim) return '/iletisim'
  if (plan.fiyat.aylik === 0) return refliAdres('/signup')
  return refliAdres(`/signup?plan=${plan.anahtar}`)
}

export default function Planlar() {
  const [donem, setDonem] = useState('yillik')

  return (
    <section id="planlar" className={`${BOLUM_KAYMA} ${KAP} pt-16 lg:pt-[88px] pb-14 lg:pb-[72px] flex flex-col gap-8 lg:gap-9`}>
      <div className="flex flex-wrap justify-between items-end gap-6">
        <div className="flex flex-col gap-3 max-w-[680px]">
          <span className={`${UST} text-aksan`}>Planlar</span>
          <h2 className={birlestir(H2, 'text-metin')}>Ücretsiz başlayın; veriniz ve bağlantılarınız büyüdükçe geçin</h2>
          <p className="text-[17px] leading-relaxed text-metin-2">
            Ücretsiz plan gerçek bir karttır, sınırları vardır. Ücretli planlar iki şey ekler: kartınızın{' '}
            <b className="font-semibold text-metin">tüm verisine</b> erişim ve kullandığınız uygulamalarla{' '}
            <b className="font-semibold text-metin">senkron</b>.
          </p>
        </div>
        <div role="group" aria-label="Ödeme dönemi" className="inline-flex bg-yuzey-2 rounded-xl p-1">
          {[
            { deger: 'aylik', ad: 'Aylık' },
            { deger: 'yillik', ad: 'Yıllık', ek: yillikKartHediyesiVar ? '· kart hediyeli' : null },
          ].map((s) => {
            const secili = donem === s.deger
            return (
              <button
                key={s.deger}
                type="button"
                aria-pressed={secili}
                onClick={() => setDonem(s.deger)}
                className={birlestir(
                  'h-10 px-[18px] rounded-[9px] text-sm font-semibold transition-colors whitespace-nowrap',
                  ODAK,
                  secili ? 'bg-yuzey text-metin shadow-sm' : 'text-metin-2 hover:text-metin',
                )}
              >
                {s.ad}
                {s.ek && <span className="text-aksan"> {s.ek}</span>}
              </button>
            )
          })}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <DegerKarti
          ikon={ChartLine}
          ton="bg-aksan-acik text-aksan-koyu dark:text-aksan"
          baslik="Tam veri erişimi"
          metin="Ziyaretçiler nereden ve hangi kanaldan geldi (QR, NFC, bağlantı), hangi bağlantıya tıklandı, kaç kişi rehbere kaydetti. Tarih aralığı ve CSV dışa aktarım."
        />
        <DegerKarti
          ikon={RefreshCw}
          ton="bg-vurgu-acik text-vurgu"
          baslik="Kullandığınız uygulamalarla senkron"
          metin="Arku Remote, Tınga ve İlgezdi'ye QRtım hesabınızla girin; ücretli planlarda daha fazla cihaz ve şifre senkronu. Cüzdan kartı yakında."
        />
      </div>

      <ul className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-stretch">
        {PLANLAR.map((p) => <PlanKarti key={p.anahtar} plan={p} donem={donem} />)}
      </ul>
    </section>
  )
}

function DegerKarti({ ikon, ton, baslik, metin }) {
  const Ikon = ikon
  return (
    <div className="flex gap-4 items-start p-[22px] rounded-2xl bg-yuzey border border-cizgi">
      <span className={birlestir('w-10 h-10 shrink-0 rounded-[10px] inline-flex items-center justify-center', ton)}>
        <Ikon size={20} aria-hidden="true" />
      </span>
      <div>
        <h3 className="font-sans text-base font-semibold tracking-normal text-metin">{baslik}</h3>
        <p className="mt-1 text-sm leading-relaxed text-metin-2">{metin}</p>
      </div>
    </div>
  )
}

function PlanKarti({ plan, donem }) {
  const koyu = plan.koyu
  const ucretsiz = plan.fiyat.aylik === 0
  const yillik = donem === 'yillik'
  const ana = yillik ? plan.fiyat.yillik : plan.fiyat.aylik
  const ikinci = yillik ? plan.fiyat.aylik : plan.fiyat.yillik
  const soluk = koyu ? 'text-lacivert-200' : 'text-metin-2'

  return (
    <li
      className={birlestir(
        'relative flex flex-col gap-3.5 p-6 rounded-2xl min-w-0',
        koyu
          ? 'bg-lacivert-950 text-white border border-lacivert-950 dark:border-white/15'
          : plan.onerilen
            ? 'bg-yuzey text-metin border-2 border-aksan'
            : 'bg-yuzey text-metin border border-cizgi',
      )}
    >
      {plan.onerilen && (
        <span className="absolute -top-3 left-5 bg-aksan text-white dark:text-zemin rounded-full px-2.5 py-[3px] text-xs font-semibold">
          Önerilen
        </span>
      )}
      <div>
        <h3 className={birlestir('font-baslik text-lg font-bold leading-tight', koyu ? 'text-white' : 'text-metin')}>{plan.ad}</h3>
        <span className={birlestir('text-[13px]', soluk)}>{plan.alt}</span>
      </div>
      <div>
        <span className="font-baslik font-extrabold text-[28px] tracking-[-0.02em]">{tutar(ana)}</span>
        {!ucretsiz && <span className={birlestir('text-sm', soluk)}> /{yillik ? 'yıl' : 'ay'}</span>}
        {!ucretsiz && (
          <div className={birlestir('text-xs', soluk)}>veya {tutar(ikinci)}/{yillik ? 'ay' : 'yıl'}</div>
        )}
      </div>
      <Link
        to={planAdresi(plan)}
        className={birlestir(koyu ? DUGME.vurguKoyu : plan.onerilen ? DUGME.ana : DUGME.ikincil, 'w-full px-3')}
      >
        {plan.dugme}
      </Link>
      <ul className="flex flex-col gap-2 text-sm leading-snug">
        {plan.maddeler.map((m) => (
          <li key={m.metin} className={birlestir('flex gap-2 items-start', m.yok && soluk)}>
            {m.yok ? (
              <X size={16} strokeWidth={2.5} className={birlestir('shrink-0 mt-[1px]', koyu ? 'text-lacivert-300' : 'text-metin-2/60')} aria-hidden="true" />
            ) : (
              <Check
                size={16}
                strokeWidth={2.5}
                className={birlestir('shrink-0 mt-[1px]', m.kart ? 'text-vurgu' : koyu ? 'text-marka-acik' : 'text-aksan')}
                aria-hidden="true"
              />
            )}
            <span>
              {m.yok && <span className="sr-only">Dahil değil: </span>}
              {m.metin}
            </span>
          </li>
        ))}
      </ul>
    </li>
  )
}
