// YÖNETİCİ PANELİ — tasarım: Yonetici.dc.html (Claude Design)
//
// Kabuk bireysel/kurumsal panelle ortak (PanelKabugu). Bölüm adreste tutulur
// (?bolum=…): yenileyince yerinde kalır, bağlantısı paylaşılabilir.
// Veri ve işlemler eski AdminCRM'den taşındı; AdminCRM dosyası olduğu gibi duruyor.
import { useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Download, RefreshCw, Search, LayoutGrid, LogOut, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { bildir } from '../../lib/bildirim'
import { exportToCSV } from '../../utils/exportHelpers'
import { useAdimAtlama } from '../../hooks/useAdimAtlama'
import { ConfirmModal } from '../../components/Modal'
import PanelKabugu from '../PanelKabugu'
import { Kart, Rozet, Dugme, IkonDugme, SayfaBaslik, Yukleniyor } from '../ui'
import { goreli } from '../bicim'
import { useYoneticiVerisi, useTuretilmis } from './veri'
import { Istatistikler, PlanDagilimi, DikkatGerektiren } from './Platform'
import KayitTablosu from './KayitTablosu'
import KullaniciPaneli from './KullaniciPaneli'

// Menü tasarımdaki sırada. NFC siparişleri ve denetim kaydı için yöneticinin
// okuyabildiği bir kaynak yok (nfc_orders'ta yönetici okuma kuralı yok,
// audit_log yalnızca kişinin kendi kayıtlarına açık): "Yakında".
const MENU = [
  { anahtar: 'platform', ad: 'Platform' },
  { anahtar: 'kullanicilar', ad: 'Kullanıcılar' },
  { anahtar: 'abonelikler', ad: 'Abonelikler' },
  { anahtar: 'komisyonlar', ad: 'Komisyonlar' },
  { anahtar: 'referanslar', ad: 'Referanslar' },
  { anahtar: 'nfc', ad: 'NFC siparişleri', etiket: 'Yakında', kapali: true },
  { anahtar: 'kurumlar', ad: 'Kurumlar' },
  { anahtar: 'denetim', ad: 'Denetim kaydı', etiket: 'Yakında', kapali: true },
]
const SAYFA = {
  kullanicilar: { tur: 'users', baslik: 'Kullanıcılar', alt: 'Tüm hesaplar. Rol, plan ve silme işlemleri için satırda Aç.' },
  abonelikler: { tur: 'subs', baslik: 'Abonelikler', alt: 'Kişi başına abonelik kaydı, dönemi ve bitiş tarihi.' },
  komisyonlar: { tur: 'comms', baslik: 'Komisyonlar', alt: 'Davet ödemelerinden doğan hakedişler.' },
  referanslar: { tur: 'refs', baslik: 'Referanslar', alt: 'Kim kimi davet etti, davet ödemeye dönüştü mü.' },
  kurumlar: { tur: 'orgs', baslik: 'Kurumlar', alt: 'Platformdaki tüm kurumlar. Yalnızca görüntüleme; kurum işlemleri kurum yöneticisindedir.' },
}
const gecerliBolum = (b) => (b && (b === 'platform' || SAYFA[b]) ? b : 'platform')
const BOS_FILTRE = { plan: 'hepsi', durum: 'hepsi' }

export default function YoneticiPaneli({ profile, session }) {
  const navigate = useNavigate()
  const { adimAtla } = useAdimAtlama()
  const [aramaParam, setAramaParam] = useSearchParams()
  const bolum = gecerliBolum(aramaParam.get('bolum'))
  const { veri, setVeri, yukleniyor, yenileniyor, yenile } = useYoneticiVerisi()
  const t = useTuretilmis(veri)

  const [tablo, setTablo] = useState(() => ({ tur: SAYFA[bolum]?.tur || 'users', ...BOS_FILTRE }))
  const [arama, setArama] = useState('')
  const [secili, setSecili] = useState(null)
  const [onay, setOnay] = useState(null)
  const tabloRef = useRef(null)

  const bolumSec = (b) => {
    setAramaParam(b === 'platform' ? {} : { bolum: b }, { replace: true })
    setTablo({ tur: SAYFA[b]?.tur || 'users', ...BOS_FILTRE })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const dikkateGit = (hedef) => {
    setTablo({ ...BOS_FILTRE, ...hedef })
    tabloRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const ac = (profilId) => {
    // Hesabı silinmiş kişinin komisyon/davet kaydı kalabilir: açacak profil yok.
    if (!profilId || !t.kisi.has(profilId)) {
      bildir('Bu kaydın bağlı olduğu hesap bulunamadı; silinmiş olabilir.', 'error')
      return
    }
    setSecili(profilId)
  }

  // Yan paneldeki RPC başarılı olunca listeyi yeniden çekmeden güncelle.
  const degisti = (d) => {
    if (d.tur === 'rol') {
      setVeri((v) => ({ ...v, users: v.users.map((u) => (u.id === d.id ? { ...u, role: d.rol } : u)) }))
    } else if (d.tur === 'plan') {
      setVeri((v) => ({
        ...v,
        subs: v.subs.map((s) => (s.profile_id === d.id
          ? { ...s, plan: d.plan, status: 'active', expires_at: d.plan === 'free' ? null : s.expires_at }
          : s)),
      }))
    } else if (d.tur === 'sil') {
      setSecili(null)
      setVeri((v) => ({ ...v, users: v.users.filter((u) => u.id !== d.id) }))
    }
  }

  // Dışa aktarma kişisel veri taşır: şifre penceresi yerine iki adımlı
  // doğrulama (eski yöntem istemcide çalışıyor ve atlanabiliyordu).
  const kullanicilariIndir = async () => {
    if (!(await adimAtla({ sebep: 'Veri dışa aktarma', zorla: true }))) return
    exportToCSV(veri.users.map((u) => ({
      'Ad Soyad': u.name, 'Email': u.email, 'Rol': u.role, 'Kayıt': new Date(u.created_at).toLocaleDateString('tr-TR'),
    })), 'users')
  }
  const abonelikleriIndir = async () => {
    if (!(await adimAtla({ sebep: 'Veri dışa aktarma', zorla: true }))) return
    exportToCSV(veri.subs.map((s) => ({
      'Kullanıcı': s.profiles?.name, 'Email': s.profiles?.email, 'Plan': s.plan, 'Durum': s.status,
      'Tarih': new Date(s.created_at).toLocaleDateString('tr-TR'),
    })), 'subscriptions')
  }

  const cikis = async () => {
    await supabase.auth.signOut()
    navigate('/')
  }

  const kullanici = { ad: profile?.name || session?.user?.email, avatar: profile?.avatar_url, eposta: session?.user?.email }
  const hesapMenusu = [
    { ad: 'Kişisel panele dön', ikon: LayoutGrid, onClick: () => navigate('/dashboard') },
    { ad: 'Çıkış yap', ikon: LogOut, onClick: cikis, tehlike: true },
  ]

  const oturumAdi = profile?.username || profile?.name?.split(' ')[0] || ''
  const ikiAdim = veri.mfa ? (veri.mfa.totp_kurulu ? '2FA açık' : '2FA kapalı') : null
  const sagUst = (
    <>
      {oturumAdi && (
        <span className="hidden xl:inline text-xs text-metin-2 whitespace-nowrap">
          Oturum: {oturumAdi}{ikiAdim ? ` · ${ikiAdim}` : ''}
        </span>
      )}
      <label className="relative hidden md:block">
        <span className="sr-only">Platformda ara</span>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-metin-2" aria-hidden="true" />
        <input
          type="search"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Kullanıcı, e-posta, kurum veya kart kodu…"
          className="h-10 w-[280px] lg:w-[360px] rounded-[10px] border border-cizgi bg-zemin pl-9 pr-3 text-[13px] text-metin placeholder:text-metin-2/80 focus:outline-none focus:ring-2 focus:ring-aksan/40 focus:border-aksan"
        />
      </label>
    </>
  )

  const csvDugmeleri = (ne) => (
    <>
      {(ne === 'hepsi' || ne === 'users') && <Dugme ikon={Download} onClick={kullanicilariIndir} disabled={yukleniyor}>Kullanıcılar CSV</Dugme>}
      {(ne === 'hepsi' || ne === 'subs') && <Dugme ikon={ne === 'subs' ? Download : undefined} onClick={abonelikleriIndir} disabled={yukleniyor}>Abonelikler CSV</Dugme>}
    </>
  )
  const yenileDugmesi = (
    <IkonDugme etiket="Verileri yenile" ikon={RefreshCw} onClick={yenile} disabled={yenileniyor} className="w-10 h-10" />
  )

  const tabloOrtak = {
    plan: tablo.plan,
    durum: tablo.durum,
    onPlan: (plan) => setTablo((x) => ({ ...x, plan })),
    onDurum: (durum) => setTablo((x) => ({ ...x, durum })),
    arama,
    onArama: setArama,
    veri,
    t,
    onAc: ac,
  }

  const sayfa = SAYFA[bolum]
  let icerik
  if (yukleniyor) {
    icerik = <Yukleniyor className="py-24" />
  } else if (bolum === 'platform') {
    icerik = (
      <>
        <SayfaBaslik
          baslik="Platform"
          alt={`Canlı sayılar · son güncelleme ${goreli(veri.zaman)}`}
          sag={<>{yenileDugmesi}{csvDugmeleri('hepsi')}</>}
        />
        <Istatistikler t={t} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <PlanDagilimi t={t} />
          <DikkatGerektiren t={t} onGit={dikkateGit} />
        </div>
        <div ref={tabloRef} className="scroll-mt-20">
          <KayitTablosu
            key={tablo.tur}
            tur={tablo.tur}
            sekmeli
            onTur={(tur) => setTablo({ tur, ...BOS_FILTRE })}
            {...tabloOrtak}
          />
        </div>
      </>
    )
  } else {
    icerik = (
      <>
        <SayfaBaslik
          baslik={sayfa.baslik}
          alt={sayfa.alt}
          sag={<>{yenileDugmesi}{(sayfa.tur === 'users' || sayfa.tur === 'subs') && csvDugmeleri(sayfa.tur)}</>}
        />
        {sayfa.tur === 'subs' && <PlanDagilimi t={t} />}
        <KayitTablosu key={sayfa.tur} tur={sayfa.tur} etiket={sayfa.baslik} {...tabloOrtak} />
      </>
    )
  }

  const seciliKisi = secili ? t.kisi.get(secili) : null

  return (
    <PanelKabugu
      menu={MENU}
      aktif={bolum}
      onSec={bolumSec}
      ustEtiket={<Rozet ton="vurguDolu">Yönetici</Rozet>}
      sagUst={sagUst}
      kullanici={kullanici}
      hesapMenusu={hesapMenusu}
      altSlot={
        <p className="px-3 text-[11px] leading-relaxed text-metin-2">
          Rol, plan ve silme işlemleri gerekçesiyle denetim kaydına yazılır ve ikinci onay ister.
        </p>
      }
    >
      {!yukleniyor && veri.hatalar.length > 0 && (
        <Kart vurgu="tehlike" className="px-4 py-3 flex items-start gap-2.5 text-[13px]" role="alert">
          <AlertTriangle size={16} className="text-red-600 dark:text-red-400 mt-0.5 shrink-0" aria-hidden="true" />
          <span className="text-metin">
            Şu veriler yüklenemedi: {veri.hatalar.join(', ')}. İlgili sayılar eksik görünebilir.
          </span>
        </Kart>
      )}
      {icerik}

      {seciliKisi && (
        <KullaniciPaneli
          key={seciliKisi.id}
          kullanici={seciliKisi}
          abonelik={t.abonelik.get(seciliKisi.id)}
          kurumlar={t.kurulanKurum.get(seciliKisi.id)}
          benimProfilId={profile?.id}
          onKapat={() => setSecili(null)}
          onayIste={setOnay}
          onDegisti={degisti}
          engelli={!!onay}
        />
      )}
      <ConfirmModal
        isOpen={!!onay}
        onClose={() => setOnay(null)}
        title={onay?.title}
        message={onay?.message}
        confirmText={onay?.confirmText}
        variant={onay?.variant}
        onConfirm={() => onay?.onConfirm()}
      />
    </PanelKabugu>
  )
}
