// Bireysel panel — Genel bakış (tasarım: PanelGenel).
//
// Sayılar son 30 GÜNÜN sayılarıdır ve sunucuda toplanır (my_card_analytics).
// Önceki 30 günle kıyas için aynı RPC ikinci bir aralıkla çağrılır; önceki
// dönemde hiç veri yoksa "değişim" satırı hiç gösterilmez — sıfıra bölüp
// "%∞ arttı" demek ya da uydurma bir oran yazmak kullanıcıyı yanıltır.
import { useCallback, useEffect, useState } from 'react'
import { Calendar, Check, IdCard, Plus, QrCode, User, ArrowRight, Nfc, Inbox } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { cardUrl, personaUrl, kartKoduUrl } from '../../lib/siteUrl'
import { Kart, KartBaslik, SayfaBaslik, Dugme, Rozet, Istatistik, Avatar, Ilerleme, BosDurum, Yukleniyor } from '../ui'
import { sayi, bugunUst, birlestir } from '../bicim'

const GUN = 86400000
const TZ = 'Europe/Istanbul'

// Sunucu tarih sınırlarını GÜNE yuvarlar; yerel takvim gününü gönderiyoruz.
const gunMetni = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), g = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${g}`
}
const adresYaz = (url) => url.replace(/^https?:\/\//, '')

const KAYNAK = { qr: 'QR ile', nfc: 'NFC ile', link: 'Bağlantıdan', direct: 'Doğrudan' }

function kisiZamani(iso) {
  const d = new Date(iso)
  const bugun = new Date(); bugun.setHours(0, 0, 0, 0)
  const saatStr = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })
  if (d >= bugun) return `bugün ${saatStr}`
  if (d >= new Date(bugun.getTime() - GUN)) return `dün ${saatStr}`
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
}

function randevuZamani(r) {
  const d = new Date(r.baslar_at)
  const gun = d.toLocaleDateString('tr-TR', { weekday: 'short', timeZone: TZ })
  const tarih = d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', timeZone: TZ })
  const s = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  const dk = Math.round((new Date(r.biter_at) - d) / 60000)
  return `${gun} ${tarih}, ${s}${dk > 0 ? ` · ${dk} dk` : ''}`
}

// vCard 3.0: virgül, noktalı virgül ve satır sonu kaçışlanır; yoksa telefonun
// rehberi alanları kaydırır (şirket adındaki virgül soyada düşer).
const vKac = (s) => String(s ?? '').replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')
function rehbereEkle(k) {
  const parca = String(k.name || '').trim().split(/\s+/)
  const soyad = parca.length > 1 ? parca.pop() : ''
  const metin = [
    'BEGIN:VCARD', 'VERSION:3.0',
    `FN:${vKac(k.name)}`, `N:${vKac(soyad)};${vKac(parca.join(' '))};;;`,
    k.company && `ORG:${vKac(k.company)}`,
    k.email && `EMAIL;TYPE=INTERNET:${vKac(k.email)}`,
    k.phone && `TEL;TYPE=CELL:${vKac(k.phone)}`,
    k.note && `NOTE:${vKac(k.note)}`,
    'END:VCARD',
  ].filter(Boolean).join('\r\n')
  const url = URL.createObjectURL(new Blob([metin], { type: 'text/vcard;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${(k.name || 'kisi').replace(/[^\p{L}\p{N}]+/gu, '-')}.vcf`
  document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const DOGRULAMA_DURUM = {
  dogrulandi: { ad: 'Doğrulandı', ton: 'aksan' },
  beklemede: { ad: 'Bekliyor', ton: 'uyari' },
  basarisiz: { ad: 'Başarısız', ton: 'tehlike' },
}

async function veriyiYukle() {
  const bugun = new Date()
  const bas = new Date(bugun.getTime() - 29 * GUN)
  const oncekiBit = new Date(bugun.getTime() - 30 * GUN)
  const oncekiBas = new Date(bugun.getTime() - 59 * GUN)
  const aralik = { p_from: gunMetni(bas), p_to: gunMetni(bugun) }
  const [a, o, l, p, r, k, v] = await Promise.all([
    supabase.rpc('my_card_analytics', aralik),
    supabase.rpc('my_card_analytics', { p_from: gunMetni(oncekiBas), p_to: gunMetni(oncekiBit) }),
    supabase.rpc('my_link_performance', aralik),
    supabase.rpc('persona_list'),
    supabase.rpc('my_appointments', { p_gecmis: false }),
    supabase.rpc('my_card_contacts'),
    supabase.rpc('my_verifications'),
  ])
  return {
    analiz: a.data?.ok ? a.data : null,
    onceki: o.data?.ok ? o.data : null,
    baglantilar: l.data?.ok ? l.data.baglantilar || [] : [],
    personalar: Array.isArray(p.data) ? p.data : [],
    randevular: Array.isArray(r.data) ? r.data : [],
    kisiler: Array.isArray(k.data) ? k.data : [],
    dogrulama: v.data?.ok ? v.data : null,
  }
}

export default function GenelBakis({ ctx }) {
  const { profile, socialLinks, bolumDegistir, planBilgisi } = ctx
  const navigate = useNavigate()
  const [veri, setVeri] = useState(null)
  const [isleniyor, setIsleniyor] = useState(null)

  useEffect(() => {
    if (!profile?.id) return
    let iptal = false
    veriyiYukle().then((v) => { if (!iptal) setVeri(v) })
    return () => { iptal = true }
  }, [profile?.id])

  const randevuYanitla = useCallback(async (r, durum) => {
    setIsleniyor(r.id)
    try {
      const { data, error } = await supabase.rpc('appointment_set_status', { p_id: r.id, p_durum: durum })
      if (error || !data?.ok) throw new Error('İşlem tamamlanamadı.')
      setVeri((o) => ({ ...o, randevular: o.randevular.map((x) => (x.id === r.id ? { ...x, durum } : x)) }))
      ctx.showToast(durum === 'onaylandi' ? `${r.ad} ile randevu onaylandı.` : 'Randevu talebi reddedildi.', 'success')
    } catch (e) {
      ctx.showToast(e.message, 'error')
    } finally {
      setIsleniyor(null)
    }
  }, [ctx])

  const ad = (profile?.name || ctx.session?.user?.email || '').trim().split(/[\s@]/)[0]

  return (
    <>
      <SayfaBaslik
        ust={bugunUst()}
        baslik={ad ? `Merhaba ${ad}` : 'Merhaba'}
        sag={
          <>
            <Dugme ikon={QrCode} onClick={() => bolumDegistir('paylasim')}>QR indir</Dugme>
            <Dugme tur="ana" onClick={() => bolumDegistir('kartim')}>Kartı düzenle</Dugme>
          </>
        }
      />

      {!veri ? <Yukleniyor /> : (
        <>
          <Istatistikler veri={veri} />

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] items-start">
            <div className="flex flex-col gap-5 min-w-0">
              <Kartlariniz personalar={veri.personalar} profile={profile} bolumDegistir={bolumDegistir} />
              <GelenlerOnizleme veri={veri} bolumDegistir={bolumDegistir} isleniyor={isleniyor} onYanit={randevuYanitla} />
            </div>
            <div className="flex flex-col gap-5 min-w-0">
              <Guclendir profile={profile} socialLinks={socialLinks} dogrulama={veri.dogrulama} bolumDegistir={bolumDegistir} />
              <KimlikDurumu dogrulama={veri.dogrulama} bolumDegistir={bolumDegistir} />
              <NfcKarti profile={profile} planBilgisi={planBilgisi} odemeyiAc={ctx.odemeyiAc} navigate={navigate} bolumDegistir={bolumDegistir} />
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------- istatistikler
function Istatistikler({ veri }) {
  const a = veri.analiz
  const toplam = a?.toplam_goruntulenme ?? 0
  const onceki = veri.onceki?.toplam_goruntulenme ?? 0

  let degisim = null
  if (a && onceki > 0) {
    const oran = Math.round(((toplam - onceki) / onceki) * 100)
    degisim = oran === 0
      ? { metin: 'Önceki dönemle aynı', ton: 'notr' }
      : { metin: `${oran > 0 ? '▲' : '▼'} %${Math.abs(oran)} önceki döneme göre`, ton: oran > 0 ? 'olumlu' : 'tehlike' }
  }

  const rehber = a?.rehbere_kaydetme ?? 0
  const enCok = veri.baglantilar.find((b) => b.toplam > 0)
  // QR ve NFC sayımı sunucuda olay türü VEYA kaynakla yapılır; nadir de olsa
  // payı aşabilir, yüzde 100'ü geçmesin.
  const qrNfc = Math.min(toplam, (a?.qr ?? 0) + (a?.nfc ?? 0))
  const nfcPay = toplam ? Math.round(((a?.nfc ?? 0) / toplam) * 100) : null

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      <Istatistik etiket="Görüntülenme · 30 gün" deger={a ? sayi(toplam) : '—'} alt={degisim?.metin} altTon={degisim?.ton} />
      <Istatistik
        etiket="Rehbere kaydetme"
        deger={a ? sayi(rehber) : '—'}
        alt={toplam ? `%${(Math.round((rehber / toplam) * 1000) / 10).toLocaleString('tr-TR')} dönüşüm` : undefined}
      />
      <Istatistik etiket="Bağlantı tıklama" deger={a ? sayi(a.baglanti_tiklama ?? 0) : '—'} alt={enCok ? `En çok: ${enCok.ad || enCok.platform}` : undefined} />
      <Istatistik
        etiket="QR / NFC ile gelen"
        deger={toplam ? Math.round((qrNfc / toplam) * 100) : '—'}
        birim={toplam ? '%' : undefined}
        alt={nfcPay !== null ? `NFC payı %${nfcPay}` : 'Henüz görüntülenme yok'}
      />
    </div>
  )
}

// ------------------------------------------------------------- kartlarınız
function Kartlariniz({ personalar, profile, bolumDegistir }) {
  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="g-kart">
      <KartBaslik
        id="g-kart"
        baslik="Kartlarınız"
        className="items-center"
        sag={<Dugme tur="sessiz" boyut="k" ikon={Plus} className="h-[34px] px-3.5 text-sm" onClick={() => bolumDegistir('kartim')}>Profil ekle</Dugme>}
      />
      {personalar.length === 0 ? (
        <BosDurum
          ikon={IdCard}
          baslik="Henüz yayında bir kartınız yok"
          aciklama="Kartım bölümünden adınızı, bağlantılarınızı ve kullanıcı adınızı girin; kartınız burada görünür."
          eylem={<Dugme tur="ana" boyut="k" onClick={() => bolumDegistir('kartim')}>Kartımı oluştur</Dugme>}
          className="py-5"
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {personalar.map((p) => {
            const adres = p.is_primary
              ? (profile?.username ? cardUrl(profile.username) : null)
              : (p.share_code ? personaUrl(p.share_code) : null)
            const yayinda = p.status !== 'paused'
            return (
              <div key={p.id} className="flex items-center gap-3.5 p-3 border border-cizgi rounded-xl min-w-0">
                <Avatar ad={profile?.name || p.name} boyut={44} kare ton={p.is_primary ? 'bg-aksan text-white dark:text-zemin' : 'bg-vurgu text-white'} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <b className="font-semibold text-[14px] text-metin">{[p.kind_label, p.display_name || p.name].filter(Boolean).join(' · ')}</b>
                    <Rozet ton={yayinda ? 'aksan' : 'notr'}>{yayinda ? 'Yayında' : 'Duraklatıldı'}</Rozet>
                  </div>
                  <div className="text-xs text-metin-2 font-mono truncate">
                    {adres ? adresYaz(adres) : 'Kullanıcı adı belirlenmedi'}
                  </div>
                </div>
                <Dugme boyut="k" className="h-[34px] px-3.5 text-sm" onClick={() => bolumDegistir('kartim')} aria-label={`${p.name} profilini düzenle`}>Düzenle</Dugme>
              </div>
            )
          })}
        </div>
      )}
    </Kart>
  )
}

// ------------------------------------------------------------- gelenler
function GelenlerOnizleme({ veri, bolumDegistir, isleniyor, onYanit }) {
  const bekleyen = veri.randevular.filter((r) => r.durum === 'bekliyor').slice(0, 3)
  const kisiler = veri.kisiler.slice(0, 3)
  const bos = bekleyen.length === 0 && kisiler.length === 0
  return (
    <Kart className="p-5 flex flex-col gap-2" aria-labelledby="g-gelen">
      <KartBaslik
        id="g-gelen"
        baslik="Gelenler"
        className="items-center"
        sag={<button type="button" onClick={() => bolumDegistir('gelenler')} className="text-[13px] font-semibold text-aksan hover:underline">Tümünü gör</button>}
      />
      {bos ? (
        <BosDurum
          ikon={Inbox}
          baslik="Yeni bir şey yok"
          aciklama="Kartınızdan gelen randevu talepleri ve size bilgi bırakan kişiler burada görünür."
          className="py-5"
        />
      ) : (
        <div className="flex flex-col">
          {bekleyen.map((r) => (
            <div key={r.id} className="flex items-center gap-3 py-2.5 border-b border-yuzey-2 last:border-b-0 flex-wrap sm:flex-nowrap">
              <span className="w-[34px] h-[34px] rounded-full bg-amber-50 text-amber-800 dark:bg-amber-400/15 dark:text-amber-300 inline-flex items-center justify-center shrink-0">
                <Calendar size={16} aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <b className="block font-semibold text-[14px] break-words">Randevu talebi · {r.ad}</b>
                <div className="text-xs text-metin-2">{randevuZamani(r)}</div>
              </div>
              <div className="flex gap-1.5 shrink-0 basis-full sm:basis-auto pl-[46px] sm:pl-0">
                <Dugme boyut="k" disabled={isleniyor === r.id} onClick={() => onYanit(r, 'iptal')}>Reddet</Dugme>
                <Dugme tur="ana" boyut="k" disabled={isleniyor === r.id} onClick={() => onYanit(r, 'onaylandi')}>Onayla</Dugme>
              </div>
            </div>
          ))}
          {kisiler.map((k) => (
            <div key={k.id} className="flex items-center gap-3 py-2.5 border-b border-yuzey-2 last:border-b-0">
              <span className="w-[34px] h-[34px] rounded-full bg-aksan-acik text-aksan-koyu dark:text-aksan inline-flex items-center justify-center shrink-0">
                <User size={16} aria-hidden="true" />
              </span>
              <div className="flex-1 min-w-0">
                <b className="block font-semibold text-[14px] truncate">Yeni kişi · {k.name}</b>
                <div className="text-xs text-metin-2 truncate">
                  {[KAYNAK[k.source], kisiZamani(k.created_at), k.email || k.phone].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Dugme tur="sessiz" boyut="k" className="shrink-0" onClick={() => rehbereEkle(k)} aria-label={`${k.name} kişisini rehbere ekle`}>Rehbere ekle</Dugme>
            </div>
          ))}
        </div>
      )}
    </Kart>
  )
}

// ------------------------------------------------------------- güçlendirin
function Guclendir({ profile, socialLinks, dogrulama, bolumDegistir }) {
  const baglanti = socialLinks?.length || 0
  const dogrulandi = Boolean(
    dogrulama?.eposta?.dogrulandi ||
    (dogrulama?.liste || []).some((v) => v.tur === 'alan_adi' && v.durum === 'dogrulandi' && !v.suresi_gecti),
  )
  // Her madde gerçek profil verisinden; tamamlanmamış madde ilgili bölüme götürür.
  const maddeler = [
    { ad: 'Profil fotoğrafı', eylem: 'Profil fotoğrafı ekle', tamam: Boolean(profile?.avatar_url), bolum: 'kartim' },
    { ad: 'Kullanıcı adı', eylem: 'Kullanıcı adınızı belirleyin', tamam: Boolean(profile?.username), bolum: 'kartim' },
    { ad: 'En az 3 bağlantı', eylem: `En az 3 bağlantı ekleyin (${baglanti}/3)`, tamam: baglanti >= 3, bolum: 'kartim' },
    { ad: 'Kısa tanıtım yazısı', eylem: 'Kısa tanıtım yazısı ekle', tamam: Boolean(profile?.bio?.trim()), bolum: 'kartim' },
    { ad: 'Alan adı ya da e-posta doğrulaması', eylem: 'Alan adınızı ya da e-postanızı doğrulayın', tamam: dogrulandi, bolum: 'kimlik' },
    { ad: 'Telefon numarası', eylem: 'Telefon numarası ekle', tamam: Boolean(profile?.phone?.trim()), bolum: 'kartim' },
  ]
  const biten = maddeler.filter((m) => m.tamam).length
  const oran = biten / maddeler.length
  const sirali = [...maddeler.filter((m) => m.tamam), ...maddeler.filter((m) => !m.tamam)]
  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="g-guc">
      <div className="flex items-center justify-between gap-3">
        <h2 id="g-guc" className="font-baslik text-[17px] font-bold leading-tight">Kartınızı güçlendirin</h2>
        <span className="font-baslik text-sm font-extrabold text-aksan tabular-nums">%{Math.round(oran * 100)}</span>
      </div>
      <Ilerleme oran={oran} etiket="Kart tamamlanma oranı" />
      <ul className="flex flex-col gap-2 text-[13px]">
        {sirali.map((m) => (
          <li key={m.ad} className="flex items-center gap-2.5">
            {m.tamam ? (
              <>
                <Check size={16} strokeWidth={2.5} className="text-aksan shrink-0" aria-hidden="true" />
                <span className="text-metin-2 line-through">{m.ad}<span className="sr-only"> (tamamlandı)</span></span>
              </>
            ) : (
              <>
                <span className="w-4 h-4 rounded border-2 border-cizgi shrink-0" aria-hidden="true" />
                <button type="button" onClick={() => bolumDegistir(m.bolum)} className="text-left text-aksan hover:underline">{m.eylem}</button>
              </>
            )}
          </li>
        ))}
      </ul>
    </Kart>
  )
}

// ------------------------------------------------------------- kimlik durumu
function KimlikDurumu({ dogrulama, bolumDegistir }) {
  const liste = (dogrulama?.liste || []).filter((v) => v.durum !== 'iptal').slice(0, 4)
  const eposta = dogrulama?.eposta
  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="g-kimlik">
      <h2 id="g-kimlik" className="font-baslik text-[17px] font-bold leading-tight">Kimlik durumu</h2>
      <div className="flex flex-col gap-2.5 text-[13px]">
        {liste.map((v) => {
          const d = v.suresi_gecti ? { ad: 'Süresi doldu', ton: 'uyari' } : DOGRULAMA_DURUM[v.durum] || { ad: v.durum, ton: 'notr' }
          const konu = v.tur === 'resmi_kimlik' ? 'Resmî kimlik' : v.konu
          return (
            <div key={v.id} className="flex items-center justify-between gap-3">
              <span className="truncate">{konu}{v.kurum_adi ? ` (${v.kurum_adi})` : ''}</span>
              <Rozet ton={d.ton}>{d.ad}</Rozet>
            </div>
          )
        })}
        {eposta && (
          <div className="flex items-center justify-between gap-3">
            <span className="truncate">E-posta adresi</span>
            <Rozet ton={eposta.dogrulandi ? 'aksan' : 'uyari'}>{eposta.dogrulandi ? 'Doğrulandı' : 'Bekliyor'}</Rozet>
          </div>
        )}
        {liste.length === 0 && (
          <p className="text-metin-2">Alan adınızı ya da telefonunuzu doğrulayın; kartınızda doğrulanmış rozeti görünsün.</p>
        )}
      </div>
      <button type="button" onClick={() => bolumDegistir('kimlik')} className="self-start inline-flex items-center gap-1 text-[13px] font-semibold text-aksan hover:underline">
        Kimlik bölümüne git <ArrowRight size={14} aria-hidden="true" />
      </button>
    </Kart>
  )
}

// ------------------------------------------------------------- NFC kartı
function NfcKarti({ profile, planBilgisi, odemeyiAc, navigate, bolumDegistir }) {
  const hak = (planBilgisi?.sinir?.nfc_yillik ?? 0) > 0
  const kod = profile?.card_code
  return (
    <Kart koyu className="p-5 flex flex-col gap-3.5" aria-labelledby="g-nfc">
      <div className="flex items-center justify-between gap-3">
        <h2 id="g-nfc" className="font-baslik text-[17px] font-bold leading-tight inline-flex items-center gap-2">
          <Nfc size={18} aria-hidden="true" className="text-white/70" />NFC kartınız
        </h2>
        <span className={birlestir('inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold', hak ? 'bg-white/15 text-white' : 'bg-white/10 text-white/75')}>
          {hak ? 'Planınızda var' : 'Profesyonel planda'}
        </span>
      </div>
      {kod ? (
        <p className="text-[13px] text-white/70">
          Kart kodu <span className="font-mono text-white">{kod}</span> · ana profile bağlı
          <span className="block font-mono text-xs text-white/60 mt-1 break-all">{adresYaz(kartKoduUrl(kod))}</span>
        </p>
      ) : (
        <p className="text-[13px] text-white/70">Kart kodunuz kullanıcı adınızı belirlediğinizde oluşur.</p>
      )}
      <p className="text-xs text-white/60">
        {hak
          ? 'Basılı kart bu kalıcı adrese yönlenir; kullanıcı adınızı değiştirseniz de çalışır.'
          : 'Basılı NFC kart Profesyonel planla gelir. QR kodunuzu her planda indirebilirsiniz.'}
      </p>
      <div className="flex gap-2 flex-wrap">
        {hak ? (
          <Dugme tur="koyuIkincil" boyut="k" className="h-[34px] px-3.5 text-sm" onClick={() => navigate('/nfc-designer')}>Kart tasarla</Dugme>
        ) : (
          <Dugme tur="beyaz" boyut="k" className="h-[34px] px-3.5 text-sm" onClick={() => odemeyiAc('professional', 'yearly')}>Planı yükselt</Dugme>
        )}
        <button type="button" onClick={() => bolumDegistir('paylasim')} className="h-[34px] px-3 rounded-lg text-sm font-semibold text-lacivert-200 hover:text-white hover:bg-white/10 transition-colors">NFC ayarları</button>
      </div>
    </Kart>
  )
}
