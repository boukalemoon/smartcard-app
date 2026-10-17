import { Link } from 'react-router-dom'
import { Check, CirclePlay } from 'lucide-react'
import { refliAdres } from '../yardim'
import { BulucuDesen, BulucuIsaret } from './ortak'
import { DUGME, KAP, UST } from './siniflar'

// "Veriler Türkiye'de işlenir" maddesi doğrulanamadığı için yok (brif).
const MADDELER = ['Ücretsiz planda kredi kartı istenmez', 'Ziyaretçi uygulama indirmez']

export default function Hero() {
  return (
    <section className={`${KAP} grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] gap-10 lg:gap-12 items-center pt-12 pb-16 lg:py-[88px]`}>
      <div className="flex flex-col gap-6">
        <span className={`${UST} text-aksan inline-flex items-center gap-2`}>
          <i className="w-2 h-2 rounded-[2px] bg-vurgu inline-block" aria-hidden="true" />
          Dijital kimlik ve dijital kart, tek yerde
        </span>
        <h1 className="font-baslik font-extrabold text-[40px] sm:text-[52px] lg:text-[58px] leading-[1.1] tracking-[-0.015em] text-metin">
          Bir dokunuşla paylaşılan, <span className="text-aksan">sizin kurduğunuz</span> kart.
        </h1>
        <p className="text-[17px] sm:text-[19px] leading-[1.55] text-metin-2 max-w-[580px]">
          Bağlantı, randevu, ödeme, belge, galeri, form, ürün… Kartınızı bloklarla kendiniz kurun; neyin kime
          görüneceğine siz karar verin. QR okutun ya da NFC kartı dokundurun; karşınızdaki kişi uygulama
          indirmeden rehberine veya cüzdanına kaydetsin.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to={refliAdres('/signup')} className={DUGME.ana}>Kartınızı kurun, ücretsiz</Link>
          <a href="#nasil" className={DUGME.ikincil}>
            <CirclePlay size={18} aria-hidden="true" />
            Nasıl çalışır
          </a>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-metin-2">
          {MADDELER.map((m) => (
            <li key={m} className="flex items-center gap-1.5">
              <Check size={16} strokeWidth={2.5} className="text-aksan shrink-0" aria-hidden="true" />
              {m}
            </li>
          ))}
        </ul>
      </div>

      <TelefonMaketi />
    </section>
  )
}

// Statik örnek maket: gerçek bir kişiye ait değildir, ekran okuyucuya tek
// bir görsel olarak okunur.
function TelefonMaketi() {
  return (
    <div
      role="img"
      aria-label="Örnek dijital kart: telefonda açılmış kart ve arkasında NFC kart"
      className="relative flex justify-center items-center min-h-[540px] sm:min-h-[600px] overflow-x-clip"
    >
      <div className="absolute inset-x-0 sm:inset-x-5 inset-y-10 rounded-[32px] bg-yuzey-2" />

      {/* Arkadaki eğik NFC kart */}
      <div className="absolute right-0 sm:right-7 top-[60px] sm:top-[72px] w-[180px] sm:w-[220px] h-[115px] sm:h-[140px] rounded-2xl bg-lacivert-950 rotate-[8deg] shadow-2xl dark:ring-1 dark:ring-white/10 p-4 flex flex-col justify-between">
        <div className="flex justify-between items-center">
          <BulucuIsaret className="w-[22px] h-[22px] text-vurgu" />
          <span className="w-7 h-5 rounded bg-vurgu" />
        </div>
        <div>
          <div className="font-baslik font-bold text-sm text-white">Elif Kayaalp</div>
          <div className="text-[11px] text-lacivert-200">Bozkır Studio · NFC</div>
        </div>
      </div>

      {/* Telefon */}
      <div className="relative w-[280px] sm:w-[300px] bg-lacivert-950 rounded-[40px] p-3 shadow-2xl dark:ring-1 dark:ring-white/10">
        <div className="bg-zemin rounded-[30px] overflow-hidden flex flex-col">
          <div className="relative overflow-hidden bg-marka text-white px-5 pt-7 pb-5 flex flex-col items-center gap-2.5">
            <BulucuDesen className="absolute -right-6 -top-6 w-[130px] h-[130px] text-white/15" cizgi={1.5} />
            <span className="relative w-[72px] h-[72px] rounded-full bg-marka-acik text-marka-koyu inline-flex items-center justify-center font-baslik font-extrabold text-2xl border-[3px] border-white/60">
              EK
            </span>
            <div className="relative text-center">
              <div className="font-baslik font-bold text-lg">Elif Kayaalp</div>
              <div className="text-xs text-white/90">Ürün Tasarımcısı · Bozkır Studio</div>
            </div>
            <span className="relative inline-flex items-center gap-1.5 bg-white/15 rounded-full px-2.5 py-[3px] text-[11px] font-semibold">
              <Check size={11} strokeWidth={3} />
              ornek.com.tr doğrulandı
            </span>
          </div>
          <div className="p-3.5 flex flex-col gap-2 text-metin">
            <div className="grid grid-cols-2 gap-2">
              <span className="bg-murekkep text-yuzey rounded-[10px] h-10 flex items-center justify-center text-xs font-semibold">Rehbere kaydet</span>
              <span className="bg-yuzey border border-cizgi rounded-[10px] h-10 flex items-center justify-center text-xs font-semibold">Cüzdana ekle</span>
            </div>
            <MaketSatir renk="bg-aksan-acik">Randevu al · 30 dk</MaketSatir>
            <MaketSatir renk="bg-vurgu-acik">IBAN · kopyala</MaketSatir>
            <MaketSatir renk="bg-yuzey-2">Portföy 2026 · PDF</MaketSatir>
            <div className="grid grid-cols-3 gap-1.5">
              <span className="h-11 rounded-lg bg-yuzey-2" />
              <span className="h-11 rounded-lg bg-yuzey-2" />
              <span className="h-11 rounded-lg bg-yuzey-2" />
            </div>
            <div className="flex gap-1.5">
              <span className="flex-1 h-8 rounded-[9px] bg-murekkep" />
              <span className="flex-1 h-8 rounded-[9px] bg-vurgu" />
              <span className="flex-1 h-8 rounded-[9px] bg-marka" />
              <span className="flex-1 h-8 rounded-[9px] bg-metin-2" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function MaketSatir({ renk, children }) {
  return (
    <div className="flex items-center gap-2 bg-yuzey border border-cizgi rounded-[10px] px-2.5 py-2 text-[11px] font-semibold">
      <i className={`w-[22px] h-[22px] rounded-md inline-block ${renk}`} />
      {children}
    </div>
  )
}
