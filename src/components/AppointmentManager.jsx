import { useEffect, useState } from 'react'
import { CalendarClock, Check, X, Clock, Mail, Phone, QrCode, Nfc, Copy, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { SITE_URL } from '../lib/siteUrl'

import { bildir } from '../lib/bildirim'
// RANDEVU YÖNETİMİ
//
// Çalışma saatleri Türkiye saatine göre yorumlanır (sunucuda da öyle).
// Ayarlar kaydedilirken sunucu gün/saat yapısını yeniden doğrular: arayüzden
// gelen veriye güvenmiyoruz.

const GUNLER = [
  { no: '1', ad: 'Pazartesi' },
  { no: '2', ad: 'Salı' },
  { no: '3', ad: 'Çarşamba' },
  { no: '4', ad: 'Perşembe' },
  { no: '5', ad: 'Cuma' },
  { no: '6', ad: 'Cumartesi' },
  { no: '7', ad: 'Pazar' },
]

const SLOTLAR = [15, 20, 30, 45, 60, 90, 120]
const ZAMAN = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' }
const KAYNAK_SIMGE = { qr: QrCode, nfc: Nfc }

export default function AppointmentManager() {
  const [ayar, setAyar] = useState(null)
  const [randevular, setRandevular] = useState([])
  const [kaydediliyor, setKaydediliyor] = useState(false)
  const [takvimAnahtari, setTakvimAnahtari] = useState(null)
  const [kopyalandi, setKopyalandi] = useState(false)
  const [mesaj, setMesaj] = useState(null)

  const yenile = async () => {
    const [a, r] = await Promise.all([
      supabase.rpc('my_appointment_settings'),
      supabase.rpc('my_appointments', { p_gecmis: false }),
    ])
    if (a.data?.ok) setAyar(a.data)
    setRandevular(r.data || [])
  }

  useEffect(() => {
    let iptal = false
    ;(async () => {
      const [a, r, t] = await Promise.all([
        supabase.rpc('my_appointment_settings'),
        supabase.rpc('my_appointments', { p_gecmis: false }),
        supabase.rpc('my_calendar_key'),
      ])
      if (iptal) return
      if (a.error) console.error('Randevu ayarları alınamadı:', a.error)
      setAyar(a.data?.ok ? a.data : null)
      setRandevular(r.data || [])
      setTakvimAnahtari(t.data?.anahtar || null)
    })()
    return () => { iptal = true }
  }, [])

  const gunDegistir = (gunNo, alan, deger) => {
    const mevcut = ayar.gun_saatleri?.[gunNo]?.[0] || ['09:00', '18:00']
    const yeni = alan === 'bas' ? [deger, mevcut[1]] : [mevcut[0], deger]
    setAyar({ ...ayar, gun_saatleri: { ...ayar.gun_saatleri, [gunNo]: [yeni] } })
  }

  const gunKapat = (gunNo) => {
    const kopya = { ...(ayar.gun_saatleri || {}) }
    delete kopya[gunNo]
    setAyar({ ...ayar, gun_saatleri: kopya })
  }

  const kaydet = async () => {
    setMesaj(null)
    setKaydediliyor(true)
    try {
      const { data, error } = await supabase.rpc('appointment_settings_save', {
        p_aktif: ayar.aktif,
        p_slot_dakika: ayar.slot_dakika,
        p_ileri_gun: ayar.ileri_gun,
        p_en_erken_saat: ayar.en_erken_saat,
        p_gun_saatleri: ayar.gun_saatleri || {},
        p_aciklama: ayar.aciklama || null,
        p_otomatik_onay: ayar.otomatik_onay,
      })
      if (error) throw error
      if (!data?.ok) { setMesaj({ tur: 'hata', metin: 'Kaydedilemedi.' }); return }
      // Sunucu temizlenmiş hâli döner; ekran gerçekte kaydedileni göstersin.
      setAyar((o) => ({ ...o, gun_saatleri: data.gun_saatleri }))
      setMesaj({ tur: 'basari', metin: 'Randevu ayarları kaydedildi.' })
      // Ayar satırı ilk kez bu kayıtta oluşmuş olabilir; takvim anahtarı da
      // o anda doğar.
      if (!takvimAnahtari) {
        const { data: t } = await supabase.rpc('my_calendar_key')
        setTakvimAnahtari(t?.anahtar || null)
      }
    } catch (err) {
      setMesaj({ tur: 'hata', metin: 'Hata: ' + err.message })
    } finally {
      setKaydediliyor(false)
    }
  }

  const takvimAdresi = takvimAnahtari ? `${SITE_URL}/api/takvim.ics?anahtar=${takvimAnahtari}` : null

  const anahtarYenile = async () => {
    if (!confirm('Takvim adresi yenilensin mi? Eski adres çalışmayı bırakır; takvim uygulamanızdaki aboneliği yeni adresle kurmanız gerekir.')) return
    const { data, error } = await supabase.rpc('rotate_calendar_key')
    if (error || !data?.ok) { bildir('Yenilenemedi.'); return }
    setTakvimAnahtari(data.anahtar)
    setMesaj({ tur: 'basari', metin: 'Takvim adresi yenilendi. Aboneliğinizi yeni adresle kurun.' })
  }

  const adresiKopyala = async () => {
    try {
      await navigator.clipboard.writeText(takvimAdresi)
      setKopyalandi(true)
      setTimeout(() => setKopyalandi(false), 1500)
    } catch {
      setMesaj({ tur: 'hata', metin: 'Kopyalanamadı; adresi elle seçip kopyalayın.' })
    }
  }

  const durumDegistir = async (randevu, durum) => {
    const { data, error } = await supabase.rpc('appointment_set_status', { p_id: randevu.id, p_durum: durum })
    if (error || !data?.ok) { bildir('İşlem tamamlanamadı.'); return }
    await yenile()
  }

  if (!ayar) return null

  const bekleyen = randevular.filter((r) => r.durum === 'bekliyor')

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock className="text-blue-600 dark:text-blue-400" size={22} />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Randevu{bekleyen.length > 0 ? ` (${bekleyen.length} yeni)` : ''}
        </h2>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Açtığınızda kartınızdan doğrudan randevu alınabilir. Saatler Türkiye
        saatiyle yorumlanır.
      </p>

      {mesaj && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          mesaj.tur === 'basari' ? 'bg-green-50 text-green-800 border border-green-200'
          : 'bg-red-50 text-red-700 border border-red-200'
        }`}>{mesaj.metin}</div>
      )}

      <label className="flex items-center gap-2 mb-4 text-sm font-semibold text-gray-900 dark:text-gray-100">
        <input type="checkbox" checked={!!ayar.aktif}
          onChange={(e) => setAyar({ ...ayar, aktif: e.target.checked })} />
        Kartımdan randevu alınabilsin
      </label>

      {ayar.aktif && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-3 gap-3">
            <label className="text-sm text-gray-700 dark:text-gray-300">
              <span className="block mb-1">Randevu süresi</span>
              <select value={ayar.slot_dakika}
                onChange={(e) => setAyar({ ...ayar, slot_dakika: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm">
                {SLOTLAR.map((d) => <option key={d} value={d}>{d} dakika</option>)}
              </select>
            </label>
            <label className="text-sm text-gray-700 dark:text-gray-300">
              <span className="block mb-1">Kaç gün ileriye</span>
              <input type="number" min={1} max={180} value={ayar.ileri_gun}
                onChange={(e) => setAyar({ ...ayar, ileri_gun: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm" />
            </label>
            <label className="text-sm text-gray-700 dark:text-gray-300">
              <span className="block mb-1">En erken kaç saat sonrası</span>
              <input type="number" min={0} max={168} value={ayar.en_erken_saat}
                onChange={(e) => setAyar({ ...ayar, en_erken_saat: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm" />
            </label>
          </div>

          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">Çalışma saatleri</p>
            <div className="space-y-2">
              {GUNLER.map((g) => {
                const aralik = ayar.gun_saatleri?.[g.no]?.[0]
                const acik = Array.isArray(aralik)
                return (
                  <div key={g.no} className="flex items-center gap-2 flex-wrap">
                    <label className="flex items-center gap-2 w-32 text-sm text-gray-700 dark:text-gray-300">
                      <input type="checkbox" checked={acik}
                        onChange={(e) => e.target.checked
                          ? gunDegistir(g.no, 'bas', '09:00')
                          : gunKapat(g.no)} />
                      {g.ad}
                    </label>
                    {acik ? (
                      <>
                        <input type="time" value={aralik[0]}
                          onChange={(e) => gunDegistir(g.no, 'bas', e.target.value)}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm" />
                        <span className="text-gray-400">–</span>
                        <input type="time" value={aralik[1]}
                          onChange={(e) => gunDegistir(g.no, 'bit', e.target.value)}
                          className="px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded text-sm" />
                      </>
                    ) : (
                      <span className="text-sm text-gray-400">kapalı</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <input type="text" maxLength={300} value={ayar.aciklama || ''}
            onChange={(e) => setAyar({ ...ayar, aciklama: e.target.value })}
            placeholder="Kartta görünecek açıklama (örn. Görüşme için 30 dakika)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm" />

          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <input type="checkbox" checked={!!ayar.otomatik_onay}
              onChange={(e) => setAyar({ ...ayar, otomatik_onay: e.target.checked })} />
            Randevular otomatik onaylansın (kapalıysa siz onaylarsınız)
          </label>

          <button onClick={kaydet} disabled={kaydediliyor}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-semibold disabled:opacity-50">
            {kaydediliyor ? 'Kaydediliyor…' : 'Ayarları kaydet'}
          </button>

          {/* KENDİ TAKVİMİNİZ
              Herkesin sağlayıcısı farklı (Gmail, Hotmail, kurumsal). Her biri
              için ayrı entegrasyon yazmak yerine takvim standardını (ICS)
              kullanıyoruz: hepsi destekliyor, kimsenin hesabını bağlaması
              gerekmiyor. */}
          {takvimAdresi && (
            <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                Randevularınızı kendi takviminizde görün
              </p>
              <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                Aşağıdaki adresi takvim uygulamanıza <strong>abonelik</strong> olarak
                ekleyin; randevularınız kendiliğinden düşer. Google Takvim
                (Diğer takvimler → URL'den), Outlook/Hotmail (Takvim ekle →
                İnternetten abone ol), Apple Takvim (Dosya → Yeni Takvim
                Aboneliği) ve kurumsal Exchange destekliyor.
              </p>
              <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                <code className="text-xs text-gray-800 dark:text-gray-200 break-all flex-1">{takvimAdresi}</code>
                <button onClick={adresiKopyala} title="Kopyala"
                  className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 shrink-0">
                  {kopyalandi ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                </button>
                <button onClick={anahtarYenile} title="Adresi yenile"
                  className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 shrink-0">
                  <RefreshCw size={15} />
                </button>
              </div>
              {/* İki şeyi baştan söylüyoruz ki kullanıcı "bozuk" sanmasın. */}
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-2 leading-relaxed">
                Bu adres bir anahtardır: adresi bilen randevularınızı görebilir.
                Paylaşmayın; yanlışlıkla paylaştıysanız yenileme düğmesiyle
                değiştirin, eski adres çalışmayı bırakır.
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">
                Takvim uygulamaları abone oldukları adresleri kendi aralıklarıyla
                tazeler; yeni randevu takviminize birkaç saat sonra düşebilir.
                Anında görmek için bu panel var.
              </p>
            </div>
          )}
        </div>
      )}

      {randevular.length > 0 && (
        <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-3">Yaklaşan randevular</p>
          <div className="space-y-2">
            {randevular.map((r) => {
              const Simge = KAYNAK_SIMGE[r.kaynak]
              return (
                <div key={r.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                      <Clock size={14} />
                      {new Date(r.baslar_at).toLocaleString('tr-TR', ZAMAN)}
                      {r.durum === 'bekliyor' && (
                        <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                          onay bekliyor
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">{r.ad}</div>
                    <div className="flex flex-wrap gap-3 text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                      {r.eposta && <a href={`mailto:${r.eposta}`} className="flex items-center gap-1 hover:underline"><Mail size={12} />{r.eposta}</a>}
                      {r.telefon && <a href={`tel:${r.telefon}`} className="flex items-center gap-1 hover:underline"><Phone size={12} />{r.telefon}</a>}
                    </div>
                    {r.aciklama && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{r.aciklama}</p>}
                    {Simge && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-1">
                        <Simge size={11} />{r.kaynak === 'qr' ? 'QR okutarak aldı' : 'NFC kartla aldı'}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {r.durum === 'bekliyor' && (
                      <button onClick={() => durumDegistir(r, 'onaylandi')} title="Onayla"
                        className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg">
                        <Check size={16} />
                      </button>
                    )}
                    <button onClick={() => durumDegistir(r, 'iptal')} title="İptal et"
                      className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                      <X size={16} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
