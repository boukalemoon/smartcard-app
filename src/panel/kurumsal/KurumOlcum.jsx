// KURUM — Ölçüm (tasarım: KurumOlcum)
//
// Kaynak: org_member_analytics (üye bazında toplam) + org_activity_series
// (günlük seri). Üyelikten önceki hareketler sunucuda zaten dışarıda kalır.
// Dizin ziyareti ve form görüntülenme henüz ölçülmüyor: "Yakında".
import { useCallback, useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useAdimAtlama } from '../../hooks/useAdimAtlama'
import { exportToCSV } from '../../utils/exportHelpers'
import { Kart, Dugme, Rozet, Avatar, Istatistik, Segment, Secim, BosDurum, Yukleniyor } from '../ui'
import { sayi, yuzde, birlestir } from '../bicim'
import { useVeri, rpc, gunOnce, dizinAcikMi } from './veri'
import { SayfaBas, KartBas, RolRozeti, Sayfalama, UyeDetayi } from './ortak'

const BOYUT = 25
const ay = (d) => d.toLocaleDateString('tr-TR', { month: 'short' })
const gunAy = (d) => d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })
const gunCoz = (s) => { const [y, m, g] = String(s).slice(0, 10).split('-').map(Number); return new Date(y, m - 1, g) }

// "12–18 Eyl", "26 Eyl–2 Eki", "12 Eki"
function aralikEtiketi(a, b) {
  if (a.getTime() === b.getTime()) return gunAy(a)
  if (a.getMonth() === b.getMonth()) return `${a.getDate()}–${b.getDate()} ${ay(b)}`
  return `${gunAy(a)}–${gunAy(b)}`
}

// Seriyi sondan geriye 7 günlük (7 günlük dönemde 1 günlük) kovalara böler:
// en yeni kova her zaman tam olur, kısmi kova en başta kalır.
function kovala(seri, boy) {
  const g = [...(seri || [])].sort((x, y) => String(x.gun).localeCompare(String(y.gun)))
  const kovalar = []
  for (let son = g.length; son > 0; son -= boy) {
    const parca = g.slice(Math.max(0, son - boy), son)
    const t = parca.reduce((a, r) => ({
      gor: a.gor + Number(r.profile_views || 0),
      qr: a.qr + Number(r.qr_views || 0),
      nfc: a.nfc + Number(r.nfc_views || 0),
    }), { gor: 0, qr: 0, nfc: 0 })
    const qr = Math.min(t.qr, t.gor)
    const nfc = Math.min(t.nfc, t.gor - qr)
    kovalar.unshift({ etiket: aralikEtiketi(gunCoz(parca[0].gun), gunCoz(parca[parca.length - 1].gun)), qr, nfc, bag: Math.max(0, t.gor - qr - nfc) })
  }
  return kovalar
}

// 0'dan başlayan "yuvarlak" eksen: 4 aralık
function eksenUst(maks) {
  if (maks <= 0) return 4
  const ham = maks / 4
  const kuvvet = 10 ** Math.floor(Math.log10(ham))
  const adim = [1, 2, 2.5, 5, 10].map((k) => k * kuvvet).find((k) => k >= ham)
  return adim * 4
}

function YiginGrafik({ kovalar, etiket }) {
  const ust = eksenUst(Math.max(0, ...kovalar.map((k) => k.qr + k.nfc + k.bag)))
  const X0 = 44, X1 = 560, Y0 = 180, Y1 = 20
  const y = (v) => Y0 - (v / ust) * (Y0 - Y1)
  const yuva = (X1 - X0) / kovalar.length
  const gen = Math.min(80, yuva * 0.62)
  const atla = kovalar.length > 8 ? 2 : 1
  return (
    <svg viewBox="0 0 560 204" width="100%" className="h-auto max-h-[220px] overflow-visible" role="img" aria-label={etiket}>
      <g className="stroke-cizgi" strokeWidth="1">
        {[0, 1, 2, 3, 4].map((i) => <line key={i} x1={X0 - 4} x2={X1} y1={y((ust / 4) * i)} y2={y((ust / 4) * i)} />)}
      </g>
      <g className="fill-metin-2" fontSize="11" textAnchor="end">
        {[0, 1, 2, 3, 4].map((i) => <text key={i} x={X0 - 10} y={y((ust / 4) * i) + 4}>{sayi((ust / 4) * i)}</text>)}
      </g>
      {kovalar.map((k, i) => {
        const x = X0 + yuva * i + (yuva - gen) / 2
        const yQr = y(k.qr), yNfc = y(k.qr + k.nfc), yBag = y(k.qr + k.nfc + k.bag)
        return (
          <g key={i}>
            <title>{`${k.etiket}: QR ${sayi(k.qr)}, NFC ${sayi(k.nfc)}, bağlantı ${sayi(k.bag)}`}</title>
            <rect x={x} y={yQr} width={gen} height={Y0 - yQr} className="fill-aksan" />
            <rect x={x} y={yNfc} width={gen} height={yQr - yNfc} className="fill-vurgu" />
            <rect x={x} y={yBag} width={gen} height={yNfc - yBag} className="fill-metin-2/40" />
            {i % atla === 0 && <text x={x + gen / 2} y={198} fontSize="11" textAnchor="middle" className="fill-metin-2">{k.etiket}</text>}
          </g>
        )
      })}
    </svg>
  )
}

function Lejant({ renk, children }) {
  return <span className="flex items-center gap-1.5"><i className={birlestir('w-2.5 h-2.5 rounded-sm inline-block', renk)} aria-hidden="true" />{children}</span>
}

function Kutu({ etiket, children }) {
  return (
    <div className="flex justify-between items-center gap-3 px-3 py-2.5 rounded-[10px] bg-zemin">
      <span>{etiket}</span>
      <b className="font-semibold tabular-nums">{children}</b>
    </div>
  )
}

export default function KurumOlcum({ kurum, bildir }) {
  const { adimAtla } = useAdimAtlama()
  const [gun, setGun] = useState(30)
  const [sira, setSira] = useState('total')
  const [sayfa, setSayfa] = useState(0)
  const [detayId, setDetayId] = useState(null)

  const aralik = useMemo(() => ({ from: gunOnce(gun - 1), to: new Date() }), [gun])

  const yukle = useCallback(async () => {
    const onceBas = gunOnce(2 * gun - 1)
    const onceSon = gunOnce(gun)
    onceSon.setDate(onceSon.getDate() - 1) // sunucu bitiş gününü kapsar
    const g = { p_org_id: kurum.id, p_from: aralik.from.toISOString(), p_to: aralik.to.toISOString() }
    const [analiz, seri, once, basvuru] = await Promise.all([
      rpc('org_member_analytics', g),
      rpc('org_activity_series', g),
      rpc('org_member_analytics', { p_org_id: kurum.id, p_from: onceBas.toISOString(), p_to: onceSon.toISOString() }).catch(() => []),
      kurum.is_stk
        ? supabase.from('applications').select('id, status, applied_at').eq('organization_id', kurum.id).gte('applied_at', aralik.from.toISOString())
          .then(({ data, error }) => { if (error) throw error; return data || [] })
        : [],
    ])
    return { analiz: analiz || [], seri: seri || [], once: once || [], basvuru }
  }, [kurum.id, kurum.is_stk, gun, aralik])
  const { veri, yukleniyor } = useVeri(yukle)

  const h = useMemo(() => {
    if (!veri) return null
    const top = (l, k) => l.reduce((t, u) => t + Number(u[k] || 0), 0)
    const gor = top(veri.analiz, 'profile_views')
    const qr = Math.min(top(veri.analiz, 'qr_views'), gor)
    const nfc = Math.min(top(veri.analiz, 'nfc_views'), gor - qr)
    const kartli = veri.analiz.filter((u) => u.has_account)
    return {
      gor, qr, nfc, bag: Math.max(0, gor - qr - nfc),
      oncekiGor: top(veri.once, 'profile_views'),
      rehber: top(veri.analiz, 'vcard_downloads'),
      tik: top(veri.analiz, 'link_clicks'),
      paylasim: top(veri.analiz, 'shares'),
      kartli,
      hesapsiz: veri.analiz.length - kartli.length,
      aktif: veri.analiz.filter((u) => u.status === 'active').length,
      kovalar: kovala(veri.seri, gun === 7 ? 1 : 7),
      basvuru: veri.basvuru.length,
      onay: veri.basvuru.filter((b) => b.status === 'approved').length,
    }
  }, [veri, gun])

  const satirlar = useMemo(() => {
    const l = [...(h?.kartli || [])]
    l.sort((a, b) => Number(b[sira] || 0) - Number(a[sira] || 0))
    return l
  }, [h, sira])
  const sayfaSay = Math.max(1, Math.ceil(satirlar.length / BOYUT))
  const gecerliSayfa = Math.min(sayfa, sayfaSay - 1)
  const gorunen = satirlar.slice(gecerliSayfa * BOYUT, (gecerliSayfa + 1) * BOYUT)
  const detay = veri?.analiz.find((u) => u.member_id === detayId) || null

  const raporIndir = async () => {
    if (!veri?.analiz.length) { bildir('Bu dönemde dışa aktarılacak veri yok.', 'error'); return }
    const tamam = await adimAtla({ sebep: 'Veri dışa aktarma', zorla: true })
    if (!tamam) return
    exportToCSV(veri.analiz.map((u) => ({
      'Kurum': kurum.name,
      'Ad Soyad': u.name || '-',
      'Rol': u.role === 'admin' ? 'Yönetici' : 'Üye',
      'Hesap': u.has_account ? 'Var' : 'Yok',
      'Katılım': u.joined_at ? new Date(u.joined_at).toLocaleDateString('tr-TR') : '-',
      'Görüntülenme': u.profile_views || 0,
      'QR ile': u.qr_views || 0,
      'NFC ile': u.nfc_views || 0,
      'Bağlantıyla': u.link_views || 0,
      'Doğrudan': u.direct_views || 0,
      'Rehbere kaydetme': u.vcard_downloads || 0,
      'Bağlantı tıklama': u.link_clicks || 0,
      'Paylaşım': u.shares || 0,
      'Toplam': u.total || 0,
      'Son hareket': u.last_activity ? new Date(u.last_activity).toLocaleDateString('tr-TR') : '-',
    })), `kurum_olcum_${gun}gun`)
  }

  const fark = h && h.oncekiGor > 0 ? (h.gor - h.oncekiGor) / h.oncekiGor : null
  const uyeBasina = h && kurum.member_count ? `üye başına ${sayi(Math.round(h.gor / kurum.member_count))}` : null
  const donem = `${gunAy(aralik.from)} – ${aralik.to.toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const grafikBaslik = gun === 7 ? 'Günlük görüntülenme, kaynağa göre' : 'Haftalık görüntülenme, kaynağa göre'

  return (
    <>
      <SayfaBas
        baslik="Kurum ölçümü"
        alt={`Üyelerin kartları toplamı · ${donem}`}
        sag={
          <>
            <Segment
              etiket="Tarih aralığı"
              deger={gun}
              onChange={(v) => { setGun(v); setSayfa(0) }}
              secenekler={[{ deger: 7, ad: '7 gün' }, { deger: 30, ad: '30 gün' }, { deger: 90, ad: '90 gün' }]}
            />
            <Dugme ikon={Download} onClick={raporIndir}>Rapor indir</Dugme>
          </>
        }
      />

      {!h ? (yukleniyor ? <Yukleniyor /> : <Kart className="p-5"><BosDurum baslik="Ölçüm alınamadı" aciklama="Bağlantınızı kontrol edip sayfayı yenileyin." /></Kart>) : (
        <>
          <div className={birlestir('grid grid-cols-2 lg:grid-cols-4 gap-3.5 transition-opacity', yukleniyor && 'opacity-60')}>
            <Istatistik
              etiket="Görüntülenme"
              deger={sayi(h.gor)}
              alt={[fark !== null && `${fark >= 0 ? '▲' : '▼'} ${yuzde(Math.abs(h.gor - h.oncekiGor), h.oncekiGor)}`, uyeBasina].filter(Boolean).join(' · ') || undefined}
              altTon={fark === null ? 'notr' : fark >= 0 ? 'olumlu' : 'tehlike'}
            />
            <Istatistik etiket="Rehbere kaydetme" deger={sayi(h.rehber)} alt={h.gor ? `${yuzde(h.rehber, h.gor)} dönüşüm` : undefined} />
            <Istatistik etiket="Bağlantı tıklama" deger={sayi(h.tik)} alt={`${sayi(h.paylasim)} paylaşım`} />
            <Istatistik
              etiket="Kaynak"
              deger={h.gor ? `QR ${Math.round((h.qr / h.gor) * 100)}` : '—'}
              birim={h.gor ? '%' : undefined}
              alt={h.gor ? `NFC ${yuzde(h.nfc, h.gor)} · bağlantı ${yuzde(h.bag, h.gor)}` : 'Bu dönemde görüntülenme yok'}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] gap-5">
            <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="ko-grafik">
              <KartBas
                id="ko-grafik"
                sag={
                  <div className="flex gap-3.5 text-xs text-metin-2">
                    <Lejant renk="bg-aksan">QR</Lejant>
                    <Lejant renk="bg-vurgu">NFC</Lejant>
                    <Lejant renk="bg-metin-2/40">Bağlantı</Lejant>
                  </div>
                }
              >
                {grafikBaslik}
              </KartBas>
              {h.gor === 0 ? (
                <BosDurum baslik="Bu dönemde görüntülenme yok" aciklama="Üyelerin kartları açıldıkça QR, NFC ve bağlantı kaynakları burada ayrışır." />
              ) : (
                <YiginGrafik kovalar={h.kovalar} etiket={`${grafikBaslik}: QR, NFC ve bağlantı kaynaklı görüntülenme yığılı sütun grafiği`} />
              )}
              <p className="text-xs text-metin-2">
                Üyelikten önceki hareketler rapora girmez. QR ve NFC ayrımı, kod ve karta gömülü kaynak parametresinden gelir; parametre taşımayan açılışlar “bağlantı” sayılır.
              </p>
            </Kart>

            <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="ko-dizin">
              <KartBas id="ko-dizin">{kurum.is_stk ? 'Üye dizini ve başvuru formu' : 'Rapor kapsamı'}</KartBas>
              <div className="flex flex-col gap-3 text-[13px]">
                {kurum.is_stk && (
                  <>
                    <Kutu etiket="Dizin ziyareti"><Rozet>Yakında</Rozet></Kutu>
                    <Kutu etiket="Dizinde listelenen üye">{dizinAcikMi(kurum) ? sayi(h.aktif) : 'Dizin kapalı'}</Kutu>
                    <Kutu etiket="Form görüntülenme"><Rozet>Yakında</Rozet></Kutu>
                    <Kutu etiket="Başvuru → onay">{sayi(h.basvuru)} → {sayi(h.onay)}</Kutu>
                  </>
                )}
                {!kurum.is_stk && (
                  <>
                    <Kutu etiket="Rapora giren üye">{sayi(h.kartli.length)}</Kutu>
                    <Kutu etiket="Aktif üye">{sayi(h.aktif)}</Kutu>
                  </>
                )}
              </div>
              <div className="border-t border-cizgi/70 pt-3 text-[13px] flex flex-col gap-1.5">
                <b className="font-semibold">QRtım hesabı olmayan üyeler</b>
                <span className="text-metin-2">
                  {h.hesapsiz > 0
                    ? `${sayi(h.hesapsiz)} üyenin QRtım hesabı yok; rapora katkıları sıfır. Hesap açıp kuruma katıldıklarında hareketleri buraya eklenir.`
                    : 'Tüm üyelerin QRtım hesabı var; hepsi rapora giriyor.'}
                </span>
              </div>
            </Kart>
          </div>

          <Kart className="overflow-hidden" aria-labelledby="ko-uye">
            <div className="flex justify-between items-center gap-3 flex-wrap px-5 pt-4 pb-3">
              <h2 id="ko-uye" className="font-baslik text-base font-bold">Üye performansı</h2>
              <label className="flex items-center gap-2 text-xs text-metin-2">
                Sırala:
                <Secim etiket="Sıralama" value={sira} onChange={(v) => { setSira(v); setSayfa(0) }} className="h-8 text-xs">
                  <option value="total">Toplam etkileşim</option>
                  <option value="profile_views">Görüntülenme</option>
                  <option value="vcard_downloads">Rehbere kayıt</option>
                  <option value="link_clicks">Tıklama</option>
                </Secim>
              </label>
            </div>
            {gorunen.length === 0 ? (
              <BosDurum baslik="Kartlı üye yok" aciklama="QRtım hesabı olan üyeler kuruma katıldığında performansları burada listelenir." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-[13.5px]">
                  <thead>
                    <tr>
                      <OTh>Üye</OTh><OTh>Rol</OTh><OTh sag>Görüntülenme</OTh><OTh sag>QR</OTh><OTh sag>NFC</OTh>
                      <OTh sag>Rehbere kayıt</OTh><OTh sag>Tıklama</OTh><OTh sag>Toplam</OTh><OTh><span className="sr-only">İşlem</span></OTh>
                    </tr>
                  </thead>
                  <tbody>
                    {gorunen.map((u) => (
                      <tr key={u.member_id} className="hover:bg-yuzey-2/50">
                        <OTd><div className="flex items-center gap-2.5 min-w-[180px]"><Avatar ad={u.name} url={u.avatar_url} boyut={32} /><b className="font-semibold truncate">{u.name}</b></div></OTd>
                        <OTd><RolRozeti rol={u.role} /></OTd>
                        <OTd sag>{sayi(u.profile_views)}</OTd>
                        <OTd sag>{sayi(u.qr_views)}</OTd>
                        <OTd sag>{sayi(u.nfc_views)}</OTd>
                        <OTd sag>{sayi(u.vcard_downloads)}</OTd>
                        <OTd sag>{sayi(u.link_clicks)}</OTd>
                        <OTd sag><b className="font-semibold">{sayi(u.total)}</b></OTd>
                        <OTd sag><Dugme boyut="k" tur="sessiz" onClick={() => setDetayId(u.member_id)} aria-label={`${u.name} ayrıntısı`}>Detay</Dugme></OTd>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {satirlar.length > 0 && <Sayfalama sayfa={gecerliSayfa} toplam={satirlar.length} boyut={BOYUT} onSayfa={setSayfa} ek=" kartlı üye" />}
          </Kart>
        </>
      )}

      <UyeDetayi kurum={kurum} uye={detay} aralik={aralik} onKapat={() => setDetayId(null)} />
    </>
  )
}

function OTh({ children, sag }) {
  return <th className={birlestir('px-3.5 py-2.5 text-[11px] font-semibold tracking-[.06em] uppercase text-metin-2 bg-yuzey-2/50 border-y border-cizgi whitespace-nowrap', sag ? 'text-right' : 'text-left')}>{children}</th>
}
function OTd({ children, sag }) {
  return <td className={birlestir('px-3.5 py-[11px] border-b border-cizgi/70 align-middle', sag && 'text-right tabular-nums')}>{children}</td>
}
