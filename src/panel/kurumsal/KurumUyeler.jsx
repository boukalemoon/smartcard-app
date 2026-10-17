// KURUM — Üyeler (tasarım: KurumUyeler)
import { useCallback, useMemo, useState } from 'react'
import { Download, Plus, Search } from 'lucide-react'
import { useAdimAtlama } from '../../hooks/useAdimAtlama'
import { exportToCSV } from '../../utils/exportHelpers'
import { Kart, Dugme, Avatar, Secim, BosDurum, Yukleniyor } from '../ui'
import { sayi, tarih, birlestir } from '../bicim'
import { useVeri, rpc, gunOnce, dizinAcikMi, uyeIslemleri } from './veri'
import { SayfaBas, Filtre, RolRozeti, DurumRozeti, Sayfalama, DavetPenceresi, OnayPenceresi, UyeDetayi, Pencere } from './ortak'

const BOYUT = 25

export default function KurumUyeler({ kurum, bildir, yenileKurumlar }) {
  const yonetici = !!kurum.is_admin
  const { adimAtla } = useAdimAtlama()
  const [ara, setAra] = useState('')
  const [filtre, setFiltre] = useState('tumu')
  const [sira, setSira] = useState('yeni')
  const [sayfa, setSayfa] = useState(0)
  const [secim, setSecim] = useState(() => new Set())
  const [davetAcik, setDavetAcik] = useState(false)
  const [onay, setOnay] = useState(null)
  const [detayId, setDetayId] = useState(null)
  const [rolSecimi, setRolSecimi] = useState(false)

  // Liste + son 30 günün görüntülenmesi (yalnızca yöneticiye döner).
  const yukle = useCallback(async () => {
    const [uyeler, analiz] = await Promise.all([
      rpc('org_member_list', { p_org_id: kurum.id }),
      yonetici ? rpc('org_member_analytics', { p_org_id: kurum.id, p_from: gunOnce(29).toISOString(), p_to: new Date().toISOString() }) : [],
    ])
    const gor = new Map((analiz || []).map((a) => [a.member_id, Number(a.profile_views || 0)]))
    return (uyeler || []).map((u) => ({ ...u, gor30: u.profile_id && gor.has(u.id) ? gor.get(u.id) : null }))
  }, [kurum.id, yonetici])
  const { veri: uyeler, yukleniyor, yenile } = useVeri(yukle)

  const dizinAcik = dizinAcikMi(kurum)
  // Sunucudaki dizin kuralı: dizin açıksa aktif üyeler listelenir.
  const dizinde = useCallback((u) => dizinAcik && u.status === 'active', [dizinAcik])

  const sayilar = useMemo(() => {
    const l = uyeler || []
    return {
      tumu: l.length,
      aktif: l.filter((u) => u.status === 'active').length,
      pasif: l.filter((u) => u.status !== 'active' && u.status !== 'invited').length,
      davet: l.filter((u) => u.status === 'invited').length,
      yonetici: l.filter((u) => u.role === 'admin').length,
      gizli: l.filter((u) => u.status !== 'invited' && !dizinde(u)).length,
      dizinde: l.filter((u) => dizinde(u)).length,
    }
  }, [uyeler, dizinde])

  const suzulmus = useMemo(() => {
    const q = ara.trim().toLocaleLowerCase('tr-TR')
    let l = (uyeler || []).filter((u) => {
      if (filtre === 'aktif' && u.status !== 'active') return false
      if (filtre === 'pasif' && (u.status === 'active' || u.status === 'invited')) return false
      if (filtre === 'davet' && u.status !== 'invited') return false
      if (filtre === 'yonetici' && u.role !== 'admin') return false
      if (filtre === 'gizli' && (u.status === 'invited' || dizinde(u))) return false
      if (!q) return true
      return [u.name, u.email, u.title, u.company].some((x) => String(x || '').toLocaleLowerCase('tr-TR').includes(q))
    })
    const zaman = (u) => new Date(u.accepted_at || u.joined_at || 0).getTime()
    l = [...l].sort((a, b) => {
      if (sira === 'eski') return zaman(a) - zaman(b)
      if (sira === 'ad') return String(a.name || '').localeCompare(String(b.name || ''), 'tr')
      if (sira === 'gor') return (b.gor30 ?? -1) - (a.gor30 ?? -1)
      return zaman(b) - zaman(a)
    })
    return l
  }, [uyeler, ara, filtre, sira, dizinde])

  const sayfaSay = Math.max(1, Math.ceil(suzulmus.length / BOYUT))
  const gecerliSayfa = Math.min(sayfa, sayfaSay - 1)
  const gorunen = suzulmus.slice(gecerliSayfa * BOYUT, (gecerliSayfa + 1) * BOYUT)
  const seciliUyeler = (uyeler || []).filter((u) => secim.has(u.id))
  const hepsiSecili = gorunen.length > 0 && gorunen.every((u) => secim.has(u.id))
  const detay = (uyeler || []).find((u) => u.id === detayId) || null

  const filtreSec = (f) => { setFiltre(f); setSayfa(0) }
  const sec = (id) => setSecim((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const sayfayiSec = () => setSecim((s) => {
    const n = new Set(s)
    if (hepsiSecili) gorunen.forEach((u) => n.delete(u.id))
    else gorunen.forEach((u) => n.add(u.id))
    return n
  })

  const islem = uyeIslemleri({
    onayIste: setOnay,
    bildir,
    sonra: () => { setSecim(new Set()); setDetayId(null); yenile(); yenileKurumlar() },
  })

  const csvIndir = async () => {
    if (!uyeler?.length) { bildir('Dışa aktarılacak üye yok.', 'error'); return }
    // Kişisel veri dışa aktarımı: iki adımlı doğrulama (CorporateDashboard ile aynı).
    const tamam = await adimAtla({ sebep: 'Veri dışa aktarma', zorla: true })
    if (!tamam) return
    exportToCSV(suzulmus.map((m) => ({
      'Kurum': kurum.name,
      'Ad Soyad': m.name || '-',
      'E-posta': m.email || '-',
      'Telefon': m.phone || '-',
      'Unvan': m.title || '-',
      'Rol': m.role === 'admin' ? 'Yönetici' : 'Üye',
      'Durum': m.status === 'invited' ? 'Davet bekliyor' : m.status === 'active' ? 'Aktif' : 'Pasif',
      'Katılım': m.accepted_at || m.joined_at ? new Date(m.accepted_at || m.joined_at).toLocaleDateString('tr-TR') : '-',
      'Görüntülenme (30 gün)': m.gor30 ?? '-',
    })), 'uyeler')
  }

  const altMetin = [
    `${sayi(sayilar.tumu - sayilar.davet)} üye`,
    `${sayi(sayilar.yonetici)} yönetici`,
    kurum.is_stk && (dizinAcik ? `${sayi(sayilar.dizinde)} dizinde görünür` : 'üye dizini kapalı'),
    sayilar.davet > 0 && `${sayi(sayilar.davet)} davet bekliyor`,
  ].filter(Boolean).join(' · ')

  return (
    <>
      <SayfaBas
        baslik="Üyeler"
        alt={uyeler ? altMetin : ' '}
        sag={yonetici && (
          <>
            <Dugme ikon={Download} onClick={csvIndir}>CSV indir</Dugme>
            <Dugme tur="ana" ikon={Plus} onClick={() => setDavetAcik(true)}>Üye davet et</Dugme>
          </>
        )}
      />

      <div className="flex gap-2.5 items-center flex-wrap">
        <div className="relative flex-1 min-w-[220px] max-w-[360px]">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-metin-2" aria-hidden="true" />
          <input
            type="search"
            aria-label="Üye ara"
            placeholder="Ad, e-posta veya unvan"
            value={ara}
            onChange={(e) => { setAra(e.target.value); setSayfa(0) }}
            className="h-10 w-full rounded-[10px] border border-cizgi bg-yuzey pl-[38px] pr-3 text-sm text-metin placeholder:text-metin-2/70 focus:outline-none focus:ring-2 focus:ring-aksan/40 focus:border-aksan"
          />
        </div>
        <div className="flex gap-2 flex-wrap" role="group" aria-label="Üye filtresi">
          <Filtre secili={filtre === 'tumu'} onClick={() => filtreSec('tumu')} sayi={sayilar.tumu}>Tümü</Filtre>
          <Filtre secili={filtre === 'aktif'} onClick={() => filtreSec('aktif')} sayi={sayilar.aktif}>Aktif</Filtre>
          <Filtre secili={filtre === 'pasif'} onClick={() => filtreSec('pasif')} sayi={sayilar.pasif}>Pasif</Filtre>
          <Filtre secili={filtre === 'yonetici'} onClick={() => filtreSec('yonetici')} sayi={sayilar.yonetici}>Yönetici</Filtre>
          {kurum.is_stk && <Filtre secili={filtre === 'gizli'} onClick={() => filtreSec('gizli')} sayi={sayilar.gizli}>Dizinde gizli</Filtre>}
          {sayilar.davet > 0 && <Filtre secili={filtre === 'davet'} onClick={() => filtreSec('davet')} sayi={sayilar.davet}>Davet bekleyen</Filtre>}
        </div>
        <label className="ml-auto flex items-center gap-2 text-[13px] text-metin-2">
          Sırala:
          <Secim etiket="Sıralama" value={sira} onChange={(v) => setSira(v)} className="font-semibold text-metin">
            <option value="yeni">Katılım (yeni)</option>
            <option value="eski">Katılım (eski)</option>
            <option value="ad">Ad (A–Z)</option>
            {yonetici && <option value="gor">Görüntülenme</option>}
          </Secim>
        </label>
      </div>

      {yonetici && seciliUyeler.length > 0 && (
        <div className="flex items-center gap-3 flex-wrap px-3.5 py-2.5 rounded-xl bg-murekkep text-yuzey text-[13px]" role="region" aria-label="Toplu işlemler">
          <input type="checkbox" checked onChange={() => setSecim(new Set())} aria-label="Seçimi kaldır" className="w-[18px] h-[18px] accent-aksan" />
          <b className="font-semibold">{sayi(seciliUyeler.length)} üye seçildi</b>
          <div className="flex gap-1.5 ml-auto flex-wrap">
            <TopluDugme onClick={() => setRolSecimi(true)}>Rol ata</TopluDugme>
            <TopluDugme onClick={() => islem.durum(seciliUyeler, 'inactive')}>Pasife al</TopluDugme>
            <TopluDugme tehlike onClick={() => islem.cikar(seciliUyeler)}>Kurumdan çıkar</TopluDugme>
          </div>
        </div>
      )}

      <Kart className="overflow-hidden" aria-label="Üye listesi">
        {yukleniyor && !uyeler ? <Yukleniyor /> : gorunen.length === 0 ? (
          <BosDurum
            baslik={uyeler?.length ? 'Bu filtrede üye yok' : 'Henüz üye yok'}
            aciklama={uyeler?.length ? 'Aramayı ya da filtreyi değiştirin.' : 'Üye davet ederek ya da başvuruları onaylayarak başlayın.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13.5px]">
              <thead>
                <tr>
                  {yonetici && (
                    <UTh className="w-9">
                      <input type="checkbox" checked={hepsiSecili} onChange={sayfayiSec} aria-label="Bu sayfadakilerin tümünü seç" className="w-4 h-4 accent-aksan align-middle" />
                    </UTh>
                  )}
                  <UTh>Üye</UTh>
                  <UTh>Rol</UTh>
                  <UTh>Durum</UTh>
                  {kurum.is_stk && <UTh>Dizin</UTh>}
                  <UTh>Katılım</UTh>
                  {yonetici && <UTh sag>Görüntülenme · 30g</UTh>}
                  <UTh><span className="sr-only">İşlem</span></UTh>
                </tr>
              </thead>
              <tbody>
                {gorunen.map((u) => (
                  <tr key={u.id} className="hover:bg-yuzey-2/50">
                    {yonetici && (
                      <UTd>
                        <input type="checkbox" checked={secim.has(u.id)} onChange={() => sec(u.id)} aria-label={`${u.name || 'Üye'} seç`} className="w-4 h-4 accent-aksan align-middle" />
                      </UTd>
                    )}
                    <UTd>
                      <div className="flex items-center gap-2.5 min-w-[220px]">
                        <Avatar ad={u.name} url={u.avatar_url} boyut={34} />
                        <div className="min-w-0">
                          <b className="block font-semibold text-metin truncate">{u.name || 'İsimsiz'}{u.is_me && <span className="font-normal text-xs text-metin-2"> · siz</span>}</b>
                          <div className="text-xs text-metin-2 truncate">
                            {[u.email, u.title, !u.profile_id && 'QRtım hesabı yok'].filter(Boolean).join(' · ') || '—'}
                          </div>
                        </div>
                      </div>
                    </UTd>
                    <UTd><RolRozeti rol={u.role} /></UTd>
                    <UTd><DurumRozeti durum={u.status} /></UTd>
                    {kurum.is_stk && (
                      <UTd>
                        {dizinde(u)
                          ? <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300">Görünür</span>
                          : <span className="text-xs font-semibold text-metin-2">Gizli</span>}
                      </UTd>
                    )}
                    <UTd className="text-metin-2 whitespace-nowrap">{u.status === 'invited' ? '—' : tarih(u.accepted_at || u.joined_at)}</UTd>
                    {yonetici && (
                      <UTd sag>{u.gor30 === null ? <span className="text-metin-2">—</span> : <b className="font-semibold">{sayi(u.gor30)}</b>}</UTd>
                    )}
                    <UTd sag>
                      <Dugme boyut="k" tur="sessiz" onClick={() => setDetayId(u.id)} aria-label={`${u.name || 'Üye'} ayrıntısı`}>Detay</Dugme>
                    </UTd>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {suzulmus.length > 0 && <Sayfalama sayfa={gecerliSayfa} toplam={suzulmus.length} boyut={BOYUT} onSayfa={setSayfa} />}
      </Kart>

      <p className="text-xs text-metin-2">
        Unvan yalnızca üyenin kartında herkese açıksa görünür. E-posta ve telefon yalnızca kurum yöneticilerine ve kişinin kendisine gösterilir.
      </p>

      {yonetici && <DavetPenceresi acik={davetAcik} kurum={kurum} onKapat={() => setDavetAcik(false)} onGonderildi={yenile} bildir={bildir} />}
      <OnayPenceresi istek={onay} onKapat={() => setOnay(null)} />
      <Pencere acik={rolSecimi} baslik="Rol ata" onKapat={() => setRolSecimi(false)}>
        <p className="text-sm text-metin-2">{sayi(seciliUyeler.length)} üyeye hangi rol verilsin?</p>
        <div className="grid grid-cols-2 gap-2">
          <Dugme onClick={() => { setRolSecimi(false); islem.rol(seciliUyeler, 'member') }}>Üye</Dugme>
          <Dugme tur="ana" onClick={() => { setRolSecimi(false); islem.rol(seciliUyeler, 'admin') }}>Yönetici</Dugme>
        </div>
      </Pencere>
      <UyeDetayi kurum={kurum} uye={detay} onKapat={() => setDetayId(null)} islemler={yonetici ? islem : null} />
    </>
  )
}

// Tasarımdaki tablo ölçüleri (11px başlık, 11px×14px hücre) ortak Th/Td'den farklı.
function UTh({ children, sag, className }) {
  return (
    <th className={birlestir('px-3.5 py-2.5 text-[11px] font-semibold tracking-[.06em] uppercase text-metin-2 bg-yuzey-2/50 border-b border-cizgi whitespace-nowrap', sag ? 'text-right' : 'text-left', className)}>
      {children}
    </th>
  )
}
function UTd({ children, sag, className }) {
  return <td className={birlestir('px-3.5 py-[11px] border-b border-cizgi/70 align-middle', sag && 'text-right tabular-nums', className)}>{children}</td>
}

// Koyu seçim çubuğundaki düğmeler: zemin tersine döndüğü için (koyu temada
// açık çubuk) renkler yuzey tokenından türetilir.
function TopluDugme({ children, tehlike, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={birlestir(
        'h-8 px-2.5 rounded-lg border border-yuzey/20 bg-yuzey/10 hover:bg-yuzey/20 text-[13px] font-semibold transition-colors',
        tehlike ? 'text-red-300 dark:text-red-700' : 'text-yuzey',
      )}
    >
      {children}
    </button>
  )
}
