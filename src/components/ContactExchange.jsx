import { useState } from 'react'
import { UserPlus, Check } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// KARŞILIKLI KARTVİZİT DEĞİŞİMİ
//
// Kartı gören kişi kendi bilgisini bırakır. Kağıt kartvizitte doğal olan şey
// (karşılıklı kart verme) dijitalde tek yönlü kalıyordu: kart sahibi kimin
// baktığını bilmiyordu.
//
// GİZLİLİK: Bilgi QRtım'a değil, KART SAHİBİNE veriliyor. Bunu formda açıkça
// yazıyoruz; onay kutusu işaretlenmeden gönderilemiyor. Kimlik numarası gibi
// alanlar bilerek istenmiyor.

const HATALAR = {
  kart_bulunamadi: 'Kart bulunamadı. Bağlantıyı yeniden açmayı deneyin.',
  ad_gerekli: 'Lütfen adınızı yazın.',
  iletisim_gerekli: 'E-posta veya telefondan en az birini yazın.',
  gecersiz_eposta: 'E-posta adresi geçerli görünmüyor.',
  cok_fazla_deneme: 'Çok fazla deneme yapıldı. Bir saat sonra tekrar deneyin.',
  kart_dolu: 'Bu kart bugün çok fazla bilgi aldı. Yarın tekrar deneyin.',
}

export default function ContactExchange({ hedef, kartSahibi, temaRengi }) {
  const [acik, setAcik] = useState(false)
  const [gonderildi, setGonderildi] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata] = useState('')
  const [onay, setOnay] = useState(false)
  const [form, setForm] = useState({ ad: '', eposta: '', telefon: '', firma: '', not: '' })

  const alan = (k) => ({
    value: form[k],
    onChange: (e) => setForm((o) => ({ ...o, [k]: e.target.value })),
  })

  const gonder = async (e) => {
    e.preventDefault()
    setHata('')
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

  if (gonderildi) {
    return (
      <div className="mt-2 p-4 bg-green-50 border border-green-200 rounded-xl text-center">
        <Check className="w-6 h-6 text-green-600 mx-auto mb-1" />
        <p className="text-sm font-semibold text-green-800">Bilgileriniz iletildi</p>
        <p className="text-xs text-green-700 mt-1">
          {kartSahibi ? `${kartSahibi} sizinle iletişime geçebilir.` : 'Kart sahibi sizinle iletişime geçebilir.'}
        </p>
      </div>
    )
  }

  if (!acik) {
    return (
      <button
        onClick={() => setAcik(true)}
        className="w-full flex items-center justify-center gap-2 py-2.5 border-2 rounded-lg font-semibold text-sm transition-colors hover:bg-gray-50"
        style={{ borderColor: temaRengi || '#3B82F6', color: temaRengi || '#3B82F6' }}
      >
        <UserPlus size={18} />
        Ben de kartımı bırakayım
      </button>
    )
  }

  return (
    <form onSubmit={gonder} className="mt-2 p-4 bg-gray-50 rounded-xl space-y-3 text-left">
      <p className="text-xs text-gray-600">
        Bilgileriniz <strong>{kartSahibi || 'kart sahibine'}</strong> iletilir; QRtım
        bunları kart sahibi adına saklar. Dilediğiniz zaman silinmesini isteyebilirsiniz.
      </p>

      <input {...alan('ad')} required placeholder="Adınız Soyadınız *" maxLength={80}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      <input {...alan('eposta')} type="email" placeholder="E-posta" maxLength={120}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      <input {...alan('telefon')} type="tel" placeholder="Telefon" maxLength={25}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      <input {...alan('firma')} placeholder="Firma (isteğe bağlı)" maxLength={80}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
      <textarea {...alan('not')} rows={2} maxLength={500} placeholder="Not (isteğe bağlı)"
        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />

      <label className="flex items-start gap-2 text-xs text-gray-600">
        <input type="checkbox" checked={onay} onChange={(e) => setOnay(e.target.checked)} className="mt-0.5" />
        <span>Bilgilerimin kart sahibiyle paylaşılmasını onaylıyorum.</span>
      </label>

      {hata && <p className="text-xs text-red-600">{hata}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={() => setAcik(false)}
          className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-semibold">
          Vazgeç
        </button>
        <button type="submit" disabled={yukleniyor}
          className="flex-1 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
          style={{ backgroundColor: temaRengi || '#3B82F6' }}>
          {yukleniyor ? 'Gönderiliyor…' : 'Gönder'}
        </button>
      </div>
      <p className="text-[11px] text-gray-400">* Ad ve en az bir iletişim bilgisi gerekli.</p>
    </form>
  )
}
