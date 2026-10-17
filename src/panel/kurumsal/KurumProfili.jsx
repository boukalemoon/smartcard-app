// KURUM — Kurum profili (tasarımı yok; OrganizationProfileManager işlevleri yeni dille)
//
// Yalnızca künye alanları yazılır; paylaşım ayarları (settings) Ayarlar
// sayfasında. İki sayfa aynı satırı güncellediği için biri diğerinin
// alanını ezmesin diye yazımlar alan bazında ayrıldı.
import { useCallback, useState } from 'react'
import { Save } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import ImageUpload from '../../components/ImageUpload'
import { Kart, Dugme, Girdi, Alan, Rozet, Yukleniyor, BosDurum } from '../ui'
import { useVeri, TUR_AD } from './veri'
import { SayfaBas, KartBas, KurumLogo } from './ortak'

// Seçenek listesi: sunucudaki tür adları (STK kararı is_stk_org_type'ta).
const TURLER = ['company', 'corporation', 'chamber', 'association', 'foundation', 'community', 'union']
const STK = ['association', 'foundation', 'community', 'union', 'dernek', 'vakif', 'vakıf', 'topluluk', 'sendika', 'stk']

const alanSinifi = 'w-full rounded-[10px] border border-cizgi bg-yuzey px-3.5 py-2.5 text-[15px] text-metin placeholder:text-metin-2/70 focus:outline-none focus:ring-2 focus:ring-aksan/40 focus:border-aksan'

export default function KurumProfili({ kurum, bildir, yenileKurumlar }) {
  const yukle = useCallback(async () => {
    const { data, error } = await supabase.from('organizations').select('*').eq('id', kurum.id).single()
    if (error) throw error
    return data
  }, [kurum.id])
  const { veri: satir, yukleniyor, hata, yenile } = useVeri(yukle)

  return (
    <>
      <SayfaBas baslik="Kurum profili" alt="Üye kartlarındaki kurum rozeti, üye dizini ve başvuru formunda görünen bilgiler" />
      {yukleniyor && !satir ? <Yukleniyor /> : hata || !satir ? (
        <Kart className="p-5"><BosDurum baslik="Kurum bilgisi alınamadı" eylem={<Dugme onClick={yenile}>Tekrar dene</Dugme>} /></Kart>
      ) : (
        <ProfilFormu key={satir.updated_at || satir.id} satir={satir} kurum={kurum} bildir={bildir} sonra={() => { yenile(); yenileKurumlar() }} />
      )}
    </>
  )
}

function ProfilFormu({ satir, kurum, bildir, sonra }) {
  const [f, setF] = useState(() => ({
    name: satir.name || '', type: satir.type || 'company', description: satir.description || '',
    website: satir.website || '', email: satir.email || '', phone: satir.phone || '',
    city: satir.city || '', address: satir.address || '',
  }))
  const [logo, setLogo] = useState(satir.logo_url || null)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const degistir = (k) => (e) => setF((o) => ({ ...o, [k]: e.target.value }))
  const stk = STK.includes(String(f.type).toLowerCase())
  const turler = TURLER.includes(f.type) ? TURLER : [...TURLER, f.type]

  const kaydet = async (e) => {
    e.preventDefault()
    if (!f.name.trim()) { bildir('Kurum adı zorunlu.', 'error'); return }
    setKaydediliyor(true)
    try {
      // Etkilenen satır kontrolü: erişim kuralı engellerse Supabase hata vermez.
      const { data, error } = await supabase.from('organizations')
        .update({ ...f, name: f.name.trim(), updated_at: new Date().toISOString() })
        .eq('id', kurum.id).select('id')
      if (error) throw error
      if (!data?.length) { bildir('Güncellenemedi. Bu işlem için kurum yöneticisi olmanız gerekiyor.', 'error'); return }
      bildir('Kurum profili kaydedildi.', 'success')
      sonra()
    } catch (err) {
      bildir('Kaydedilemedi: ' + err.message, 'error')
    } finally {
      setKaydediliyor(false)
    }
  }

  const logoKaydet = async (url) => {
    const { data, error } = await supabase.from('organizations').update({ logo_url: url }).eq('id', kurum.id).select('id')
    if (error || !data?.length) { bildir('Logo güncellenemedi. Bu işlem için kurum yöneticisi olmanız gerekiyor.', 'error'); return }
    setLogo(url)
    bildir('Logo güncellendi.', 'success')
    sonra()
  }

  return (
    <form onSubmit={kaydet} className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-5 items-start">
      <div className="flex flex-col gap-5 min-w-0">
        <Kart className="p-5 flex flex-col gap-4" aria-labelledby="kp-temel">
          <KartBas id="kp-temel">Temel bilgiler</KartBas>
          <Alan id="kp-ad" etiket="Kurum adı">
            <Girdi id="kp-ad" value={f.name} onChange={degistir('name')} required maxLength={120} />
          </Alan>
          <Alan id="kp-tur" etiket="Kurum türü" ipucu="Dernek, vakıf, topluluk ve sendika türleri STK sayılır; üye dizini ve başvuru formu yalnızca bu türlerde açılır.">
            <select id="kp-tur" value={f.type} onChange={degistir('type')} className={alanSinifi + ' h-11 py-0'}>
              {turler.map((t) => <option key={t} value={t}>{TUR_AD[t] || t}</option>)}
            </select>
          </Alan>
          <Alan id="kp-aciklama" etiket="Açıklama">
            <textarea id="kp-aciklama" rows={4} value={f.description} onChange={degistir('description')} className={alanSinifi} placeholder="Kurumunuzu bir iki cümleyle anlatın" maxLength={1000} />
          </Alan>
        </Kart>

        <Kart className="p-5 flex flex-col gap-4" aria-labelledby="kp-iletisim">
          <KartBas id="kp-iletisim">İletişim</KartBas>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Alan id="kp-web" etiket="Web sitesi"><Girdi id="kp-web" type="url" value={f.website} onChange={degistir('website')} placeholder="https://" /></Alan>
            <Alan id="kp-eposta" etiket="E-posta"><Girdi id="kp-eposta" type="email" value={f.email} onChange={degistir('email')} placeholder="iletisim@kurum.org" /></Alan>
            <Alan id="kp-tel" etiket="Telefon"><Girdi id="kp-tel" type="tel" value={f.phone} onChange={degistir('phone')} placeholder="+90" /></Alan>
            <Alan id="kp-sehir" etiket="Şehir"><Girdi id="kp-sehir" value={f.city} onChange={degistir('city')} /></Alan>
          </div>
          <Alan id="kp-adres" etiket="Adres"><Girdi id="kp-adres" value={f.address} onChange={degistir('address')} /></Alan>
        </Kart>

        <div className="flex justify-end">
          <Dugme type="submit" tur="ana" ikon={Save} disabled={kaydediliyor || !f.name.trim()}>{kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}</Dugme>
        </div>
      </div>

      <div className="flex flex-col gap-5 min-w-0">
        <Kart className="p-5 flex flex-col gap-4" aria-labelledby="kp-logo">
          <KartBas id="kp-logo">Logo</KartBas>
          <div className="flex items-center gap-3">
            <KurumLogo kurum={{ ...kurum, name: f.name, logo_url: logo }} boyut={56} />
            <div className="min-w-0">
              <b className="block font-semibold truncate">{f.name || 'Kurum adı'}</b>
              <div className="flex gap-1.5 mt-1 flex-wrap">{stk && <Rozet ton="aksan">STK</Rozet>}<Rozet>{TUR_AD[f.type] || f.type}</Rozet></div>
            </div>
          </div>
          <ImageUpload currentImageUrl={logo} onUploadSuccess={logoKaydet} bucket="logos" label="Kurum logosu" maxSize={2} />
        </Kart>
      </div>
    </form>
  )
}
