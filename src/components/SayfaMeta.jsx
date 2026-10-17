// Gezinirken sayfanın <title>, açıklaması ve canonical adresini yazar.
//
// NEDEN: SPA'da adres değişince <head> kendiliğinden değişmez. Önceden 21
// rotanın tamamı index.html'deki tek başlıkla görünüyordu.
//
// Herkese açık kart rotaları (/card/:username, /k/:code) BURADA YOK:
// başlığını PublicCard.jsx kişinin adıyla kendisi yazıyor, üstüne yazmayalım.
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { KANONIK_ADRES, VARSAYILAN, sayfaBul } from '../lib/sayfaMeta'

const KART_YOLLARI = ['/card/', '/k/']

function etiketiAyarla(secici, olustur, deger) {
  let el = document.head.querySelector(secici)
  if (!el) {
    el = olustur()
    document.head.appendChild(el)
  }
  if (el.tagName === 'LINK') el.setAttribute('href', deger)
  else el.setAttribute('content', deger)
}

export default function SayfaMeta() {
  const { pathname } = useLocation()

  useEffect(() => {
    if (KART_YOLLARI.some((y) => pathname.startsWith(y))) return

    const sayfa = sayfaBul(pathname)
    // Tanımsız rota (panel, giriş, 404…): başlığı markaya döndür ama
    // açıklamayı ve canonical'ı ana sayfanınkiyle doldurmayalım —
    // arama motoruna yanlış sayfayı işaret etmiş oluruz.
    document.title = sayfa ? sayfa.baslik : VARSAYILAN.baslik

    const aciklama = sayfa?.aciklama ?? VARSAYILAN.aciklama
    etiketiAyarla('meta[name="description"]', () => {
      const m = document.createElement('meta')
      m.setAttribute('name', 'description')
      return m
    }, aciklama)

    etiketiAyarla('meta[property="og:title"]', () => {
      const m = document.createElement('meta')
      m.setAttribute('property', 'og:title')
      return m
    }, sayfa ? sayfa.baslik : VARSAYILAN.baslik)

    etiketiAyarla('meta[property="og:description"]', () => {
      const m = document.createElement('meta')
      m.setAttribute('property', 'og:description')
      return m
    }, aciklama)

    if (sayfa) {
      const adres = `${KANONIK_ADRES}${sayfa.yol === '/' ? '/' : sayfa.yol}`
      etiketiAyarla('link[rel="canonical"]', () => {
        const l = document.createElement('link')
        l.setAttribute('rel', 'canonical')
        return l
      }, adres)
      etiketiAyarla('meta[property="og:url"]', () => {
        const m = document.createElement('meta')
        m.setAttribute('property', 'og:url')
        return m
      }, adres)
    }
  }, [pathname])

  return null
}
