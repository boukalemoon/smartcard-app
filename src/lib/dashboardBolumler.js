import { IdCard, Share2, BadgeCheck, Inbox, BarChart3, User, Handshake } from 'lucide-react'

// PANEL BÖLÜMLERİ
//
// NEDEN: panel tek sayfada ~28 bölüm gösteriyordu, hepsi alt alta ve hepsi
// aynı görsel ağırlıkta. Doğrulama, randevu, kişi defteri, hakediş, referans,
// etkinlik kaydı, NFC, kurumlar… bir duvar. Kişi ne yapmak istediğini biliyor
// ama nereye bakacağını bilmiyordu.
//
// Bölümler İŞE göre ayrıldı, özelliğe göre değil:
//   • Kartım    — ziyaretçinin GÖRDÜĞÜ şey
//   • Paylaşım  — kartın DIŞARI çıkma yolları
//   • Kimlik    — kartın arkasındaki KANIT
//   • Gelenler  — karttan GERİ gelenler (bu yüzden sayaç burada)
//   • Ölçüm     — ne işe yaradığı
//   • Partner   — referans koduyla getirilenler ve %10 hak ediş
//   • Hesap     — abonelik ve güvenlik
//
// AYRI DOSYA: sabitler bileşenle aynı dosyadan dışa aktarılırsa hızlı
// yenileme (fast refresh) bozulur ve geliştirirken sayfa tam yeniden yüklenir.

export const BOLUMLER = [
  { anahtar: 'kartim',   ad: 'Kartım',   simge: IdCard },
  { anahtar: 'paylasim', ad: 'Paylaşım', simge: Share2 },
  { anahtar: 'kimlik',   ad: 'Kimlik',   simge: BadgeCheck },
  { anahtar: 'gelenler', ad: 'Gelenler', simge: Inbox },
  { anahtar: 'olcum',    ad: 'Ölçüm',    simge: BarChart3 },
  { anahtar: 'partner',  ad: 'Partner',  simge: Handshake },
  { anahtar: 'hesap',    ad: 'Hesap',    simge: User },
]

export const VARSAYILAN_BOLUM = 'kartim'

// Adresten gelen değere güvenmiyoruz: tanımadığımız bir bölüm adı gelirse
// boş ekran yerine varsayılana düşer.
export function gecerliBolum(deger) {
  return BOLUMLER.some((b) => b.anahtar === deger) ? deger : VARSAYILAN_BOLUM
}
