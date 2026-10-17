import { LayoutGrid, IdCard, Share2, BadgeCheck, Inbox, BarChart3, Wallet, Handshake, User } from 'lucide-react'

// Bireysel panel menüsü (tasarım: PanelGenel). Cüzdan henüz yok: menüde
// "Yakında" olarak görünür ama tıklanmaz.
export function bireyselMenu({ gelenSayisi = 0 } = {}) {
  return [
    { anahtar: 'genel', ad: 'Genel bakış', simge: LayoutGrid },
    { anahtar: 'kartim', ad: 'Kartım', simge: IdCard },
    { anahtar: 'paylasim', ad: 'Paylaşım', simge: Share2 },
    { anahtar: 'kimlik', ad: 'Kimlik', simge: BadgeCheck },
    { anahtar: 'gelenler', ad: 'Gelenler', simge: Inbox, sayi: gelenSayisi },
    { anahtar: 'olcum', ad: 'Ölçüm', simge: BarChart3 },
    { anahtar: 'cuzdan', ad: 'Cüzdan', simge: Wallet, etiket: 'Yakında', kapali: true },
    { anahtar: 'partner', ad: 'Partner', simge: Handshake },
    { anahtar: 'hesap', ad: 'Hesap', simge: User },
  ]
}
