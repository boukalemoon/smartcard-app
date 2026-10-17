// AÇILIŞ SAYFASI — tasarım panosundaki "Landing" ekranı.
//
// Bölümler src/site/acilis/ altında; üst çubuk ve alt bilgi site kabuğundan.
// Fiyat ve plan bilgisi yalnız src/lib/planlar.js'ten okunur.
// Partner kodu (?ref=) kayıt/giriş bağlantılarına refliAdres ile taşınır.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { SiteAlti, SiteUstu } from '../site/SiteKabugu'
import { refKodu } from '../site/yardim'
import Hero from '../site/acilis/Hero'
import { Bloklar, KimlerIcin, KimlikKatmani, NasilCalisir } from '../site/acilis/Bolumler'
import Planlar from '../site/acilis/Planlar'
import Sorular from '../site/acilis/Sorular'
import { CtaBandi, NfcKart, PartnerBandi, Rakamlar } from '../site/acilis/Bantlar'

export default function LandingPage() {
  const { hash } = useLocation()

  // ?ref= ile gelindiyse kod ilk açılışta saklansın; ziyaretçi sayfada gezip
  // sonra kaydolsa da partner hak edişi kaybolmasın.
  useEffect(() => {
    refKodu()
  }, [])

  // Başka sayfadan "/#planlar" ile gelindiğinde tarayıcı bölüm henüz
  // çizilmeden kaydırmayı dener; sayfa yüklendikten sonra biz kaydırırız.
  useEffect(() => {
    if (!hash) return
    const id = decodeURIComponent(hash.slice(1))
    const kare = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ block: 'start' })
    })
    return () => cancelAnimationFrame(kare)
  }, [hash])

  return (
    <div className="min-h-screen flex flex-col bg-zemin text-metin">
      <SiteUstu />
      <main id="icerik" className="flex-1">
        <Hero />
        <NasilCalisir />
        <Bloklar />
        <KimlikKatmani />
        <KimlerIcin />
        <Planlar />
        <PartnerBandi />
        <NfcKart />
        <Rakamlar />
        <Sorular />
        <CtaBandi />
      </main>
      <SiteAlti />
    </div>
  )
}
