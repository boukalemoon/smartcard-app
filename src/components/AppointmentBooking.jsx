import { useEffect, useState } from 'react'
import { CalendarClock, Check, ChevronLeft, ChevronRight, CalendarPlus } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { randevuIcsIndir } from '../utils/takvim'

// KARTTAN RANDEVU
//
// Linktree'de bu ancak dışarıdan bir takvim aracı gömülerek oluyor; bizde
// kartın kendi parçası ve aynı ölçüm hattında — randevunun QR okutandan mı
// geldiği belli.
//
// SAATLER TÜRKİYE SAATİYLE gösterilir ve bu açıkça yazar. Ziyaretçinin kendi
// saat dilimine çevirmek, yurt dışındaki birinin "sabah 9" sanıp gece yarısı
// randevu almasına yol açardı; esnafın takvimi kaymamalı.

const HATALAR = {
  kart_bulunamadi: 'Kart bulunamadı.',
  randevu_kapali: 'Randevu alımı kapalı.',
  ad_gerekli: 'Lütfen adınızı yazın.',
  iletisim_gerekli: 'E-posta veya telefondan en az birini yazın.',
  saat_gerekli: 'Lütfen bir saat seçin.',
  cok_yakin: 'Bu saat için artık çok geç. Daha ileri bir saat seçin.',
  cok_ileri: 'Bu kadar ileri tarihe randevu alınamıyor.',
  saat_uygun_degil: 'Bu saat uygun değil. Listeden bir saat seçin.',
  saat_dolu: 'Bu saati az önce başkası aldı. Başka bir saat seçin.',
  cok_fazla_deneme: 'Çok fazla deneme yapıldı. Bir saat sonra tekrar deneyin.',
  kart_dolu: 'Bugün için randevu sınırına ulaşıldı. Yarın tekrar deneyin.',
}

const SAAT_BICIMI = { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }
const GUN_BICIMI = { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Istanbul' }

function gunEkle(tarih, n) {
  const d = new Date(tarih)
  d.setDate(d.getDate() + n)
  return d
}

function isoGun(d) {
  // Türkiye saatine göre takvim günü.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(d)
}

export default function AppointmentBooking({ hedef, temaRengi, kartSahibi }) {
  const [gun, setGun] = useState(() => gunEkle(new Date(), 1))
  const [veri, setVeri] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [secili, setSecili] = useState(null)
  const [form, setForm] = useState({ ad: '', eposta: '', telefon: '', aciklama: '' })
  const [gonderiliyor, setGonderiliyor] = useState(false)
  const [sonuc, setSonuc] = useState(null)
  const [hata, setHata] = useState('')

  useEffect(() => {
    let iptal = false
    ;(async () => {
      const { data } = await supabase.rpc('appointment_slots', {
        p_code: hedef.code || null,
        p_username: hedef.username || null,
        p_gun: isoGun(gun),
      })
      if (iptal) return
      setVeri(data || null)
      setSecili(null)
      setYukleniyor(false)
    })()
    return () => { iptal = true }
  }, [gun, hedef.code, hedef.username])

  const gonder = async (e) => {
    e.preventDefault()
    setHata('')
    setGonderiliyor(true)
    try {
      const { data, error } = await supabase.rpc('book_appointment', {
        p_code: hedef.code || null,
        p_username: hedef.username || null,
        p_baslar: secili,
        p_ad: form.ad,
        p_eposta: form.eposta || null,
        p_telefon: form.telefon || null,
        p_aciklama: form.aciklama || null,
        p_kaynak: hedef.source || null,
      })
      if (error) throw error
      if (!data?.ok) {
        setHata(HATALAR[data?.hata] || 'Randevu alınamadı.')
        // Saat kapıldıysa listeyi tazele ki kişi boşuna uğraşmasın.
        if (data?.hata === 'saat_dolu' || data?.hata === 'saat_uygun_degil') {
          setGun(new Date(gun))
          setSecili(null)
        }
        return
      }
      setSonuc(data)
    } catch (err) {
      setHata('Bağlantı hatası: ' + err.message)
    } finally {
      setGonderiliyor(false)
    }
  }

  // Randevu kapalıysa bölüm hiç görünmez.
  if (yukleniyor || !veri?.ok) return null

  if (sonuc) {
    return (
      <div className="pt-4 border-t border-gray-200">
        <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-center">
          <Check className="w-6 h-6 text-green-600 mx-auto mb-1" />
          <p className="text-sm font-semibold text-green-800">
            {sonuc.durum === 'onaylandi' ? 'Randevunuz alındı' : 'Randevu talebiniz iletildi'}
          </p>
          <p className="text-xs text-green-700 mt-1">
            {new Date(sonuc.baslar_at).toLocaleDateString('tr-TR', GUN_BICIMI)} ·{' '}
            {new Date(sonuc.baslar_at).toLocaleTimeString('tr-TR', SAAT_BICIMI)}
            {' '}(Türkiye saati)
          </p>
          {sonuc.durum !== 'onaylandi' && (
            <p className="text-xs text-green-700 mt-1">Onaylandığında size dönülecek.</p>
          )}

          {/* Kişinin bizde hesabı yok; takvimine abone olamayız. Tek seferlik
              dosya her takvim uygulamasında açılır ve hatırlatmayı KENDİ
              takvimi yapar — bizim e-posta göndermemize gerek kalmaz. */}
          <button
            type="button"
            onClick={() => randevuIcsIndir({
              id: sonuc.id,
              baslar: sonuc.baslar_at,
              biter: sonuc.biter_at,
              kartSahibi,
              aciklama: form.aciklama || null,
            })}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-2 bg-white border-2 border-green-300 text-green-800 rounded-lg text-sm font-semibold hover:bg-green-100"
          >
            <CalendarPlus size={16} />
            Takvimime ekle
          </button>
          <p className="text-[11px] text-green-700 mt-1">
            Google, Outlook, Apple ve kurumsal takvimlerin hepsinde açılır.
          </p>
        </div>
      </div>
    )
  }

  const slotlar = veri.slotlar || []
  const bugun = isoGun(new Date())
  const geriGidilebilir = isoGun(gun) > isoGun(gunEkle(new Date(), 1))

  return (
    <div className="pt-4 border-t border-gray-200">
      <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
        <CalendarClock size={18} style={{ color: temaRengi || '#3B82F6' }} />
        Randevu Al
      </h3>
      {veri.aciklama && <p className="text-xs text-gray-500 mb-3">{veri.aciklama}</p>}

      <div className="flex items-center justify-between mb-3">
        <button
          type="button"
          onClick={() => setGun(gunEkle(gun, -1))}
          disabled={!geriGidilebilir}
          className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100 disabled:opacity-30"
          title="Önceki gün"
        >
          <ChevronLeft size={18} />
        </button>
        <span className="text-sm font-semibold text-gray-800">
          {gun.toLocaleDateString('tr-TR', GUN_BICIMI)}
          {isoGun(gun) === bugun && ' (bugün)'}
        </span>
        <button
          type="button"
          onClick={() => setGun(gunEkle(gun, 1))}
          className="p-1.5 rounded-lg text-gray-600 hover:bg-gray-100"
          title="Sonraki gün"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {slotlar.length === 0 ? (
        <p className="text-sm text-gray-500 text-center py-3">
          Bu gün için uygun saat yok. İleri günlere bakabilirsiniz.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-1">
            {slotlar.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSecili(s)}
                className={`py-2 rounded-lg text-sm font-semibold border-2 transition-colors ${
                  secili === s ? 'text-white' : 'text-gray-700 border-gray-200 hover:border-gray-300'
                }`}
                style={secili === s
                  ? { backgroundColor: temaRengi || '#3B82F6', borderColor: temaRengi || '#3B82F6' }
                  : undefined}
              >
                {new Date(s).toLocaleTimeString('tr-TR', SAAT_BICIMI)}
              </button>
            ))}
          </div>
          <p className="text-[11px] text-gray-400 mb-3">
            Saatler Türkiye saatiyle · her randevu {veri.slot_dakika} dakika
          </p>
        </>
      )}

      {secili && (
        <form onSubmit={gonder} className="space-y-2 p-3 bg-gray-50 rounded-xl text-left">
          <p className="text-xs text-gray-600">
            <strong>{new Date(secili).toLocaleTimeString('tr-TR', SAAT_BICIMI)}</strong> için
            bilgileriniz kart sahibine iletilir.
          </p>
          <input required maxLength={80} placeholder="Adınız Soyadınız *"
            value={form.ad} onChange={(e) => setForm({ ...form, ad: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="email" maxLength={120} placeholder="E-posta"
            value={form.eposta} onChange={(e) => setForm({ ...form, eposta: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <input type="tel" maxLength={25} placeholder="Telefon"
            value={form.telefon} onChange={(e) => setForm({ ...form, telefon: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
          <textarea rows={2} maxLength={500} placeholder="Konu (isteğe bağlı)"
            value={form.aciklama} onChange={(e) => setForm({ ...form, aciklama: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />

          {hata && <p className="text-xs text-red-600">{hata}</p>}

          <div className="flex gap-2">
            <button type="button" onClick={() => setSecili(null)}
              className="flex-1 py-2 border border-gray-300 text-gray-600 rounded-lg text-sm font-semibold">
              Vazgeç
            </button>
            <button type="submit" disabled={gonderiliyor}
              className="flex-1 py-2 text-white rounded-lg text-sm font-semibold disabled:opacity-60"
              style={{ backgroundColor: temaRengi || '#3B82F6' }}>
              {gonderiliyor ? 'Gönderiliyor…' : 'Randevu al'}
            </button>
          </div>
          <p className="text-[11px] text-gray-400">* Ad ve en az bir iletişim bilgisi gerekli.</p>
        </form>
      )}
    </div>
  )
}
