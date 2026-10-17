// Bireysel panel — Ölçüm (tasarım: PanelOlcum).
//
// Tasarım ÜCRETSİZ planı çiziyor: toplam görüntülenme ve günlük çizgi açık,
// kaynak/rehber/tıklama kilitli, ayrıntı bulanık. Ücretli planda aynı düzen
// kilitsiz gelir.
//
// Toplamlar sunucuda sayılır (my_card_analytics). Günlük seri için sunucuda
// bireysel bir RPC YOK (yalnızca kurum için org_activity_series var); bu
// yüzden seri, kişinin kendi olay satırlarından (analytics_events, RLS: yalnız
// kendi satırları) sayfalanarak çıkarılır. Tavana takılırsa grafik altında
// açıkça söylenir; toplam kutuları yine sunucudan geldiği için doğru kalır.
import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Lock, BarChart3 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { exportToCSV } from '../../utils/exportHelpers'
import { Kart, KartBaslik, SayfaBaslik, Dugme, Istatistik, Segment, Girdi, KilitliAlan, Tablo, Th, Td, BosDurum, Yukleniyor, Rozet } from '../ui'
import { sayi, tarihKisa, birlestir } from '../bicim'

const GUN = 86400000
const PLAN_AD = { free: 'Başlangıç Planı', student: 'Öğrenci Planı', professional: 'Profesyonel Plan', stk: 'STK Özel Plan', business: 'Kurumsal Plan', corporate: 'Kurumsal Plan' }
const GORUNTULENME = ['profile_view', 'qr_scan', 'nfc_tap']
const KANAL = { qr: 'QR', nfc: 'NFC', link: 'Bağlantı', direct: 'Doğrudan' }
const SAYFA = 1000
const SAYFA_TAVANI = 20

const gunMetni = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), g = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${g}`
}
const gunBasi = (metin) => { const [y, m, g] = metin.split('-').map(Number); return new Date(y, m - 1, g) }
const gunEkle = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x }

function eylemMetni(e) {
  switch (e.event_type) {
    case 'profile_view': return 'Kartı görüntüledi'
    case 'qr_scan': return 'QR okuttu'
    case 'nfc_tap': return 'NFC karta dokundu'
    case 'vcard_download': return 'Rehbere kaydetti'
    case 'share': return 'Kartı paylaştı'
    case 'link_click': return e.etiket || e.platform ? `${e.etiket || e.platform} bağlantısına tıkladı` : 'Bir bağlantıya tıkladı'
    default: return e.event_type
  }
}
// Sunucudaki sayımla aynı kural: kaynak işareti VEYA olay türü.
const qrMi = (e) => e.source === 'qr' || e.event_type === 'qr_scan'
const nfcMi = (e) => e.source === 'nfc' || e.event_type === 'nfc_tap'

async function olaylariGetir(profilId, bas, bit) {
  const satirlar = []
  for (let i = 0; i < SAYFA_TAVANI; i++) {
    const { data, error } = await supabase
      .from('analytics_events')
      .select('created_at,event_type,source,etiket:metadata->>label,platform:metadata->>platform')
      .eq('profile_id', profilId)
      .gte('created_at', bas.toISOString())
      .lt('created_at', bit.toISOString())
      .order('created_at', { ascending: false })
      .range(i * SAYFA, i * SAYFA + SAYFA - 1)
    if (error) throw error
    satirlar.push(...(data || []))
    if (!data || data.length < SAYFA) return { satirlar, eksik: false }
  }
  return { satirlar, eksik: true }
}

async function yukle(profilId, from, to, ucretli) {
  const bas = gunBasi(from)
  const bit = gunEkle(gunBasi(to), 1)
  const uzunluk = Math.round((bit - bas) / GUN)
  const oncekiBas = gunEkle(bas, -uzunluk)
  const oncekiBit = gunEkle(bas, -1)
  const [a, o, l, ev] = await Promise.all([
    supabase.rpc('my_card_analytics', { p_from: from, p_to: to }),
    ucretli ? supabase.rpc('my_card_analytics', { p_from: gunMetni(oncekiBas), p_to: gunMetni(oncekiBit) }) : Promise.resolve({}),
    ucretli ? supabase.rpc('my_link_performance', { p_from: from, p_to: to }) : Promise.resolve({}),
    olaylariGetir(profilId, bas, bit).catch((e) => { console.error('Olaylar alınamadı:', e); return null }),
  ])
  // Gün kovaları yerel takvim gününe göre; boş günler de çizgide sıfır olarak görünür.
  const kova = new Map()
  for (let d = new Date(bas); d < bit; d = gunEkle(d, 1)) kova.set(gunMetni(d), { gun: new Date(d), toplam: 0, qr: 0, nfc: 0, rehber: 0, tiklama: 0 })
  for (const e of ev?.satirlar || []) {
    const k = kova.get(gunMetni(new Date(e.created_at)))
    if (!k) continue
    if (GORUNTULENME.includes(e.event_type)) {
      k.toplam++
      if (qrMi(e)) k.qr++
      if (nfcMi(e)) k.nfc++
    }
    if (e.event_type === 'vcard_download') k.rehber++
    if (e.event_type === 'link_click') k.tiklama++
  }
  return {
    analiz: a.data?.ok ? a.data : null,
    onceki: o.data?.ok ? o.data : null,
    baglantilar: l.data?.ok ? l.data.baglantilar || [] : [],
    gunler: [...kova.values()],
    sonHareketler: (ev?.satirlar || []).slice(0, 8),
    seriVar: Boolean(ev),
    eksik: Boolean(ev?.eksik),
  }
}

export default function Olcum({ ctx }) {
  const { profile, planBilgisi, subscription, subLoading } = ctx
  const plan = planBilgisi?.plan || subscription?.plan || (subLoading ? null : 'free')
  const ucretli = Boolean(plan && plan !== 'free')

  const [donem, setDonem] = useState('30')
  const bugun = gunMetni(new Date())
  const [ozel, setOzel] = useState(() => ({ from: gunMetni(gunEkle(new Date(), -29)), to: gunMetni(new Date()) }))

  // Ücretsiz planda 90 gün ve özel aralık kapalı; plan düşerse seçim 30'a döner.
  const etkinDonem = !ucretli && (donem === '90' || donem === 'ozel') ? '30' : donem
  const { from, to } = etkinDonem === 'ozel'
    ? (ozel.from && ozel.to && ozel.from <= ozel.to ? ozel : { from: ozel.to || bugun, to: ozel.to || bugun })
    : { from: gunMetni(gunEkle(new Date(), -(Number(etkinDonem) - 1))), to: bugun }
  const anahtar = `${from}_${to}_${ucretli}`

  const [sonuc, setSonuc] = useState(null)
  useEffect(() => {
    if (!profile?.id || !plan) return
    let iptal = false
    yukle(profile.id, from, to, ucretli).then((v) => { if (!iptal) setSonuc({ anahtar: `${from}_${to}_${ucretli}`, ...v }) })
    return () => { iptal = true }
  }, [profile?.id, plan, from, to, ucretli])
  const yukleniyor = !sonuc || sonuc.anahtar !== anahtar
  const gunSayisi = Math.round((gunEkle(gunBasi(to), 1) - gunBasi(from)) / GUN)

  const yukselt = () => ctx.odemeyiAc('professional', 'yearly')

  const csvIndir = () => {
    if (!sonuc?.gunler?.length) return
    exportToCSV(
      sonuc.gunler.map((g) => ({
        Tarih: gunMetni(g.gun),
        'Görüntülenme': g.toplam,
        QR: g.qr,
        NFC: g.nfc,
        'Rehbere kaydetme': g.rehber,
        'Bağlantı tıklama': g.tiklama,
      })),
      `qrtim_olcum_${from}_${to}`,
    )
  }

  const donemMetni = etkinDonem === 'ozel' ? `${tarihKisa(gunBasi(from))} – ${tarihKisa(gunBasi(to))}` : `son ${etkinDonem} gün`
  const kisiAd = profile?.name || ctx.session?.user?.email || ''

  return (
    <>
      <SayfaBaslik
        baslik="Ölçüm"
        alt={[kisiAd, plan && PLAN_AD[plan], donemMetni].filter(Boolean).join(' · ')}
        sag={
          <>
            <Segment
              etiket="Tarih aralığı"
              deger={etkinDonem}
              onChange={setDonem}
              secenekler={[
                { deger: '7', ad: '7 gün' },
                { deger: '30', ad: '30 gün' },
                { deger: '90', ad: '90 gün', kapali: !ucretli },
                { deger: 'ozel', ad: 'Özel', kapali: !ucretli },
              ]}
            />
            {ucretli ? (
              <Dugme ikon={Download} onClick={csvIndir} disabled={yukleniyor || !sonuc?.seriVar}>CSV</Dugme>
            ) : (
              <Dugme ikon={Lock} disabled title="CSV dışa aktarım Profesyonel planda">CSV</Dugme>
            )}
          </>
        }
      />

      {etkinDonem === 'ozel' && (
        <div className="flex flex-wrap items-end gap-3 -mt-1">
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Başlangıç
            <Girdi type="date" value={ozel.from} max={ozel.to || bugun} onChange={(e) => setOzel((o) => ({ ...o, from: e.target.value }))} className="h-9 w-[170px] text-[13px]" />
          </label>
          <label className="flex flex-col gap-1 text-[13px] font-semibold">
            Bitiş
            <Girdi type="date" value={ozel.to} min={ozel.from} max={bugun} onChange={(e) => setOzel((o) => ({ ...o, to: e.target.value }))} className="h-9 w-[170px] text-[13px]" />
          </label>
        </div>
      )}

      {!plan || yukleniyor ? <Yukleniyor /> : (
        <>
          <Kutular sonuc={sonuc} ucretli={ucretli} onKilit={yukselt} />

          <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="o-grafik">
            <KartBaslik
              id="o-grafik"
              baslik="Günlük toplam görüntülenme"
              className="items-center"
              sag={ucretli
                ? <Lejant />
                : <span className="text-xs text-metin-2">Kaynak ayrımı Profesyonel planda</span>}
            />
            {!sonuc.seriVar ? (
              <p className="text-[13px] text-metin-2 py-6 text-center">Günlük seri şu an yüklenemedi.</p>
            ) : (
              <CizgiGrafik gunler={sonuc.gunler} ikinci={ucretli} etiket={`${donemMetni} için günlük toplam görüntülenme çizgi grafiği`} />
            )}
            {sonuc.eksik && (
              <p className="text-xs text-metin-2">Bu aralıkta çok fazla hareket var; grafik ilk {sayi(SAYFA * SAYFA_TAVANI)} olayı gösteriyor. Üstteki toplamlar eksiksizdir.</p>
            )}
          </Kart>

          {ucretli ? (
            <Ayrinti sonuc={sonuc} gunSayisi={gunSayisi} />
          ) : (
            <Kart className="min-h-[360px] overflow-hidden" aria-labelledby="o-detay">
              <KilitliAlan
                baslik={<span id="o-detay">Ayrıntılı veri Profesyonel planda</span>}
                aciklama="Ziyaretçilerin hangi kanaldan geldiği, hangi bağlantıya tıklandığı, kaç kişinin rehbere kaydettiği; 90 güne kadar tarih aralığı ve CSV dışa aktarım."
                eylemler={
                  <>
                    <Dugme tur="ana" onClick={yukselt}>Profesyonel&apos;e geç</Dugme>
                    <Dugme onClick={() => ctx.bolumDegistir('hesap')}>Planları karşılaştır</Dugme>
                  </>
                }
                not="Veriler şimdiden toplanıyor; geçtiğinizde son 90 gün açılır."
              >
                <AyrintiIskeleti />
              </KilitliAlan>
            </Kart>
          )}
        </>
      )}
    </>
  )
}

// ------------------------------------------------------------- kutular
function Kutular({ sonuc, ucretli, onKilit }) {
  const a = sonuc.analiz
  const toplam = a?.toplam_goruntulenme ?? 0
  const onceki = sonuc.onceki?.toplam_goruntulenme ?? 0
  let degisim
  if (ucretli && a && onceki > 0) {
    const oran = Math.round(((toplam - onceki) / onceki) * 100)
    degisim = oran === 0
      ? { metin: 'Önceki dönemle aynı', ton: 'notr' }
      : { metin: `${oran > 0 ? '▲' : '▼'} %${Math.abs(oran)} önceki döneme göre`, ton: oran > 0 ? 'olumlu' : 'tehlike' }
  }
  const enCok = sonuc.baglantilar.find((b) => b.toplam > 0)
  const rehber = a?.rehbere_kaydetme ?? 0
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
      <Istatistik
        etiket="Toplam görüntülenme"
        deger={a ? sayi(toplam) : '—'}
        alt={ucretli ? degisim?.metin : 'Ücretsiz planda açık'}
        altTon={degisim?.ton}
      />
      <Istatistik
        etiket="Kaynak (QR / NFC / bağlantı)"
        kilitli={!ucretli}
        onKilit={onKilit}
        deger={a ? sayi((a.qr ?? 0) + (a.nfc ?? 0) + (a.baglanti ?? 0)) : '—'}
        alt={a ? `QR ${sayi(a.qr ?? 0)} · NFC ${sayi(a.nfc ?? 0)} · Bağlantı ${sayi(a.baglanti ?? 0)}` : undefined}
      />
      <Istatistik
        etiket="Rehbere kaydeden"
        kilitli={!ucretli}
        onKilit={onKilit}
        deger={a ? sayi(rehber) : '—'}
        alt={toplam ? `%${(Math.round((rehber / toplam) * 1000) / 10).toLocaleString('tr-TR')} dönüşüm` : undefined}
      />
      <Istatistik
        etiket="Bağlantı tıklama"
        kilitli={!ucretli}
        onKilit={onKilit}
        deger={a ? sayi(a.baglanti_tiklama ?? 0) : '—'}
        alt={enCok ? `En çok: ${enCok.ad || enCok.platform}` : undefined}
      />
    </div>
  )
}

function Lejant() {
  return (
    <div className="flex items-center gap-4 text-xs text-metin-2">
      <span className="inline-flex items-center gap-1.5"><span className="w-3 h-[3px] rounded-full bg-aksan" aria-hidden="true" />Toplam</span>
      <span className="inline-flex items-center gap-1.5"><span className="w-3 h-[3px] rounded-full bg-vurgu" aria-hidden="true" />QR / NFC</span>
    </div>
  )
}

// ------------------------------------------------------------- grafik (saf SVG)
// Y ekseni için "yuvarlak" üst sınır: 0, 5, 10, 15 gibi okunur çizgiler.
function eksenUstu(max) {
  if (max <= 3) return 3
  const kaba = max / 3
  const us = Math.pow(10, Math.floor(Math.log10(kaba)))
  // Adımlar tam sayı kalsın: eksen yazıları 0, 2, 4, 6 gibi okunur.
  const adim = [1, 2, 5, 10].map((c) => c * us).find((c) => c >= kaba)
  return adim * 3
}

function CizgiGrafik({ gunler, ikinci, etiket }) {
  const kutu = useRef(null)
  const [gen, setGen] = useState(640)
  useEffect(() => {
    const el = kutu.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(([g]) => setGen(Math.max(260, Math.round(g.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const Y = 170, SOL = 34, ALT = 22, UST = 8, SAG = 8
  const max = eksenUstu(Math.max(0, ...gunler.map((g) => g.toplam)))
  const n = gunler.length
  const x = (i) => SOL + (n <= 1 ? 0 : (i * (gen - SOL - SAG)) / (n - 1))
  const y = (v) => UST + (1 - v / max) * (Y - UST - ALT)
  const yol = (alan) => gunler.map((g, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(alan(g)).toFixed(1)}`).join(' ')
  const cizgiler = [0, 1, 2, 3].map((k) => (max / 3) * k)
  const etiketSayisi = Math.max(2, Math.min(6, Math.floor(gen / 120)))
  const etiketler = useMemo(() => {
    if (n <= 1) return [0]
    const adim = (n - 1) / (etiketSayisi - 1)
    return [...new Set(Array.from({ length: etiketSayisi }, (_, i) => Math.round(i * adim)))]
  }, [n, etiketSayisi])
  const toplam = gunler.reduce((t, g) => t + g.toplam, 0)

  return (
    <div ref={kutu} className="w-full">
      {toplam === 0 && (
        <p className="text-[13px] text-metin-2 mb-1">Bu aralıkta henüz görüntülenme yok. Kartınızı paylaştıkça çizgi burada oluşur.</p>
      )}
      <svg width={gen} height={Y} viewBox={`0 0 ${gen} ${Y}`} role="img" aria-label={`${etiket}; toplam ${toplam}`} className="block max-w-full">
        <g className="stroke-yuzey-2" strokeWidth="1">
          {cizgiler.map((v) => <line key={v} x1={SOL} x2={gen - SAG} y1={y(v)} y2={y(v)} />)}
        </g>
        <g className="fill-metin-2" fontSize="11">
          {cizgiler.map((v) => <text key={v} x={SOL - 8} y={y(v) + 4} textAnchor="end">{Math.round(v)}</text>)}
          {etiketler.map((i) => (
            <text key={i} x={x(i)} y={Y - 4} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{tarihKisa(gunler[i].gun)}</text>
          ))}
        </g>
        {ikinci && <path d={yol((g) => Math.min(g.toplam, g.qr + g.nfc))} fill="none" className="stroke-vurgu" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />}
        <path d={yol((g) => g.toplam)} fill="none" className="stroke-aksan" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {/* Nokta başına görünmez hedef: üstüne gelince gün ve sayı okunur. */}
        {gunler.map((g, i) => (
          <circle key={i} cx={x(i)} cy={y(g.toplam)} r={n > 45 ? 3 : 5} className="fill-aksan opacity-0 hover:opacity-100">
            <title>{`${tarihKisa(g.gun)}: ${g.toplam} görüntülenme${ikinci ? ` (QR/NFC ${g.qr + g.nfc})` : ''}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  )
}

// ------------------------------------------------------------- ayrıntı (ücretli)
function Ayrinti({ sonuc, gunSayisi }) {
  const baglantilar = sonuc.baglantilar.filter((b) => b.toplam > 0)
  const enYuksek = Math.max(1, ...baglantilar.map((b) => b.toplam))
  return (
    <Kart className="p-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className="flex flex-col gap-3 min-w-0" aria-labelledby="o-hareket">
        <h2 id="o-hareket" className="font-baslik text-[16px] font-bold">Son hareketler · son {gunSayisi} gün</h2>
        {sonuc.sonHareketler.length === 0 ? (
          <BosDurum ikon={BarChart3} baslik="Bu aralıkta hareket yok" aciklama="Kartınız görüntülendiğinde, bağlantılarınıza tıklandığında burada görünür." className="py-6" />
        ) : (
          <Tablo>
            <thead><tr><Th>Zaman</Th><Th>Kanal</Th><Th>Eylem</Th></tr></thead>
            <tbody>
              {sonuc.sonHareketler.map((e, i) => (
                <tr key={`${e.created_at}-${i}`}>
                  <Td className="whitespace-nowrap text-metin-2">
                    {new Date(e.created_at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </Td>
                  <Td>{KANAL[e.source] ? <Rozet ton={e.source === 'nfc' ? 'vurgu' : e.source === 'qr' ? 'aksan' : 'notr'}>{KANAL[e.source]}</Rozet> : <span className="text-metin-2">—</span>}</Td>
                  <Td>{eylemMetni(e)}</Td>
                </tr>
              ))}
            </tbody>
          </Tablo>
        )}
        <p className="text-xs text-metin-2">Ziyaretçiler anonimdir; kimlik yalnızca kişi size kendi bilgisini bırakırsa Gelenler&apos;de görünür.</p>
      </section>

      <section className="flex flex-col gap-3 min-w-0" aria-labelledby="o-baglanti">
        <h2 id="o-baglanti" className="font-baslik text-[16px] font-bold">Bağlantı performansı</h2>
        {baglantilar.length === 0 ? (
          <p className="text-[13px] text-metin-2">Bu aralıkta bağlantılarınıza tıklanmadı.</p>
        ) : (
          <ul className="flex flex-col gap-3 text-[13px]">
            {baglantilar.map((b, i) => (
              <li key={`${b.ad}-${i}`} className="flex flex-col gap-1.5">
                <div className="flex justify-between gap-3">
                  <span className={birlestir('truncate', !b.hala_var && 'text-metin-2')}>
                    {b.ad || b.platform || 'Bilinmeyen bağlantı'}{!b.hala_var && ' (kaldırıldı)'}
                  </span>
                  <b className="tabular-nums">{sayi(b.toplam)}</b>
                </div>
                <div className="h-2 rounded bg-yuzey-2 overflow-hidden" aria-hidden="true">
                  <span className="block h-full rounded bg-aksan" style={{ width: `${(b.toplam / enYuksek) * 100}%` }} />
                </div>
                {(b.qr > 0 || b.nfc > 0) && (
                  <span className="text-xs text-metin-2">QR ile {sayi(b.qr)} · NFC ile {sayi(b.nfc)}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </Kart>
  )
}

// Kilitli alanın arkasındaki bulanık görünüm: yalnızca iskelet, örnek veri yok.
function AyrintiIskeleti() {
  return (
    <div className="p-5 grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] min-h-[360px]">
      <div className="flex flex-col gap-3">
        <span className="h-4 w-40 rounded bg-cizgi" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="grid grid-cols-4 gap-4 py-3 border-b border-cizgi/70">
            <span className="h-3 rounded bg-yuzey-2" /><span className="h-3 rounded bg-yuzey-2 w-2/3" />
            <span className="h-3 rounded bg-yuzey-2 w-3/4" /><span className="h-3 rounded bg-yuzey-2" />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        <span className="h-4 w-36 rounded bg-cizgi" />
        {[90, 48, 28].map((w) => (
          <div key={w} className="flex flex-col gap-2">
            <span className="h-3 w-20 rounded bg-yuzey-2" />
            <span className="h-2 rounded bg-aksan/40" style={{ width: `${w}%` }} />
          </div>
        ))}
      </div>
    </div>
  )
}
