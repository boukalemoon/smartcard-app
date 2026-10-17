// Kart başlık bandı: QRtım küçük logosu + paylaş düğmesi, avatar, ad, unvan,
// şirket · şehir ve doğrulama rozetleri.
//   bireysel → ortalanmış yuvarlak avatar (tasarım: KartBireysel)
//   kurumsal → solda kare avatar, altında rozet çipleri (tasarım: KartKurumsal)
// Band rengi varsayılan `marka`; kart sahibi tema rengi seçtiyse o renk.
import { useEffect, useRef, useState } from 'react'
import { Building2, Check, ChevronDown, Link2, Mail, MessageCircle, MessageSquare, Share } from 'lucide-react'
import { basHarf, birlestir } from '../../panel/bicim'
import { trackCardEvent } from '../../utils/analyticsHelpers'
import { ODAK, bantRengi, panoyaKopyala, rozetBilgisi, safeUrl } from './yardim'
import { QrMotif } from './parcalar'

function PaylasDugmesi({ adres, baslik, hedef, acikBant }) {
  const [menu, setMenu] = useState(false)
  const kutu = useRef(null)

  // Yedek menü dışarı tıklanınca ya da Escape ile kapanır.
  useEffect(() => {
    if (!menu) return undefined
    const tik = (e) => { if (kutu.current && !kutu.current.contains(e.target)) setMenu(false) }
    const esc = (e) => { if (e.key === 'Escape') setMenu(false) }
    document.addEventListener('mousedown', tik)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', tik); document.removeEventListener('keydown', esc) }
  }, [menu])

  const kaydet = (kanal) => trackCardEvent('share', { ...hedef, meta: { channel: kanal } })

  const paylas = async () => {
    // Telefonda sistemin paylaşım sayfası (WhatsApp, SMS, e-posta… hepsi orada).
    // Desteklenmeyen tarayıcıda kanal menüsü açılır.
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: baslik, url: adres })
        kaydet('sistem')
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    setMenu((v) => !v)
  }

  const metin = `${baslik} - ${adres}`
  const oge = 'flex items-center gap-2.5 w-full h-11 px-3 rounded-[10px] text-[14px] font-medium text-metin hover:bg-yuzey-2 text-left ' + ODAK

  return (
    <div ref={kutu} className="absolute right-3 top-2 z-20">
      <button
        type="button"
        aria-label="Paylaş"
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={paylas}
        className={birlestir(
          'w-10 h-10 rounded-[10px] inline-flex items-center justify-center transition-colors',
          acikBant ? 'bg-black/10 hover:bg-black/15 text-lacivert-950' : 'bg-white/15 hover:bg-white/25 text-white',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white',
        )}
      >
        <Share size={18} aria-hidden="true" />
      </button>
      {menu && (
        <div role="menu" aria-label="Kartı paylaş" className="absolute right-0 mt-2 w-56 rounded-xl border border-cizgi bg-yuzey p-1.5 shadow-xl text-left">
          <a role="menuitem" className={oge} href={`https://wa.me/?text=${encodeURIComponent(metin)}`} target="_blank" rel="noopener noreferrer" onClick={() => { kaydet('whatsapp'); setMenu(false) }}>
            <MessageCircle size={16} aria-hidden="true" className="text-aksan" />WhatsApp
          </a>
          <a role="menuitem" className={oge} href={`sms:?body=${encodeURIComponent(metin)}`} onClick={() => { kaydet('sms'); setMenu(false) }}>
            <MessageSquare size={16} aria-hidden="true" className="text-aksan" />SMS
          </a>
          <a role="menuitem" className={oge} href={`mailto:?subject=${encodeURIComponent(baslik)}&body=${encodeURIComponent(`${baslik} dijital kartvizitini gör:\n${adres}`)}`} onClick={() => { kaydet('eposta'); setMenu(false) }}>
            <Mail size={16} aria-hidden="true" className="text-aksan" />E-posta
          </a>
          <button role="menuitem" type="button" className={oge} onClick={() => { panoyaKopyala(adres, 'Bağlantı kopyalandı'); kaydet('kopyala'); setMenu(false) }}>
            <Link2 size={16} aria-hidden="true" className="text-aksan" />Bağlantıyı kopyala
          </button>
        </div>
      )}
    </div>
  )
}

// Ready Player Me 3D avatarı varsa avatara dokununca görünüm değişir
// (eski AvatarFlipCard davranışı).
function Avatar({ profile, kare }) {
  const [ucBoyut, setUcBoyut] = useState(false)
  const foto = safeUrl(profile.avatar_url)
  const rpmId = typeof profile.avatar_3d_url === 'string' ? profile.avatar_3d_url.split('/').pop().replace('.glb', '').replace(/[^A-Za-z0-9_-]/g, '') : ''
  const ucBoyutAdres = rpmId ? `https://models.readyplayer.me/${rpmId}.png?scene=fullbody-portrait-v1` : null
  const gorsel = ucBoyut && ucBoyutAdres ? ucBoyutAdres : foto
  const ad = profile.name || ''

  const kutu = kare
    ? 'w-[76px] h-[76px] rounded-[20px] bg-vurgu text-white dark:text-lacivert-950 text-[26px]'
    : 'w-24 h-24 rounded-full bg-aksan-acik text-aksan-koyu dark:text-aksan text-[32px] border-4 border-white/55'
  const icerik = gorsel
    ? <img src={gorsel} alt="" className="w-full h-full object-cover" />
    : <span aria-hidden="true">{basHarf(ad)}</span>
  const ortak = birlestir('relative shrink-0 overflow-hidden inline-flex items-center justify-center font-baslik font-extrabold', kutu)

  if (!ucBoyutAdres) {
    return <span role="img" aria-label={`${ad} profil fotoğrafı`} className={ortak}>{icerik}</span>
  }
  return (
    <button
      type="button"
      aria-pressed={ucBoyut}
      aria-label={ucBoyut ? `${ad} profil fotoğrafını göster` : `${ad} 3D avatarını göster`}
      onClick={() => setUcBoyut((v) => !v)}
      className={birlestir(ortak, 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white')}
    >
      {icerik}
      <span className="absolute bottom-1 right-1 rounded-full bg-lacivert-950/80 text-white text-[10px] font-bold px-1.5 py-0.5 font-sans">{ucBoyut ? 'Foto' : '3D'}</span>
    </button>
  )
}

export default function Baslik({ profile, fields, dogrulamalar, duzen, dogrulamaAcik, onDogrulama, paylasAdres, anaAdres, hedef }) {
  const tema = bantRengi(profile.theme_color)
  const arkaPlan = safeUrl(profile.background_image_url)
  // Arka plan görseli varsa üstüne koyu örtü gelir; yazı her durumda beyaz.
  const acikBant = !arkaPlan && !!tema?.acik
  const kare = duzen === 'kurumsal'

  const yazi = acikBant ? 'text-lacivert-950' : 'text-white'
  const yazi2 = acikBant ? 'text-lacivert-900' : 'text-white/85'
  const yazi3 = acikBant ? 'text-lacivert-800' : 'text-white/75'
  const unvan = [fields.title, fields.department].filter(Boolean).join(' · ')
  const yer = [fields.company, fields.city].filter(Boolean).join(' · ')
  const rozetler = (dogrulamalar || []).map(rozetBilgisi)

  const ad = (
    <div className={birlestir('relative flex flex-col gap-[3px] min-w-0', kare ? 'text-left' : 'text-center')}>
      <h1 className={birlestir('font-baslik font-extrabold tracking-[-0.015em] leading-[1.15] break-words', kare ? 'text-[22px]' : 'text-2xl', yazi)}>{profile.name || 'İsimsiz kart'}</h1>
      {unvan && <p className={birlestir('text-[14px]', yazi2)}>{unvan}</p>}
      {yer && <p className={birlestir('text-[13px]', yazi3)}>{yer}</p>}
    </div>
  )

  const cipSinif = acikBant
    ? 'bg-black/10 border-black/20 text-lacivert-950'
    : 'bg-white/15 border-white/35 text-white'

  return (
    <header
      className={birlestir('relative overflow-hidden px-5 pb-[22px]', kare ? 'pt-[52px]' : 'pt-14', !tema && !arkaPlan && 'bg-marka')}
      style={tema && !arkaPlan ? { backgroundColor: tema.renk } : undefined}
    >
      {arkaPlan && (
        <>
          <div className="absolute inset-0 bg-cover bg-center" style={{ backgroundImage: `url(${JSON.stringify(arkaPlan)})` }} aria-hidden="true" />
          <div className="absolute inset-0 bg-black/45" aria-hidden="true" />
        </>
      )}
      <QrMotif className={birlestir('absolute -right-12 -top-12 w-[240px] h-[240px] opacity-[0.14]', acikBant ? 'text-lacivert-950' : 'text-white')} />

      <a
        href={anaAdres}
        aria-label="QRtım ana sayfa"
        className="absolute left-4 top-3.5 z-10 inline-flex items-center rounded-md bg-white px-1.5 py-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
      >
        <img src="/qrtim-logo.png" alt="QRtım" width="240" height="68" className="h-4 w-auto" />
      </a>
      <PaylasDugmesi adres={paylasAdres} baslik={profile.name || 'QRtım kartı'} hedef={hedef} acikBant={acikBant} />

      {kare ? (
        <div className="relative flex flex-col gap-3.5">
          <div className="flex items-center gap-3.5">
            <Avatar profile={profile} kare />
            {ad}
          </div>
          {rozetler.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Doğrulamalar">
              {rozetler.map((r, i) => (
                <li key={`${r.tur}-${i}`}>
                  <button
                    type="button"
                    onClick={onDogrulama}
                    aria-expanded={dogrulamaAcik}
                    aria-controls="kart-dogrulama"
                    className={birlestir('inline-flex items-center gap-1.5 rounded-full border px-[11px] py-[5px] text-xs font-semibold transition-colors hover:bg-white/25', cipSinif, 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white')}
                  >
                    {r.tur === 'kurum' ? <Building2 size={12} aria-hidden="true" /> : <Check size={12} strokeWidth={3} aria-hidden="true" />}
                    {r.cip}
                    {r.dayanak && <span className="opacity-75">· {r.dayanak}</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="relative flex flex-col items-center gap-3">
          <Avatar profile={profile} />
          {ad}
          {rozetler.length > 0 && (
            <button
              type="button"
              onClick={onDogrulama}
              aria-expanded={dogrulamaAcik}
              aria-controls="kart-dogrulama"
              className={birlestir('inline-flex max-w-full items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-white/25', cipSinif, 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white')}
            >
              <Check size={13} strokeWidth={3} aria-hidden="true" className="shrink-0" />
              <span className="min-w-0">
                {rozetler[0].tur === 'alan_adi' ? `${rozetler[0].cip} doğrulandı` : rozetler[0].cip}
                {rozetler[0].dayanak && <span className="opacity-75"> · {rozetler[0].dayanak}</span>}
                {rozetler.length > 1 && <span className="opacity-75"> · +{rozetler.length - 1}</span>}
              </span>
              <ChevronDown size={12} strokeWidth={2.5} aria-hidden="true" className={birlestir('shrink-0 transition-transform', dogrulamaAcik && 'rotate-180')} />
            </button>
          )}
        </div>
      )}
    </header>
  )
}
