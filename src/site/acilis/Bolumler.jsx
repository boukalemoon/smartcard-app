import { Link } from 'react-router-dom'
import {
  ArrowRight, Calendar, CreditCard, Eye, File, FileText, Globe, Grid2x2Plus, Image, Landmark,
  Link as BaglantiIkon, MapPin, Nfc, RectangleHorizontal, Share2, ShieldCheck, ShoppingBag, Star, User, Video,
} from 'lucide-react'
import { birlestir } from '../../panel/bicim'
import { refliAdres } from '../yardim'
import { BolumBasligi } from './ortak'
import { BOLUM_KAYMA, H2, KAP, ODAK, ODAK_KOYU, UST } from './siniflar'

const IKON_AKSAN = 'bg-aksan-acik text-aksan-koyu dark:text-aksan'
const IKON_VURGU = 'bg-vurgu-acik text-vurgu'

// ------------------------------------------------------------ Nasıl çalışır
const ADIMLAR = [
  {
    no: '01', ikon: Grid2x2Plus, ton: IKON_AKSAN, baslik: 'Bloklarla kurun',
    metin: 'İhtiyacınız olan blokları ekleyin, sürükleyip sıralayın. Her alanın görünürlüğünü ayrı ayrı belirleyin: herkese açık, yalnızca bağlantısı olana ya da karşılıklı onayla.',
  },
  {
    no: '02', ikon: Nfc, ton: IKON_VURGU, baslik: 'QR okutun ya da NFC dokundurun',
    metin: 'Kodu telefon kamerası okur; NFC kartı dokundurmak yeterli. Ziyaretçi hiçbir uygulama indirmez, kartınız tarayıcıda açılır.',
  },
  {
    no: '03', ikon: CreditCard, ton: IKON_AKSAN, baslik: 'Rehbere ve cüzdana kaydedilsin',
    metin: 'Tek dokunuşla rehbere kayıt, randevu talebi, IBAN kopyalama. Apple ve Google Cüzdan kartı yakında.',
  },
]

export function NasilCalisir() {
  return (
    <section id="nasil" className={`${BOLUM_KAYMA} bg-yuzey border-y border-cizgi py-16 lg:py-[88px]`}>
      <div className={`${KAP} flex flex-col gap-10 lg:gap-12`}>
        <BolumBasligi
          ust="Nasıl çalışır"
          baslik="Kurun, paylaşın, kaydedilsin"
          aciklama="Kart yazdırmaya son. Kartınızı bir kez kurun; QR ve NFC kartınız her zaman güncel kalsın."
        />
        <ol className="grid md:grid-cols-3 gap-4 lg:gap-6">
          {ADIMLAR.map((a) => {
            const Ikon = a.ikon
            return (
              <li key={a.no} className="flex flex-col gap-3.5 p-6 lg:p-7 rounded-2xl bg-zemin">
                <span className="font-baslik font-extrabold text-[13px] tracking-[0.08em] text-vurgu" aria-hidden="true">{a.no}</span>
                <span className={birlestir('w-12 h-12 rounded-xl inline-flex items-center justify-center', a.ton)}>
                  <Ikon size={24} aria-hidden="true" />
                </span>
                <h3 className="font-baslik text-xl font-bold leading-tight text-metin">{a.baslik}</h3>
                <p className="text-[15px] leading-relaxed text-metin-2">{a.metin}</p>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

// ------------------------------------------------------------ Blok kütüphanesi
const BLOKLAR = [
  { ad: 'Bağlantı', ikon: BaglantiIkon },
  { ad: 'Buton', ikon: RectangleHorizontal },
  { ad: 'Sosyal', ikon: Share2 },
  { ad: 'İletişim / rehbere kaydet', ikon: User },
  { ad: 'Randevu', ikon: Calendar },
  { ad: 'Ödeme / IBAN', ikon: Landmark, vurgu: true },
  { ad: 'Belge / dosya', ikon: File },
  { ad: 'Galeri', ikon: Image },
  { ad: 'Video', ikon: Video },
  { ad: 'Konum', ikon: MapPin },
  { ad: 'Form', ikon: FileText },
  { ad: 'Ürün / katalog', ikon: ShoppingBag },
  { ad: 'Google yorumu', ikon: Star },
  // Apple/Google Wallet arka ucu henüz yok.
  { ad: 'Cüzdan kartı', ikon: CreditCard, yakinda: true },
]

export function Bloklar() {
  return (
    <section id="bloklar" className={`${BOLUM_KAYMA} ${KAP} py-16 lg:py-[88px] grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] gap-10 lg:gap-12 items-center`}>
      <div className="flex flex-col gap-4">
        <span className={`${UST} text-aksan`}>Blok kütüphanesi</span>
        <h2 className={birlestir(H2, 'text-metin')}>Bu kartla neredeyse her şeyi yaparsınız</h2>
        <p className="text-[17px] leading-relaxed text-metin-2">
          Bağlantı listesi kadar esnek, kartvizitten çok daha fazlası. Blokları karıştırın; iş, kişisel ve etkinlik için ayrı kartlar kurun.
        </p>
        <Link to={refliAdres('/signup')} className={birlestir('self-start inline-flex items-center gap-1.5 font-semibold text-aksan hover:text-aksan-koyu rounded', ODAK)}>
          Tüm blokları gör <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </div>
      <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {BLOKLAR.map((b) => {
          const Ikon = b.ikon
          return (
            <li
              key={b.ad}
              className={birlestir(
                'flex items-center gap-2.5 px-3 sm:px-3.5 py-3 rounded-xl bg-yuzey border text-sm font-semibold leading-snug text-metin min-w-0',
                b.yakinda ? 'border-dashed border-cizgi' : 'border-cizgi',
              )}
            >
              <span className={birlestir('w-8 h-8 shrink-0 rounded-lg inline-flex items-center justify-center', b.yakinda ? 'bg-yuzey-2 text-metin-2' : b.vurgu ? IKON_VURGU : IKON_AKSAN)}>
                <Ikon size={16} aria-hidden="true" />
              </span>
              <span className={birlestir('min-w-0', b.yakinda && 'text-metin-2')}>{b.ad}</span>
              {b.yakinda && (
                <span className="ml-auto inline-flex items-center h-[22px] px-2 rounded-full bg-yuzey-2 text-metin-2 text-[11px] font-semibold tracking-[0.04em] whitespace-nowrap">
                  Yakında
                </span>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

// ------------------------------------------------------------ Kimlik katmanı
const KANITLAR = [
  {
    ikon: ShieldCheck, baslik: 'Doğrulama rozetleri',
    metin: 'Alan adı DNS doğrulaması ve kurum yöneticisi onayı. Ziyaretçi rozete dokununca neyin, nasıl doğrulandığını okur.',
  },
  {
    ikon: Eye, baslik: 'Alan bazlı görünürlük',
    metin: 'Telefonunuz herkese mi, yalnızca bağlantısı olana mı, yoksa karşılıklı onayla mı görünsün? Her alan için siz seçersiniz; sunucu buna uyar.',
  },
  {
    ikon: Globe, baslik: 'Özel alan adı ve çoklu kart',
    metin: "kart.sirketiniz.com gibi kendi adresinizi bağlayın; iş, kişisel ve etkinlik için ayrı kartlar, her birinin kendi QR'ı.",
  },
]

export function KimlikKatmani() {
  return (
    <section className="bg-yuzey border-y border-cizgi py-16 lg:py-[88px]">
      <div className={`${KAP} flex flex-col gap-10`}>
        <BolumBasligi ust="Kimlik katmanı" baslik="Kartın arkasındaki kanıt" />
        <ul className="grid md:grid-cols-3 gap-4 lg:gap-5">
          {KANITLAR.map((k) => {
            const Ikon = k.ikon
            return (
              <li key={k.baslik} className="flex flex-col gap-2.5 p-6 rounded-2xl bg-zemin border border-cizgi">
                <span className={birlestir('w-10 h-10 rounded-[10px] inline-flex items-center justify-center', IKON_AKSAN)}>
                  <Ikon size={20} aria-hidden="true" />
                </span>
                <h3 className="font-baslik text-[17px] font-bold leading-tight text-metin">{k.baslik}</h3>
                <p className="text-sm leading-relaxed text-metin-2">{k.metin}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

// ------------------------------------------------------------ Kimler için
const KITLELER = [
  {
    baslik: 'Bireyler',
    metin: 'Danışmanlar, serbest çalışanlar, satış ekipleri. Tek hesap, birden fazla kart; randevu ve ödeme bilgisi dahil.',
    baglanti: 'Bireysel planlar',
  },
  {
    baslik: 'Dernek, sendika ve topluluklar',
    metin: 'Üye başvurusu, onay akışı, yönetici/üye rolleri ve herkese açık üye dizini. Üyenin kartında doğrulanmış kurum rozeti.',
    baglanti: 'STK Özel plan',
  },
  {
    baslik: 'Şirketler',
    metin: 'Çalışan kartları tek merkezden, kurumsal alan adıyla. Üye analitiği ve dışa aktarım, kurumsal faturalama, özel entegrasyon.',
    baglanti: 'Kurumsal plan',
  },
]

// Her iki temada koyu kalan bant (sabit lacivert).
// ------------------------------------------------- Bağlı uygulamalar
// ÜCRETLİ PLAN TEŞVİKİ. Metinler sunucudaki gerçek davranışa bağlı:
//   • plan_features.sync_passwords = (plan <> 'free') → şifre senkronu HER
//     ücretli planda, öğrenci dahil.
//   • plan_features.sync_max_devices: ücretsiz 1 cihaz.
//   • Yer imleri user_sync_data'da (namespace 'bookmarks') merkezde durur.
//   • tinga_listeler: "gizli" olmayan listeyi anon okuyabilir → paylaşılabilir
//     bağlantı gerçekten çalışır.
// YAZMADIĞIMIZ: QRtım site şifresi SAKLAMIYOR, kasa yok, uçtan uca şifreleme
// kapsamda değil (bkz. 20260912180000_identity_sync_and_audit.sql). Bu yüzden
// "şifreleriniz bizde güvende" denmez; hak ücretli planda açılır, şifrenin
// kendisi QRtım'a gelmez. Arku için VERİ SENKRONU İDDİA EDİLMEZ: yok.
const UYGULAMALAR = [
  {
    ikon: BaglantiIkon, ton: IKON_AKSAN, baslik: 'İlgezdi · yer imleri ve şifreler',
    metin: 'Yer imleriniz QRtım hesabınızda durur, kurduğunuz her cihazda aynı. Şifre senkronu ücretli planlarda açılır ve şifrenizin kendisi QRtım tarafına geçmez. Ücretsiz planda senkron tek cihazla sınırlıdır.',
  },
  {
    ikon: Share2, ton: IKON_VURGU, baslik: 'Tınga · çalma listeleri',
    metin: 'Listenizi açık işaretleyin, bağlantıyı arkadaşlarınıza gönderin. Açtıkları sayfada hesap açmaları ya da uygulama kurmaları gerekmez.',
  },
  {
    ikon: ShieldCheck, ton: IKON_AKSAN, baslik: 'Arku Remote · tek hesap',
    metin: 'QRtım hesabınızla girin; ayrı şifre tutmanız gerekmez. Hangi uygulamanın neye eriştiğini Hesap bölümünden görür, dilediğinizde bağlantıyı kesersiniz.',
  },
]

export function BagliUygulamalar() {
  return (
    <section id="uygulamalar" className={`${BOLUM_KAYMA} py-16 lg:py-[88px]`}>
      <div className={`${KAP} flex flex-col gap-10`}>
        <BolumBasligi
          ust="Bağlı uygulamalar"
          baslik="Tek hesap, taşıdığınız veri"
          aciklama="QRtım hesabınız İlgezdi, Tınga ve Arku Remote'ta da sizsiniz. Ücretli planlar senkronu çok cihaza ve şifrelere açar."
        />
        <ul className="grid md:grid-cols-3 gap-4 lg:gap-5">
          {UYGULAMALAR.map((u) => {
            const Ikon = u.ikon
            return (
              <li key={u.baslik} className="flex flex-col gap-2.5 p-6 rounded-2xl bg-yuzey border border-cizgi">
                <span className={birlestir('w-10 h-10 rounded-[10px] inline-flex items-center justify-center', u.ton)}>
                  <Ikon size={20} aria-hidden="true" />
                </span>
                <h3 className="font-baslik text-[17px] font-bold leading-tight text-metin">{u.baslik}</h3>
                <p className="text-sm leading-relaxed text-metin-2">{u.metin}</p>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

export function KimlerIcin() {
  return (
    <section id="kimler" className={`${BOLUM_KAYMA} bg-lacivert-950 text-white py-16 lg:py-[88px] dark:border-y dark:border-white/10`}>
      <div className={`${KAP} flex flex-col gap-10`}>
        <BolumBasligi ust="Kimler için" ustRenk="text-marka-acik" baslik="Bireyden kuruma, aynı güven katmanı" baslikRenk="text-white" />
        <ul className="grid md:grid-cols-3 gap-4 lg:gap-5">
          {KITLELER.map((k) => (
            <li key={k.baslik} className="flex flex-col gap-3 p-6 lg:p-7 rounded-2xl bg-lacivert-900 border border-white/10">
              <h3 className="font-baslik text-[22px] font-bold leading-tight text-white">{k.baslik}</h3>
              <p className="text-[15px] leading-relaxed text-lacivert-200">{k.metin}</p>
              <a href="#planlar" className={birlestir('mt-auto pt-4 self-start inline-flex items-center gap-1.5 font-semibold text-marka-acik hover:text-white rounded', ODAK_KOYU)}>
                {k.baglanti} <ArrowRight size={16} aria-hidden="true" />
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
