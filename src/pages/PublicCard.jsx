// HERKESE AÇIK KART — /card/:username, /k/:code ve özel alan adı modu.
//
// Tasarım panosu: KartBireysel (açık) ve KartKurumsal (STK üyesi, koyu). İkisi
// aynı sayfanın iki görünümüdür; hangi blokların görüneceğini veri belirler.
// Bölüm bileşenleri src/site/kart/ altında.
import { useCallback, useEffect, useState } from 'react'
import { useLocation, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabaseClient'
import { SITE_URL } from '../lib/siteUrl'
import { ozelAlanAdiMi, suAnkiHost } from '../lib/ozelAlanAdi'
import { trackCardEvent, kaynagiCoz } from '../utils/analyticsHelpers'
import { refliAdres } from '../site/yardim'
import { vCardMetni } from '../site/kart/yardim'
import Baslik from '../site/kart/Baslik'
import Randevu from '../site/kart/Randevu'
import BilgiBirak from '../site/kart/BilgiBirak'
import { Baglantilar, Dogrulama, Eylemler, GoogleYorum, Hizmetler, Iletisim, Katalog, Kurumlar, Odeme } from '../site/kart/Bloklar'
import { DurumEkrani, Iskelet, KartAlti, Sutun } from '../site/kart/Kabuk'

// Sayfa başlığı ve paylaşım önizleme etiketleri. SPA olduğu için yalnız
// betik çalıştıran tarayıcı/önizleyiciler görür; sayfadan çıkınca eski
// değerler geri yüklenir.
function metaAyarla(ad, deger, ozellik = 'name') {
  let el = document.head.querySelector(`meta[${ozellik}="${ad}"]`)
  const eski = el ? el.getAttribute('content') : null
  const yeni = !el
  if (!el) {
    el = document.createElement('meta')
    el.setAttribute(ozellik, ad)
    document.head.appendChild(el)
  }
  el.setAttribute('content', deger)
  return () => { if (yeni) el.remove(); else el.setAttribute('content', eski ?? '') }
}

export default function PublicCard() {
  // /card/:username → ana profil, /k/:code → seçilmiş profil (persona)
  const { username, code } = useParams()
  const location = useLocation()
  // Kart kişinin kendi alan adında da açılabiliyor; o durumda adres
  // parametresi yok, kartı HOST belirler.
  const ozelAlan = ozelAlanAdiMi()
  const anahtar = ozelAlan ? `host:${suAnkiHost()}` : code ? `k:${code}` : `u:${username || ''}`
  // Ziyaretçi karta nereden geldi: QR (?k=qr), NFC (?k=nfc), /k/ bağlantısı ya da doğrudan.
  const kaynak = kaynagiCoz(location.search, Boolean(code))

  const [deneme, setDeneme] = useState(0)
  // { anahtar, deneme, durum: 'tamam'|'yok'|'durdu'|'yogun', data }
  const [sonuc, setSonuc] = useState({ anahtar: null })
  const [randevuVar, setRandevuVar] = useState(false)
  const [dogrulamaAcik, setDogrulamaAcik] = useState(null)

  useEffect(() => {
    if (!ozelAlan && !username && !code) return undefined
    let iptal = false
    ;(async () => {
      let yeni
      try {
        // Kartın TEK veri kaynağı. Görünürlük filtresi, plan bazlı kurum sınırı
        // ve ödeme onayı sunucuda uygulanır; persona bağlantısı kodla çözülür,
        // profil ADIYLA başka profile ulaşılamaz.
        const { data, error } = ozelAlan
          ? await supabase.rpc('resolve_custom_domain', { p_host: suAnkiHost() })
          : code
            ? await supabase.rpc('get_public_card_by_code', { p_code: code })
            : await supabase.rpc('get_public_card', { p_username: username })
        if (error) throw error
        if (!data) yeni = { durum: 'yok' }
        else if (data.paused) yeni = { durum: 'durdu' }
        else {
          yeni = { durum: 'tamam', data }
          // Görüntülenme, sayaç ve hız sınırı TEK çağrıda, sunucuda.
          trackCardEvent('profile_view', {
            username: username || (ozelAlan ? data.username || null : null),
            code: code || null,
            source: kaynak,
          })
        }
      } catch (err) {
        console.error('Kart yükleme hatası:', err)
        // 53400: sunucudaki hız sınırı. Ziyaretçiye "kart yok" demek yanıltıcı olur.
        yeni = { durum: err?.code === '53400' ? 'yogun' : 'yok' }
      }
      if (!iptal) setSonuc({ anahtar, deneme, ...yeni })
    })()
    return () => { iptal = true }
    // kaynak yalnız ilk görüntülenme kaydı için okunur; değişmesi kartı yeniden yüklememeli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anahtar, deneme])

  const yukleniyor = sonuc.anahtar !== anahtar || sonuc.deneme !== deneme
  const profile = !yukleniyor && sonuc.durum === 'tamam' ? sonuc.data : null
  const fields = profile?.fields || {}
  const dogrulamalar = profile?.dogrulamalar || []

  // Sayfa başlığı ve önizleme etiketleri.
  useEffect(() => {
    if (yukleniyor) return undefined
    const eskiBaslik = document.title
    const geri = []
    if (profile) {
      const ad = profile.name || 'QRtım kartı'
      const ozet = [fields.title, fields.company, fields.city].filter(Boolean).join(' · ') || 'Dijital kartvizit'
      document.title = `${ad} — QRtım`
      geri.push(metaAyarla('description', `${ad} · ${ozet}`))
      geri.push(metaAyarla('og:title', `${ad} — QRtım`, 'property'))
      geri.push(metaAyarla('og:description', ozet, 'property'))
      geri.push(metaAyarla('og:type', 'profile', 'property'))
      geri.push(metaAyarla('og:url', `${SITE_URL}${profile.share_path || `/card/${profile.username}`}`, 'property'))
      if (/^https:\/\//i.test(profile.avatar_url || '')) geri.push(metaAyarla('og:image', profile.avatar_url, 'property'))
      // /k/ bağlantıları paylaşılan kişiye özeldir; arama motorunda listelenmesin.
      if (code) geri.push(metaAyarla('robots', 'noindex'))
    } else {
      document.title = sonuc.durum === 'durdu' ? 'Kart paylaşılmıyor — QRtım' : 'Kart bulunamadı — QRtım'
      geri.push(metaAyarla('robots', 'noindex'))
    }
    return () => { document.title = eskiBaslik; geri.forEach((f) => f()) }
  }, [yukleniyor, profile, fields.title, fields.company, fields.city, sonuc.durum, code])

  const hedef = {
    username: username || (ozelAlan ? profile?.username || null : null),
    code: code || null,
    source: kaynak,
  }

  // Kendi alan adında açılan kartta site sayfaları yok; bağlantılar QRtım'a gider.
  const disAdres = ozelAlan ? SITE_URL : null
  // Kart sahibinin davet kodu varsa kayıt bağlantısı onu taşır; yoksa
  // ziyaretçinin getirdiği partner kodu (?ref) korunur. Eskiden profil
  // kimliği yazılıyordu, sunucu tanımadığı için davet sessizce kayboluyordu.
  const kayitYolu = profile?.referral_code ? `/signup?ref=${encodeURIComponent(profile.referral_code)}` : refliAdres('/signup')

  const rehbereKaydet = useCallback(() => {
    if (!profile) return
    const blob = new Blob([vCardMetni(profile, fields)], { type: 'text/vcard;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${profile.username || 'kisi'}.vcf`
    document.body.appendChild(link); link.click(); document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    trackCardEvent('vcard_download', hedef)
    // hedef her çizimde yeniden kurulur; alanları yeterli.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, fields, hedef.username, hedef.code, hedef.source])

  const randevuyaGit = () => {
    const el = document.getElementById('randevu')
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    el.querySelector('button[aria-pressed="true"]')?.focus({ preventScroll: true })
  }

  if (!ozelAlan && !username && !code) return <DurumEkrani tur="yok" disAdres={disAdres} kayitYolu={kayitYolu} />
  if (yukleniyor) return <Iskelet />
  if (!profile) {
    return <DurumEkrani tur={sonuc.durum} disAdres={disAdres} kayitYolu={kayitYolu} onYenile={() => setDeneme((n) => n + 1)} />
  }

  // STK / kurum üyesi görünümü: kartta doğrulanmış kurum üyeliği varsa kare
  // avatarlı düzen ve açık doğrulama kutusu (tasarım: KartKurumsal).
  const duzen = dogrulamalar.some((d) => d.tur === 'kurum') ? 'kurumsal' : 'bireysel'
  const dogrulamaGorunur = dogrulamaAcik ?? duzen === 'kurumsal'
  const paylasAdres = ozelAlan ? window.location.origin : `${SITE_URL}${profile.share_path || `/card/${profile.username}`}`

  const randevu = <Randevu hedef={hedef} kartSahibi={profile.name} onDurum={setRandevuVar} />
  const bio = fields.bio && <p className="text-[14px] text-metin-2 px-1 whitespace-pre-line">{fields.bio}</p>

  return (
    <Sutun>
      <Baslik
        profile={profile}
        fields={fields}
        dogrulamalar={dogrulamalar}
        duzen={duzen}
        dogrulamaAcik={dogrulamaGorunur}
        onDogrulama={() => setDogrulamaAcik(!dogrulamaGorunur)}
        paylasAdres={paylasAdres}
        anaAdres={ozelAlan ? SITE_URL : '/'}
        hedef={hedef}
      />
      <main className="p-4 flex flex-col gap-3">
        <Eylemler duzen={duzen} randevuVar={randevuVar} onRehber={rehbereKaydet} onRandevu={randevuyaGit} />

        {dogrulamalar.length > 0 && (duzen === 'kurumsal' || dogrulamaGorunur) && (
          <Dogrulama dogrulamalar={dogrulamalar} acik={dogrulamaGorunur} onToggle={() => setDogrulamaAcik(!dogrulamaGorunur)} />
        )}

        {bio}
        <Iletisim fields={fields} />
        {duzen === 'kurumsal' && randevu}
        <Baglantilar socialLinks={profile.social_links} whatsapp={fields.whatsapp} hedef={hedef} gorunum={profile.social_layout} />
        <Kurumlar organizations={profile.organizations} dogrulamalar={dogrulamalar} />
        <Hizmetler services={fields.services} />
        {duzen === 'bireysel' && randevu}
        <GoogleYorum link={fields.google_review_link} />
        <Odeme payment={profile.payment} />
        <Katalog links={fields.catalog_links} />
        {/* Karşılıklı kartvizit: kartı gören kişi de kendini tanıtabilsin. */}
        <BilgiBirak hedef={hedef} kartSahibi={profile.name} />

        <KartAlti kayitYolu={kayitYolu} disAdres={disAdres} />
      </main>
    </Sutun>
  )
}
