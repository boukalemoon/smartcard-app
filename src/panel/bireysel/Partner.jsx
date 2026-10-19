// Partner programı (tasarım: PanelPartner).
//
// Partner = referans programı: kodla gelen kişi/kurumların ücretli
// ödemelerinden hak ediş. Oran metinde yazar ama burada HESAPLANMAZ;
// tutarlar sunucudaki komisyon kaydından gelir (my_referrals).
//
// Komisyon tablosu (bekleyen/onaylanan/ödenen ayrımı) sahibine açık değil,
// bu yüzden o kırılımlar "—" ile gösterilir; yalnızca toplam gerçek.
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Users } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { signupUrl } from '../../lib/siteUrl'
import { Kart, KartBaslik, SayfaBaslik, Dugme, Rozet, Istatistik, Avatar, Tablo, Th, Td, BosDurum, Yukleniyor } from '../ui'
import { tarih, tl, sayi, birlestir } from '../bicim'

const yakindaSinif = 'ml-1 inline-flex items-center h-[18px] px-1.5 rounded-full text-[10px] font-semibold'

// "TR12 3456 … 78" — IBAN'ın tamamı ekranda durmasın.
function ibanMaskele(iban) {
  const t = String(iban || '').replace(/\s/g, '')
  if (t.length < 8) return t
  return `${t.slice(0, 4)} ${t.slice(4, 8)} … ${t.slice(-2)}`
}

function kayitTarihi(d) {
  if (!d) return '—'
  return new Date(d).toDateString() === new Date().toDateString() ? 'bugün' : tarih(d)
}

function KodKarti({ kod, baglanti, showToast }) {
  const [qr, setQr] = useState(null)

  useEffect(() => {
    if (!baglanti) return
    let iptal = false
    QRCode.toDataURL(baglanti, { width: 512, margin: 1, errorCorrectionLevel: 'M', color: { dark: '#162349', light: '#FFFFFF' } })
      .then((url) => { if (!iptal) setQr(url) })
      .catch(() => {})
    return () => { iptal = true }
  }, [baglanti])

  const kopyala = async (metin, mesaj) => {
    try { await navigator.clipboard.writeText(metin); showToast(mesaj, 'success') }
    catch { showToast('Kopyalanamadı; elle seçip kopyalayın.', 'error') }
  }

  const paylasimMetni = `QRtım'a benim partner kodumla katılın: ${baglanti}`
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(paylasimMetni)}`
  const linkedin = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(baglanti)}`
  const eposta = `mailto:?subject=${encodeURIComponent('QRtım daveti')}&body=${encodeURIComponent(paylasimMetni)}`

  return (
    <Kart koyu className="p-5 flex flex-col gap-4" aria-labelledby="p-kod">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <h2 id="p-kod" className="font-baslik text-[17px] font-bold leading-tight">Partner kodunuz</h2>
        {kod && <span className="inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold bg-white/10 text-lacivert-100">Aktif</span>}
      </div>
      {!kod ? (
        <p className="text-sm text-lacivert-200">Kodunuz hazırlanıyor…</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_132px] gap-4 items-center">
          <div className="flex flex-col gap-2.5 min-w-0">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-[28px] font-semibold tracking-[.06em] break-all">{String(kod.code).toLocaleUpperCase('en-US')}</span>
              <Dugme boyut="k" tur="koyuIkincil" onClick={() => kopyala(String(kod.code).toLocaleUpperCase('en-US'), 'Kod kopyalandı')}>Kopyala</Dugme>
            </div>
            <div className="flex items-center h-10 rounded-[10px] border border-white/15 bg-white/5 overflow-hidden">
              <span className="flex-1 min-w-0 px-3 font-mono text-xs text-lacivert-200 truncate">{baglanti.replace(/^https?:\/\//, '')}</span>
              <button type="button" onClick={() => kopyala(baglanti, 'Bağlantı kopyalandı')} className="h-full px-3.5 border-l border-white/15 bg-white/10 hover:bg-white/15 text-[13px] font-semibold text-white whitespace-nowrap">Bağlantıyı kopyala</button>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Dugme as="a" href={whatsapp} target="_blank" rel="noopener noreferrer" boyut="k" tur="beyaz" className="h-9">WhatsApp</Dugme>
              <Dugme as="a" href={linkedin} target="_blank" rel="noopener noreferrer" boyut="k" tur="koyuIkincil" className="h-9">LinkedIn</Dugme>
              <Dugme as="a" href={eposta} boyut="k" tur="koyuIkincil" className="h-9">E-posta</Dugme>
              <Dugme boyut="k" tur="koyuIkincil" className="h-9" disabled title="Yakında">
                Karta partner bloğu ekle<span className={birlestir(yakindaSinif, 'bg-white/15 text-lacivert-100')}>Yakında</span>
              </Dugme>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1.5">
            <span className="w-[120px] h-[120px] rounded-[10px] bg-white p-2 inline-flex items-center justify-center">
              {qr ? <img src={qr} alt="Partner bağlantısı QR kodu" className="w-full h-full" /> : <span className="text-[11px] text-lacivert-700">QR hazırlanıyor</span>}
            </span>
            {qr && (
              <a href={qr} download={`qrtim-partner-${kod.code}.png`} className="text-xs font-semibold text-lacivert-200 hover:text-white hover:underline">PNG indir</a>
            )}
          </div>
        </div>
      )}
    </Kart>
  )
}

function OdemeKarti({ ctx }) {
  const hesap = ctx.profile?.bank_accounts?.[0]
  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="p-odeme">
      <KartBaslik id="p-odeme" baslik="Hak ediş ödemesi" />
      <dl className="flex flex-col gap-2 text-[13px]">
        <div className="flex justify-between gap-3">
          <dt className="text-metin-2 shrink-0">Ödeme hesabı</dt>
          <dd className="font-semibold text-right min-w-0">
            {hesap?.iban
              ? <><span className="font-mono">{ibanMaskele(hesap.iban)}</span>{hesap.account_holder && <span> · {hesap.account_holder}</span>}</>
              : <span className="text-metin-2 font-normal">Kayıtlı IBAN yok</span>}
          </dd>
        </div>
        <div className="flex justify-between gap-3">
          <dt className="text-metin-2 shrink-0">Dönem</dt>
          <dd className="font-semibold text-right">Aylık, tamamlanmış ay için</dd>
        </div>
      </dl>
      <div className="flex gap-2 flex-wrap">
        {hesap
          ? <Dugme boyut="k" onClick={() => ctx.bankaDuzenle(hesap, 0)}>IBAN'ı değiştir</Dugme>
          : <Dugme boyut="k" tur="ana" onClick={() => ctx.bankaDuzenle()}>IBAN ekle</Dugme>}
        <Dugme boyut="k" tur="sessiz" disabled title="Yakında">Ödeme geçmişi<span className={birlestir(yakindaSinif, 'bg-yuzey-2 text-metin-2')}>Yakında</span></Dugme>
      </div>
      <p className="text-xs text-metin-2">Hak ediş, yönlendirdiğiniz hesabın ödemesi onaylandıktan sonra "onaylanan"a geçer; iade edilen ödemelerin hak edişi düşülür.</p>
    </Kart>
  )
}

const ODEME_DURUM = {
  pending: 'Bekliyor', approved: 'Onaylandı', paid: 'Ödendi', rejected: 'Reddedildi',
}

function DurumRozeti({ r }) {
  if (r.suruyor) return <Rozet ton="aksan">Aboneliği sürüyor</Rozet>
  if (r.toplam > 0) return <Rozet ton="notr">Abonelik bitti</Rozet>
  return <Rozet ton="uyari">Kayıt oldu</Rozet>
}

// my_referral_tracking ve my_referrals satırlarını TEK biçime indirir.
// Yedek yol my_referrals: sunucu güncellemesi dağıtımdan sonra uygulanırsa
// panel arada bozuk görünmesin (sosyal görünümde bunun maliyetini gördük).
// Yedek yolda yenileme bilgisi YOK — uydurmuyoruz, alan boş kalıyor.
function satirlariDuzle(takip, eski) {
  if (takip?.ok) {
    return (takip.davetler || []).map((d) => ({
      id: d.davet_id,
      ad: d.ad,
      hesapSilinmis: d.hesap_silinmis,
      tarih: d.davet_tarihi,
      plan: d.plan,
      suruyor: d.suruyor,
      yenileme: d.yenileme,
      toplam: Number(d.toplam_hakedis || 0),
      odemeler: d.odemeler || [],
    }))
  }
  return (eski || []).map((r) => ({
    id: r.id,
    ad: r.davetli_adi,
    hesapSilinmis: r.hesap_silinmis,
    tarih: r.created_at,
    plan: null,
    suruyor: r.status === 'active',
    yenileme: null,
    toplam: Number(r.commission_amount || 0),
    odemeler: [],
  }))
}

export default function Partner({ ctx }) {
  const [kod, setKod] = useState(null)
  const [liste, setListe] = useState(null)
  const [ozet, setOzet] = useState(null)
  const [yenilemeYok, setYenilemeYok] = useState(false)
  const [hata, setHata] = useState(false)
  const [filtre, setFiltre] = useState('tumu')
  const [acik, setAcik] = useState(null)

  useEffect(() => {
    let iptal = false
    supabase.rpc('get_or_create_referral_code').then(({ data, error }) => {
      if (iptal) return
      if (error || !data?.ok) { setHata(true); return }
      setKod(data)
    })
    supabase.rpc('my_referral_tracking').then(async ({ data, error }) => {
      if (iptal) return
      if (!error && data?.ok) {
        setListe(satirlariDuzle(data, null))
        setOzet(data.ozet || null)
        return
      }
      // Yedek: yenileme takibi henüz canlıda değil.
      setYenilemeYok(true)
      const { data: e, error: eHata } = await supabase.rpc('my_referrals')
      if (iptal) return
      if (eHata) setHata(true)
      setListe(satirlariDuzle(null, Array.isArray(e) ? e : []))
    })
    return () => { iptal = true }
  }, [])

  const baglanti = kod?.code ? signupUrl(kod.code) : ''
  const tum = liste || []
  const suren = tum.filter((r) => r.suruyor)
  const toplam = ozet ? Number(ozet.toplam_hakedis || 0) : tum.reduce((t, r) => t + r.toplam, 0)
  // Ödeme satırlarından kırılım: bekleyen (pending) ve ödenmiş (paid).
  const odemeSatirlari = tum.flatMap((r) => r.odemeler)
  const topla = (d) => odemeSatirlari.filter((o) => o.durum === d).reduce((t, o) => t + Number(o.tutar || 0), 0)
  const bekleyen = topla('pending')
  const odenmis = topla('paid')
  const gorunen = filtre === 'ucretli' ? suren : tum

  return (
    <>
      <SayfaBaslik
        baslik="Partner programı"
        alt={<span className="block max-w-[720px] text-sm">Partner kodunuzla gelen her kullanıcı ve kurumun ücretli ödemelerinden <b className="text-metin">%10 hak ediş</b> kazanırsınız; ödeme gerçekleştikçe hesabınıza yazılır, aylık olarak kayıtlı IBAN'ınıza aktarılır.</span>}
        sag={<span className="text-[13px] font-semibold text-metin-2 whitespace-nowrap">Program koşulları<span className={birlestir(yakindaSinif, 'bg-yuzey-2 text-metin-2')}>Yakında</span></span>}
      />

      {hata && <p role="alert" className="text-[13px] text-red-700 dark:text-red-300">Partner bilgileri tam yüklenemedi. Sayfayı yenileyip tekrar deneyin.</p>}

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-5 items-start">
        <KodKarti kod={kod} baglanti={baglanti} showToast={ctx.showToast} />
        <OdemeKarti ctx={ctx} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Istatistik etiket="Partner kodunuzla gelen" deger={liste ? sayi(tum.length) : '—'} alt={liste ? `${sayi(suren.length)} aboneliği sürüyor` : null} />
        <Istatistik
          etiket="30 günde yenilenecek"
          deger={ozet ? sayi(ozet.yakinda_yenilenen) : '—'}
          alt={ozet ? 'Yenilenirse hak ediş yeniden yazılır' : 'Yenileme takibi hazırlanıyor'}
        />
        <Istatistik etiket="Bekleyen hak ediş" deger={liste ? tl(bekleyen) : '—'} alt={odenmis > 0 ? `${tl(odenmis)} ödendi` : 'Henüz ödeme aktarımı yok'} />
        <Istatistik etiket="Hak ediş · toplam" deger={liste ? tl(toplam) : '—'} alt="Kayıtlı hak edişlerin toplamı" altTon="aksan" />
      </div>

      <Kart className="p-0 overflow-hidden" aria-labelledby="p-liste">
        <div className="flex items-center justify-between gap-2.5 flex-wrap px-5 pt-4 pb-3">
          <h2 id="p-liste" className="font-baslik text-[17px] font-bold leading-tight">Yönlendirdikleriniz</h2>
          <div className="flex gap-1.5" role="group" aria-label="Liste filtresi">
            <Dugme boyut="k" tur={filtre === 'tumu' ? 'ikincil' : 'sessiz'} aria-pressed={filtre === 'tumu'} onClick={() => setFiltre('tumu')}>Tümü</Dugme>
            <Dugme boyut="k" tur={filtre === 'ucretli' ? 'ikincil' : 'sessiz'} aria-pressed={filtre === 'ucretli'} onClick={() => setFiltre('ucretli')}>Aboneliği sürenler</Dugme>
          </div>
        </div>
        {liste === null ? (
          <Yukleniyor />
        ) : gorunen.length === 0 ? (
          <BosDurum
            ikon={Users}
            baslik={filtre === 'ucretli' && tum.length ? 'Aboneliği süren kimse yok' : 'Henüz yönlendirme yok'}
            aciklama="Bağlantınızla kayıt olanlar burada listelenir; ücretli pakete geçtiklerinde hak edişiniz yazılır."
          />
        ) : (
          <Tablo>
            <thead>
              <tr><Th>Ad</Th><Th>Kayıt</Th><Th>Durum</Th><Th>Yenileme</Th><Th sag>Hak ediş · %10</Th></tr>
            </thead>
            <tbody>
              {gorunen.map((r) => {
                const genis = acik === r.id
                const dokumVar = r.odemeler.length > 0
                return [
                  <tr
                    key={r.id}
                    className={dokumVar ? 'cursor-pointer hover:bg-yuzey-2/50' : undefined}
                    onClick={dokumVar ? () => setAcik(genis ? null : r.id) : undefined}
                  >
                    <Td>
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar ad={r.ad} boyut={32} />
                        <div className="min-w-0">
                          <b className="block truncate">{r.ad}</b>
                          {r.hesapSilinmis && <span className="text-xs text-metin-2">Hesabını sildi</span>}
                          {dokumVar && (
                            <span className="text-xs text-metin-2">
                              {sayi(r.odemeler.length)} ödeme · {genis ? 'kapat' : 'dökümü aç'}
                            </span>
                          )}
                        </div>
                      </div>
                    </Td>
                    <Td className="text-metin-2 whitespace-nowrap">{kayitTarihi(r.tarih)}</Td>
                    <Td><DurumRozeti r={r} /></Td>
                    <Td className="text-metin-2 whitespace-nowrap">
                      {r.yenileme ? kayitTarihi(r.yenileme) : '—'}
                    </Td>
                    <Td sag className={r.toplam > 0 ? 'font-semibold' : 'text-metin-2'}>{r.toplam > 0 ? tl(r.toplam) : '—'}</Td>
                  </tr>,
                  genis ? (
                    <tr key={r.id + '-odeme'}>
                      <Td colSpan={5} className="bg-yuzey-2/60">
                        <div className="flex flex-col gap-1.5 py-1">
                          {r.odemeler.map((o, i) => (
                            <div key={i} className="flex justify-between gap-3 text-xs">
                              <span className="text-metin-2">{kayitTarihi(o.tarih)}</span>
                              <span className="text-metin-2">{ODEME_DURUM[o.durum] || o.durum}</span>
                              <b className="tabular-nums">{tl(Number(o.tutar || 0))}</b>
                            </div>
                          ))}
                        </div>
                      </Td>
                    </tr>
                  ) : null,
                ]
              })}
            </tbody>
          </Tablo>
        )}
        <p className="px-5 py-3 text-xs text-metin-2 border-t border-cizgi/70">
          Yönlendirdiğiniz kişilerin kart verisini, e-postasını ve ödediği tutarı görmezsiniz; yalnızca ad,
          kayıt tarihi, abonelik durumu, yenileme tarihi ve KENDİ hak edişiniz listelenir.
          {yenilemeYok && ' Yenileme takibi için sunucu güncellemesi bekleniyor.'}
        </p>
      </Kart>
    </>
  )
}
