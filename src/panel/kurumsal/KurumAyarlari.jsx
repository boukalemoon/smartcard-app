// KURUM — Ayarlar (tasarımı yok; OrganizationProfileManager paylaşım ayarları
// + OrganizationManager kurum oluşturma/silme işlevleri yeni dille)
import { useCallback, useState } from 'react'
import { Copy, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { Kart, Dugme, Girdi, Alan, Anahtar, Ilerleme, Yukleniyor } from '../ui'
import { sayi } from '../bicim'
import { useVeri, rpc, kurumAdresi, kisaAdres, TUR_AD, KURUM_HATALARI } from './veri'
import { SayfaBas, KartBas, OnayPenceresi } from './ortak'

export default function KurumAyarlari({ kurum, kurumlar, bildir, yenileKurumlar, onKurumSec }) {
  const [onay, setOnay] = useState(null)

  // Ayarlar my_organizations'dan da geliyor ama yazmadan hemen önce taze
  // kayıt okunur: başka yöneticinin değiştirdiği ayar ezilmesin.
  const yukle = useCallback(async () => {
    const { data, error } = await supabase.from('organizations').select('id, settings, updated_at').eq('id', kurum.id).single()
    if (error) throw error
    return data
  }, [kurum.id])
  const { veri: satir, yukleniyor, yenile } = useVeri(yukle)

  const sil = () => setOnay({
    baslik: 'Kurumu sil',
    mesaj: `${kurum.name} ve tüm üyelik kayıtları kalıcı olarak silinecek. Üyelerin kendi kartları silinmez, yalnızca kurum rozeti düşer.\n\nBu işlem geri alınamaz.`,
    onay: 'Kurumu sil',
    tehlike: true,
    onEvet: async () => {
      const { data, error } = await supabase.from('organizations').delete().eq('id', kurum.id).select('id')
      if (error || !data?.length) { bildir('Kurum silinemedi. Bu işlem için kurum yöneticisi olmanız gerekiyor.', 'error'); return }
      bildir('Kurum silindi.', 'success')
      const baska = kurumlar.find((k) => k.id !== kurum.id)
      if (baska) onKurumSec(baska.id)
      yenileKurumlar()
    },
  })

  return (
    <>
      <SayfaBas baslik="Ayarlar" alt={`${kurum.name} · herkese açık sayfalar ve kurum işlemleri`} />

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-5 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          {kurum.is_stk ? (
            yukleniyor && !satir ? <Yukleniyor /> : satir && (
              <PaylasimAyarlari key={satir.updated_at || satir.id} kurum={kurum} ayar={satir.settings || {}} bildir={bildir} sonra={() => { yenile(); yenileKurumlar() }} />
            )
          ) : (
            <Kart className="p-5 flex flex-col gap-2" aria-labelledby="ka-acik">
              <KartBas id="ka-acik">Herkese açık sayfalar</KartBas>
              <p className="text-[13px] text-metin-2">
                Üye dizini ve başvuru formu dernek, vakıf, topluluk ve sendika türündeki kurumlarda açılır. Bu kurumun türü: {TUR_AD[kurum.type] || kurum.type}.
              </p>
            </Kart>
          )}

          <Kart vurgu="tehlike" className="p-5 flex flex-col gap-3" aria-labelledby="ka-sil">
            <KartBas id="ka-sil">Kurumu sil</KartBas>
            <p className="text-[13px] text-metin-2">Kurum, üyelik kayıtları ve başvurular kalıcı olarak silinir. Önce üye listesini CSV olarak indirmeniz önerilir.</p>
            <Dugme tur="tehlike" ikon={Trash2} className="self-start" onClick={sil}>Kurumu sil</Dugme>
          </Kart>
        </div>

        <div className="flex flex-col gap-5 min-w-0">
          <KurumOlustur bildir={bildir} onOlustu={(id) => { yenileKurumlar(); if (id) onKurumSec(id) }} />
        </div>
      </div>

      <OnayPenceresi istek={onay} onKapat={() => setOnay(null)} />
    </>
  )
}

function PaylasimAyarlari({ kurum, ayar, bildir, sonra }) {
  const [dizin, setDizin] = useState(!!ayar.allowPublicDirectory)
  const [uyeler, setUyeler] = useState(String(ayar.memberVisibility || '').toLowerCase() === 'public')
  const [iletisim, setIletisim] = useState(!!ayar.showMemberContact)
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const degisti = dizin !== !!ayar.allowPublicDirectory
    || uyeler !== (String(ayar.memberVisibility || '').toLowerCase() === 'public')
    || iletisim !== !!ayar.showMemberContact

  const kaydet = async () => {
    setKaydediliyor(true)
    try {
      const { data, error } = await supabase.from('organizations')
        .update({
          settings: { ...ayar, allowPublicDirectory: dizin, memberVisibility: uyeler ? 'public' : 'members_only', showMemberContact: iletisim },
          updated_at: new Date().toISOString(),
        })
        .eq('id', kurum.id).select('id')
      if (error) throw error
      if (!data?.length) { bildir('Kaydedilemedi. Bu işlem için kurum yöneticisi olmanız gerekiyor.', 'error'); return }
      bildir('Paylaşım ayarları kaydedildi.', 'success')
      sonra()
    } catch (e) {
      bildir('Kaydedilemedi: ' + e.message, 'error')
    } finally {
      setKaydediliyor(false)
    }
  }

  const kopyala = async (a) => {
    try { await navigator.clipboard.writeText(a); bildir('Bağlantı kopyalandı.', 'success') } catch { bildir('Kopyalanamadı.', 'error') }
  }

  const satirlar = [
    { id: 'ka-dizin', deger: dizin, ayarla: setDizin, baslik: 'Herkese açık sayfalar aktif', aciklama: 'Kurum bilgileriniz ve üye dizini paylaşılabilir olur.' },
    { id: 'ka-uyeler', deger: uyeler, ayarla: setUyeler, baslik: 'Üye listesi herkese açık', aciklama: 'Kapalıyken dizin bağlantısı boş liste gösterir. Açıkken aktif üyelerin adı ve rolü listelenir.' },
    { id: 'ka-iletisim', deger: iletisim, ayarla: setIletisim, baslik: 'Üye iletişim bilgileri görünsün', aciklama: 'Üyelerin e-posta ve telefonu dizinde herkese açılır. Açmadan önce üyelerinize sorun.' },
  ]

  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="ka-acik">
      <KartBas id="ka-acik">Herkese açık sayfalar</KartBas>
      <div className="flex flex-col">
        {satirlar.map((s) => (
          <div key={s.id} className="flex items-start gap-3 py-3 border-b border-cizgi/70 last:border-0">
            <div className="flex-1 min-w-0">
              <div id={s.id} className="text-sm font-semibold text-metin">{s.baslik}</div>
              <div className="text-xs text-metin-2 mt-0.5">{s.aciklama}</div>
            </div>
            <Anahtar acik={s.deger} onChange={s.ayarla} etiket={s.baslik} />
          </div>
        ))}
      </div>
      <div className="flex flex-col gap-2">
        {[{ ad: 'Üye dizini', yol: 'members' }, { ad: 'Başvuru formu', yol: 'apply' }].map((b) => {
          const adres = kurumAdresi(kurum.id, b.yol)
          return (
            <div key={b.yol} className="flex items-center gap-2 rounded-xl bg-zemin px-3 py-2">
              <span className="text-[13px] font-semibold w-28 shrink-0">{b.ad}</span>
              <span className="font-mono text-xs text-metin-2 truncate flex-1 min-w-0">{kisaAdres(adres)}</span>
              <button type="button" onClick={() => kopyala(adres)} aria-label={`${b.ad} bağlantısını kopyala`} className="p-1.5 rounded-lg text-metin-2 hover:text-metin hover:bg-yuzey-2">
                <Copy size={14} aria-hidden="true" />
              </button>
            </div>
          )
        })}
      </div>
      <div className="flex justify-end">
        <Dugme tur="ana" onClick={kaydet} disabled={!degisti || kaydediliyor}>{kaydediliyor ? 'Kaydediliyor…' : 'Kaydet'}</Dugme>
      </div>
    </Kart>
  )
}

// Yeni kurum: kurum ve kurucu üyelik sunucuda tek işlemde (create_organization);
// sınır plan_features'tan (my_plan_limits) okunur.
export function KurumOlustur({ bildir, onOlustu }) {
  const [ad, setAd] = useState('')
  const [tur, setTur] = useState('association')
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const planYukle = useCallback(async () => rpc('my_plan_limits'), [])
  const { veri: plan, yenile } = useVeri(planYukle)

  const sinir = Number(plan?.sinir?.organizasyon ?? 0)
  const kullanim = Number(plan?.kullanim?.organizasyon ?? 0)
  const sinirsiz = sinir >= 999
  const dolu = plan?.ok && !sinirsiz && kullanim >= sinir

  const olustur = async (e) => {
    e.preventDefault()
    if (!ad.trim()) return
    setGonderiliyor(true)
    try {
      const data = await rpc('create_organization', { p_name: ad.trim(), p_type: tur, p_description: null, p_website: null, p_email: null, p_phone: null })
      if (!data?.ok) { bildir(KURUM_HATALARI[data?.hata] || 'Kurum oluşturulamadı.', 'error'); return }
      bildir(`${ad.trim()} oluşturuldu.`, 'success')
      setAd('')
      yenile()
      onOlustu?.(data.id || data.organization_id || null)
    } catch (err) {
      bildir('Kurum oluşturulamadı: ' + err.message, 'error')
    } finally {
      setGonderiliyor(false)
    }
  }

  return (
    <Kart className="p-5 flex flex-col gap-4" aria-labelledby="ka-yeni">
      <KartBas id="ka-yeni">Yeni kurum oluştur</KartBas>
      {plan?.ok && (
        <div className="text-[13px]">
          <div className="flex justify-between mb-1.5">
            <span className="text-metin-2">Yönettiğiniz kurum</span>
            <b className="tabular-nums">{sayi(kullanim)} / {sinirsiz ? 'sınırsız' : sayi(sinir)}</b>
          </div>
          {!sinirsiz && <Ilerleme oran={sinir ? kullanim / sinir : 0} etiket="Kurum hakkı kullanımı" />}
        </div>
      )}
      <form onSubmit={olustur} className="flex flex-col gap-3">
        <Alan id="ka-ad" etiket="Kurum adı">
          <Girdi id="ka-ad" value={ad} onChange={(e) => setAd(e.target.value)} placeholder="Şirket, dernek ya da topluluk adı" maxLength={120} />
        </Alan>
        <Alan id="ka-tur" etiket="Tür">
          <select id="ka-tur" value={tur} onChange={(e) => setTur(e.target.value)} className="h-11 w-full rounded-[10px] border border-cizgi bg-yuzey px-3 text-[15px] text-metin focus:outline-none focus:ring-2 focus:ring-aksan/40">
            {['association', 'foundation', 'community', 'union', 'company', 'corporation', 'chamber'].map((t) => <option key={t} value={t}>{TUR_AD[t]}</option>)}
          </select>
        </Alan>
        {dolu && <p className="text-xs text-amber-800 dark:text-amber-300">Planınızın kurum sınırına ulaştınız. Daha fazlası için planınızı yükseltin.</p>}
        <Dugme type="submit" tur="ana" ikon={Plus} className="self-start" disabled={!ad.trim() || gonderiliyor || dolu}>
          {gonderiliyor ? 'Oluşturuluyor…' : 'Kurum oluştur'}
        </Dugme>
      </form>
    </Kart>
  )
}
