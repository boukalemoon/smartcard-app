// KURUMSAL / STK PANELİ — giriş
//
// Tasarım: KurumGenel, KurumUyeler, KurumBasvurular, KurumOlcum, KurumPartner.
// Tek çağrı (my_organizations) kurumları, rolümü, üye sayısını, bekleyen
// başvuruyu ve STK kararını getirir. Aktif bölüm adreste (?kbolum=…) durur;
// seçili kurum tarayıcıda hatırlanır (yalnızca kolaylık).
import { useCallback, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import PanelKabugu from '../PanelKabugu'
import { BosDurum, Dugme, Kart, Yukleniyor } from '../ui'
import { bildir } from '../../lib/bildirim'
import { useVeri, rpc } from './veri'
import { KurumSecici, SayfaBas } from './ortak'
import KurumGenel from './KurumGenel'
import KurumUyeler from './KurumUyeler'
import KurumBasvurular from './KurumBasvurular'
import KurumOlcum from './KurumOlcum'
import KurumPartner from './KurumPartner'
import KurumProfili from './KurumProfili'
import KurumKoltuklar from './KurumKoltuklar'
import { kurumsalMenu } from '../menuler'
import KurumAyarlari, { KurumOlustur } from './KurumAyarlari'

const SECILI_ANAHTAR = 'qrtim-kurum-secili'
const oku = () => { try { return localStorage.getItem(SECILI_ANAHTAR) } catch { return null } }
const yaz = (id) => { try { localStorage.setItem(SECILI_ANAHTAR, id) } catch { /* gizli pencere */ } }

const kurumlariYukle = async () => (await rpc('my_organizations')) || []


export default function KurumPaneli({ profile, kullanici, hesapMenusu, onModDegistir }) {
  const [arama, setArama] = useSearchParams()
  const [seciliId, setSeciliId] = useState(oku)
  const { veri: kurumlar, yukleniyor, hata, yenile } = useVeri(kurumlariYukle)

  const liste = kurumlar || []
  const kurum = liste.find((k) => k.id === seciliId) || liste[0] || null
  const menu = kurumsalMenu(kurum)
  const istenen = arama.get('kbolum') || 'genel'
  const bolum = menu.some((m) => m.anahtar === istenen) ? istenen : 'genel'

  const bolumSec = useCallback((anahtar, ek = {}) => {
    setArama((onceki) => {
      const n = new URLSearchParams(onceki)
      n.set('kbolum', anahtar)
      n.delete('basvuru')
      for (const [k, v] of Object.entries(ek)) n.set(k, v)
      return n
    })
    window.scrollTo({ top: 0 })
  }, [setArama])

  const kurumSec = (id) => { setSeciliId(id); yaz(id); bolumSec('genel') }

  // Bireysel paneldeki bir bölüme geç (plan, partner).
  const bireyseleGec = (b) => {
    setArama((onceki) => { const n = new URLSearchParams(onceki); n.delete('kbolum'); n.set('bolum', b); return n })
    onModDegistir('bireysel')
  }

  const kabuk = (icerik, ust) => (
    <PanelKabugu
      menu={kurum ? menu : []}
      aktif={bolum}
      onSec={(a) => bolumSec(a)}
      mod="kurumsal"
      kurumsalAcik
      onModDegistir={onModDegistir}
      kullanici={kullanici}
      hesapMenusu={hesapMenusu}
      ustSlot={ust}
    >
      {icerik}
    </PanelKabugu>
  )

  if (yukleniyor && !kurumlar) return kabuk(<Yukleniyor className="py-24" />)

  if (hata) {
    return kabuk(
      <Kart className="p-5">
        <BosDurum ikon={Building2} baslik="Kurumlar yüklenemedi" aciklama="Bağlantınızı kontrol edip tekrar deneyin." eylem={<Dugme onClick={yenile}>Tekrar dene</Dugme>} />
      </Kart>,
    )
  }

  if (!kurum) {
    return kabuk(
      <>
        <SayfaBas baslik="Kurumsal panel" alt="Kurum ya da STK yönetimi" />
        <Kart className="p-5">
          <BosDurum
            ikon={Building2}
            baslik="Henüz bir kurumunuz yok"
            aciklama="Bir kurum oluşturduğunuzda ya da bir kurumun davetini kabul ettiğinizde burada görünür. Yönetici olduğunuz kurumlarda üyeleri, başvuruları ve ölçümü buradan yönetirsiniz."
            eylem={<Dugme tur="ikincil" onClick={() => onModDegistir('bireysel')}>Bireysel panele dön</Dugme>}
          />
        </Kart>
        <KurumOlustur bildir={bildir} onOlustu={(id) => { setSeciliId(id); yaz(id); yenile() }} />
      </>,
    )
  }

  const ortak = { kurum, profile, bildir, bolumSec, yenileKurumlar: yenile }
  let sayfa
  if (bolum === 'uyeler') sayfa = <KurumUyeler key={kurum.id} {...ortak} />
  else if (bolum === 'basvurular') sayfa = <KurumBasvurular key={kurum.id} {...ortak} />
  else if (bolum === 'profil') sayfa = <KurumProfili key={kurum.id} {...ortak} />
  else if (bolum === 'koltuk') sayfa = <KurumKoltuklar key={kurum.id} {...ortak} />
  else if (bolum === 'olcum') sayfa = <KurumOlcum key={kurum.id} {...ortak} />
  else if (bolum === 'partner') sayfa = <KurumPartner key={kurum.id} {...ortak} bireyseleGec={bireyseleGec} />
  else if (bolum === 'ayarlar') sayfa = <KurumAyarlari key={kurum.id} {...ortak} kurumlar={liste} onKurumSec={kurumSec} />
  else sayfa = <KurumGenel key={kurum.id} {...ortak} bireyseleGec={bireyseleGec} />

  // Tasarımın gövde metni 14px; sayfa içeriği bu ölçüyü miras alır.
  return kabuk(<div className="contents text-sm">{sayfa}</div>, <KurumSecici kurumlar={liste} secili={kurum} onSec={kurumSec} />)
}
