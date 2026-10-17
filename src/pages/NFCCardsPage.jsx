import { Link } from 'react-router-dom'
import { ArrowRight, Check, Clock, CreditCard, Mail, PenTool, Gift, Smartphone } from 'lucide-react'
import SiteKabugu from '../site/SiteKabugu'
import { refliAdres } from '../site/yardim'
import { NfcKartGorseli, QrMotif, SayfaUst } from '../site/sayfalar/ortak'
import { dugme, KAP, UST_ETIKET } from '../site/sayfalar/siniflar'
import { birlestir } from '../panel/bicim'
import { NFC_KART_FIYATI } from '../lib/planlar'

// Fiyatlar: standart PVC kart bedeli tek kaynaktan (src/lib/planlar.js) okunur.
// Diğer kart türlerinin bedeli orada henüz tanımlı değil; mevcut sabitler
// olduğu gibi duruyor (yeni rakam yazılmadı).
const cardTypes = [
  {
    id: 'pvc',
    name: 'Standart PVC Kart',
    tagline: 'Uygun Fiyatlı & Dayanıklı',
    price: `₺${NFC_KART_FIYATI.toLocaleString('tr-TR')}`,
    comingSoon: false,
    features: ['Su geçirmez PVC malzeme', 'Canlı renkli baskı', 'Çizilmeye dayanıklı', 'NFC çip dahil', 'QR kod baskısı', '3-5 iş günü teslimat'],
    specs: [
      { label: 'Malzeme', value: 'PVC Plastik' },
      { label: 'Boyut', value: '85.6×54 mm' },
      { label: 'Kalınlık', value: '0.76 mm' },
    ],
  },
  {
    id: 'metal',
    name: 'Premium Metal Kart',
    tagline: 'Prestij & Lüks',
    price: '₺1.490',
    comingSoon: false,
    metal: true,
    features: ['Paslanmaz çelik malzeme', 'Lazer gravür baskı', 'Ağır ve kaliteli his', 'NFC çip dahil', 'Mat veya parlak yüzey', '5-7 iş günü teslimat'],
    specs: [
      { label: 'Malzeme', value: 'Paslanmaz Çelik' },
      { label: 'Boyut', value: '85.6×54 mm' },
      { label: 'Kalınlık', value: '0.8 mm' },
    ],
  },
  {
    id: 'transparent',
    name: 'Şeffaf Kart',
    tagline: 'Modern & Dikkat Çekici',
    price: '₺999',
    comingSoon: true,
    features: ['Şeffaf PVC malzeme', 'Benzersiz görünüm', 'Hafif yapı', 'NFC çip dahil', 'Dikkat çekici tasarım', 'Kargo ücretsiz'],
  },
  {
    id: 'bamboo',
    name: 'Bambu Kart',
    tagline: 'Çevre Dostu & Doğal',
    price: '₺1.290',
    comingSoon: true,
    features: ['Doğal bambu malzeme', 'Çevre dostu üretim', 'Organik doku', 'NFC çip dahil', 'Sürdürülebilir', 'Kargo ücretsiz'],
  },
  {
    id: 'custom',
    name: 'Özel Tasarım',
    tagline: 'Tamamen Size Özel',
    price: 'Fiyat Teklifi',
    comingSoon: true,
    features: ['İstediğiniz malzeme', 'Logo ve marka baskısı', 'Özel renk & tasarım', 'NFC çip dahil', 'Kurumsal sipariş', 'Proje bazlı fiyat'],
  },
]

const faqs = [
  { q: 'NFC kartlar nasıl çalışır?', a: 'NFC kartlar, telefonla dokunduğunuzda otomatik olarak dijital kartvizitinizi açar. QR kod taramaya gerek kalmaz.' },
  { q: 'Tüm telefonlarla uyumlu mu?', a: 'Evet! NFC özelliği olan tüm akıllı telefonlar (iPhone, Android) ile uyumludur. NFC olmayan telefonlarda QR kod ile kullanılabilir.' },
  { q: 'Kart bilgilerini güncelleyebilir miyim?', a: 'Evet! Kartınızdaki bilgiler dijital olduğu için istediğiniz zaman QRtım panelinden güncelleyebilirsiniz. Yeni kart bastırmaya gerek yok!' },
  { q: 'Teslimat süresi ne kadar?', a: 'PVC kartlar 3-5 iş günü, metal kartlar 5-7 iş günü içinde kargoya verilir. Kargo ücretsizdir.' },
  { q: 'Yıllık abonelikte kart hediye mi geliyor?', a: 'Evet! Profesyonel yıllık abonelikte 1 PVC kart, STK yıllık abonelikte 6 kart, Kurumsal yıllık abonelikte 10 kart ücretsiz gönderilir.' },
]

const ADIMLAR = [
  { icon: CreditCard, title: 'Kart seç, sipariş ver', desc: 'İstediğin kart türünü seçin, siparişinizi oluşturun.' },
  { icon: PenTool, title: 'Tasarımını özelleştir', desc: 'QRtım panelinden profilinizi güncelleyin, kart hazırlanır.' },
  { icon: Smartphone, title: 'Dokunuşla paylaş', desc: 'Kartvizitinizi telefona dokundurarak anında paylaşın.' },
]

// Küçük kart görseli: PVC marka mavisi, metal koyu lacivert + fırçalanmış
// çizgi dokusu; yakında gelenler soluk yüzey. Hepsi dekor (aria-hidden).
function KucukKart({ card, soluk }) {
  const zemin = soluk ? 'bg-yuzey-2 text-metin-2 border border-dashed border-cizgi' : card.metal ? 'bg-lacivert-950 dark:bg-lacivert-900 dark:ring-1 dark:ring-inset dark:ring-white/10 text-white' : 'bg-marka text-white'
  return (
    <div aria-hidden="true" className={birlestir('relative w-full aspect-[85.6/54] max-w-[300px] mx-auto rounded-2xl p-5 flex flex-col justify-between overflow-hidden', zemin)}>
      {card.metal && (
        <span className="absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #fff 0 1px, transparent 1px 4px)' }} />
      )}
      {!soluk && <QrMotif className="absolute -right-10 -bottom-10 text-white/10" boyut={170} />}
      <div className="relative flex items-center justify-between">
        <span className={birlestir('text-xs font-semibold', soluk ? 'text-metin-2' : 'text-white/70')}>QRtım</span>
        <span className={birlestir('w-8 h-6 rounded-[5px]', soluk ? 'bg-cizgi' : 'bg-vurgu')} />
      </div>
      <div className="relative">
        <div className={birlestir('font-baslik font-bold text-[15px]', soluk ? 'text-metin-2' : 'text-white')}>{soluk ? card.name : 'Ad Soyad'}</div>
        <div className={birlestir('text-xs', soluk ? 'text-metin-2/80' : 'text-white/70')}>{soluk ? 'Hazırlanıyor' : 'qrtim.com.tr/profil'}</div>
      </div>
    </div>
  )
}

function Ozellik({ children, kucuk }) {
  return (
    <li className={birlestir('flex items-start gap-2.5', kucuk ? 'text-[13.5px] text-metin-2' : 'text-[15px] text-metin')}>
      <Check size={kucuk ? 14 : 16} strokeWidth={2.5} className="shrink-0 mt-[3px] text-aksan" aria-hidden="true" />
      <span>{children}</span>
    </li>
  )
}

export default function NFCCardsPage() {
  const activeCards = cardTypes.filter((c) => !c.comingSoon)
  const comingSoonCards = cardTypes.filter((c) => c.comingSoon)

  return (
    <SiteKabugu>
      {/* Başlık: Landing NFC bölümünün dili — solda metin, sağda koyu kart. */}
      <section className={birlestir(KAP, 'pt-12 sm:pt-20 pb-14 sm:pb-20')}>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-center">
          <SayfaUst
            ust="NFC kart"
            ustTon="vurgu"
            baslik="NFC kartınızı seçin, sipariş verin"
            alt="Dijital kartvizitinizi fiziksel bir karta dönüştürün. Dokunuşla paylaşın, anında etki bırakın."
          >
            <div className="mt-3 flex flex-wrap gap-3">
              <Link to="/nfc-designer" className={dugme('vurgu')}>Kart tasarla</Link>
              <a href="#kartlar" className={dugme('ikincil')}>Kartları incele</a>
            </div>
            <p className="mt-2 inline-flex items-center gap-2 text-sm text-metin-2">
              <Gift size={16} className="text-vurgu" aria-hidden="true" />
              Yıllık aboneliklerde kart hediye!
            </p>
          </SayfaUst>
          <NfcKartGorseli className="min-h-[260px] lg:min-h-[320px]" />
        </div>
      </section>

      {/* Şu an sipariş verilebilen kartlar */}
      <section id="kartlar" aria-labelledby="aktif-baslik" className="scroll-mt-20 bg-yuzey border-y border-cizgi py-16 sm:py-20">
        <div className={KAP}>
          <div className="flex flex-col gap-3 max-w-[640px]">
            <span className={birlestir(UST_ETIKET, 'text-aksan')}>Stokta mevcut, hızlı teslimat</span>
            <h2 id="aktif-baslik" className="font-baslik text-[30px] sm:text-[36px] leading-tight font-extrabold tracking-[-0.02em] text-metin">Şu an sipariş verebilirsiniz</h2>
          </div>

          <div className="mt-10 grid gap-6 md:grid-cols-2">
            {activeCards.map((card) => (
              <article key={card.id} className="rounded-2xl border border-cizgi bg-zemin p-6 sm:p-8 flex flex-col gap-6">
                <KucukKart card={card} />
                <div>
                  <h3 className="font-baslik text-[22px] font-bold text-metin">{card.name}</h3>
                  <p className="mt-1 text-sm text-metin-2">{card.tagline}</p>
                </div>
                <ul className="grid sm:grid-cols-2 gap-x-4 gap-y-2.5">
                  {card.features.map((f) => <Ozellik key={f}>{f}</Ozellik>)}
                </ul>
                <dl className="grid grid-cols-3 rounded-xl border border-cizgi bg-yuzey divide-x divide-cizgi">
                  {card.specs.map((spec) => (
                    <div key={spec.label} className="px-3 py-3 text-center">
                      <dt className="text-xs text-metin-2">{spec.label}</dt>
                      <dd className="mt-0.5 text-[13px] font-semibold text-metin">{spec.value}</dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-auto pt-6 border-t border-cizgi flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="flex items-baseline gap-1">
                      <span className="font-baslik text-[32px] font-extrabold tracking-tight text-metin tabular-nums">{card.price}</span>
                      <span className="text-sm text-metin-2">/adet</span>
                    </p>
                    <p className="text-[13px] font-semibold text-emerald-700 dark:text-emerald-300">Kargo ücretsiz</p>
                  </div>
                  <Link to={refliAdres('/signup')} className={dugme('vurgu', 'w-full sm:w-auto')}>
                    Sipariş ver
                    <ArrowRight size={18} aria-hidden="true" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Yakında gelen kartlar: devre dışı, "Yakında" rozetli */}
      <section aria-labelledby="yakinda-baslik" className={birlestir(KAP, 'py-16 sm:py-20')}>
        <div className="flex flex-col gap-3 max-w-[640px]">
          <span className={birlestir(UST_ETIKET, 'text-metin-2')}>Hazırlık aşamasında</span>
          <h2 id="yakinda-baslik" className="font-baslik text-[30px] sm:text-[36px] leading-tight font-extrabold tracking-[-0.02em] text-metin">Yakında geliyor</h2>
          <p className="text-[17px] text-metin-2">Hazırlık aşamasındaki kartlarımızı keşfedin</p>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {comingSoonCards.map((card) => (
            <article key={card.id} className="rounded-2xl border border-dashed border-cizgi bg-yuzey p-6 flex flex-col gap-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-baslik text-[18px] font-bold text-metin">{card.name}</h3>
                  <p className="mt-0.5 text-[13px] text-metin-2">{card.tagline}</p>
                </div>
                <span className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-xs font-semibold bg-vurgu-acik text-vurgu whitespace-nowrap">
                  <Clock size={12} strokeWidth={2.5} aria-hidden="true" />
                  Yakında
                </span>
              </div>
              <ul className="flex flex-col gap-2">
                {card.features.slice(0, 4).map((f) => <Ozellik key={f} kucuk>{f}</Ozellik>)}
              </ul>
              <div className="mt-auto pt-5 border-t border-cizgi flex items-center justify-between gap-3">
                <p className="flex items-baseline gap-1">
                  <span className="font-baslik text-[20px] font-extrabold text-metin-2 tabular-nums">{card.price}</span>
                  {card.price.includes('₺') && <span className="text-xs text-metin-2">/adet</span>}
                </p>
                <button type="button" disabled className="inline-flex items-center gap-1.5 h-10 px-4 rounded-[10px] border border-cizgi bg-yuzey-2 text-sm font-semibold text-metin-2 cursor-not-allowed">
                  Yakında açılacak
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Toplu sipariş: her iki temada koyu lacivert bant */}
      <section aria-labelledby="toplu-baslik" className={birlestir(KAP, 'pb-16 sm:pb-20')}>
        <div className="relative overflow-hidden rounded-3xl bg-lacivert-950 dark:bg-lacivert-900 text-white px-6 py-10 sm:px-12 sm:py-12 grid gap-6 md:grid-cols-[minmax(0,1fr)_auto] items-center dark:border dark:border-cizgi">
          <QrMotif className="absolute -left-16 -bottom-24 text-white/[0.07]" boyut={260} />
          <div className="relative flex flex-col gap-3 max-w-[620px]">
            <span className={birlestir(UST_ETIKET, 'text-vurgu')}>Kurumsal</span>
            <h2 id="toplu-baslik" className="font-baslik text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-[-0.02em] text-white">Toplu sipariş ve kurumsal</h2>
            <p className="text-[16px] leading-relaxed text-lacivert-200">10+ kart siparişlerinde özel fiyatlandırma. Şirket logolu özel tasarım seçenekleri.</p>
          </div>
          <a href="mailto:info@qartim.com" className={dugme('beyaz', 'relative')}>
            <Mail size={18} aria-hidden="true" />
            Teklif al
          </a>
        </div>
      </section>

      {/* Nasıl çalışır */}
      <section aria-labelledby="nasil-baslik" className="bg-yuzey border-y border-cizgi py-16 sm:py-20">
        <div className={KAP}>
          <div className="flex flex-col gap-3 max-w-[640px]">
            <span className={birlestir(UST_ETIKET, 'text-aksan')}>Nasıl çalışır</span>
            <h2 id="nasil-baslik" className="font-baslik text-[30px] sm:text-[36px] leading-tight font-extrabold tracking-[-0.02em] text-metin">Üç adımda kartınız elinizde</h2>
          </div>
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {ADIMLAR.map((item, i) => {
              const Icon = item.icon
              return (
                <li key={item.title} className="rounded-2xl bg-zemin p-7 flex flex-col gap-3.5">
                  <span className="font-baslik text-[13px] font-extrabold tracking-[.08em] text-vurgu">{String(i + 1).padStart(2, '0')}</span>
                  <span className={birlestir('w-12 h-12 rounded-xl inline-flex items-center justify-center', i === 1 ? 'bg-vurgu-acik text-vurgu' : 'bg-aksan-acik text-aksan')}>
                    <Icon size={22} aria-hidden="true" />
                  </span>
                  <h3 className="font-baslik text-[20px] font-bold text-metin">{item.title}</h3>
                  <p className="text-[15px] leading-relaxed text-metin-2">{item.desc}</p>
                </li>
              )
            })}
          </ol>
        </div>
      </section>

      {/* SSS + iletişim */}
      <section aria-labelledby="sss-baslik" className={birlestir(KAP, 'py-16 sm:py-20 grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]')}>
        <div className="flex flex-col gap-3">
          <span className={birlestir(UST_ETIKET, 'text-aksan')}>SSS</span>
          <h2 id="sss-baslik" className="font-baslik text-[30px] sm:text-[36px] leading-tight font-extrabold tracking-[-0.02em] text-metin">Sık sorulan sorular</h2>
          <p className="text-[16px] text-metin-2">Sorunuz mu var? Hemen iletişime geçin, size yardımcı olalım.</p>
          <div className="mt-2 flex flex-wrap gap-3">
            <a href="mailto:info@qartim.com" className={dugme('ikincil')}>
              <Mail size={18} aria-hidden="true" />
              info@qartim.com
            </a>
          </div>
        </div>
        <div className="rounded-2xl border border-cizgi bg-yuzey divide-y divide-cizgi">
          {faqs.map((faq) => (
            <details key={faq.q} className="group px-6 py-5">
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <h3 className="font-baslik text-[16px] font-bold text-metin">{faq.q}</h3>
                <span className="w-8 h-8 shrink-0 rounded-lg bg-yuzey-2 text-metin-2 inline-flex items-center justify-center text-lg leading-none transition-transform group-open:rotate-45" aria-hidden="true">+</span>
              </summary>
              <p className="mt-3 text-[15px] leading-relaxed text-metin-2">{faq.a}</p>
            </details>
          ))}
        </div>
      </section>
    </SiteKabugu>
  )
}
