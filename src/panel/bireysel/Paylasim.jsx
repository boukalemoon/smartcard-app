// Bireysel panel — Paylaşım (tasarımı yok; PanelGenel dilinden).
//
// QR kod, profil seçimi, NFC etiket yazma, kendi alan adı ve basılı NFC kart
// tek sayfada. Eski bileşenlerin (QRCodeDisplay, PersonaShare, NFCWriter,
// CustomDomainManager) iş mantığı AYNEN taşındı, görünüm yeni dille yazıldı:
//   • QR'a basılan adres kaynağını taşır (?k=qr), ekranda gösterilen sade kalır.
//   • Ana profilin QR'ı kalıcı KART KODUNA bakar; kullanıcı adı değişse de çalışır.
//   • Logo varken hata düzeltme H (~%30); yoksa M. İndirmede kenar payı 4 modül.
//   • NFC'ye yazılan adres ?k=nfc taşır; yazdıktan sonra kilit varsayılan açık.
import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Copy, Download, FileImage, Globe, IdCard, Nfc, RefreshCw, Share2, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { cardUrl, personaUrl, kartKoduUrl, kaynakliAdres } from '../../lib/siteUrl'
import { Kart, KartBaslik, SayfaBaslik, Dugme, IkonDugme, Rozet, Segment, Anahtar, Girdi, BosDurum } from '../ui'
import { birlestir } from '../bicim'

const VARSAYILAN_ON = '#1F2937'
const VARSAYILAN_ARKA = '#FFFFFF'
const BASKI_KENAR_PAYI = 4
const BOYUTLAR = [
  { deger: 600, ad: 'Ekran', not: 'Sosyal medya, e-posta imzası' },
  { deger: 1000, ad: 'Kartvizit', not: 'Kartvizit, etiket, broşür' },
  { deger: 2000, ad: 'Afiş', not: 'Tabela, afiş, vitrin' },
]
const adresYaz = (url) => url.replace(/^https?:\/\//, '')

// Durum kutusu: yalnız durum renkleri, her biri koyu karşılığıyla.
const MESAJ_TON = {
  basari: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/30',
  uyari: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/30',
  hata: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
  bilgi: 'bg-yuzey-2 text-metin border-cizgi',
}
function Mesaj({ mesaj }) {
  if (!mesaj) return null
  return <div role="status" className={birlestir('rounded-xl border px-3.5 py-2.5 text-[13px]', MESAJ_TON[mesaj.tur])}>{mesaj.metin}</div>
}

// ------------------------------------------------------------- QR yardımcıları
function parlaklik(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '')
  if (!m) return 1
  const n = parseInt(m[1], 16)
  const k = [n >> 16, (n >> 8) & 255, n & 255].map((c) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]
}
const kontrast = (a, b) => { const [x, y] = [parlaklik(a), parlaklik(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }

// Logo kodun ortasındaki %20'yi kaplar (yuvarlak). Görsel yüklenmezse false.
function logoCiz(canvas, src, arka) {
  return new Promise((coz) => {
    const c = canvas.getContext('2d')
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const b = canvas.width * 0.2
      const x = (canvas.width - b) / 2, y = (canvas.height - b) / 2
      c.fillStyle = arka
      c.fillRect(x - 5, y - 5, b + 10, b + 10)
      c.save(); c.beginPath(); c.arc(x + b / 2, y + b / 2, b / 2, 0, Math.PI * 2); c.closePath(); c.clip()
      c.drawImage(img, x, y, b, b); c.restore()
      coz(true)
    }
    img.onerror = () => coz(false)
    img.src = src
  })
}

function indir(href, ad) {
  const a = document.createElement('a')
  a.href = href; a.download = ad
  document.body.appendChild(a); a.click(); a.remove()
}

// =============================================================== sayfa
export default function Paylasim({ ctx }) {
  const { profile } = ctx
  const [personalar, setPersonalar] = useState([])
  const [gorunum, setGorunum] = useState(() => ({
    on: profile?.qr_foreground_color || VARSAYILAN_ON,
    arka: profile?.qr_background_color || VARSAYILAN_ARKA,
    logo: Boolean(profile?.qr_logo_enabled),
  }))

  useEffect(() => {
    if (!profile?.id) return
    let iptal = false
    supabase.rpc('persona_list').then(({ data }) => { if (!iptal) setPersonalar(Array.isArray(data) ? data : []) })
    return () => { iptal = true }
  }, [profile?.id])

  if (!profile?.username) {
    return (
      <>
        <SayfaBaslik baslik="Paylaşım" alt="Kartınızı QR, NFC ve kendi adresinizle paylaşın." />
        <Kart className="p-5">
          <BosDurum
            ikon={IdCard}
            baslik="Önce kullanıcı adınızı belirleyin"
            aciklama="Kartınızın adresi kullanıcı adınızdan oluşur. Kartım bölümünde kullanıcı adınızı seçtiğinizde QR kodunuz ve paylaşım bağlantınız burada hazır olur."
            eylem={<Dugme tur="ana" onClick={() => ctx.bolumDegistir('kartim')}>Kartım&apos;a git</Dugme>}
          />
        </Kart>
      </>
    )
  }

  return (
    <>
      <SayfaBaslik baslik="Paylaşım" alt="Kartınızı QR, NFC ve kendi adresinizle paylaşın." />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <QrKarti profile={profile} personalar={personalar} gorunum={gorunum} ctx={ctx} />
          <AlanAdi ctx={ctx} />
        </div>
        <div className="flex flex-col gap-5 min-w-0">
          <NfcKarti ctx={ctx} />
          <QrGorunumu profile={profile} gorunum={gorunum} setGorunum={setGorunum} ctx={ctx} />
          <NfcYaz profile={profile} />
        </div>
      </div>
    </>
  )
}

// =============================================================== QR kodu
function QrKarti({ profile, personalar, gorunum, ctx }) {
  const tuval = useRef(null)
  const [seciliId, setSeciliId] = useState(null)
  const [boyut, setBoyut] = useState(1000)
  const [kopyalandi, setKopyalandi] = useState(false)

  // İş toplantısında yanlışlıkla kişisel profil paylaşılmasın: önce profil
  // seçilir, QR seçilen profilin açık bilgilerini açar.
  const secili = personalar.find((p) => p.id === seciliId) || personalar.find((p) => p.is_primary) || null
  const ana = !secili || secili.is_primary
  const adres = ana
    ? (profile.card_code ? kartKoduUrl(profile.card_code) : cardUrl(profile.username))
    : personaUrl(secili.share_code)
  const qrAdres = kaynakliAdres(adres, 'qr')
  const logoSrc = gorunum.logo && profile.avatar_url ? profile.avatar_url : null
  const duzeltme = logoSrc ? 'H' : 'M'
  const dosya = ana ? profile.username : `${profile.username}-${secili.name}`.replace(/[^\p{L}\p{N}-]+/gu, '-')

  useEffect(() => {
    const c = tuval.current
    if (!c) return
    let iptal = false
    QRCode.toCanvas(c, qrAdres, { width: 440, margin: 2, errorCorrectionLevel: duzeltme, color: { dark: gorunum.on, light: gorunum.arka } })
      .then(() => { c.style.width = ''; c.style.height = ''; return !iptal && logoSrc ? logoCiz(c, logoSrc, gorunum.arka) : null })
      .catch((e) => console.error('QR çizilemedi:', e))
    return () => { iptal = true }
  }, [qrAdres, duzeltme, gorunum.on, gorunum.arka, logoSrc])

  const pngIndir = async () => {
    try {
      const c = document.createElement('canvas')
      await QRCode.toCanvas(c, qrAdres, { width: boyut, margin: BASKI_KENAR_PAYI, errorCorrectionLevel: duzeltme, color: { dark: gorunum.on, light: gorunum.arka } })
      let logoOldu = logoSrc ? await logoCiz(c, logoSrc, gorunum.arka) : false
      let veri
      try {
        veri = c.toDataURL('image/png')
      } catch {
        // Görsel sunucusu izin vermezse tuval "kirlenir"; logosuz kod üretilir.
        await QRCode.toCanvas(c, qrAdres, { width: boyut, margin: BASKI_KENAR_PAYI, errorCorrectionLevel: duzeltme, color: { dark: gorunum.on, light: gorunum.arka } })
        veri = c.toDataURL('image/png'); logoOldu = false
      }
      indir(veri, `${dosya}-qr-${boyut}.png`)
      if (logoSrc && !logoOldu) ctx.showToast('Profil fotoğrafı koda eklenemedi; QR logosuz indirildi.', 'warning')
    } catch (e) {
      console.error('QR indirilemedi:', e)
      ctx.showToast('QR kod indirilemedi.', 'error')
    }
  }

  // Vektör çıktı matbaada bozulmadan büyür. Logo SVG'ye gömülmez.
  const svgIndir = async () => {
    try {
      const svg = await QRCode.toString(qrAdres, { type: 'svg', margin: BASKI_KENAR_PAYI, errorCorrectionLevel: duzeltme, color: { dark: gorunum.on, light: gorunum.arka } })
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
      indir(url, `${dosya}-qr.svg`)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (e) {
      console.error('SVG indirilemedi:', e)
      ctx.showToast('SVG indirilemedi.', 'error')
    }
  }

  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(adres)
      setKopyalandi(true)
      setTimeout(() => setKopyalandi(false), 1500)
    } catch {
      ctx.showToast('Kopyalanamadı; adresi elle seçip kopyalayın.', 'error')
    }
  }
  const paylas = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${profile.name || profile.username} · dijital kartvizit`, url: adres })
        return
      } catch (e) {
        if (e?.name === 'AbortError') return
      }
    }
    kopyala()
  }

  return (
    <Kart className="p-5 flex flex-col gap-4" aria-labelledby="p-qr">
      <KartBaslik id="p-qr" baslik="QR kodunuz" alt="Basılan kod kalıcıdır; kullanıcı adınızı değiştirseniz de çalışır." />

      {personalar.length > 1 && (
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Hangi profilinizi paylaşacaksınız?</span>
          <div className="overflow-x-auto -mx-1 px-1">
            <Segment
              etiket="Paylaşılacak profil"
              deger={secili?.id}
              onChange={setSeciliId}
              secenekler={personalar.map((p) => ({ deger: p.id, ad: p.status === 'paused' ? `${p.name} (duraklatıldı)` : p.name, kapali: p.status === 'paused' }))}
            />
          </div>
          {!ana && <span className="text-xs text-metin-2">Bu QR yalnızca “{secili.name}” profilinde görünür işaretlediğiniz bilgileri açar.</span>}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-5 items-center sm:items-start">
        <div className="shrink-0 rounded-xl border border-cizgi p-2" style={{ background: gorunum.arka }}>
          <canvas ref={tuval} className="block w-[200px] h-[200px]" role="img" aria-label={`${adresYaz(adres)} adresine giden QR kod`} />
        </div>
        <div className="flex-1 min-w-0 w-full flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Kart adresi</span>
            <div className="flex items-center gap-2 rounded-[10px] border border-cizgi bg-yuzey-2 pl-3 pr-1 h-11 min-w-0">
              <span className="font-mono text-[13px] truncate flex-1">{adresYaz(adres)}</span>
              <IkonDugme ikon={kopyalandi ? Check : Copy} etiket="Adresi kopyala" onClick={kopyala} className="w-8 h-8" />
              <IkonDugme ikon={Share2} etiket="Bağlantıyı paylaş" onClick={paylas} className="w-8 h-8" />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">İndirme boyutu</span>
            <Segment etiket="İndirme boyutu" boyut="k" deger={boyut} onChange={setBoyut} secenekler={BOYUTLAR.map((b) => ({ deger: b.deger, ad: b.ad }))} />
            <span className="text-xs text-metin-2">{BOYUTLAR.find((b) => b.deger === boyut)?.not} · {boyut} px</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Dugme tur="ana" ikon={Download} onClick={pngIndir}>PNG indir</Dugme>
            <Dugme ikon={FileImage} onClick={svgIndir} title="Matbaa için vektör dosya">SVG (baskı)</Dugme>
          </div>
        </div>
      </div>

      <ul className="grid gap-1.5 sm:grid-cols-2 text-xs text-metin-2 border-t border-cizgi pt-3.5">
        <li>Matbaaya SVG verin; büyütmek kodu bozmaz.</li>
        <li>Kodun etrafındaki boşluğu kapatmayın.</li>
        <li>Kartvizitte kenarı en az 2 cm olsun.</li>
        <li>Logolu kodda logo SVG&apos;ye eklenmez; basımcıya ayrıca verin.</li>
      </ul>
    </Kart>
  )
}

// =============================================================== QR görünümü
function QrGorunumu({ profile, gorunum, setGorunum, ctx }) {
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const kayitli = {
    on: profile.qr_foreground_color || VARSAYILAN_ON,
    arka: profile.qr_background_color || VARSAYILAN_ARKA,
    logo: Boolean(profile.qr_logo_enabled),
  }
  const degisti = kayitli.on !== gorunum.on || kayitli.arka !== gorunum.arka || kayitli.logo !== gorunum.logo
  const oran = kontrast(gorunum.on, gorunum.arka)
  const ters = parlaklik(gorunum.on) > parlaklik(gorunum.arka)

  const kaydet = async () => {
    setKaydediliyor(true)
    try {
      const yama = { qr_foreground_color: gorunum.on, qr_background_color: gorunum.arka, qr_logo_enabled: gorunum.logo }
      await ctx.profilAlaniKaydet(yama)
      ctx.setProfile((p) => ({ ...p, ...yama }))
      ctx.showToast('QR görünümü kaydedildi.', 'success')
    } catch (e) {
      ctx.showToast(e.message || 'Kaydedilemedi.', 'error')
    } finally {
      setKaydediliyor(false)
    }
  }

  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="p-gorunum">
      <KartBaslik id="p-gorunum" baslik="QR görünümü" alt="Renk ve logo hem ekrandaki hem indirilen kodda kullanılır." />
      <div className="grid grid-cols-2 gap-3">
        {[['on', 'Kod rengi'], ['arka', 'Zemin rengi']].map(([alan, ad]) => (
          <label key={alan} className="flex items-center gap-2.5 rounded-[10px] border border-cizgi px-2.5 h-11 cursor-pointer">
            <input
              type="color"
              value={gorunum[alan]}
              onChange={(e) => setGorunum((o) => ({ ...o, [alan]: e.target.value.toUpperCase() }))}
              className="w-7 h-7 rounded-md border border-cizgi bg-transparent cursor-pointer p-0"
            />
            <span className="flex flex-col leading-tight min-w-0">
              <span className="text-[13px] font-semibold">{ad}</span>
              <span className="text-[11.5px] font-mono text-metin-2">{gorunum[alan]}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-[13px] font-semibold">Ortada profil fotoğrafı</span>
          <span className="text-xs text-metin-2">{profile.avatar_url ? 'Logo varken kod daha yüksek hata düzeltmeyle üretilir.' : 'Önce Kartım bölümünden profil fotoğrafı ekleyin.'}</span>
        </span>
        <Anahtar acik={gorunum.logo} disabled={!profile.avatar_url} onChange={(v) => setGorunum((o) => ({ ...o, logo: v }))} etiket="Ortada profil fotoğrafı" />
      </div>
      {(oran < 3 || ters) && (
        <p className="flex items-start gap-2 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle size={14} className="shrink-0 mt-px" aria-hidden="true" />
          {oran < 3 ? 'Renkler arasındaki fark düşük; bazı telefonlar kodu okuyamayabilir.' : 'Açık renk kod koyu zeminde bazı okuyucularda çalışmaz; koyu kod, açık zemin önerilir.'}
        </p>
      )}
      {degisti && (
      <div className="flex gap-2 justify-end">
        <Dugme tur="sessiz" boyut="k" disabled={kaydediliyor} onClick={() => setGorunum(kayitli)}>Geri al</Dugme>
        <Dugme tur="ana" boyut="k" disabled={kaydediliyor} onClick={kaydet}>{kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}</Dugme>
      </div>
      )}
    </Kart>
  )
}

// =============================================================== NFC kart (koyu)
function NfcKarti({ ctx }) {
  const navigate = useNavigate()
  const { profile, planBilgisi } = ctx
  const hak = (planBilgisi?.sinir?.nfc_yillik ?? 0) > 0
  const [onay, setOnay] = useState(false)
  const [isleniyor, setIsleniyor] = useState(false)

  // Kayıp/çalıntı kart: kod yenilenir, eski baskılar BİLEREK geçersiz olur.
  const kodYenile = async () => {
    setIsleniyor(true)
    try {
      const { data, error } = await supabase.rpc('rotate_card_code')
      if (error) throw error
      if (!data?.ok) throw new Error(data?.hata === 'cok_fazla_deneme' ? 'Saatte en fazla 3 kez yenilenebilir; biraz sonra deneyin.' : 'Kart kodu yenilenemedi.')
      ctx.setProfile((p) => ({ ...p, card_code: data.kod }))
      ctx.showToast('Kart kodu yenilendi. Eski kart ve basılı QR artık çalışmıyor.', 'success')
      setOnay(false)
    } catch (e) {
      ctx.showToast(e.message, 'error')
    } finally {
      setIsleniyor(false)
    }
  }

  return (
    <Kart koyu className="p-5 flex flex-col gap-3.5" aria-labelledby="p-nfc">
      <div className="flex items-center justify-between gap-3">
        <h2 id="p-nfc" className="font-baslik text-[17px] font-bold leading-tight inline-flex items-center gap-2">
          <Nfc size={18} aria-hidden="true" className="text-white/70" />NFC kartınız
        </h2>
        <span className={birlestir('inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold', hak ? 'bg-white/15 text-white' : 'bg-white/10 text-white/75')}>
          {hak ? 'Planınızda var' : 'Profesyonel planda'}
        </span>
      </div>
      {profile.card_code && (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-white/60">Kart kodu</span>
          <span className="font-mono text-[20px] font-semibold tracking-wide">{profile.card_code}</span>
          <span className="font-mono text-xs text-white/60 break-all">{adresYaz(kartKoduUrl(profile.card_code))}</span>
        </div>
      )}
      <p className="text-[13px] text-white/70">
        Basılı kart ve ana profil QR&apos;ı bu kalıcı adrese yönlenir; adres, o an ana profiliniz hangisiyse onu açar.
      </p>
      <div className="flex gap-2 flex-wrap">
        {hak
          ? <Dugme tur="beyaz" boyut="k" className="h-[34px] px-3.5 text-sm" onClick={() => navigate('/nfc-designer')}>Kart tasarla</Dugme>
          : <Dugme tur="beyaz" boyut="k" className="h-[34px] px-3.5 text-sm" onClick={() => ctx.odemeyiAc('professional', 'yearly')}>Planı yükselt</Dugme>}
        <Dugme tur="koyuIkincil" boyut="k" className="h-[34px] px-3.5 text-sm" onClick={() => navigate('/nfc-cards')}>Kart türleri</Dugme>
        {!onay && (
          <button type="button" onClick={() => setOnay(true)} className="h-[34px] px-3 rounded-lg text-sm font-semibold text-lacivert-200 hover:text-white hover:bg-white/10 transition-colors">
            Kartımı kaybettim
          </button>
        )}
      </div>
      {onay && (
        <div className="rounded-xl bg-white/10 border border-white/15 p-3.5 flex flex-col gap-2.5 text-[13px]">
          <p>Kart kodu yenilenir. Eski NFC kartınız ve basılı ana profil QR kodlarınız <b>çalışmayı bırakır</b>; yeni kodla yeniden basmanız gerekir. Geri alınamaz.</p>
          <div className="flex gap-2">
            <Dugme tur="koyuIkincil" boyut="k" onClick={() => setOnay(false)} disabled={isleniyor}>Vazgeç</Dugme>
            <Dugme tur="beyaz" boyut="k" onClick={kodYenile} disabled={isleniyor}>{isleniyor ? 'Yenileniyor…' : 'Kodu yenile'}</Dugme>
          </div>
        </div>
      )}
    </Kart>
  )
}

// =============================================================== NFC etikete yaz
function NfcYaz({ profile }) {
  const destek = typeof window !== 'undefined' && 'NDEFReader' in window
  const [kilitle, setKilitle] = useState(true)
  const [yaziyor, setYaziyor] = useState(false)
  const [mesaj, setMesaj] = useState(null)
  // Karta kullanıcı adı değil KALICI KOD yazılır; yazılan adres kaynağını taşır.
  const adres = profile.card_code ? kartKoduUrl(profile.card_code) : cardUrl(profile.username)

  const yaz = async () => {
    setYaziyor(true)
    setMesaj({ tur: 'bilgi', metin: 'Etiketi telefonunuzun arkasına yaklaştırın…' })
    try {
      const ndef = new window.NDEFReader()
      await ndef.write({ records: [{ recordType: 'url', data: kaynakliAdres(adres, 'nfc') }, { recordType: 'text', data: `QRtım - ${profile.username}` }] })
      if (kilitle) {
        setMesaj({ tur: 'bilgi', metin: 'Yazıldı, etiket kilitleniyor — çekmeyin…' })
        try {
          await ndef.makeReadOnly()
          setMesaj({ tur: 'basari', metin: 'Etikete yazıldı ve kilitlendi. Artık üzerine yazılamaz.' })
        } catch (e) {
          // Bazı etiketler kilitlemeyi desteklemez; yazma yine de geçerli.
          console.warn('Etiket kilitlenemedi:', e)
          setMesaj({ tur: 'uyari', metin: 'Etikete yazıldı ama bu etiket kilitlenemedi: başkası üzerine yazabilir.' })
        }
      } else {
        setMesaj({ tur: 'basari', metin: 'Etikete yazıldı (kilitlenmedi).' })
      }
    } catch (e) {
      console.error('NFC yazma hatası:', e)
      setMesaj({
        tur: 'hata',
        metin: {
          NotAllowedError: 'NFC izni verilmedi. Tarayıcı izinlerinden açın.',
          NotSupportedError: 'NFC bu cihazda desteklenmiyor.',
          NotReadableError: 'Etiket okunamadı. Başka bir etiket deneyin.',
          AbortError: 'İşlem iptal edildi.',
        }[e?.name] || 'Etikete yazılamadı.',
      })
    } finally {
      setYaziyor(false)
    }
  }

  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="p-nfcyaz">
      <KartBaslik id="p-nfcyaz" baslik="NFC etikete yaz" alt="Boş bir NFC etiketine ya da çıkartmaya kart adresinizi yazın." />
      <span className="font-mono text-xs text-metin-2 break-all">{adresYaz(adres)}</span>
      {!destek && (
        <p className="rounded-xl bg-yuzey-2 px-3.5 py-2.5 text-[13px] text-metin-2">
          Bu cihazda NFC yazma yok: Android telefonda Chrome gerekir. iPhone etiketi okuyabilir ama yazamaz.
        </p>
      )}
      <div className="flex items-start justify-between gap-3">
        <span className="flex flex-col">
          <span className="text-[13px] font-semibold">Yazdıktan sonra kilitle (önerilir)</span>
          <span className="text-xs text-metin-2">Kilitsiz etiketin üzerine başkası kendi adresini yazabilir. Kilit geri alınamaz.</span>
        </span>
        <Anahtar acik={kilitle} onChange={setKilitle} etiket="Yazdıktan sonra kilitle" disabled={!destek} />
      </div>
      <Mesaj mesaj={mesaj} />
      <Dugme tur="ana" ikon={Nfc} onClick={yaz} disabled={!destek || yaziyor} className="self-start">{yaziyor ? 'Yazılıyor…' : 'Etikete yaz'}</Dugme>
    </Kart>
  )
}

// =============================================================== kendi alan adı
const ALAN_HATA = {
  alan_adi_dogrulanmamis: 'Önce bu alan adını Kimlik bölümünden doğrulamanız gerekiyor.',
  gecersiz_alan_adi: 'Adres geçerli görünmüyor. Örnek: kart.ornek.com.tr',
  adres_kullanimda: 'Bu adres başka bir hesapta kullanılıyor.',
  adres_baska_projede: 'Bu adres başka bir yerde kullanımda; önce oradan kaldırılması gerekiyor.',
  cok_fazla_deneme: 'Çok fazla deneme yapıldı. Bir saat sonra tekrar deneyin.',
  kart_yok: 'Seçilen kart bulunamadı.',
  kayit_yok: 'Kayıt bulunamadı.',
  dns_bekleniyor: 'Adres eklendi, DNS kaydınız henüz görünmüyor. Yayılması biraz sürebilir; birazdan tekrar deneyin.',
  saglayici_ayari_eksik: 'Bu özellik için yönetici ayarı (barındırma sağlayıcı anahtarı) henüz tanımlanmamış.',
  saglayici_durum_okunamadi: 'Adresin durumu barındırma sağlayıcısından okunamadı. DNS kaydınızda bir şey değiştirmeyin; birazdan tekrar deneyin.',
  saglayici_yetkisi_yok: 'Barındırma sağlayıcısı yetkiyi reddetti; yönetici anahtarı yenilenmeli.',
  saglayici_proje_bulunamadi: 'Barındırma sağlayıcısında proje bulunamadı; yönetici ayarı yanlış olabilir.',
  saglayici_reddetti: 'Adres barındırma sağlayıcısına eklenemedi.',
  islem_tamamlanamadi: 'İşlem tamamlanamadı. Lütfen tekrar deneyin.',
}
const ALAN_DURUM = {
  baglandi: { ad: 'Yayında', ton: 'olumlu' },
  beklemede: { ad: 'DNS bekleniyor', ton: 'uyari' },
  hata: { ad: 'Bağlanamadı', ton: 'tehlike' },
}
const CNAME = 'cname.vercel-dns.com'

function AlanAdi({ ctx }) {
  const [liste, setListe] = useState(null)
  const [host, setHost] = useState('')
  const [ekleniyor, setEkleniyor] = useState(false)
  const [baglanan, setBaglanan] = useState(null)
  const [kopyalandi, setKopyalandi] = useState(false)
  const [mesaj, setMesaj] = useState(null)

  const getir = () => supabase.rpc('my_custom_domains').then(({ data, error }) => {
    if (error) console.error('Özel alan adları alınamadı:', error)
    return Array.isArray(data) ? data : []
  })
  useEffect(() => {
    let iptal = false
    getir().then((l) => { if (!iptal) setListe(l) })
    return () => { iptal = true }
  }, [])
  const yenile = async () => setListe(await getir())

  const ekle = async (e) => {
    e.preventDefault()
    setMesaj(null); setEkleniyor(true)
    try {
      const { data, error } = await supabase.rpc('custom_domain_claim', { p_host: host.trim(), p_persona_id: null })
      if (error) throw error
      if (!data?.ok) { setMesaj({ tur: 'hata', metin: ALAN_HATA[data?.hata] || 'İşlem tamamlanamadı.' }); return }
      setHost('')
      await yenile()
      setMesaj({ tur: 'bilgi', metin: 'Adres kaydedildi. Şimdi DNS kaydını ekleyip “Bağla”ya basın.' })
    } catch (err) {
      setMesaj({ tur: 'hata', metin: 'Bağlantı hatası: ' + err.message })
    } finally {
      setEkleniyor(false)
    }
  }

  const bagla = async (k) => {
    setMesaj(null); setBaglanan(k.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setMesaj({ tur: 'hata', metin: 'Oturumunuz sona ermiş. Tekrar giriş yapın.' }); return }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ozel-alan-adi-baglan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: k.id }),
      })
      const s = await res.json().catch(() => ({}))
      setMesaj(s?.ok
        ? { tur: 'basari', metin: `${k.host} yayında. Kartınız bu adreste açılıyor.` }
        : { tur: 'uyari', metin: ALAN_HATA[s?.hata] || 'Bağlanamadı.' })
      await yenile()
    } catch (err) {
      setMesaj({ tur: 'hata', metin: 'Bağlantı hatası: ' + err.message })
    } finally {
      setBaglanan(null)
    }
  }

  const kaldir = (k) => ctx.onayIste({
    title: 'Adres kaldırılsın mı?',
    message: `${k.host} adresi kaldırılacak; kartınız bu adreste açılmayı bırakır.`,
    onConfirm: async () => {
      const { data, error } = await supabase.rpc('custom_domain_remove', { p_id: k.id })
      if (error || !data?.ok) { ctx.showToast(ALAN_HATA[data?.hata] || 'Kaldırılamadı.', 'error'); return }
      await yenile()
      ctx.showToast('Adres kaldırıldı.', 'success')
    },
  })

  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(CNAME)
      setKopyalandi(true)
      setTimeout(() => setKopyalandi(false), 1500)
    } catch {
      setMesaj({ tur: 'uyari', metin: 'Kopyalanamadı; değeri elle seçip kopyalayın.' })
    }
  }

  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="p-alan">
      <KartBaslik
        id="p-alan"
        baslik="Kendi alan adınız"
        alt="Kartınız kendi adresinizde açılsın: kart.ornek.com.tr. Önce alan adını Kimlik bölümünden doğrulamanız gerekir."
      />
      <Mesaj mesaj={mesaj} />
      {liste === null ? null : (
        <>
          {liste.map((k) => {
            const d = ALAN_DURUM[k.durum] || ALAN_DURUM.beklemede
            return (
              <div key={k.id} className="rounded-xl border border-cizgi p-3.5 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="w-9 h-9 rounded-[10px] bg-yuzey-2 text-metin-2 inline-flex items-center justify-center shrink-0"><Globe size={16} aria-hidden="true" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <b className="font-semibold text-[14px] break-all">{k.host}</b>
                      <Rozet ton={d.ton}>{d.ad}</Rozet>
                    </div>
                    {k.kart_adi && <div className="text-xs text-metin-2">Açılacak kart: {k.kart_adi}</div>}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {k.durum !== 'baglandi' && (
                      <Dugme tur="ana" boyut="k" ikon={RefreshCw} disabled={baglanan === k.id} onClick={() => bagla(k)}>
                        {baglanan === k.id ? 'Bağlanıyor…' : 'Bağla'}
                      </Dugme>
                    )}
                    <IkonDugme ikon={Trash2} etiket={`${k.host} adresini kaldır`} onClick={() => kaldir(k)} className="hover:text-red-600 dark:hover:text-red-400" />
                  </div>
                </div>
                {k.durum !== 'baglandi' && (
                  <div className="flex flex-col gap-2 border-t border-cizgi pt-3 text-[13px]">
                    <p className="text-metin-2">
                      Alan adı sağlayıcınızda <b className="text-metin font-semibold">{k.host.split('.')[0]}</b> için bir <b className="text-metin font-semibold">CNAME</b> kaydı oluşturun ve şunu hedef gösterin:
                    </p>
                    <div className="flex items-center gap-2 rounded-[10px] bg-yuzey-2 pl-3 pr-1 h-10">
                      <code className="font-mono text-xs flex-1">{CNAME}</code>
                      <IkonDugme ikon={kopyalandi ? Check : Copy} etiket="CNAME değerini kopyala" onClick={kopyala} className="w-8 h-8" />
                    </div>
                    <p className="text-xs text-metin-2">Bu adreste yalnızca kartınız açılır; panel ve giriş QRtım adresinde kalır. Güvenlik sertifikası otomatik kurulur.</p>
                  </div>
                )}
              </div>
            )
          })}
          <form onSubmit={ekle} className="flex gap-2 flex-wrap sm:flex-nowrap">
            <Girdi
              value={host}
              onChange={(e) => setHost(e.target.value)}
              placeholder="kart.ornek.com.tr"
              aria-label="Alan adı"
              autoComplete="off" autoCapitalize="off" spellCheck="false"
              className="flex-1 min-w-0"
            />
            <Dugme type="submit" tur="ikincil" boyut="b" disabled={ekleniyor || !host.trim()}>{ekleniyor ? 'Ekleniyor…' : 'Adres ekle'}</Dugme>
          </form>
          <button type="button" onClick={() => ctx.bolumDegistir('kimlik')} className="self-start text-[13px] font-semibold text-aksan hover:underline">
            Alan adı doğrulamasına git →
          </button>
        </>
      )}
    </Kart>
  )
}
