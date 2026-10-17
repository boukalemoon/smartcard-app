// KARTTAN RANDEVU (eski components/AppointmentBooking mantığı, yeni görünüm)
//
// Kart sahibi randevuyu açtıysa görünür; kapalıysa bölüm hiç çizilmez
// (kapalı bir özelliği göstermek beklenti yaratır). Saatler TÜRKİYE SAATİYLE.
//
// Veri gün başına önbellekte tutulur: gün değişince ekranda ESKİ günün saatleri
// görünmez (seçilen gün için kayıt yoksa "Saatler alınıyor"). Eskiden başlık
// yeni günü yazarken ızgara eski günün zaman damgalarını gösterebiliyordu;
// ziyaretçi "Çarşamba 14:00" sanıp SALI'ya randevu alabilirdi.
import { useEffect, useRef, useState } from 'react'
import { CalendarPlus, Check, ChevronLeft, ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { randevuIcsIndir } from '../../utils/takvim'
import { birlestir } from '../../panel/bicim'
import { BTN, BTN_ANA, ODAK, SAAT_BICIMI, gunEkle, gunKisa, gunUzun, isoGun } from './yardim'
import { Blok, Girdi, MetinAlani } from './parcalar'

const HATALAR = {
  kart_bulunamadi: 'Kart bulunamadı.',
  randevu_kapali: 'Randevu alımı kapalı.',
  ad_gerekli: 'Lütfen adınızı yazın.',
  iletisim_gerekli: 'E-posta veya telefondan en az birini yazın.',
  saat_gerekli: 'Lütfen bir saat seçin.',
  cok_yakin: 'Bu saat için artık çok geç. Daha ileri bir saat seçin.',
  cok_ileri: 'Bu kadar ileri tarihe randevu alınamıyor.',
  saat_uygun_degil: 'Bu saat uygun değil. Listeden bir saat seçin.',
  saat_dolu: 'Bu saati az önce başkası aldı. Başka bir saat seçin.',
  cok_fazla_deneme: 'Çok fazla deneme yapıldı. Bir saat sonra tekrar deneyin.',
  kart_dolu: 'Bugün için randevu sınırına ulaşıldı. Yarın tekrar deneyin.',
}

const SERIT = 5 // şeritte aynı anda görünen gün sayısı

const slotSinif = (secili) => birlestir(
  'h-10 rounded-[10px] border text-[13px] font-semibold transition-colors',
  secili ? 'bg-aksan border-aksan text-white dark:text-zemin' : 'bg-yuzey-2 border-cizgi text-metin hover:border-aksan/60',
  ODAK,
)

export default function Randevu({ hedef, kartSahibi, onDurum }) {
  // İlk gün yarın: aynı gün randevu çoğu kart sahibinin en erken sınırına takılıyor.
  const [ilk] = useState(() => gunEkle(new Date(), 1))
  const [kaydir, setKaydir] = useState(0)
  const [gun, setGun] = useState(() => isoGun(gunEkle(new Date(), 1)))
  const [veriler, setVeriler] = useState({}) // { 'YYYY-AA-GG': yanıt }
  const [tazele, setTazele] = useState(0)
  // Randevu açık mı: bir kez öğrenilir; gün değişirken bölüm yanıp sönmesin.
  const [acikMi, setAcikMi] = useState(null)
  const ogrenildi = useRef(false)
  const [secili, setSecili] = useState(null) // { gun, slot }
  const [form, setForm] = useState({ ad: '', eposta: '', telefon: '', aciklama: '' })
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [sonuc, setSonuc] = useState(null)
  const [hata, setHata] = useState('')

  useEffect(() => {
    let iptal = false
    supabase.rpc('appointment_slots', {
      p_code: hedef.code || null,
      p_username: hedef.username || null,
      p_gun: gun,
    }).then(({ data }) => {
      if (iptal) return
      setVeriler((o) => ({ ...o, [gun]: data || { ok: false } }))
      if (!ogrenildi.current) {
        ogrenildi.current = true
        setAcikMi(Boolean(data?.ok))
        onDurum?.(Boolean(data?.ok))
      }
    })
    return () => { iptal = true }
  }, [gun, tazele, hedef.code, hedef.username, onDurum])

  if (acikMi !== true) return null

  const veri = veriler[gun]
  const yukleniyor = !veri
  const slotlar = veri?.slotlar || []
  const seciliSlot = secili?.gun === gun ? secili.slot : null
  const gunler = Array.from({ length: SERIT }, (_, i) => gunEkle(ilk, kaydir + i))
  const sure = veriler[Object.keys(veriler)[0]]?.slot_dakika

  const gunSec = (iso) => {
    setGun(iso)
    setHata('')
  }

  const gonder = async (e) => {
    e.preventDefault()
    setHata('')
    if (!seciliSlot) { setHata(HATALAR.saat_gerekli); return }
    if (!form.eposta && !form.telefon) { setHata(HATALAR.iletisim_gerekli); return }
    setGonderiliyor(true)
    try {
      const { data, error } = await supabase.rpc('book_appointment', {
        p_code: hedef.code || null,
        p_username: hedef.username || null,
        p_baslar: seciliSlot,
        p_ad: form.ad,
        p_eposta: form.eposta || null,
        p_telefon: form.telefon || null,
        p_aciklama: form.aciklama || null,
        p_kaynak: hedef.source || null,
      })
      if (error) throw error
      if (!data?.ok) {
        setHata(HATALAR[data?.hata] || 'Randevu alınamadı.')
        // Saat kapıldıysa listeyi tazele ki kişi boşuna uğraşmasın.
        if (data?.hata === 'saat_dolu' || data?.hata === 'saat_uygun_degil') {
          setVeriler((o) => { const y = { ...o }; delete y[gun]; return y })
          setTazele((n) => n + 1)
          setSecili(null)
        }
        return
      }
      setSonuc(data)
    } catch (err) {
      setHata('Bağlantı hatası: ' + err.message)
    } finally {
      setGonderiliyor(false)
    }
  }

  if (sonuc) {
    const bas = new Date(sonuc.baslar_at)
    return (
      <Blok id="randevu" baslik="Randevu al" baslikId="kart-randevu">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-400/10 p-4 text-center" role="status">
          <Check className="w-6 h-6 text-emerald-700 dark:text-emerald-300 mx-auto mb-1" aria-hidden="true" />
          <p className="text-[14px] font-semibold text-emerald-900 dark:text-emerald-200">
            {sonuc.durum === 'onaylandi' ? 'Randevunuz alındı' : 'Randevu talebiniz iletildi'}
          </p>
          <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">
            {gunUzun(bas)} · {bas.toLocaleTimeString('tr-TR', SAAT_BICIMI)} (Türkiye saati)
          </p>
          {sonuc.durum !== 'onaylandi' && <p className="text-xs text-emerald-800 dark:text-emerald-300 mt-1">Onaylandığında size dönülecek.</p>}
          {/* Ziyaretçinin bizde hesabı yok; tek seferlik .ics dosyası her
              takvim uygulamasında açılır ve hatırlatmayı KENDİ takvimi yapar. */}
          <button
            type="button"
            onClick={() => {
              const oldu = randevuIcsIndir({ id: sonuc.id, baslar: sonuc.baslar_at, biter: sonuc.biter_at, kartSahibi, aciklama: form.aciklama || null })
              if (!oldu) setHata('Takvim dosyası oluşturulamadı.')
            }}
            className={birlestir('mt-3 inline-flex items-center gap-1.5 h-10 px-3 rounded-[10px] border border-emerald-300 bg-yuzey text-[13px] font-semibold text-emerald-900 dark:text-emerald-200 dark:border-emerald-400/40', ODAK)}
          >
            <CalendarPlus size={16} aria-hidden="true" />Takvimime ekle
          </button>
          <p className="text-[11px] text-emerald-800 dark:text-emerald-300 mt-1">Google, Outlook, Apple ve kurumsal takvimlerin hepsinde açılır.</p>
          {hata && <p className="text-xs text-red-700 dark:text-red-300 mt-2" role="alert">{hata}</p>}
        </div>
      </Blok>
    )
  }

  const sag = <span className="text-xs text-metin-2">{[sure ? `${sure} dk` : null, 'Türkiye saati'].filter(Boolean).join(' · ')}</span>
  const etiketGun = seciliSlot ? `${gunUzun(new Date(seciliSlot))}, ${new Date(seciliSlot).toLocaleTimeString('tr-TR', SAAT_BICIMI)}` : null
  const otomatik = veri?.otomatik_onay

  return (
    <Blok id="randevu" baslik="Randevu al" baslikId="kart-randevu" sag={sag} className="scroll-mt-4">
      {veri?.aciklama && <p className="text-[13px] text-metin-2 -mt-1">{veri.aciklama}</p>}

      <div className="flex items-center gap-1.5">
        {kaydir > 0 && (
          <button type="button" onClick={() => setKaydir((k) => Math.max(0, k - SERIT))} aria-label="Önceki günler" className={birlestir('w-7 h-10 shrink-0 rounded-lg inline-flex items-center justify-center text-metin-2 hover:text-metin', ODAK)}>
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
        )}
        <div className="grid grid-cols-5 gap-1.5 flex-1" role="group" aria-label="Gün seçin">
          {gunler.map((d) => {
            const iso = isoGun(d)
            return (
              <button key={iso} type="button" aria-pressed={iso === gun} onClick={() => gunSec(iso)} className={birlestir(slotSinif(iso === gun), 'px-0')}>
                {gunKisa(d)}
              </button>
            )
          })}
        </div>
        <button type="button" onClick={() => setKaydir((k) => k + SERIT)} aria-label="Sonraki günler" className={birlestir('w-7 h-10 shrink-0 rounded-lg inline-flex items-center justify-center text-metin-2 hover:text-metin', ODAK)}>
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div aria-live="polite">
        {yukleniyor ? (
          <p className="text-[13px] text-metin-2 text-center py-2.5">Saatler alınıyor…</p>
        ) : slotlar.length === 0 ? (
          <p className="text-[13px] text-metin-2 text-center py-2.5">Bu gün için uygun saat yok. Başka bir gün seçin.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1.5" role="group" aria-label="Saat seçin">
            {slotlar.map((s) => (
              <button key={s} type="button" aria-pressed={seciliSlot === s} onClick={() => { setSecili({ gun, slot: s }); setHata('') }} className={slotSinif(seciliSlot === s)}>
                {new Date(s).toLocaleTimeString('tr-TR', SAAT_BICIMI)}
              </button>
            ))}
          </div>
        )}
      </div>

      {seciliSlot ? (
        <form onSubmit={gonder} className="flex flex-col gap-2.5 pt-1">
          <Girdi id="rv-ad" etiket="Ad Soyad" required maxLength={80} autoComplete="name" value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })} />
          <Girdi id="rv-eposta" etiket="E-posta" type="email" maxLength={120} autoComplete="email" placeholder="ad@ornek.com" value={form.eposta} onChange={(e) => setForm({ ...form, eposta: e.target.value })} />
          <Girdi id="rv-tel" etiket="Telefon" type="tel" maxLength={25} autoComplete="tel" value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })} />
          <MetinAlani id="rv-konu" etiket="Konu (isteğe bağlı)" maxLength={500} value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })} />
          <p className="text-[11px] text-metin-2">Ad ve en az bir iletişim bilgisi gerekli. Bilgileriniz kart sahibine iletilir.</p>
          {hata && <p className="text-xs text-red-700 dark:text-red-300" role="alert">{hata}</p>}
          <button type="submit" disabled={gonderiliyor} className={birlestir(BTN, BTN_ANA, 'w-full')}>
            {gonderiliyor ? 'Gönderiliyor…' : `${etiketGun} için ${otomatik ? 'randevu al' : 'talep gönder'}`}
          </button>
        </form>
      ) : (
        <>
          {hata && <p className="text-xs text-red-700 dark:text-red-300" role="alert">{hata}</p>}
          {slotlar.length > 0 && <p className="text-xs text-metin-2">Bir saat seçin; ardından bilgilerinizi yazıp talebi gönderin.</p>}
        </>
      )}
    </Blok>
  )
}
