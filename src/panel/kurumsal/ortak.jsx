// KURUMSAL PANEL — sayfalar arası ortak parçalar
// (kurum seçici, pencere, üye detayı, davet, rozetler, sayfalama)
import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronsUpDown, Check, X, Mail, Phone } from 'lucide-react'
import { Avatar, Rozet, Dugme, Girdi, Alan, Yukleniyor } from '../ui'
import { birlestir, sayi, tarih } from '../bicim'
import { kurumKisa, rpc, useVeri, gunOnce, UYE_EKLEME_HATALARI } from './veri'

// ---------------------------------------------------------------- başlıklar
// Tasarımda kart başlıkları 16px; ortak KartBaslik 17px ve alt metinli, bu
// yüzden kurum sayfalarında bu sade başlık kullanılır.
export function KartBas({ id, children, sag, className }) {
  return (
    <div className={birlestir('flex items-center justify-between gap-3 flex-wrap', className)}>
      <h2 id={id} className="font-baslik text-base font-bold leading-tight text-metin">{children}</h2>
      {sag}
    </div>
  )
}

// Sayfa başlığı: tasarımda 26px, alt metin 13px
export function SayfaBas({ baslik, alt, sag }) {
  return (
    <div className="flex items-center justify-between gap-4 flex-wrap">
      <div className="min-w-0">
        <h1 className="font-baslik text-[26px] font-extrabold leading-tight tracking-tight text-metin">{baslik}</h1>
        {alt && <p className="mt-1 text-[13px] text-metin-2">{alt}</p>}
      </div>
      {sag && <div className="flex items-center gap-2 flex-wrap">{sag}</div>}
    </div>
  )
}

// ---------------------------------------------------------------- kurum logosu
export function KurumLogo({ kurum, boyut = 36, className }) {
  const stil = { width: boyut, height: boyut }
  if (kurum?.logo_url) {
    return <img src={kurum.logo_url} alt="" style={stil} className={birlestir('object-cover shrink-0 rounded-[10px] bg-yuzey', className)} />
  }
  return (
    <span
      style={{ ...stil, fontSize: Math.max(11, Math.round(boyut * 0.3)) }}
      className={birlestir('inline-flex items-center justify-center shrink-0 bg-murekkep text-yuzey font-baslik font-extrabold', boyut > 44 ? 'rounded-[14px]' : 'rounded-[10px]', className)}
      aria-hidden="true"
    >
      {kurumKisa(kurum?.name)}
    </span>
  )
}

// ---------------------------------------------------------------- kurum seçici
// Sol menünün üstünde. Birden çok kurum varsa açılır liste.
export function KurumSecici({ kurumlar, secili, onSec }) {
  const [acik, setAcik] = useState(false)
  const kap = useRef(null)
  const coklu = kurumlar.length > 1

  useEffect(() => {
    if (!acik) return undefined
    const dis = (e) => { if (kap.current && !kap.current.contains(e.target)) setAcik(false) }
    const esc = (e) => { if (e.key === 'Escape') setAcik(false) }
    document.addEventListener('mousedown', dis)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', dis); document.removeEventListener('keydown', esc) }
  }, [acik])

  const rol = secili?.is_admin ? 'Yönetici' : 'Üye'
  const ic = (
    <>
      <KurumLogo kurum={secili} boyut={36} />
      <span className="flex-1 min-w-0 text-left">
        <b className="block text-[13px] font-semibold text-metin truncate">{secili?.name}</b>
        <span className="block text-[11px] text-metin-2 truncate">
          {rol}{coklu ? ` · ${kurumlar.length} kurumdan` : ''}{secili?.is_stk ? ' · STK' : ''}
        </span>
      </span>
    </>
  )

  if (!coklu) {
    return <div className="flex items-center gap-2.5 p-2.5 rounded-xl border border-cizgi bg-yuzey">{ic}</div>
  }

  return (
    <div className="relative" ref={kap}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={acik}
        aria-label={`Kurum seç: ${secili?.name || ''}`}
        onClick={() => setAcik((a) => !a)}
        className="w-full flex items-center gap-2.5 p-2.5 rounded-xl border border-cizgi bg-yuzey hover:border-aksan transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-aksan"
      >
        {ic}
        <ChevronsUpDown size={16} className="text-metin-2 shrink-0" aria-hidden="true" />
      </button>
      {acik && (
        <ul role="listbox" aria-label="Kurumlarınız" className="absolute left-0 right-0 mt-1.5 z-40 rounded-xl border border-cizgi bg-yuzey shadow-xl p-1.5 max-h-80 overflow-y-auto">
          {kurumlar.map((k) => {
            const sec = k.id === secili?.id
            return (
              <li key={k.id} role="option" aria-selected={sec}>
                <button
                  type="button"
                  onClick={() => { setAcik(false); onSec(k.id) }}
                  className={birlestir('w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-left hover:bg-yuzey-2', sec && 'bg-yuzey-2')}
                >
                  <KurumLogo kurum={k} boyut={30} />
                  <span className="flex-1 min-w-0">
                    <b className="block text-[13px] font-semibold text-metin truncate">{k.name}</b>
                    <span className="block text-[11px] text-metin-2 truncate">
                      {k.is_admin ? 'Yönetici' : 'Üye'} · {sayi(k.member_count)} üye{k.is_stk ? ' · STK' : ''}
                    </span>
                  </span>
                  {Number(k.pending_applications) > 0 && (
                    <span className="min-w-[20px] h-5 px-1.5 inline-flex items-center justify-center rounded-full text-[11px] font-bold bg-vurgu text-white" aria-label={`${k.pending_applications} bekleyen başvuru`}>
                      {k.pending_applications}
                    </span>
                  )}
                  {sec && <Check size={15} className="text-aksan shrink-0" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- pencere
export function Pencere({ acik, baslik, onKapat, children, genislik = 'max-w-md', alt }) {
  useEffect(() => {
    if (!acik) return undefined
    const esc = (e) => { if (e.key === 'Escape') onKapat?.() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [acik, onKapat])
  if (!acik) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4" onMouseDown={onKapat}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={baslik}
        onMouseDown={(e) => e.stopPropagation()}
        className={birlestir('w-full bg-yuzey text-metin border border-cizgi rounded-t-2xl sm:rounded-2xl shadow-2xl max-h-[90vh] flex flex-col', genislik)}
      >
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-cizgi">
          <h2 className="font-baslik text-base font-bold">{baslik}</h2>
          <button type="button" onClick={onKapat} aria-label="Kapat" className="p-1.5 rounded-lg text-metin-2 hover:bg-yuzey-2 hover:text-metin">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 py-4 overflow-y-auto flex flex-col gap-4">{children}</div>
        {alt && <div className="px-5 py-3.5 border-t border-cizgi flex justify-end gap-2 flex-wrap">{alt}</div>}
      </div>
    </div>
  )
}

// Onay penceresi: { baslik, mesaj, onay, tehlike, onEvet }
export function OnayPenceresi({ istek, onKapat }) {
  const [calisiyor, setCalisiyor] = useState(false)
  if (!istek) return null
  const evet = async () => {
    setCalisiyor(true)
    try { await istek.onEvet() } finally { setCalisiyor(false); onKapat() }
  }
  return (
    <Pencere
      acik
      baslik={istek.baslik}
      onKapat={onKapat}
      alt={
        <>
          <Dugme tur="ikincil" onClick={onKapat}>Vazgeç</Dugme>
          <Dugme tur={istek.tehlike ? 'tehlike' : 'ana'} onClick={evet} disabled={calisiyor}>{calisiyor ? 'İşleniyor…' : istek.onay || 'Onayla'}</Dugme>
        </>
      }
    >
      <p className="text-sm text-metin-2 whitespace-pre-line">{istek.mesaj}</p>
    </Pencere>
  )
}

// ---------------------------------------------------------------- rozetler
export const RolRozeti = ({ rol }) => (rol === 'admin' ? <Rozet ton="koyu">Yönetici</Rozet> : <Rozet>Üye</Rozet>)

export function DurumRozeti({ durum }) {
  if (durum === 'invited') return <Rozet>Davet bekliyor</Rozet>
  if (durum === 'active') return <Rozet ton="aksan">Aktif</Rozet>
  return <Rozet ton="uyari">Pasif</Rozet>
}

// Filtre hapı (Tümü 148 · Aktif 139 …)
export function Filtre({ secili, onClick, children, sayi: adet }) {
  return (
    <button
      type="button"
      aria-pressed={secili}
      onClick={onClick}
      className={birlestir(
        'h-9 px-3 rounded-full border text-[13px] font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors',
        secili ? 'bg-murekkep text-yuzey border-murekkep' : 'bg-yuzey text-metin border-cizgi hover:border-metin-2',
      )}
    >
      {children}
      {adet !== undefined && <span className="opacity-70 tabular-nums">{sayi(adet)}</span>}
    </button>
  )
}

// İstemci tarafı sayfalama alt çubuğu
export function Sayfalama({ sayfa, toplam, boyut = 25, onSayfa, ek = '' }) {
  const sayfaSay = Math.max(1, Math.ceil(toplam / boyut))
  const bas = toplam === 0 ? 0 : sayfa * boyut + 1
  const son = Math.min(toplam, (sayfa + 1) * boyut)
  return (
    <div className="flex justify-between items-center gap-2 flex-wrap px-4 sm:px-5 py-3 text-[13px] text-metin-2">
      <span className="tabular-nums">{bas}–{son} / {sayi(toplam)}{ek}</span>
      {sayfaSay > 1 && (
        <div className="flex items-center gap-1.5">
          <Dugme boyut="k" onClick={() => onSayfa(sayfa - 1)} disabled={sayfa === 0}>Önceki</Dugme>
          <span className="px-1.5 tabular-nums"><b className="text-metin">{sayfa + 1}</b> / {sayfaSay}</span>
          <Dugme boyut="k" onClick={() => onSayfa(sayfa + 1)} disabled={sayfa >= sayfaSay - 1}>Sonraki</Dugme>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- davet
// Kişi kendi panelinden kabul ettiğinde üye olur (org_add_member_by_email).
export function DavetPenceresi({ acik, kurum, onKapat, onGonderildi, bildir }) {
  const [eposta, setEposta] = useState('')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [hata, setHata] = useState('')
  const kapat = () => { setEposta(''); setHata(''); onKapat() }
  const gonder = async (e) => {
    e?.preventDefault()
    const temiz = eposta.trim()
    if (!temiz) return
    setGonderiliyor(true)
    setHata('')
    try {
      const data = await rpc('org_add_member_by_email', { p_org_id: kurum.id, p_email: temiz })
      if (!data?.ok) { setHata(UYE_EKLEME_HATALARI[data?.hata] || 'Davet gönderilemedi.'); return }
      bildir(`${data.ad || temiz} kişisine davet gönderildi. Kabul ettiğinde üye olacak.`, 'success')
      setEposta('')
      onGonderildi?.()
      onKapat()
    } catch (err) {
      setHata('Davet gönderilemedi: ' + err.message)
    } finally {
      setGonderiliyor(false)
    }
  }
  return (
    <Pencere
      acik={acik}
      baslik="Üye davet et"
      onKapat={kapat}
      alt={
        <>
          <Dugme tur="ikincil" onClick={kapat}>Vazgeç</Dugme>
          <Dugme tur="ana" onClick={gonder} disabled={gonderiliyor || !eposta.trim()}>{gonderiliyor ? 'Gönderiliyor…' : 'Davet gönder'}</Dugme>
        </>
      }
    >
      <form onSubmit={gonder} className="flex flex-col gap-3">
        <Alan id="davet-eposta" etiket="E-posta" hata={hata} ipucu="Kişinin QRtım hesabındaki doğrulanmış e-posta adresi.">
          <Girdi id="davet-eposta" type="email" autoComplete="off" value={eposta} onChange={(e) => setEposta(e.target.value)} placeholder="ornek@eposta.com" autoFocus />
        </Alan>
        <p className="text-[13px] text-metin-2">
          Davet, kişinin panelinde görünür. Kabul ettiğinde {kurum?.name} üyesi olur; o zamana kadar listede “Davet bekliyor” olarak kalır.
        </p>
      </form>
    </Pencere>
  )
}

// ---------------------------------------------------------------- üye detayı
const KAYNAK_AD = { qr: 'QR kod', nfc: 'NFC kart', link: 'Bağlantı', direct: 'Doğrudan', bilinmiyor: 'Bilinmiyor' }
const OLAY_AD = { profile_view: 'Görüntülenme', qr_scan: 'QR okutma', nfc_tap: 'NFC dokunuş', vcard_download: 'Rehbere kaydetme', link_click: 'Bağlantı tıklama', share: 'Paylaşım' }

// Sağdan açılan yan panel. uye: org_member_list ya da org_member_analytics satırı.
// islemler verilirse (yönetim) rol/durum/çıkarma düğmeleri görünür.
export function UyeDetayi({ kurum, uye, aralik, onKapat, islemler }) {
  const profilId = uye?.profile_id
  const yukle = useCallback(async () => {
    if (!profilId) return null
    return rpc('org_member_detail', {
      p_org_id: kurum.id, p_profile_id: profilId,
      p_from: (aralik?.from || gunOnce(29)).toISOString(), p_to: (aralik?.to || new Date()).toISOString(),
    })
  }, [kurum.id, profilId, aralik])
  const { veri: detay, yukleniyor } = useVeri(uye ? yukle : null)

  useEffect(() => {
    if (!uye) return undefined
    const esc = (e) => { if (e.key === 'Escape') onKapat() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [uye, onKapat])

  if (!uye) return null
  const kaynak = Object.entries(detay?.kaynak || {})
  const toplam = Object.entries(detay?.toplam || {})

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onMouseDown={onKapat}>
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`${uye.name || 'Üye'} ayrıntısı`}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-md h-full bg-yuzey text-metin border-l border-cizgi shadow-2xl flex flex-col"
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-cizgi">
          <Avatar ad={uye.name} url={uye.avatar_url} boyut={48} />
          <div className="flex-1 min-w-0">
            <h2 className="font-baslik text-lg font-extrabold leading-tight truncate">{uye.name || 'İsimsiz üye'}</h2>
            <div className="mt-1.5 flex gap-1.5 flex-wrap"><RolRozeti rol={uye.role} /><DurumRozeti durum={uye.status} /></div>
          </div>
          <button type="button" onClick={onKapat} aria-label="Kapat" className="p-1.5 rounded-lg text-metin-2 hover:bg-yuzey-2 hover:text-metin">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-5 text-sm">
          <dl className="flex flex-col">
            {uye.email && (
              <div className="flex items-center gap-2.5 py-2 border-b border-cizgi/70">
                <Mail size={15} className="text-metin-2" aria-hidden="true" /><dt className="sr-only">E-posta</dt>
                <dd><a className="text-aksan hover:underline break-all" href={`mailto:${uye.email}`}>{uye.email}</a></dd>
              </div>
            )}
            {uye.phone && (
              <div className="flex items-center gap-2.5 py-2 border-b border-cizgi/70">
                <Phone size={15} className="text-metin-2" aria-hidden="true" /><dt className="sr-only">Telefon</dt>
                <dd><a className="text-aksan hover:underline" href={`tel:${uye.phone}`}>{uye.phone}</a></dd>
              </div>
            )}
            {(uye.title || uye.company) && (
              <div className="flex justify-between gap-3 py-2 border-b border-cizgi/70"><dt className="text-metin-2">Unvan</dt><dd className="text-right">{[uye.title, uye.company].filter(Boolean).join(' · ')}</dd></div>
            )}
            <div className="flex justify-between gap-3 py-2"><dt className="text-metin-2">Katılım</dt><dd>{tarih(uye.accepted_at || uye.joined_at)}</dd></div>
          </dl>

          {!profilId ? (
            <p className="text-[13px] text-metin-2 rounded-xl bg-yuzey-2 p-3">
              Bu üyenin QRtım hesabı yok; yalnızca listede kayıtlı. Hesap açıp kuruma katıldığında kart hareketleri burada görünür.
            </p>
          ) : yukleniyor ? (
            <Yukleniyor />
          ) : !detay?.ok ? (
            <p className="text-[13px] text-red-600 dark:text-red-400">Ayrıntı alınamadı.</p>
          ) : (
            <>
              <p className="text-xs text-metin-2">
                Dönem: {tarih(detay.aralik?.bas)} – {tarih(detay.aralik?.bit)} · üyelikten önceki hareketler sayılmaz
              </p>
              <section aria-label="Toplamlar">
                <h3 className="text-[13px] font-semibold mb-2">Hareketler</h3>
                {toplam.length === 0 ? <p className="text-[13px] text-metin-2">Bu dönemde hareket yok.</p> : (
                  <div className="grid grid-cols-2 gap-2">
                    {toplam.map(([k, v]) => (
                      <div key={k} className="rounded-xl bg-yuzey-2 px-3 py-2.5">
                        <div className="text-xs text-metin-2">{OLAY_AD[k] || k}</div>
                        <div className="font-baslik text-lg font-extrabold tabular-nums">{sayi(v)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
              {kaynak.length > 0 && (
                <section aria-label="Kaynak">
                  <h3 className="text-[13px] font-semibold mb-2">Karta nereden geldiler</h3>
                  <div className="flex gap-1.5 flex-wrap">
                    {kaynak.map(([k, v]) => <Rozet key={k}>{KAYNAK_AD[k] || k}: {sayi(v)}</Rozet>)}
                  </div>
                </section>
              )}
              {(detay.profiller || []).length > 0 && (
                <section aria-label="Profiller">
                  <h3 className="text-[13px] font-semibold mb-1">Görüntülenen profiller</h3>
                  {detay.profiller.map((p, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-cizgi/70 last:border-0"><span>{p.ad}{p.ana ? ' (ana)' : ''}</span><b className="tabular-nums">{sayi(p.goruntulenme)}</b></div>
                  ))}
                </section>
              )}
              {(detay.baglantilar || []).length > 0 && (
                <section aria-label="Bağlantılar">
                  <h3 className="text-[13px] font-semibold mb-1">En çok tıklanan bağlantılar</h3>
                  {detay.baglantilar.map((b, i) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-cizgi/70 last:border-0"><span className="truncate">{b.hedef}</span><b className="tabular-nums">{sayi(b.tiklama)}</b></div>
                  ))}
                </section>
              )}
            </>
          )}
        </div>

        {islemler && !uye.is_me && uye.id && (
          <div className="px-5 py-3.5 border-t border-cizgi flex gap-2 flex-wrap">
            <Dugme boyut="k" onClick={() => islemler.rol([uye], uye.role === 'admin' ? 'member' : 'admin')}>
              {uye.role === 'admin' ? 'Üye yap' : 'Yönetici yap'}
            </Dugme>
            {uye.status !== 'invited' && (
              <Dugme boyut="k" onClick={() => islemler.durum([uye], uye.status === 'active' ? 'inactive' : 'active')}>
                {uye.status === 'active' ? 'Pasife al' : 'Etkinleştir'}
              </Dugme>
            )}
            <Dugme boyut="k" tur="tehlike" className="ml-auto" onClick={() => islemler.cikar([uye])}>Kurumdan çıkar</Dugme>
          </div>
        )}
      </aside>
    </div>
  )
}
