// Kartım düzenleyicisinin veri yardımcıları — bileşen içermez.
//
// Bloklar sunucuda ayrı bir tablo DEĞİL: her blok, profilin (persona) gerçek
// alanlarının ve anahtarlarının bir görünümüdür. Bloğun görünürlüğü, içindeki
// alanların görünürlüğünden hesaplanır; bloğa yazmak o alanlara yazmaktır.
import {
  User, Briefcase, CreditCard, CalendarDays, Landmark, Share2, FileText,
  ShoppingBag, Star, Receipt, BadgeCheck,
} from 'lucide-react'
import { tl } from '../../bicim'

// Görünürlük seviyeleri. Sunucu (persona_set_field) bugün yalnız public ve
// private kabul ediyor; diğer ikisi profile_fields kısıtında tanımlı ama
// persona kartında henüz uygulanmıyor → arayüzde "yakında".
export const SEVIYELER = [
  { deger: 'public', ad: 'Herkese açık', nokta: 'bg-aksan' },
  { deger: 'link_only', ad: 'Bağlantısı olan', nokta: 'bg-vurgu', yakinda: true },
  { deger: 'on_request', ad: 'Karşılıklı onay', nokta: 'bg-metin-2', yakinda: true },
  { deger: 'private', ad: 'Gizli', nokta: 'bg-cizgi' },
]
export const SEVIYE_AD = {
  public: 'Herkese açık', link_only: 'Bağlantısı olan', on_request: 'Karşılıklı onay',
  private: 'Gizli', karisik: 'Karışık',
}

// Önizleme kitlesi → hangi seviyeleri görür
export const KITLELER = [
  { deger: 'herkes', ad: 'Herkes', gorur: ['public'] },
  { deger: 'baglanti', ad: 'Bağlantısı olan', gorur: ['public', 'link_only'] },
  { deger: 'onayli', ad: 'Onaylı kişi', gorur: ['public', 'link_only', 'on_request'] },
]

export const SOSYAL_PLATFORMLAR = [
  ['linkedin', 'LinkedIn'], ['instagram', 'Instagram'], ['twitter', 'X (Twitter)'],
  ['facebook', 'Facebook'], ['youtube', 'YouTube'], ['tiktok', 'TikTok'], ['github', 'GitHub'],
  ['website', 'Web sitesi'], ['pinterest', 'Pinterest'], ['twitch', 'Twitch'], ['kick', 'Kick'],
  ['snapchat', 'Snapchat'], ['trendyol', 'Trendyol'], ['hepsiburada', 'Hepsiburada'], ['n11', 'N11'],
  ['amazon_tr', 'Amazon TR'], ['etsy', 'Etsy'], ['shopify', 'Shopify Mağaza'],
  ['woocommerce', 'WooCommerce'], ['katalog_link', 'Ürün Kataloğu'],
]
export const platformAdi = (id) => SOSYAL_PLATFORMLAR.find((p) => p[0] === id)?.[1] || id

export const TEMA_RENKLERI = ['#0A52B0', '#162349', '#0E6B61', '#2F7D4F', '#B5672B', '#B23A48', '#6B4FA3', '#1A1C1E']

const HATALAR = {
  limit_asildi: 'Planınızın profil sınırına ulaştınız.',
  ayni_ad_var: 'Bu isimde bir profiliniz zaten var.',
  ana_persona_silinemez: 'Ana profil silinemez. Önce başka bir profili ana profil yapın.',
  ana_persona_duraklatilamaz: 'Ana profil duraklatılamaz; basılı kartlarınız bu profili gösterir.',
  gecersiz_ad: 'Profil adı 1–40 karakter olmalı.',
  ad_cok_uzun: 'Profil adı en fazla 40 karakter olabilir.',
  gecersiz_tur: 'Geçersiz profil türü.',
  gecersiz_gorunurluk: 'Bu görünürlük seviyesi henüz desteklenmiyor.',
  persona_bulunamadi: 'Profil bulunamadı; sayfayı yenileyin.',
  gorunen_ad_cok_uzun: 'Görünen ad en fazla 80 karakter olabilir.',
}
const DEGER_TURU = {
  email: 'e-posta', phone: 'telefon', url: 'bağlantı (https:// ile)',
  text: 'metin (en fazla 120 karakter)', longtext: 'metin (en fazla 2000 karakter)',
}
export function hataMesaji(data, varsayilan = 'İşlem tamamlanamadı') {
  if (!data?.hata) return varsayilan
  if (data.hata === 'gecersiz_deger' && data.tur) return `Geçerli bir ${DEGER_TURU[data.tur] || 'değer'} girin.`
  return HATALAR[data.hata] || varsayilan
}

// ------------------------------------------------------------------ alanlar
export const doluMu = (v) => (Array.isArray(v) ? v.length > 0 : v !== null && v !== undefined && String(v).trim() !== '')
// Profile özel değer varsa o, yoksa profildeki temel değer
export const alanDegeri = (f) => (f && doluMu(f.override_value) ? f.override_value : f?.base_value ?? null)

// Bir grup alanın ortak seviyesi: içeriği olan alanlara bakılır (boş alanın
// görünürlüğü kartta bir şey değiştirmez); hiçbiri dolu değilse tümüne.
export function ortakSeviye(alanlar) {
  if (!alanlar.length) return 'private'
  const dolu = alanlar.filter((f) => doluMu(alanDegeri(f)))
  const bakilan = dolu.length ? dolu : alanlar
  const ilk = bakilan[0].visibility || 'private'
  return bakilan.every((f) => (f.visibility || 'private') === ilk) ? ilk : 'karisik'
}

export function ibanMaske(iban) {
  const t = String(iban || '').replace(/\s/g, '')
  if (t.length < 10) return t
  return `${t.slice(0, 4)} ${t.slice(4, 8)} … ${t.slice(-2)}`
}

const GUN_KISA = ['', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz']
export function randevuOzeti(r) {
  if (!r) return ''
  const gunler = Object.keys(r.gun_saatleri || {}).map(Number).filter((g) => g >= 1 && g <= 7).sort((a, b) => a - b)
  const parca = [`${r.slot_dakika || 30} dk`]
  if (gunler.length) {
    const ardisik = gunler.every((g, i) => i === 0 || g === gunler[i - 1] + 1)
    parca.push(ardisik && gunler.length > 2 ? `${GUN_KISA[gunler[0]]}–${GUN_KISA[gunler[gunler.length - 1]]}` : gunler.map((g) => GUN_KISA[g]).join(', '))
    const araliklar = gunler.map((g) => JSON.stringify(r.gun_saatleri[g]?.[0] || null))
    if (araliklar.every((a) => a === araliklar[0]) && r.gun_saatleri[gunler[0]]?.[0]) {
      const [bas, son] = r.gun_saatleri[gunler[0]][0]
      parca.push(`${bas}–${son}`)
    }
  } else {
    parca.push('çalışma saati girilmemiş')
  }
  parca.push(r.otomatik_onay ? 'otomatik onay' : 'onayınızla')
  return parca.join(' · ')
}

// ------------------------------------------------------------------ bloklar
// Her bloğun gerçek veriye eşlemesi. `alanlar`: persona alan anahtarları;
// `tur`: yazma yolunu belirler (alan | odeme | sosyal | randevu | kurum | yakinda).
export function bloklariHesapla({ editor, profile, randevu, orgCount, sosyalSinir }) {
  if (!editor) return []
  const x = editor.persona || {}
  const alan = (k) => editor.fields.find((f) => f.key === k)
  const alanlar = (ks) => ks.map(alan).filter(Boolean)
  const dolu = (k) => doluMu(alanDegeri(alan(k)))
  const liste = (k) => {
    const v = alanDegeri(alan(k))
    return Array.isArray(v) ? v : []
  }
  const bankalar = Array.isArray(profile?.bank_accounts) ? profile.bank_accounts : []
  const fatura = profile?.billing_info
  const linkler = editor.social_links || []
  const gorunenLink = linkler.filter((l) => l.visible)

  const alanBlok = (anahtar, ad, ikon, ks, ozet, ek = {}) => {
    const a = alanlar(ks)
    const seviye = ortakSeviye(a)
    return {
      anahtar, ad, ikon, tur: 'alan', alanKeys: ks, seviye,
      acik: a.some((f) => (f.visibility || 'private') !== 'private' && doluMu(alanDegeri(f))),
      icerikVar: ks.some(dolu), ozet, ...ek,
    }
  }

  const iletisimAdlari = ['phone', 'email', 'whatsapp', 'website', 'city'].filter(dolu).map((k) => alan(k)?.label)
  const hizmetler = liste('services')
  const belgeler = liste('catalog_links')
  const fiyatli = hizmetler.filter((h) => Number(h?.price) > 0)

  const odemeAcik = !!x.show_payment
  const b = [
    alanBlok('iletisim', 'İletişim · rehbere kaydet', User, ['email', 'phone', 'whatsapp', 'website', 'city'],
      iletisimAdlari.length ? `${iletisimAdlari.join(', ')} · vCard indirme` : 'Telefon, e-posta, web · henüz bilgi yok', { cekirdek: true }),
    alanBlok('hakkinda', 'Hakkında · kariyer', Briefcase, ['title', 'company', 'department', 'bio'],
      [alanDegeri(alan('title')), alanDegeri(alan('company')), alanDegeri(alan('department'))].filter(doluMu).join(' · ') || 'Unvan, şirket, hakkımda', { cekirdek: true }),
    {
      anahtar: 'cuzdan', ad: 'Cüzdana ekle', ikon: CreditCard, tur: 'yakinda', yakinda: true, cekirdek: true,
      seviye: 'public', acik: false, icerikVar: true, ikonTon: 'notr',
      ozet: 'Apple ve Google Cüzdan kartı · hazır olunca açılır',
    },
    {
      anahtar: 'randevu', ad: 'Randevu', ikon: CalendarDays, tur: 'randevu',
      seviye: randevu?.aktif ? 'public' : 'private', sabitSeviye: true,
      acik: !!randevu?.aktif, icerikVar: !!randevu && (randevu.aktif || Object.keys(randevu.gun_saatleri || {}).length > 0),
      ozet: randevu ? randevuOzeti(randevu) : 'Randevu ayarları yükleniyor',
    },
    {
      anahtar: 'odeme', ad: 'Ödeme · IBAN', ikon: Landmark, tur: 'odeme', odemeAlani: 'show_bank_accounts', ikonTon: 'vurgu',
      seviye: odemeAcik && profile?.show_bank_accounts ? 'public' : 'private', ikiSeviye: true,
      acik: odemeAcik && !!profile?.show_bank_accounts && bankalar.length > 0, icerikVar: bankalar.length > 0,
      ozet: bankalar.length
        ? `${bankalar[0].account_holder || bankalar[0].bank_name || 'Hesap'} · ${ibanMaske(bankalar[0].iban)}${bankalar.length > 1 ? ` · +${bankalar.length - 1} hesap` : ''} · tek dokunuşla kopyala`
        : 'Banka hesabı eklenmedi',
    },
    {
      anahtar: 'sosyal', ad: 'Sosyal', ikon: Share2, tur: 'sosyal',
      seviye: !linkler.length ? 'private' : gorunenLink.length === linkler.length ? 'public' : gorunenLink.length ? 'karisik' : 'private',
      ikiSeviye: true, acik: gorunenLink.length > 0, icerikVar: linkler.length > 0,
      ozet: linkler.length
        ? `${linkler.slice(0, 4).map((l) => platformAdi(l.platform)).join(', ')}${linkler.length > 4 ? '…' : ''} · ${linkler.length} / ${sosyalSinir == null ? '—' : sosyalSinir >= 999 ? 'sınırsız' : sosyalSinir}`
        : 'Henüz bağlantı eklenmedi',
    },
    alanBlok('belge', belgeler.length === 1 ? `Belge · ${belgeler[0].title || 'Belge'}` : 'Belge', FileText, ['catalog_links'],
      belgeler.length ? belgeler.map((l) => l.title).filter(Boolean).slice(0, 3).join(', ') + (belgeler.length > 1 ? ` · ${belgeler.length} belge` : ' · bağlantı') : 'Katalog, portföy, PDF bağlantısı'),
    alanBlok('hizmet', 'Ürün / hizmet', ShoppingBag, ['services'],
      hizmetler.length
        ? `${hizmetler.length} hizmet${fiyatli.length ? ` · ${fiyatli.length === 1 ? tl(fiyatli[0].price) : `${tl(Math.min(...fiyatli.map((h) => Number(h.price))))}'den başlayan`}` : ''}`
        : 'Hizmet ya da ürün eklenmedi'),
    alanBlok('google', 'Google yorumu', Star, ['google_review_link'],
      dolu('google_review_link') ? 'Ziyaretçiyi Google yorum sayfanıza götürür' : 'Yorum bağlantısı eklenmedi'),
    {
      anahtar: 'fatura', ad: 'Fatura bilgisi', ikon: Receipt, tur: 'odeme', odemeAlani: 'show_billing_info', ikonTon: 'vurgu',
      seviye: odemeAcik && profile?.show_billing_info ? 'public' : 'private', ikiSeviye: true,
      acik: odemeAcik && !!profile?.show_billing_info && !!fatura, icerikVar: !!fatura,
      ozet: fatura ? [fatura.company_title, fatura.tax_office].filter(Boolean).join(' · ') + ' · kopyalanabilir' : 'Fatura bilgisi eklenmedi',
    },
    {
      anahtar: 'kurum', ad: 'Kurum rozetleri', ikon: BadgeCheck, tur: 'kurum',
      seviye: x.show_organizations ? 'public' : 'private', ikiSeviye: true,
      acik: !!x.show_organizations && orgCount > 0, icerikVar: orgCount > 0, duzenleYok: true,
      ozet: orgCount > 0 ? `${orgCount} kurum üyeliği · kartta rozet olarak` : 'Kurum üyeliğiniz yok',
    },
  ]
  return b
}
