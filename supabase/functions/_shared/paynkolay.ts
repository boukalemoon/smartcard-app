// PayNkolay (Aktifbank) protokol bağdaştırıcısı.
//
// NEDEN AYRI DOSYA:
//   Ödeme sağlayıcıya özgü HER ŞEY burada durur: alan adları, imza (hash)
//   sırası, uç nokta adresleri. Geri kalan sistem (niyet tablosu, tutar
//   doğrulaması, hak tanımlama, denetim kaydı) sağlayıcıdan bağımsızdır ve
//   zaten test edilmiştir. Sağlayıcı değişirse yalnızca bu dosya değişir.
//
// KAPALI BAŞARISIZLIK (fail closed):
//   PROTOKOL_DOGRULANDI `false` olduğu sürece:
//     • payment-start ödeme BAŞLATMAZ (503 döner)
//     • payment-callback hiçbir bildirimi İŞLEMEZ (hak tanımlanmaz)
//   İmza biçimi tahminle yazılmadı. Yanlış tahmin edilmiş bir imza
//   doğrulaması, sahte "ödendi" bildirimlerinin kabul edilmesi demektir.
//
// ENTEGRASYON DOKÜMANI GELDİĞİNDE YAPILACAKLAR:
//   1. `odemeIstegiOlustur` içinde istek alanlarını ve imza sırasını doldur
//   2. `bildirimiDogrula` içinde bildirim alanlarını ve imza sırasını doldur
//   3. (Önerilir) `odemeyiSorgula` ile bildirimden sonra sunucudan sunucuya
//      ikinci teyit al
//   4. Test ortamında uçtan uca doğrula, SONRA PROTOKOL_DOGRULANDI = true
//
// SIRLAR (Supabase → Edge Functions → Manage Secrets):
//   PAYNKOLAY_MERCHANT_KEY   üye iş yeri anahtarı
//   PAYNKOLAY_SECRET_KEY     imza anahtarı — ASLA istemciye gitmez
//   PAYNKOLAY_BASE_URL       test veya canlı uç nokta kökü
//   PUBLIC_SITE_URL          https://www.qartim.com (domain taşınınca güncellenir)

export const PROTOKOL_DOGRULANDI = false

export interface Yapilandirma {
  merchantKey: string
  secretKey: string
  baseUrl: string
  siteUrl: string
}

export interface OdemeNiyeti {
  id: string
  merchant_ref: string
  amount_kurus: number
  currency: string
  plan: string
  period: string
}

export interface OdemeIstegi {
  /** Tarayıcının POST edeceği adres */
  actionUrl: string
  /** Gizli form alanları. İmza dahil; sır DAHİL DEĞİL. */
  fields: Record<string, string>
}

export interface BildirimSonucu {
  /** İmza geçerli mi. false ise HİÇBİR alan güvenilir değildir. */
  gecerli: boolean
  merchantRef: string | null
  basarili: boolean
  /** Bankanın bildirdiği tutar, kuruş. Tutar doğrulaması veritabanında yapılır. */
  tutarKurus: number | null
  providerRef: string | null
  sebep: string | null
}

export class ProtokolHazirDegil extends Error {
  constructor() {
    super('PayNkolay protokolü henüz entegrasyon dokümanına göre doğrulanmadı')
  }
}

export function yapilandirmayiOku(): Yapilandirma | null {
  const merchantKey = Deno.env.get('PAYNKOLAY_MERCHANT_KEY') ?? ''
  const secretKey = Deno.env.get('PAYNKOLAY_SECRET_KEY') ?? ''
  const baseUrl = Deno.env.get('PAYNKOLAY_BASE_URL') ?? ''
  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? '').replace(/\/+$/, '')
  if (!merchantKey || !secretKey || !baseUrl || !siteUrl) return null
  return { merchantKey, secretKey, baseUrl, siteUrl }
}

/** Ödeme altyapısı gerçekten kullanılabilir mi. */
export function hazirMi(): boolean {
  return PROTOKOL_DOGRULANDI && yapilandirmayiOku() !== null
}

// ---------------------------------------------------------------------------
// Sağlayıcıdan bağımsız, güvenle yazılabilen yardımcılar
// ---------------------------------------------------------------------------

/** Kuruş → "1234.56". Para hesabında ondalık sayı kullanılmaz; yalnızca biçimlenir. */
export function kurusuTutaraCevir(kurus: number): string {
  const tam = Math.trunc(kurus / 100)
  const artik = Math.abs(kurus % 100).toString().padStart(2, '0')
  return `${tam}.${artik}`
}

/** "1234,56" / "1234.56" / "1.234,56" → kuruş. Anlaşılamazsa null (tahmin yok). */
export function tutariKurusaCevir(metin: string | null | undefined): number | null {
  if (metin == null) return null
  let s = String(metin).trim()
  if (!s) return null
  // Hem nokta hem virgül varsa sonuncusu ondalık ayıracıdır.
  const sonNokta = s.lastIndexOf('.')
  const sonVirgul = s.lastIndexOf(',')
  if (sonNokta !== -1 && sonVirgul !== -1) {
    const ondalik = sonNokta > sonVirgul ? '.' : ','
    const binlik = ondalik === '.' ? ',' : '.'
    s = s.split(binlik).join('').replace(ondalik, '.')
  } else {
    s = s.replace(',', '.')
  }
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null
  const [tam, artik = ''] = s.split('.')
  return Number(tam) * 100 + Number(artik.padEnd(2, '0'))
}

export async function sha512Base64(metin: string): Promise<string> {
  const ozet = await crypto.subtle.digest('SHA-512', new TextEncoder().encode(metin))
  return btoa(String.fromCharCode(...new Uint8Array(ozet)))
}

/** Zamanlama saldırısına karşı sabit süreli karşılaştırma. */
export function sabitSureliEsit(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a)
  const y = new TextEncoder().encode(b)
  let fark = x.length ^ y.length
  const n = Math.max(x.length, y.length)
  for (let i = 0; i < n; i++) fark |= (x[i] ?? 0) ^ (y[i] ?? 0)
  return fark === 0
}

// ---------------------------------------------------------------------------
// Sağlayıcıya özgü — ENTEGRASYON DOKÜMANIYLA DOLDURULACAK
// ---------------------------------------------------------------------------

export async function odemeIstegiOlustur(
  _yap: Yapilandirma,
  _niyet: OdemeNiyeti,
  _donusUrl: string,
): Promise<OdemeIstegi> {
  if (!PROTOKOL_DOGRULANDI) throw new ProtokolHazirDegil()

  // DOKÜMANDAN DOLDURULACAK:
  //   • ödeme sayfası uç noktası (yap.baseUrl + ...)
  //   • zorunlu alanlar: üye iş yeri anahtarı, bizim referansımız
  //     (niyet.merchant_ref), tutar (kurusuTutaraCevir(niyet.amount_kurus)),
  //     başarı/başarısız dönüş adresleri (donusUrl), rastgele değer,
  //     taksit, 3D kullanımı
  //   • imza: dokümandaki ALAN SIRASI + ayırıcı + secretKey →
  //     sha512Base64(...)   (algoritma dokümandan teyit edilecek)
  throw new ProtokolHazirDegil()
}

export async function bildirimiDogrula(
  _yap: Yapilandirma,
  _parametreler: Record<string, string>,
): Promise<BildirimSonucu> {
  if (!PROTOKOL_DOGRULANDI) throw new ProtokolHazirDegil()

  // DOKÜMANDAN DOLDURULACAK:
  //   • bankanın gönderdiği imza alanı ve imzaya giren ALAN SIRASI
  //   • beklenen imzayı hesapla, sabitSureliEsit ile karşılaştır
  //   • imza geçersizse { gecerli: false, ...null } dön — başka HİÇBİR alana bakma
  //   • geçerliyse: bizim referansımız, başarı kodu, tutar
  //     (tutariKurusaCevir), banka işlem numarası
  throw new ProtokolHazirDegil()
}

export async function odemeyiSorgula(
  _yap: Yapilandirma,
  _merchantRef: string,
): Promise<BildirimSonucu | null> {
  // İsteğe bağlı ama önerilir: bildirim tarayıcı üzerinden geldiyse,
  // sunucudan sunucuya işlem sorgusu ile ikinci teyit.
  return null
}
