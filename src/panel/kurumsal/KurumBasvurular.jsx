// KURUM — Başvurular (tasarım: KurumBasvurular)
//
// Başvuru formu bugün dört alan topluyor (ad, e-posta, telefon, mesaj);
// ayrıntı panelinde yalnızca bunlar gösterilir. Tasarımdaki "yönetici notu"
// ve "hoş geldin e-postası" için arka uç yok, bu yüzden konmadı.
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ArrowLeft, Inbox } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { Kart, Dugme, Rozet, Avatar, Segment, BosDurum, Yukleniyor } from '../ui'
import { sayi, tarih, saat, birlestir } from '../bicim'
import { useVeri, kurumAdresi, kisaAdres, kisaYas, gunOnce, basvuruSonuclandir } from './veri'
import { SayfaBas, OnayPenceresi } from './ortak'

const DURUM = {
  pending: { ad: 'Bekliyor', ton: 'uyari' },
  approved: { ad: 'Onaylandı', ton: 'olumlu' },
  rejected: { ad: 'Reddedildi', ton: 'tehlike' },
}

// "bugün 09:14", "dün 18:02", "12 Eki 2026 09:14"
function zamanMetni(d) {
  if (!d) return ''
  const y = kisaYas(d)
  return `${y === 'bugün' || y === 'dün' ? y : tarih(d)} ${saat(d)}`
}

export default function KurumBasvurular({ kurum, bildir, yenileKurumlar }) {
  const [arama, setArama] = useSearchParams()
  const [sekme, setSekme] = useState('pending')
  const [onay, setOnay] = useState(null)
  const [islenen, setIslenen] = useState(null)

  const yukle = useCallback(async () => {
    const { data, error } = await supabase
      .from('applications')
      .select('*')
      .eq('organization_id', kurum.id)
      .order('applied_at', { ascending: false })
    if (error) throw error
    return data || []
  }, [kurum.id])
  const { veri: hepsi, yukleniyor, yenile } = useVeri(yukle)

  const sayilar = useMemo(() => {
    const l = hepsi || []
    const son30 = l.filter((b) => new Date(b.applied_at) >= gunOnce(29))
    return {
      pending: l.filter((b) => b.status === 'pending').length,
      son30: son30.length,
      onay30: son30.filter((b) => b.status === 'approved').length,
    }
  }, [hepsi])

  // Bekleyenlerde en eski üstte (sırası gelen önce); sonuçlananlarda en yeni üstte.
  const liste = useMemo(() => {
    const l = (hepsi || []).filter((b) => b.status === sekme)
    return sekme === 'pending' ? [...l].sort((a, b) => new Date(a.applied_at) - new Date(b.applied_at)) : l
  }, [hepsi, sekme])

  const istenenId = arama.get('basvuru')
  // Adresteki başvuru başka sekmedeyse o sekmeyi göster.
  const istenen = (hepsi || []).find((b) => b.id === istenenId)
  const aktifSekme = istenen ? istenen.status : sekme
  const gorunenListe = istenen && istenen.status !== sekme ? (hepsi || []).filter((b) => b.status === istenen.status) : liste
  const secili = istenen || gorunenListe[0] || null

  const basvuruSec = (id) => setArama((o) => { const n = new URLSearchParams(o); n.set('basvuru', id); return n })
  const listeyeDon = () => setArama((o) => { const n = new URLSearchParams(o); n.delete('basvuru'); return n })
  const sekmeSec = (s) => { setSekme(s); listeyeDon() }

  const karar = async (b, k) => {
    setIslenen(b.id)
    try {
      const s = await basvuruSonuclandir(b.id, k)
      if (k === 'approved') {
        bildir(s.hesap_bagli
          ? `${b.applicant_name} QRtım hesabıyla üye olarak eklendi.`
          : `${b.applicant_name} üye olarak eklendi. QRtım hesabı olmadığı için üye kaydı başvuru bilgileriyle açıldı.`, 'success')
      } else {
        bildir('Başvuru reddedildi.', 'success')
      }
      listeyeDon()
      yenile()
      yenileKurumlar()
    } catch (e) {
      bildir(e.message, 'error')
    } finally {
      setIslenen(null)
    }
  }

  const reddet = (b) => setOnay({
    baslik: 'Başvuruyu reddet',
    mesaj: `${b.applicant_name} adlı kişinin başvurusu reddedilecek. Kişiye otomatik bildirim gitmez; isterseniz e-postayla siz haber verin.`,
    onay: 'Reddet',
    tehlike: true,
    onEvet: () => karar(b, 'rejected'),
  })

  if (!kurum.is_stk) {
    return (
      <>
        <SayfaBas baslik="Başvurular" />
        <Kart className="p-5"><BosDurum ikon={Inbox} baslik="Başvuru formu bu kurum türünde kapalı" aciklama="Herkese açık başvuru formu dernek, vakıf, topluluk ve sendika türündeki kurumlarda çalışır." /></Kart>
      </>
    )
  }

  const formAdresi = kisaAdres(kurumAdresi(kurum.id, 'apply'))
  const oncekiler = secili ? (hepsi || []).filter((b) => b.id !== secili.id && String(b.applicant_email || '').toLowerCase() === String(secili.applicant_email || '').toLowerCase()) : []

  return (
    <>
      <SayfaBas
        baslik="Başvurular"
        alt={<>Form: <span className="break-all">{formAdresi}</span>{hepsi && ` · son 30 günde ${sayi(sayilar.son30)} başvuru, ${sayi(sayilar.onay30)} onay`}</>}
        sag={
          <Segment
            etiket="Başvuru durumu"
            deger={aktifSekme}
            onChange={sekmeSec}
            secenekler={[
              { deger: 'pending', ad: 'Bekleyen', sayi: sayilar.pending },
              { deger: 'approved', ad: 'Onaylanan' },
              { deger: 'rejected', ad: 'Reddedilen' },
            ]}
          />
        }
      />

      {yukleniyor && !hepsi ? <Yukleniyor /> : gorunenListe.length === 0 ? (
        <Kart className="p-5">
          <BosDurum
            ikon={Inbox}
            baslik={aktifSekme === 'pending' ? 'Bekleyen başvuru yok' : aktifSekme === 'approved' ? 'Onaylanan başvuru yok' : 'Reddedilen başvuru yok'}
            aciklama={aktifSekme === 'pending' ? 'Başvuru formu bağlantısını paylaştığınızda gelen başvurular burada sıraya girer.' : undefined}
          />
        </Kart>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-5 items-start">
          {/* Liste — mobilde ayrıntı açıkken gizlenir */}
          <Kart className={birlestir('overflow-hidden', istenenId && 'hidden lg:block')} aria-label="Başvuru listesi">
            <ul>
              {gorunenListe.map((b) => {
                const sec = secili?.id === b.id
                const yas = kisaYas(b.applied_at)
                const gecikti = b.status === 'pending' && (Date.now() - new Date(b.applied_at).getTime()) > 3 * 86400000
                return (
                  <li key={b.id} className="border-b border-cizgi/70 last:border-0">
                    <button
                      type="button"
                      onClick={() => basvuruSec(b.id)}
                      aria-current={sec ? 'true' : undefined}
                      className={birlestir(
                        'w-full flex gap-3 items-start pl-[13px] pr-4 py-3.5 text-left transition-colors border-l-[3px]',
                        sec ? 'bg-zemin border-aksan' : 'border-transparent hover:bg-yuzey-2/50',
                      )}
                    >
                      <Avatar ad={b.applicant_name} boyut={38} />
                      <span className="flex-1 min-w-0">
                        <b className="block font-semibold text-metin truncate">{b.applicant_name}</b>
                        <span className="block text-xs text-metin-2 truncate">{b.applicant_email}</span>
                      </span>
                      <span className={birlestir('text-xs whitespace-nowrap', gecikti ? 'text-red-600 dark:text-red-400 font-semibold' : 'text-metin-2')}>{yas}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </Kart>

          {/* Ayrıntı */}
          {secili && (
            <Kart className={birlestir('p-[22px] flex flex-col gap-4', !istenenId && 'hidden lg:flex')} aria-labelledby="bs-ad">
              <button type="button" onClick={listeyeDon} className="lg:hidden self-start inline-flex items-center gap-1.5 text-[13px] font-semibold text-aksan">
                <ArrowLeft size={15} aria-hidden="true" />Listeye dön
              </button>
              <div className="flex justify-between items-start gap-3 flex-wrap">
                <div className="flex gap-3.5 items-center min-w-0">
                  <Avatar ad={secili.applicant_name} boyut={52} />
                  <div className="min-w-0">
                    <h2 id="bs-ad" className="font-baslik text-xl font-extrabold leading-tight">{secili.applicant_name}</h2>
                    <div className="text-[13px] text-metin-2">
                      {[secili.applicant_email, `başvuru ${zamanMetni(secili.applied_at)}`, 'form üzerinden'].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                </div>
                <Rozet ton={DURUM[secili.status]?.ton}>{DURUM[secili.status]?.ad || secili.status}</Rozet>
              </div>

              <div className="flex gap-2 flex-wrap">
                {oncekiler.length === 0
                  ? <Rozet>Daha önce başvurmadı</Rozet>
                  : <Rozet ton="vurgu">Daha önce {sayi(oncekiler.length)} kez başvurdu</Rozet>}
              </div>

              <dl className="flex flex-col border-t border-cizgi/70">
                <Cevap etiket="Ad Soyad">{secili.applicant_name}</Cevap>
                <Cevap etiket="E-posta"><a href={`mailto:${secili.applicant_email}`} className="text-aksan hover:underline break-all">{secili.applicant_email}</a></Cevap>
                {secili.applicant_phone && <Cevap etiket="Telefon"><a href={`tel:${secili.applicant_phone}`} className="text-aksan hover:underline">{secili.applicant_phone}</a></Cevap>}
                <Cevap etiket="Mesaj">{secili.applicant_message ? <span className="whitespace-pre-line">{secili.applicant_message}</span> : <span className="text-metin-2">Mesaj bırakılmamış.</span>}</Cevap>
                {secili.reviewed_at && <Cevap etiket="Sonuç">{DURUM[secili.status]?.ad} · {zamanMetni(secili.reviewed_at)}</Cevap>}
              </dl>

              {secili.status === 'pending' && (
                <>
                  <div className="flex justify-between items-center gap-2.5 flex-wrap border-t border-cizgi/70 pt-4">
                    <div className="flex gap-2">
                      <Dugme tur="tehlike" onClick={() => reddet(secili)} disabled={islenen === secili.id}>Reddet…</Dugme>
                      <Dugme as="a" href={`mailto:${secili.applicant_email}?subject=${encodeURIComponent(kurum.name + ' üyelik başvurunuz')}`}>Bilgi iste</Dugme>
                    </div>
                    <Dugme tur="ana" onClick={() => karar(secili, 'approved')} disabled={islenen === secili.id}>
                      {islenen === secili.id ? 'İşleniyor…' : 'Onayla ve üye yap'}
                    </Dugme>
                  </div>
                  <p className="text-xs text-metin-2">
                    Onaylandığında {secili.applicant_name.split(' ')[0]} {kurum.name} üyesi olarak eklenir. Bu e-postayla doğrulanmış bir QRtım hesabı varsa üyelik o hesaba bağlanır; yoksa başvuru bilgileriyle üye kaydı açılır.
                  </p>
                </>
              )}
            </Kart>
          )}
        </div>
      )}

      <OnayPenceresi istek={onay} onKapat={() => setOnay(null)} />
    </>
  )
}

function Cevap({ etiket, children }) {
  return (
    <div className="flex flex-col gap-[3px] py-3 border-b border-cizgi/70 last:border-0">
      <dt className="text-xs text-metin-2">{etiket}</dt>
      <dd className="font-medium text-metin">{children}</dd>
    </div>
  )
}
