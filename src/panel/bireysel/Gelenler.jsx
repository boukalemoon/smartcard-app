// Bireysel panel — Gelenler (tasarımı yok; PanelGenel'deki "Gelenler" kartının
// dilinden tam sayfa).
//
// Sol: karttan alınan randevular (bekleyen / onaylanan / geçmiş).
// Sağ: kişi defteri — kartı okutup kendi rızasıyla bilgi bırakanlar.
// Randevu ayarları (çalışma saatleri, süre, takvim aboneliği) bir pencerede;
// eski AppointmentManager'ın ayar kısmı yeni tasarım diliyle yeniden yazıldı,
// RPC'ler aynı (my_appointment_settings / appointment_settings_save).
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Calendar, Check, Copy, Download, Mail, Phone, RefreshCw, Search, Settings, Trash2, UserPlus, Users } from 'lucide-react'
import Modal from '../../components/Modal'
import { supabase } from '../../lib/supabaseClient'
import { SITE_URL } from '../../lib/siteUrl'
import { exportToCSV } from '../../utils/exportHelpers'
import { Kart, KartBaslik, SayfaBaslik, Dugme, IkonDugme, Rozet, Segment, Avatar, Anahtar, Secim, Girdi, Alan, BosDurum, Yukleniyor } from '../ui'
import { birlestir } from '../bicim'

const TZ = 'Europe/Istanbul'
const KAYNAK = { qr: 'QR ile', nfc: 'NFC ile', link: 'Bağlantıdan', direct: 'Doğrudan' }
const KAYNAK_CSV = { qr: 'QR kod', nfc: 'NFC kart', link: 'Bağlantı', direct: 'Doğrudan' }
const DURUM = {
  bekliyor: { ad: 'Onay bekliyor', ton: 'uyari' },
  onaylandi: { ad: 'Onaylandı', ton: 'aksan' },
  iptal: { ad: 'İptal', ton: 'notr' },
  tamamlandi: { ad: 'Tamamlandı', ton: 'olumlu' },
}
const GUNLER = [
  { no: '1', ad: 'Pazartesi' }, { no: '2', ad: 'Salı' }, { no: '3', ad: 'Çarşamba' }, { no: '4', ad: 'Perşembe' },
  { no: '5', ad: 'Cuma' }, { no: '6', ad: 'Cumartesi' }, { no: '7', ad: 'Pazar' },
]
const SLOTLAR = [15, 20, 30, 45, 60, 90, 120]

// vCard 3.0: virgül, noktalı virgül ve satır sonu kaçışlanır; yoksa telefonun
// rehberi alanları kaydırır.
const vKac = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')
function vcard(k) {
  const parca = String(k.name || '').trim().split(/\s+/)
  const soyad = parca.length > 1 ? parca.pop() : ''
  return [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${vKac(k.name)}`, `N:${vKac(soyad)};${vKac(parca.join(' '))};;;`,
    k.company && `ORG:${vKac(k.company)}`,
    k.email && `EMAIL;TYPE=INTERNET:${vKac(k.email)}`,
    k.phone && `TEL;TYPE=CELL:${vKac(k.phone)}`,
    k.note && `NOTE:${vKac(k.note)}`,
    'END:VCARD',
  ].filter(Boolean).join('\r\n')
}
function dosyaIndir(metin, ad, tur) {
  const url = URL.createObjectURL(new Blob([metin], { type: tur }))
  const a = document.createElement('a')
  a.href = url; a.download = ad
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
const dosyaAdi = (s) => String(s || 'kisi').replace(/[^\p{L}\p{N}]+/gu, '-')

const zaman = (iso, s) => new Date(iso).toLocaleString('tr-TR', { ...s, timeZone: TZ })

async function hepsiniYukle() {
  const [y, g, k, a] = await Promise.all([
    supabase.rpc('my_appointments', { p_gecmis: false }),
    supabase.rpc('my_appointments', { p_gecmis: true }),
    supabase.rpc('my_card_contacts'),
    supabase.rpc('my_appointment_settings'),
  ])
  return {
    yaklasan: Array.isArray(y.data) ? y.data : [],
    gecmis: Array.isArray(g.data) ? g.data : [],
    kisiler: Array.isArray(k.data) ? k.data : [],
    ayar: a.data?.ok ? a.data : null,
  }
}

export default function Gelenler({ ctx }) {
  const [veri, setVeri] = useState(null)
  const [sekme, setSekme] = useState('bekleyen')
  const [ayarAcik, setAyarAcik] = useState(false)

  useEffect(() => {
    let iptal = false
    hepsiniYukle().then((v) => { if (!iptal) setVeri(v) })
    return () => { iptal = true }
  }, [ctx.profile?.id])

  const yenile = useCallback(() => hepsiniYukle().then(setVeri), [])

  return (
    <>
      <SayfaBaslik
        baslik="Gelenler"
        alt="Kartınızdan gelen randevu talepleri ve size bilgi bırakan kişiler."
        sag={<Dugme ikon={Settings} onClick={() => setAyarAcik(true)}>Randevu ayarları</Dugme>}
      />
      {!veri ? <Yukleniyor /> : (
        <div className="grid gap-5 lg:grid-cols-2 items-start">
          <Randevular veri={veri} sekme={sekme} setSekme={setSekme} yenile={yenile} ctx={ctx} ayariAc={() => setAyarAcik(true)} />
          <KisiDefteri kisiler={veri.kisiler} setKisiler={(f) => setVeri((o) => ({ ...o, kisiler: f(o.kisiler) }))} ctx={ctx} />
        </div>
      )}
      <Modal isOpen={ayarAcik} onClose={() => setAyarAcik(false)} title="Randevu ayarları" size="xl">
        {ayarAcik && (
          <RandevuAyarlari
            ilk={veri?.ayar}
            onKaydedildi={(a) => setVeri((o) => (o ? { ...o, ayar: { ...o.ayar, ...a } } : o))}
            ctx={ctx}
          />
        )}
      </Modal>
    </>
  )
}

// ------------------------------------------------------------- randevular
function Randevular({ veri, sekme, setSekme, yenile, ctx, ayariAc }) {
  const [isleniyor, setIsleniyor] = useState(null)
  const bekleyen = veri.yaklasan.filter((r) => r.durum === 'bekliyor')
  const onaylanan = veri.yaklasan.filter((r) => r.durum === 'onaylandi')
  // Geçmiş: saati geçenler (yeniden eskiye) + ileri tarihli olup iptal edilenler.
  const gecmis = [...veri.yaklasan.filter((r) => r.durum === 'iptal' || r.durum === 'tamamlandi'), ...[...veri.gecmis].reverse()]
  const liste = sekme === 'bekleyen' ? bekleyen : sekme === 'onaylanan' ? onaylanan : gecmis

  const durumYaz = async (r, durum) => {
    setIsleniyor(r.id)
    try {
      const { data, error } = await supabase.rpc('appointment_set_status', { p_id: r.id, p_durum: durum })
      if (error || !data?.ok) throw new Error('İşlem tamamlanamadı.')
      await yenile()
      ctx.showToast({ onaylandi: 'Randevu onaylandı.', iptal: 'Randevu iptal edildi.', tamamlandi: 'Randevu tamamlandı olarak işaretlendi.' }[durum], 'success')
    } catch (e) {
      ctx.showToast(e.message, 'error')
    } finally {
      setIsleniyor(null)
    }
  }

  const kapali = veri.ayar && !veri.ayar.aktif
  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="gl-randevu">
      <KartBaslik id="gl-randevu" baslik="Randevular" className="items-center" />
      <Segment
        etiket="Randevu durumu"
        deger={sekme}
        onChange={setSekme}
        boyut="k"
        secenekler={[
          { deger: 'bekleyen', ad: 'Bekleyen', sayi: bekleyen.length },
          { deger: 'onaylanan', ad: 'Onaylanan' },
          { deger: 'gecmis', ad: 'Geçmiş' },
        ]}
      />
      {kapali && (
        <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl bg-yuzey-2 px-3.5 py-2.5 text-[13px]">
          <span className="text-metin-2">Kartınızdan randevu alma şu an kapalı.</span>
          <button type="button" onClick={ayariAc} className="font-semibold text-aksan hover:underline">Aç</button>
        </div>
      )}
      {liste.length === 0 ? (
        <BosDurum
          ikon={Calendar}
          baslik={sekme === 'bekleyen' ? 'Onay bekleyen randevu yok' : sekme === 'onaylanan' ? 'Yaklaşan onaylı randevu yok' : 'Geçmiş randevu yok'}
          aciklama={sekme === 'bekleyen' ? 'Kartınızdan gelen yeni talepler burada onayınızı bekler.' : undefined}
          className="py-6"
        />
      ) : (
        <div className="flex flex-col">
          {liste.map((r) => (
            <RandevuSatiri key={r.id} r={r} gecmis={sekme === 'gecmis'} isleniyor={isleniyor === r.id} onDurum={durumYaz} />
          ))}
        </div>
      )}
    </Kart>
  )
}

function RandevuSatiri({ r, gecmis, isleniyor, onDurum }) {
  const dk = Math.round((new Date(r.biter_at) - new Date(r.baslar_at)) / 60000)
  const d = DURUM[r.durum] || { ad: r.durum, ton: 'notr' }
  const saatiGecti = new Date(r.baslar_at) < new Date()
  return (
    <div className="flex items-start gap-3 py-3 border-b border-yuzey-2 last:border-b-0 flex-wrap sm:flex-nowrap">
      <span className="w-12 shrink-0 rounded-xl bg-yuzey-2 text-center py-1.5" aria-hidden="true">
        <span className="block font-baslik text-[17px] font-extrabold leading-none">{zaman(r.baslar_at, { day: 'numeric' })}</span>
        <span className="block text-[11px] font-semibold text-metin-2 mt-0.5">{zaman(r.baslar_at, { month: 'short' })}</span>
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <b className="font-semibold text-[14px]">{r.ad}</b>
          {gecmis && <Rozet ton={d.ton}>{d.ad}</Rozet>}
        </div>
        <div className="text-xs text-metin-2">
          {zaman(r.baslar_at, { weekday: 'long', day: 'numeric', month: 'long' })}, {zaman(r.baslar_at, { hour: '2-digit', minute: '2-digit' })}
          {dk > 0 && ` · ${dk} dk`}{KAYNAK[r.kaynak] && ` · ${KAYNAK[r.kaynak]}`}
        </div>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs">
          {r.eposta && <a href={`mailto:${r.eposta}`} className="inline-flex items-center gap-1 text-aksan hover:underline"><Mail size={12} aria-hidden="true" />{r.eposta}</a>}
          {r.telefon && <a href={`tel:${r.telefon}`} className="inline-flex items-center gap-1 text-aksan hover:underline"><Phone size={12} aria-hidden="true" />{r.telefon}</a>}
        </div>
        {r.aciklama && <p className="text-[13px] text-metin mt-1.5 break-words">{r.aciklama}</p>}
      </div>
      <div className="flex gap-1.5 shrink-0 basis-full sm:basis-auto pl-[60px] sm:pl-0">
        {r.durum === 'bekliyor' && !saatiGecti && (
          <>
            <Dugme boyut="k" disabled={isleniyor} onClick={() => onDurum(r, 'iptal')}>Reddet</Dugme>
            <Dugme tur="ana" boyut="k" disabled={isleniyor} onClick={() => onDurum(r, 'onaylandi')}>Onayla</Dugme>
          </>
        )}
        {r.durum === 'onaylandi' && !saatiGecti && (
          <Dugme tur="tehlikeSessiz" boyut="k" disabled={isleniyor} onClick={() => onDurum(r, 'iptal')}>İptal et</Dugme>
        )}
        {r.durum === 'onaylandi' && saatiGecti && (
          <Dugme tur="sessiz" boyut="k" ikon={Check} disabled={isleniyor} onClick={() => onDurum(r, 'tamamlandi')}>Tamamlandı</Dugme>
        )}
      </div>
    </div>
  )
}

// ------------------------------------------------------------- kişi defteri
function KisiDefteri({ kisiler, setKisiler, ctx }) {
  const [arama, setArama] = useState('')
  const suzulmus = useMemo(() => {
    const q = arama.trim().toLocaleLowerCase('tr-TR')
    if (!q) return kisiler
    return kisiler.filter((k) => [k.name, k.company, k.email, k.phone, k.persona_name].some((v) => v && String(v).toLocaleLowerCase('tr-TR').includes(q)))
  }, [kisiler, arama])

  const csv = () => exportToCSV(
    kisiler.map((k) => ({
      'Ad Soyad': k.name,
      'E-posta': k.email || '-',
      'Telefon': k.phone || '-',
      'Firma': k.company || '-',
      'Not': k.note || '-',
      'Geldiği yer': KAYNAK_CSV[k.source] || '-',
      'Profil': k.persona_name || '-',
      'Tarih': new Date(k.created_at).toLocaleDateString('tr-TR'),
    })),
    'kisi_defteri',
  )
  // Tüm defter tek .vcf dosyasında: telefon rehberi hepsini birden içe alır.
  const tumVcard = () => dosyaIndir(kisiler.map(vcard).join('\r\n'), 'qrtim-kisi-defteri.vcf', 'text/vcard;charset=utf-8')

  const sil = (k) => ctx.onayIste({
    title: 'Kayıt silinsin mi?',
    message: `${k.name} kişi defterinizden silinecek. Bu işlem geri alınamaz.`,
    onConfirm: async () => {
      try {
        // Erişim kuralı engellerse hata dönmez, 0 satır silinir: etkilenen satıra bakılır.
        const { data, error } = await supabase.from('card_contacts').delete().eq('id', k.id).select('id')
        if (error) throw error
        if (!data?.length) throw new Error('Kayıt silinemedi.')
        setKisiler((o) => o.filter((x) => x.id !== k.id))
        ctx.showToast('Kayıt silindi.', 'success')
      } catch (e) {
        ctx.showToast(e.message, 'error')
      }
    },
  })

  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="gl-kisi">
      <KartBaslik
        id="gl-kisi"
        baslik="Kişi defteri"
        alt={kisiler.length ? `${kisiler.length} kişi size bilgisini bıraktı` : undefined}
        sag={kisiler.length > 0 && (
          <>
            <Dugme boyut="k" ikon={Download} onClick={tumVcard} title="Telefon rehberine aktarmak için">vCard</Dugme>
            <Dugme boyut="k" ikon={Download} onClick={csv} title="Excel ve tablolar için">CSV</Dugme>
          </>
        )}
      />
      {kisiler.length > 5 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-metin-2" aria-hidden="true" />
          <Girdi value={arama} onChange={(e) => setArama(e.target.value)} placeholder="Ad, şirket, e-posta ara" aria-label="Kişi ara" className="h-10 pl-9 text-sm" />
        </div>
      )}
      {kisiler.length === 0 ? (
        <BosDurum
          ikon={Users}
          baslik="Henüz kimse bilgi bırakmadı"
          aciklama="Kartınızı okutan kişiler kartın altındaki “Ben de kartımı bırakayım” düğmesiyle kendi bilgilerini bırakabilir — kağıt kartvizit değişiminin dijital hali."
          className="py-6"
        />
      ) : suzulmus.length === 0 ? (
        <p className="text-[13px] text-metin-2 py-4 text-center">“{arama}” ile eşleşen kişi yok.</p>
      ) : (
        <div className="flex flex-col">
          {suzulmus.map((k) => (
            <div key={k.id} className="flex items-start gap-3 py-3 border-b border-yuzey-2 last:border-b-0">
              <Avatar ad={k.name} boyut={36} />
              <div className="flex-1 min-w-0">
                <b className="block font-semibold text-[14px] truncate">{k.name}</b>
                {k.company && <div className="text-xs text-metin-2 truncate">{k.company}</div>}
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs">
                  {k.email && <a href={`mailto:${k.email}`} className="inline-flex items-center gap-1 text-aksan hover:underline break-all"><Mail size={12} aria-hidden="true" />{k.email}</a>}
                  {k.phone && <a href={`tel:${k.phone}`} className="inline-flex items-center gap-1 text-aksan hover:underline"><Phone size={12} aria-hidden="true" />{k.phone}</a>}
                </div>
                {k.note && <p className="text-[13px] mt-1 break-words">{k.note}</p>}
                <div className="text-[11.5px] text-metin-2 mt-1">
                  {[KAYNAK[k.source], k.persona_name, new Date(k.created_at).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <IkonDugme ikon={UserPlus} etiket={`${k.name} kişisini rehbere ekle`} onClick={() => dosyaIndir(vcard(k), `${dosyaAdi(k.name)}.vcf`, 'text/vcard;charset=utf-8')} />
                <IkonDugme ikon={Trash2} etiket={`${k.name} kaydını sil`} onClick={() => sil(k)} className="hover:text-red-600 dark:hover:text-red-400" />
              </div>
            </div>
          ))}
        </div>
      )}
    </Kart>
  )
}

// ------------------------------------------------------------- randevu ayarları
function RandevuAyarlari({ ilk, onKaydedildi, ctx }) {
  const [ayar, setAyar] = useState(() => ilk || { aktif: false, slot_dakika: 30, ileri_gun: 14, en_erken_saat: 2, gun_saatleri: {}, aciklama: '', otomatik_onay: false })
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [takvimAnahtari, setTakvimAnahtari] = useState(null)
  const [yenileOnay, setYenileOnay] = useState(false)
  const [kopyalandi, setKopyalandi] = useState(false)

  useEffect(() => {
    let iptal = false
    supabase.rpc('my_calendar_key').then(({ data }) => { if (!iptal) setTakvimAnahtari(data?.anahtar || null) })
    return () => { iptal = true }
  }, [])

  const gunAc = (no, acik) => setAyar((o) => {
    const g = { ...(o.gun_saatleri || {}) }
    if (acik) g[no] = [['09:00', '18:00']]; else delete g[no]
    return { ...o, gun_saatleri: g }
  })
  const saatDegistir = (no, i, deger) => setAyar((o) => {
    const aralik = [...(o.gun_saatleri?.[no]?.[0] || ['09:00', '18:00'])]
    aralik[i] = deger
    return { ...o, gun_saatleri: { ...o.gun_saatleri, [no]: [aralik] } }
  })

  const kaydet = async () => {
    setKaydediliyor(true)
    try {
      const { data, error } = await supabase.rpc('appointment_settings_save', {
        p_aktif: ayar.aktif,
        p_slot_dakika: ayar.slot_dakika,
        p_ileri_gun: ayar.ileri_gun,
        p_en_erken_saat: ayar.en_erken_saat,
        p_gun_saatleri: ayar.gun_saatleri || {},
        p_aciklama: ayar.aciklama || null,
        p_otomatik_onay: ayar.otomatik_onay,
      })
      if (error) throw error
      if (!data?.ok) throw new Error('Randevu ayarları kaydedilemedi.')
      // Sunucu gün/saatleri yeniden doğrulayıp temizlenmiş hâlini döner; ekran
      // gerçekte kaydedileni göstersin.
      const kayitli = { ...ayar, gun_saatleri: data.gun_saatleri ?? ayar.gun_saatleri }
      setAyar(kayitli)
      onKaydedildi(kayitli)
      ctx.showToast('Randevu ayarları kaydedildi.', 'success')
      // Ayar satırı ilk kez bu kayıtta oluşmuş olabilir; takvim anahtarı da o anda doğar.
      if (!takvimAnahtari) {
        const { data: t } = await supabase.rpc('my_calendar_key')
        setTakvimAnahtari(t?.anahtar || null)
      }
    } catch (e) {
      ctx.showToast(e.message, 'error')
    } finally {
      setKaydediliyor(false)
    }
  }

  const takvimAdresi = takvimAnahtari ? `${SITE_URL}/api/takvim.ics?anahtar=${takvimAnahtari}` : null
  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText(takvimAdresi)
      setKopyalandi(true)
      setTimeout(() => setKopyalandi(false), 1500)
    } catch {
      ctx.showToast('Kopyalanamadı; adresi elle seçip kopyalayın.', 'error')
    }
  }
  const anahtarYenile = async () => {
    setYenileOnay(false)
    const { data, error } = await supabase.rpc('rotate_calendar_key')
    if (error || !data?.ok) { ctx.showToast('Takvim adresi yenilenemedi.', 'error'); return }
    setTakvimAnahtari(data.anahtar)
    ctx.showToast('Takvim adresi yenilendi. Aboneliğinizi yeni adresle kurun.', 'success')
  }

  return (
    <div className="flex flex-col gap-5 text-metin py-1">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-[14px]">Kartımdan randevu alınabilsin</p>
          <p className="text-[13px] text-metin-2">Saatler Türkiye saatiyle yorumlanır; kartta da öyle yazar.</p>
        </div>
        <Anahtar acik={ayar.aktif} onChange={(v) => setAyar((o) => ({ ...o, aktif: v }))} etiket="Kartımdan randevu alınabilsin" />
      </div>

      <fieldset disabled={!ayar.aktif} className={birlestir('flex flex-col gap-5 min-w-0', !ayar.aktif && 'opacity-50')}>
        <div className="grid gap-3 sm:grid-cols-3">
          <Alan etiket="Randevu süresi">
            <Secim value={ayar.slot_dakika} onChange={(v) => setAyar((o) => ({ ...o, slot_dakika: Number(v) }))} etiket="Randevu süresi" className="!h-11 w-full text-[15px]">
              {SLOTLAR.map((d) => <option key={d} value={d}>{d} dakika</option>)}
            </Secim>
          </Alan>
          <Alan etiket="Kaç gün ileriye" id="ra-ileri">
            <Girdi id="ra-ileri" type="number" min={1} max={180} value={ayar.ileri_gun} onChange={(e) => setAyar((o) => ({ ...o, ileri_gun: Number(e.target.value) }))} />
          </Alan>
          <Alan etiket="En erken kaç saat sonra" id="ra-erken">
            <Girdi id="ra-erken" type="number" min={0} max={168} value={ayar.en_erken_saat} onChange={(e) => setAyar((o) => ({ ...o, en_erken_saat: Number(e.target.value) }))} />
          </Alan>
        </div>

        <div className="flex flex-col gap-1">
          <p className="text-[13px] font-semibold">Çalışma saatleri</p>
          {GUNLER.map((g) => {
            const aralik = ayar.gun_saatleri?.[g.no]?.[0]
            const acik = Array.isArray(aralik)
            return (
              <div key={g.no} className="flex items-center gap-3 py-1.5 border-b border-yuzey-2 last:border-b-0 flex-wrap">
                <Anahtar acik={acik} onChange={(v) => gunAc(g.no, v)} etiket={`${g.ad} açık`} disabled={!ayar.aktif} />
                <span className="w-24 text-[13px] font-medium">{g.ad}</span>
                {acik ? (
                  <span className="flex items-center gap-2">
                    <Girdi type="time" value={aralik[0]} onChange={(e) => saatDegistir(g.no, 0, e.target.value)} aria-label={`${g.ad} başlangıç`} className="h-9 w-[110px] text-[13px] px-2" />
                    <span className="text-metin-2" aria-hidden="true">–</span>
                    <Girdi type="time" value={aralik[1]} onChange={(e) => saatDegistir(g.no, 1, e.target.value)} aria-label={`${g.ad} bitiş`} className="h-9 w-[110px] text-[13px] px-2" />
                  </span>
                ) : (
                  <span className="text-[13px] text-metin-2">Kapalı</span>
                )}
              </div>
            )
          })}
        </div>

        <Alan etiket="Kartta görünecek açıklama" id="ra-aciklama" ipucu="En fazla 300 karakter.">
          <Girdi id="ra-aciklama" maxLength={300} value={ayar.aciklama || ''} onChange={(e) => setAyar((o) => ({ ...o, aciklama: e.target.value }))} placeholder="Örn. Tanışma görüşmesi için 30 dakika" />
        </Alan>

        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-semibold text-[14px]">Otomatik onay</p>
            <p className="text-[13px] text-metin-2">Kapalıysa her talebi siz onaylarsınız.</p>
          </div>
          <Anahtar acik={ayar.otomatik_onay} onChange={(v) => setAyar((o) => ({ ...o, otomatik_onay: v }))} etiket="Randevular otomatik onaylansın" disabled={!ayar.aktif} />
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Dugme tur="ana" onClick={kaydet} disabled={kaydediliyor}>{kaydediliyor ? 'Kaydediliyor…' : 'Ayarları kaydet'}</Dugme>
      </div>

      {/* Herkesin takvim sağlayıcısı farklı; tek tek entegrasyon yerine takvim
          standardı (ICS) aboneliği: hepsi destekliyor, hesap bağlamak gerekmiyor. */}
      {takvimAdresi && (
        <div className="flex flex-col gap-2 pt-4 border-t border-cizgi">
          <p className="font-semibold text-[14px]">Randevularınızı kendi takviminizde görün</p>
          <p className="text-[13px] text-metin-2">
            Bu adresi takvim uygulamanıza <b className="font-semibold text-metin">abonelik</b> olarak ekleyin: Google Takvim (Diğer takvimler → URL&apos;den),
            Outlook (Takvim ekle → İnternetten abone ol), Apple Takvim (Dosya → Yeni Takvim Aboneliği).
          </p>
          <div className="flex items-center gap-2 rounded-xl bg-yuzey-2 p-2 pl-3">
            <code className="text-xs break-all flex-1">{takvimAdresi}</code>
            <IkonDugme ikon={kopyalandi ? Check : Copy} etiket="Adresi kopyala" onClick={kopyala} />
            <IkonDugme ikon={RefreshCw} etiket="Adresi yenile" onClick={() => setYenileOnay(true)} />
          </div>
          {yenileOnay && (
            <div className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-amber-300 dark:border-amber-400/40 bg-amber-50 dark:bg-amber-400/10 px-3.5 py-2.5 text-[13px] text-amber-800 dark:text-amber-300">
              <span>Eski adres çalışmayı bırakır; takvim aboneliğinizi yeni adresle kurmanız gerekir.</span>
              <span className="flex gap-1.5">
                <Dugme boyut="k" onClick={() => setYenileOnay(false)}>Vazgeç</Dugme>
                <Dugme boyut="k" tur="ana" onClick={anahtarYenile}>Yenile</Dugme>
              </span>
            </div>
          )}
          <p className="text-xs text-metin-2">
            Bu adres bir anahtardır: bilen randevularınızı görebilir, paylaşmayın. Takvim uygulamaları aboneliği kendi aralıklarıyla tazeler;
            yeni randevu takviminize birkaç saat sonra düşebilir.
          </p>
        </div>
      )}
    </div>
  )
}
