// Herkese açık kart — bileşen dışı yardımcılar (adres güvenliği, vCard,
// renk, doğrulama metinleri, tarih). Bileşen dosyaları yalnız bileşen dışa
// aktarabildiği için (react-refresh) burada toplandı.
import { Linkedin, Facebook, Twitter, Instagram, Youtube, Github, Globe, Music2, Twitch, Store, MessageCircle } from 'lucide-react'
import { SITE_URL } from '../../lib/siteUrl'
import { bildir } from '../../lib/bildirim'

export const ODAK = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksan'

// Panoya kopyalama: izin verilmediğinde ya da güvenli bağlam dışında sessizce
// başarısız olur; kullanıcı ne olduğunu anlayabilsin diye geri bildirim verilir.
export async function panoyaKopyala(metin, basari) {
  try {
    await navigator.clipboard.writeText(metin)
    bildir(basari, 'success')
    return true
  } catch {
    bildir('Kopyalanamadı — metni elle seçip kopyalayabilirsiniz.', 'warning')
    return false
  }
}

// Büyük düğme sınıfları (48px). Ana düğme açık temada mürekkep, koyu temada
// aksan dolu (tasarım: KartKurumsal koyu ekran).
export const BTN = 'inline-flex items-center justify-center gap-2 h-12 px-4 rounded-xl text-[14px] font-semibold border transition-colors disabled:opacity-50 disabled:cursor-not-allowed ' + ODAK
export const BTN_ANA = 'bg-murekkep text-yuzey border-transparent hover:opacity-90 dark:bg-aksan dark:text-zemin'
export const BTN_IKINCIL = 'bg-yuzey text-metin border-cizgi hover:bg-yuzey-2'


// Kullanıcı tarafından girilen adresler doğrudan href'e yazılmamalı:
// 'javascript:' ve 'data:' şemaları kartı açan ziyaretçide kod çalıştırabilir
// (bulgu Y-5). Yalnızca http/https geçer; diğerleri bağlantı olarak render
// edilmez. Sunucu tarafında da süzülür, bu ikinci savunma katmanıdır.
export function safeUrl(url) {
  if (typeof url !== 'string') return null
  try {
    const u = new URL(url.trim())
    return ['http:', 'https:'].includes(u.protocol) ? u.href : null
  } catch {
    return null
  }
}

// Ekranda adresin protokolsüz, sonda eğik çizgisiz hâli.
export const adresGoster = (url) => String(url || '').replace(/^https?:\/\//i, '').replace(/\/$/, '')

// Simge kutusunun rengi tasarım dilinden gelir (marka renkleri değil): kartın
// tek renk ailesinde kalması için platformlar birkaç tona dağıtıldı.
const TON = {
  koyu: 'bg-lacivert-900 text-white dark:bg-lacivert-600',
  // Koyu temada vurgu ve gri açık tona döner; simge koyu yazılır ki kaybolmasın.
  vurgu: 'bg-vurgu text-white dark:text-lacivert-950',
  marka: 'bg-marka text-white',
  gri: 'bg-metin-2 text-white dark:text-lacivert-950',
}
export const PLATFORM = {
  linkedin: { ikon: Linkedin, ad: 'LinkedIn', ton: TON.koyu },
  facebook: { ikon: Facebook, ad: 'Facebook', ton: TON.marka },
  twitter: { ikon: Twitter, ad: 'X (Twitter)', ton: TON.koyu },
  instagram: { ikon: Instagram, ad: 'Instagram', ton: TON.vurgu },
  youtube: { ikon: Youtube, ad: 'YouTube', ton: TON.vurgu },
  tiktok: { ikon: Music2, ad: 'TikTok', ton: TON.koyu },
  github: { ikon: Github, ad: 'GitHub', ton: TON.gri },
  website: { ikon: Globe, ad: 'Web sitesi', ton: TON.marka },
  twitch: { ikon: Twitch, ad: 'Twitch', ton: TON.koyu },
  kick: { ikon: Globe, ad: 'Kick', ton: TON.koyu },
  snapchat: { ikon: Globe, ad: 'Snapchat', ton: TON.vurgu },
  pinterest: { ikon: Globe, ad: 'Pinterest', ton: TON.vurgu },
  trendyol: { ikon: Store, ad: 'Trendyol', ton: TON.vurgu },
  hepsiburada: { ikon: Store, ad: 'Hepsiburada', ton: TON.vurgu },
  n11: { ikon: Store, ad: 'N11', ton: TON.marka },
  amazon_tr: { ikon: Store, ad: 'Amazon TR', ton: TON.koyu },
  etsy: { ikon: Store, ad: 'Etsy', ton: TON.vurgu },
  shopify: { ikon: Store, ad: 'Shopify', ton: TON.marka },
  woocommerce: { ikon: Store, ad: 'WooCommerce', ton: TON.koyu },
  katalog_link: { ikon: Globe, ad: 'Katalog', ton: TON.gri },
  whatsapp: { ikon: MessageCircle, ad: 'WhatsApp', ton: TON.marka },
}
export const platformBilgisi = (p) => PLATFORM[p] || { ikon: Globe, ad: p || 'Bağlantı', ton: TON.gri }

// ---------------------------------------------------------------- başlık rengi
// Kart sahibi tema rengi seçtiyse başlık bandı o renkte olur. Yazı beyazdır;
// renk çok açıksa (beyazla kontrast 4.5'in altında) koyu yazıya geçilir.
export function bantRengi(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim())
  if (!m) return null
  const n = parseInt(m[1], 16)
  const kanal = (c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * kanal((n >> 16) & 255) + 0.7152 * kanal((n >> 8) & 255) + 0.0722 * kanal(n & 255)
  const beyazKontrast = 1.05 / (L + 0.05)
  return { renk: `#${m[1]}`, acik: beyazKontrast < 4.5 }
}

// ---------------------------------------------------------------- Türkçe ek
// "Kerem'in", "Ayşe'nin", "Burak'ın" — ünlü uyumuna göre ilgi eki.
export function iyelik(ad) {
  const s = String(ad || '').trim()
  if (!s) return ''
  const k = s.toLocaleLowerCase('tr-TR')
  const unluler = [...k].filter((h) => 'aeıioöuü'.includes(h))
  const son = unluler[unluler.length - 1] || 'e'
  const ek = { a: 'ı', ı: 'ı', e: 'i', i: 'i', o: 'u', u: 'u', ö: 'ü', ü: 'ü' }[son]
  const unluyleBiter = 'aeıioöuü'.includes(k[k.length - 1])
  return `${s}'${unluyleBiter ? 'n' : ''}${ek}n`
}

export const ilkAd = (ad) => String(ad || '').trim().split(/\s+/)[0] || ''

// IBAN dört haneli gruplarla daha kolay okunur; kopyalanan değer boşluksuzdur.
export const ibanBicim = (iban) => String(iban || '').replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim()

// ---------------------------------------------------------------- vCard
// RFC 2426 metin kaçışı: bio'daki satır sonu ya da noktalı virgül vCard'ın
// yapısını bozup sahte alan üretmesin.
const vkac = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/([;,])/g, '\\$1')

export function vCardMetni(profile, fields) {
  const parcalar = (profile.name || 'Bilinmiyor').trim().split(/\s+/)
  const soyad = parcalar.length > 1 ? parcalar.pop() : ''
  const ad = parcalar.join(' ') || 'Bilinmiyor'
  // vCard yalnızca herkese açık alanlardan üretilir; gizli tutulan bir alan
  // zaten istemciye hiç gelmediği için kişi kartına da yazılamaz.
  return [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${vkac(profile.name || '')}`,
    `N:${vkac(soyad)};${vkac(ad)};;;`,
    `TEL:${vkac(fields.phone || '')}`,
    `EMAIL:${vkac(fields.email || '')}`,
    `TITLE:${vkac(fields.title || '')}`,
    `ORG:${vkac(fields.company || '')}`,
    `NOTE:${vkac(fields.bio || '')}`,
    `URL:${SITE_URL}${profile.share_path || `/card/${profile.username}`}`,
    'END:VCARD',
  ].join('\n')
}

// ---------------------------------------------------------------- doğrulama
// Alan adı KUYRUKTAN kimliklenir: sahipliği belirleyen kısım sondaki kayıtlı
// alan adıdır. Uzun adı sağdan kesmek (CSS `truncate`) tam tersini yapar:
// "ziraatbankasi.com.tr.dogrulama.saldirgan.com" ekranda
// "ziraatbankasi.com.tr…" diye görünür. Yalan doğrulamada değil GÖSTERİMDE
// olur; bu yüzden baştan kesiyoruz.
export function alanAdiGoster(metin, sinir = 26) {
  const s = String(metin ?? '')
  return s.length <= sinir ? s : '…' + s.slice(-sinir)
}

// Kurum adı serbest metindir, doğrulanmış olan alan adıdır. Ad ile DAYANAĞI
// birlikte görünür; "Ziraat Bankası" adıyla kurum açan biri hazır rozet almasın.
export function kurumAdiGoster(metin, sinir = 22) {
  const s = String(metin ?? '')
  return s.length <= sinir ? s : s.slice(0, sinir - 1) + '…'
}

// Çipte uzun kurum adı kısaltmaya döner ("Anadolu Yazılımcılar Derneği" →
// "AYD"); tam ad ve dayanak alan adı ayrıntı kutusunda yazar.
export function kurumKisaAd(metin) {
  const s = String(metin ?? '').trim()
  const kelimeler = s.split(/\s+/).filter((k) => /^\p{L}/u.test(k))
  if (s.length <= 18 || kelimeler.length < 2) return kurumAdiGoster(s)
  return kelimeler.map((k) => k[0].toLocaleUpperCase('tr-TR')).join('').slice(0, 6)
}

export const YONTEM_ACIKLAMA = {
  dns_txt: 'DNS kaydına yalnızca sahibinin yazabileceği bir değer konuldu ve iki bağımsız sunucuda doğrulandı.',
  kurum_alan_adi: 'Kurumun alan adı doğrulandı; kurum yöneticisi bu kişinin üyeliğini onayladı.',
  kurum_onayi: 'Kurumun alan adı doğrulandı; kurum yöneticisi bu kişinin üyeliğini onayladı.',
  well_known: 'Alan adındaki doğrulama dosyası kontrol edildi.',
}

export const tarihKisa = (t) => (t ? new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : null)

// Rozet (çip) ve ayrıntı kutusu için tek tanım.
export function rozetBilgisi(d) {
  if (d.tur === 'alan_adi') {
    return { tur: 'alan_adi', cip: alanAdiGoster(d.konu), dayanak: null, baslik: `Alan adı: ${d.konu}` }
  }
  if (d.tur === 'kurum') {
    return {
      tur: 'kurum',
      cip: `${kurumKisaAd(d.konu)} ${d.rol === 'admin' ? 'yöneticisi' : 'üyesi'}`,
      // Rozette adın yanında DAYANAĞI da duruyor: ad bir iddia, alan adı kanıt.
      dayanak: d.kurum_alan_adi ? alanAdiGoster(d.kurum_alan_adi, 24) : null,
      baslik: `Kurum: ${d.konu}`,
    }
  }
  return { tur: d.tur, cip: kurumAdiGoster(d.konu), dayanak: null, baslik: String(d.konu ?? '') }
}

export const ROL_ADI = { admin: 'Yönetici', owner: 'Kurucu', member: 'Üye', manager: 'Yönetici' }

// ---------------------------------------------------------------- randevu
// Saatler TÜRKİYE SAATİYLE gösterilir: ziyaretçinin kendi saat dilimine
// çevirmek, yurt dışındaki birinin "sabah 9" sanıp gece yarısı randevu
// almasına yol açardı.
export const TZ = 'Europe/Istanbul'
export const SAAT_BICIMI = { hour: '2-digit', minute: '2-digit', timeZone: TZ }

export function gunEkle(tarih, n) {
  const d = new Date(tarih)
  d.setDate(d.getDate() + n)
  return d
}

// Türkiye saatine göre takvim günü (YYYY-AA-GG).
export function isoGun(d) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d)
}

export const gunKisa = (d) => {
  const g = new Date(d)
  const ad = g.toLocaleDateString('tr-TR', { weekday: 'short', timeZone: TZ }).replace('.', '')
  return `${ad} ${g.toLocaleDateString('tr-TR', { day: 'numeric', timeZone: TZ })}`
}
export const gunUzun = (d) => {
  const g = new Date(d)
  return `${gunKisa(g)} ${g.toLocaleDateString('tr-TR', { month: 'long', timeZone: TZ })}`
}
