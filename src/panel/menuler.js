import {
  LayoutGrid, IdCard, Share2, BadgeCheck, Inbox, BarChart3, Wallet, Handshake, User,
  Users, UserPlus, Building2, Settings, Nfc, CreditCard, FileText,
} from 'lucide-react'

// PANEL MENÜLERİ — üçü de burada.
//
// NEDEN TEK DOSYA: menüler üç ayrı yerde tanımlıydı (bireysel burada,
// kurumsal KurumPaneli.jsx içinde, yönetici YoneticiPaneli.jsx içinde) ve
// ayrışmışlardı:
//   • Kurumsal ve yönetici menülerinde İKON YOKTU. MenuOgesi ikonu isteğe
//     bağlı çiziyor, bu yüzden etiketler o menülerde yatayda daha solda
//     başlıyordu — mod değişince yazılar kayıyordu.
//   • Ortak kavramlar farklı sıralarda duruyordu: Ölçüm bireyselde 6.,
//     kurumsalda 4-5.; Partner bireyselde 8., kurumsalda 5-6. Bireysel ↔
//     Kurumsal geçişinde aynı menü öğesi başka bir yere atlıyordu.
//
// KURAL: ortak kavram her menüde AYNI İKONU taşır ve menünün AYNI UCUNA
// sabitlenir. Ölçüm, Partner ve son öğe (Hesap / Ayarlar) her zaman son üç
// sıradır; Genel bakış her zaman birincidir. Ortada kalan blok moda özgüdür
// ve zaten farklı olmalıdır.
//
// Bu dosya bileşen DIŞA AKTARMAZ: sabitler bileşenle aynı dosyadan gelirse
// hızlı yenileme (fast refresh) bozulur.

// Anahtar → ikon. Ortak kavramlar tek satırda: ikon değişecekse buradan
// değişir, üç menüde birden.
const SIMGE = {
  // ortak
  genel: LayoutGrid,
  olcum: BarChart3,
  partner: Handshake,
  hesap: User,
  ayarlar: Settings,
  // bireysel
  kartim: IdCard,
  paylasim: Share2,
  kimlik: BadgeCheck,
  gelenler: Inbox,
  cuzdan: Wallet,
  // kurumsal
  uyeler: Users,
  basvurular: UserPlus,
  profil: Building2,
  // yönetici
  platform: LayoutGrid,
  kullanicilar: Users,
  abonelikler: CreditCard,
  komisyonlar: Wallet,
  referanslar: Handshake,
  nfc: Nfc,
  kurumlar: Building2,
  denetim: FileText,
}

// Öğeyi kur: ikon anahtardan gelir, tek tek yazılmaz.
const oge = (anahtar, ad, ek = {}) => ({ anahtar, ad, simge: SIMGE[anahtar], ...ek })

// Bireysel panel menüsü (tasarım: PanelGenel). Cüzdan henüz yok: menüde
// "Yakında" olarak görünür ama tıklanmaz.
//
// Cüzdan ÖLÇÜM'DEN ÖNCEYE alındı (önceden ölçüm ile partner arasındaydı).
// Sebep: son üç sıra (Ölçüm, Partner, Hesap) kurumsal menüyle hizalı
// kalsın. Cüzdan kapalı bir öğe, yer değişikliğinin işlevsel etkisi yok.
export function bireyselMenu({ gelenSayisi = 0 } = {}) {
  return [
    oge('genel', 'Genel bakış'),
    // ---- moda özgü blok
    oge('kartim', 'Kartım'),
    oge('paylasim', 'Paylaşım'),
    oge('kimlik', 'Kimlik'),
    oge('gelenler', 'Gelenler', { sayi: gelenSayisi }),
    oge('cuzdan', 'Cüzdan', { etiket: 'Yakında', kapali: true }),
    // ---- ortak kuyruk
    oge('olcum', 'Ölçüm'),
    oge('partner', 'Partner'),
    oge('hesap', 'Hesap'),
  ]
}

// Kurumsal panel menüsü. Yönetici olunmayan kurumda yalnızca genel bakış ve
// salt okunur üye listesi görünür — o durumda ortak kuyruk da yoktur, çünkü
// ölçüm/partner/ayarlar yönetici işidir.
export function kurumsalMenu(kurum) {
  const m = [oge('genel', 'Genel bakış'), oge('uyeler', 'Üyeler')]
  if (!kurum?.is_admin) return m
  // Başvuru formu yalnızca STK türünde çalışır (get_public_organization).
  if (kurum.is_stk) {
    m.push(oge('basvurular', 'Başvurular', { sayi: Number(kurum.pending_applications) || 0 }))
  }
  m.push(
    oge('profil', 'Kurum profili'),
    // ---- ortak kuyruk: bireysel menüyle aynı sırada
    oge('olcum', 'Ölçüm'),
    oge('partner', 'Partner'),
    oge('ayarlar', 'Ayarlar'),
  )
  return m
}

// Yönetici menüsü. NFC siparişleri ve denetim kaydı için yöneticinin
// okuyabildiği bir kaynak yok (nfc_orders'ta yönetici okuma kuralı yok,
// audit_log yalnızca kişinin kendi kayıtlarına açık): "Yakında".
//
// Mod anahtarı bireysel/kurumsal arasında çalışıyor, yönetici ayrı bir rol:
// burada hizalanacak bir karşı menü yok. İkonlar yine de aynı haritadan
// geliyor ki etiketler diğer panellerle aynı yerde başlasın.
export function yoneticiMenu() {
  return [
    oge('platform', 'Platform'),
    oge('kullanicilar', 'Kullanıcılar'),
    oge('abonelikler', 'Abonelikler'),
    oge('komisyonlar', 'Komisyonlar'),
    oge('referanslar', 'Referanslar'),
    oge('nfc', 'NFC siparişleri', { etiket: 'Yakında', kapali: true }),
    oge('kurumlar', 'Kurumlar'),
    oge('denetim', 'Denetim kaydı', { etiket: 'Yakında', kapali: true }),
  ]
}
