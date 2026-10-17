import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { birlestir } from '../../panel/bicim'
import { supabase } from '../../lib/supabaseClient'
import { refliAdres } from '../yardim'
import { BulucuDesen, BulucuIsaret } from './ortak'
import { BOLUM_KAYMA, DUGME, KAP, ODAK_KOYU, UST } from './siniflar'

// ------------------------------------------------------------ Partner bandı
const PARTNER_ADIMLARI = [
  // Karttaki partner bloğu panelde "Yakında"; burada vaat edilmez.
  { no: '1', baslik: 'Kodu paylaşın', metin: 'Panelinizdeki bağlantı ya da QR ile' },
  { no: '2', baslik: 'Kayıt olsunlar', metin: 'Kişi ya da kurum; durumu panelde görürsünüz' },
  { no: '3', baslik: '%10 hak ediş', metin: 'Ücretli pakete geçtiklerinde her ödemeden' },
]

export function PartnerBandi() {
  return (
    <section id="partner" className={`${BOLUM_KAYMA} ${KAP} pb-16 lg:pb-[88px]`}>
      <div className="relative overflow-hidden grid lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-8 lg:gap-10 items-center bg-marka text-white rounded-3xl p-6 sm:p-10 lg:p-12">
        <BulucuDesen className="absolute -right-10 -bottom-16 w-[300px] h-[300px] text-white/[0.12]" cizgi={0.8} />
        <div className="relative flex flex-col gap-3.5">
          <span className={`${UST} text-marka-acik`}>Partner programı</span>
          <h2 className="font-baslik font-extrabold text-[28px] sm:text-[36px] leading-[1.12] tracking-[-0.015em] text-white">Partner olun, %10 kazanın</h2>
          <p className="text-base leading-relaxed text-marka-acik max-w-[520px]">
            Kendi partner kodunuzla getirdiğiniz her kullanıcı ve kurumun ücretli ödemelerinden %10 hak ediş kazanırsınız.
            Kod, bağlantı ve QR panelinizde hazır; hak edişler kayıtlı IBAN'ınıza aktarılır.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3 mt-1">
            <Link to={refliAdres('/signup')} className={DUGME.beyaz}>Partner kodumu al</Link>
            <Link to="/iletisim" className={birlestir('inline-flex items-center gap-1.5 font-semibold text-white hover:text-marka-acik rounded', ODAK_KOYU)}>
              Program koşulları <ArrowRight size={16} aria-hidden="true" />
            </Link>
          </div>
        </div>
        <ol className="relative grid sm:grid-cols-3 gap-2.5">
          {PARTNER_ADIMLARI.map((a) => (
            <li key={a.no} className="flex flex-col gap-1.5 p-4 rounded-[14px] bg-white/10 border border-white/20">
              <span className="font-baslik font-extrabold text-[22px] leading-none" aria-hidden="true">{a.no}</span>
              <b className="text-[13px] font-semibold">{a.baslik}</b>
              <span className="text-xs leading-relaxed text-marka-acik">{a.metin}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ------------------------------------------------------------ NFC kart
// Basit, sabit bir QR görünümü (gerçek bir adres kodlamaz; süs).
const QR_DESEN = '1101110101010111010110101'

export function NfcKart() {
  return (
    <section id="nfc" className={`${BOLUM_KAYMA} ${KAP} pb-16 lg:pb-[88px]`}>
      <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 items-center bg-yuzey border border-cizgi rounded-3xl p-6 sm:p-10 lg:p-12">
        <div className="flex flex-col gap-4">
          <span className={`${UST} text-vurgu`}>NFC kart</span>
          <h2 className="font-baslik font-extrabold text-[28px] sm:text-[34px] leading-[1.12] tracking-[-0.015em] text-metin">
            Cebinizde tek kart, karşınızda güncel kimlik
          </h2>
          <p className="leading-relaxed text-metin-2">
            Kart tasarımını panelden seçin; adınız ve QR'ınız kartın üzerine basılır, çip kartınıza yazılır.
            Kartı kaybederseniz bağlantıyı panelden anında kapatırsınız.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link to="/nfc-cards" className={DUGME.vurgu}>Kart tasarla</Link>
            <Link to="/nfc-cards" className={DUGME.ikincil}>Örnek tasarımlar</Link>
          </div>
        </div>
        <div role="img" aria-label="Örnek NFC kart görünümü" className="relative flex justify-center items-center min-h-[220px] sm:min-h-[260px]">
          <div className="absolute w-[86%] max-w-[340px] aspect-[340/214] rounded-[18px] bg-marka/35 -rotate-6" />
          <div className="relative w-[86%] max-w-[340px] aspect-[340/214] rounded-[18px] bg-lacivert-950 p-[18px] sm:p-[22px] flex flex-col justify-between overflow-hidden shadow-2xl dark:ring-1 dark:ring-white/10">
            <BulucuDesen className="absolute -right-8 -bottom-8 w-[200px] h-[200px] text-white/[0.12]" cizgi={1} />
            <div className="relative flex justify-between items-center">
              <BulucuIsaret className="w-[30px] h-[30px] text-vurgu" />
              <span className="w-9 h-[26px] rounded-[5px] bg-vurgu" />
            </div>
            <div className="relative flex justify-between items-end gap-3">
              <div className="min-w-0">
                <div className="font-baslik font-bold text-base sm:text-lg text-white">Kerem Ulukan</div>
                <div className="text-[11px] sm:text-xs text-lacivert-200">Tamga Siber · Siber Güvenlik Danışmanı</div>
              </div>
              <span className="shrink-0 w-[52px] h-[52px] bg-white rounded-md grid grid-cols-5 gap-0.5 p-[5px]">
                {QR_DESEN.split('').map((h, i) => <i key={i} className={h === '1' ? 'bg-lacivert-950' : ''} />)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ------------------------------------------------------------ Rakamlar
// Yalnız get_platform_stats'ın gerçek toplamları; tahmini ağaç/CO₂ hesabı yok.
// Değerlerden biri bile sıfır ya da okunamazsa bölüm hiç görünmez.
const sayiBicimi = new Intl.NumberFormat('tr-TR')

export function Rakamlar() {
  const [veri, setVeri] = useState(null)

  useEffect(() => {
    let iptal = false
    supabase.rpc('get_platform_stats').then(({ data, error }) => {
      if (!iptal && !error && data) setVeri(data)
    })
    return () => { iptal = true }
  }, [])

  const kalemler = veri
    ? [
        { etiket: 'Oluşturulan kart', deger: Number(veri.kullanici) },
        { etiket: 'Kart görüntülenmesi', deger: Number(veri.kart_goruntulenme) },
        { etiket: 'Yazılan NFC kart', deger: Number(veri.nfc_kart) },
      ]
    : null
  if (!kalemler || !kalemler.every((k) => Number.isFinite(k.deger) && k.deger > 0)) return null

  return (
    <section aria-labelledby="rakamlar-baslik" className={`${KAP} pb-16 lg:pb-[88px]`}>
      <div className="flex flex-col gap-3.5 p-6 sm:p-7 rounded-2xl bg-yuzey border border-cizgi">
        <h2 id="rakamlar-baslik" className={`${UST} font-sans text-aksan`}>Rakamlarla QRtım</h2>
        <dl className="grid sm:grid-cols-3 gap-3">
          {kalemler.map((k) => (
            <div key={k.etiket} className="flex flex-col-reverse gap-0.5 p-4 rounded-xl bg-zemin">
              <dt className="text-xs text-metin-2">{k.etiket}</dt>
              <dd className="font-baslik font-extrabold text-[26px] text-metin">{sayiBicimi.format(k.deger)}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

// ------------------------------------------------------------ Son çağrı
export function CtaBandi() {
  return (
    <section className={`${KAP} pb-16 lg:pb-[88px]`}>
      <div className="max-w-[910px] mx-auto flex flex-wrap justify-between items-center gap-8 bg-lacivert-950 text-white rounded-3xl p-7 sm:p-14 dark:ring-1 dark:ring-white/10">
        <div className="flex flex-col gap-2.5 max-w-[620px]">
          <h2 className="font-baslik font-extrabold text-[26px] sm:text-[36px] leading-[1.12] tracking-[-0.015em] text-white">
            Kimliğinizi ve kartınızı bugün tek yere taşıyın
          </h2>
          <p className="text-base sm:text-[17px] text-lacivert-200">Beş dakikada ilk kartınız hazır. Ücretsiz planda kredi kartı istenmez.</p>
        </div>
        <Link to={refliAdres('/signup')} className={DUGME.anaKoyu}>Ücretsiz başla</Link>
      </div>
    </section>
  )
}
