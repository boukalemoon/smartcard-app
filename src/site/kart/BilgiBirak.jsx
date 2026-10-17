// KARŞILIKLI KARTVİZİT DEĞİŞİMİ (eski components/ContactExchange mantığı)
//
// Kartı gören kişi kendi bilgisini KART SAHİBİNE bırakır. Onay kutusu
// işaretlenmeden gönderilemez; kimlik numarası gibi alanlar bilerek istenmez.
import { useState } from 'react'
import { Check, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { birlestir } from '../../panel/bicim'
import { BTN, BTN_IKINCIL, ODAK, ilkAd, iyelik } from './yardim'
import { Blok, Girdi, MetinAlani } from './parcalar'

const HATALAR = {
  kart_bulunamadi: 'Kart bulunamadı. Bağlantıyı yeniden açmayı deneyin.',
  ad_gerekli: 'Lütfen adınızı yazın.',
  iletisim_gerekli: 'E-posta veya telefondan en az birini yazın.',
  gecersiz_eposta: 'E-posta adresi geçerli görünmüyor.',
  cok_fazla_deneme: 'Çok fazla deneme yapıldı. Bir saat sonra tekrar deneyin.',
  kart_dolu: 'Bu kart bugün çok fazla bilgi aldı. Yarın tekrar deneyin.',
}

export default function BilgiBirak({ hedef, kartSahibi }) {
  const [gonderildi, setGonderildi] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [onay, setOnay] = useState(false)
  const [ek, setEk] = useState(false)
  const [form, setForm] = useState({ ad: '', eposta: '', telefon: '', firma: '', not: '' })
  const ad = ilkAd(kartSahibi)

  const alan = (k) => ({ value: form[k], onChange: (e) => setForm((o) => ({ ...o, [k]: e.target.value })) })

  const gonder = async (e) => {
    e.preventDefault()
    setHata('')
    if (!form.eposta && !form.telefon) { setHata(HATALAR.iletisim_gerekli); setEk(true); return }
    if (!onay) { setHata('Devam etmek için onay kutusunu işaretleyin.'); return }
    setYukleniyor(true)
    try {
      const { data, error } = await supabase.rpc('leave_card_contact', {
        p_code: hedef.code,
        p_username: hedef.username,
        p_name: form.ad,
        p_email: form.eposta || null,
        p_phone: form.telefon || null,
        p_company: form.firma || null,
        p_note: form.not || null,
        p_source: hedef.source,
      })
      if (error) throw error
      if (!data?.ok) { setHata(HATALAR[data?.hata] || 'Bilgileriniz gönderilemedi.'); return }
      setGonderildi(true)
    } catch (err) {
      setHata('Bağlantı hatası: ' + err.message)
    } finally {
      setYukleniyor(false)
    }
  }

  return (
    <Blok baslik="Bilgilerinizi bırakın" baslikId="kart-kisi">
      {gonderildi ? (
        <div role="status" className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 dark:border-emerald-400/30 dark:bg-emerald-400/10 p-3">
          <Check size={18} aria-hidden="true" className="shrink-0 mt-0.5 text-emerald-700 dark:text-emerald-300" />
          <div>
            <p className="text-[14px] font-semibold text-emerald-900 dark:text-emerald-200">Bilgileriniz iletildi</p>
            <p className="text-xs text-emerald-800 dark:text-emerald-300">{kartSahibi ? `${kartSahibi} sizinle iletişime geçebilir.` : 'Kart sahibi sizinle iletişime geçebilir.'}</p>
          </div>
        </div>
      ) : (
        <form onSubmit={gonder} className="flex flex-col gap-2.5">
          <p className="text-[13px] text-metin-2">
            {ad ? `${iyelik(ad)} sizi tanıması için` : 'Kart sahibinin sizi tanıması için'} ad ve e-postanızı paylaşın. Bilgiler yalnızca kart sahibine gider.
          </p>
          <Girdi id="kb-ad" etiket="Ad Soyad" required maxLength={80} autoComplete="name" {...alan('ad')} />
          <Girdi id="kb-eposta" etiket="E-posta" type="email" maxLength={120} autoComplete="email" placeholder="ad@ornek.com" {...alan('eposta')} />
          {ek ? (
            <>
              <Girdi id="kb-tel" etiket="Telefon" type="tel" maxLength={25} autoComplete="tel" {...alan('telefon')} />
              <Girdi id="kb-firma" etiket="Firma (isteğe bağlı)" maxLength={80} autoComplete="organization" {...alan('firma')} />
              <MetinAlani id="kb-not" etiket="Not (isteğe bağlı)" maxLength={500} {...alan('not')} />
            </>
          ) : (
            <button type="button" onClick={() => setEk(true)} className={birlestir('self-start inline-flex items-center gap-1 text-[13px] font-semibold text-aksan hover:text-aksan-koyu rounded', ODAK)}>
              <Plus size={14} aria-hidden="true" />Telefon, firma veya not ekle
            </button>
          )}
          <label className="flex items-start gap-2 text-xs text-metin-2">
            <input type="checkbox" checked={onay} onChange={(e) => setOnay(e.target.checked)} className="mt-0.5 h-4 w-4 accent-[rgb(var(--renk-aksan))]" />
            <span>Bilgilerimin kart sahibiyle paylaşılmasını onaylıyorum.</span>
          </label>
          {hata && <p className="text-xs text-red-700 dark:text-red-300" role="alert">{hata}</p>}
          <button type="submit" disabled={yukleniyor} className={birlestir(BTN, BTN_IKINCIL, 'w-full')}>
            {yukleniyor ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </form>
      )}
    </Blok>
  )
}
