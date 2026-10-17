import { useCallback, useEffect, useState } from 'react'
import { BadgeCheck, Globe, Copy, Check, RefreshCw, Trash2, AlertTriangle, Mail, Building2 } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

import { bildir } from '../lib/bildirim'
// DOĞRULAMA YÖNETİMİ
//
// Kullanıcı kendi alan adını doğrular; sonuç kartında rozet olur.
// Sonucu SUNUCU yazar (Edge Function iki bağımsız DNS sunucusuna sorar);
// buradaki düğme yalnızca kontrolü tetikler.

const HATALAR = {
  gecersiz_alan_adi: 'Alan adı geçerli görünmüyor. Örnek: ornek.com.tr',
  yetki_yok: 'Bu işlem için yetkiniz yok.',
  cok_fazla_deneme: 'Çok fazla deneme yapıldı. Bir saat sonra tekrar deneyin.',
  profil_yok: 'Profil bulunamadı.',
  kayit_yok: 'Kayıt bulunamadı.',
  deneme_siniri: 'Bu alan adı için deneme sınırına ulaşıldı. Yeni bir doğrulama başlatın.',
  kayit_bulunamadi: 'DNS kaydı bulunamadı. Kaydı eklediyseniz yayılması biraz zaman alabilir.',
  yayiliyor: 'Kayıt bazı DNS sunucularında görünüyor, hepsinde değil. Yayılması sürüyor; birazdan tekrar deneyin.',
  islem_tamamlanamadi: 'Kontrol tamamlanamadı. Lütfen tekrar deneyin.',
}

function tarih(t) {
  if (!t) return '-'
  return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function VerificationManager() {
  const [veri, setVeri] = useState(null)
  const [yukleniyor, setYukleniyor] = useState(true)
  const [alanAdi, setAlanAdi] = useState('')
  const [ekleniyor, setEkleniyor] = useState(false)
  const [kontrolEdilen, setKontrolEdilen] = useState(null)
  const [kopyalanan, setKopyalanan] = useState(null)
  const [mesaj, setMesaj] = useState(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    const { data, error } = await supabase.rpc('my_verifications')
    if (error) console.error('Doğrulamalar alınamadı:', error)
    setVeri(data?.ok ? data : { liste: [], eposta: null })
    setYukleniyor(false)
  }, [])

  useEffect(() => { yukle() }, [yukle])

  const ekle = async (e) => {
    e.preventDefault()
    setMesaj(null)
    setEkleniyor(true)
    try {
      const { data, error } = await supabase.rpc('verification_start_domain', {
        p_domain: alanAdi,
        p_org_id: null,
      })
      if (error) throw error
      if (!data?.ok) { setMesaj({ tur: 'hata', metin: HATALAR[data?.hata] || 'İşlem tamamlanamadı.' }); return }
      setAlanAdi('')
      await yukle()
    } catch (err) {
      setMesaj({ tur: 'hata', metin: 'Bağlantı hatası: ' + err.message })
    } finally {
      setEkleniyor(false)
    }
  }

  const kontrolEt = async (kayit) => {
    setMesaj(null)
    setKontrolEdilen(kayit.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setMesaj({ tur: 'hata', metin: 'Oturumunuz sona ermiş. Tekrar giriş yapın.' }); return }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alan-adi-dogrula`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ id: kayit.id }),
        }
      )
      const sonuc = await res.json().catch(() => ({}))
      if (sonuc?.ok) {
        setMesaj({ tur: 'basari', metin: `${kayit.konu} doğrulandı. Kartınızda rozet olarak görünecek.` })
      } else {
        setMesaj({ tur: 'uyari', metin: HATALAR[sonuc?.hata] || 'Doğrulama tamamlanamadı.' })
      }
      await yukle()
    } catch (err) {
      setMesaj({ tur: 'hata', metin: 'Bağlantı hatası: ' + err.message })
    } finally {
      setKontrolEdilen(null)
    }
  }

  const kaldir = async (kayit) => {
    if (!confirm(`${kayit.konu} doğrulaması kaldırılsın mı? Kartınızdaki rozet kalkar.`)) return
    const { data, error } = await supabase.rpc('verification_cancel', { p_id: kayit.id })
    if (error || !data?.ok) { bildir(HATALAR[data?.hata] || 'Kaldırılamadı.'); return }
    await yukle()
  }

  const kopyala = async (metin, anahtar) => {
    try {
      await navigator.clipboard.writeText(metin)
      setKopyalanan(anahtar)
      setTimeout(() => setKopyalanan(null), 1500)
    } catch {
      setMesaj({ tur: 'uyari', metin: 'Kopyalanamadı; değeri elle seçip kopyalayın.' })
    }
  }

  const liste = veri?.liste || []

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-1">
        <BadgeCheck className="text-blue-600 dark:text-blue-400" size={22} />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Doğrulama</h2>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Doğruladığınız şeyler kartınızda rozet olarak görünür. Rozet “onaylı hesap”
        demez; tam olarak neyin doğrulandığını söyler.
      </p>

      {mesaj && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          mesaj.tur === 'basari' ? 'bg-green-50 text-green-800 border border-green-200'
          : mesaj.tur === 'uyari' ? 'bg-amber-50 text-amber-800 border border-amber-200'
          : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {mesaj.metin}
        </div>
      )}

      {/* E-posta: rozet değil, durum bilgisi. Herkeste olduğu için kartta
          göstermek rozeti değersizleştirirdi. */}
      {veri?.eposta && (
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
          <Mail size={16} className={veri.eposta.dogrulandi ? 'text-green-600' : 'text-gray-400'} />
          {veri.eposta.dogrulandi
            ? <span>Hesap e-postanız doğrulanmış ({tarih(veri.eposta.tarih)}).</span>
            : <span>Hesap e-postanız henüz doğrulanmamış.</span>}
          <span className="text-xs text-gray-400">· kartta rozet olarak gösterilmez</span>
        </div>
      )}

      {yukleniyor ? (
        <p className="text-sm text-gray-500 py-4 text-center">Yükleniyor…</p>
      ) : (
        <div className="space-y-3">
          {liste.map((k) => (
            <div key={k.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                    {k.kurum_id ? <Building2 size={16} /> : <Globe size={16} />}
                    <span className="break-all">{k.konu}</span>
                  </div>
                  {k.kurum_adi && (
                    <div className="text-xs text-gray-500 mt-0.5">Kurum: {k.kurum_adi}</div>
                  )}
                  <div className="mt-1">
                    {k.durum === 'dogrulandi' && !k.suresi_gecti && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        <BadgeCheck size={13} /> Doğrulandı · {tarih(k.dogrulandi_at)}
                      </span>
                    )}
                    {k.durum === 'dogrulandi' && k.suresi_gecti && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                        <AlertTriangle size={13} /> Yeniden doğrulanmalı
                      </span>
                    )}
                    {k.durum === 'beklemede' && (
                      <span className="text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full">
                        DNS kaydı bekleniyor
                      </span>
                    )}
                    {k.durum === 'basarisiz' && (
                      <span className="text-xs font-semibold text-red-700 bg-red-50 px-2 py-0.5 rounded-full">
                        Kayıt bulunamadı · son deneme {tarih(k.son_deneme_at)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {(k.durum !== 'dogrulandi' || k.suresi_gecti) && (
                    <button
                      onClick={() => kontrolEt(k)}
                      disabled={kontrolEdilen === k.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                    >
                      <RefreshCw size={14} className={kontrolEdilen === k.id ? 'animate-spin' : ''} />
                      {kontrolEdilen === k.id ? 'Kontrol ediliyor…' : 'Doğrula'}
                    </button>
                  )}
                  <button onClick={() => kaldir(k)} title="Kaldır"
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* DNS yönergesi yalnızca gerektiğinde açık durur. */}
              {(k.durum !== 'dogrulandi' || k.suresi_gecti) && k.kayit_degeri && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Alan adınızın DNS ayarlarına aşağıdaki <strong>TXT</strong> kaydını ekleyin,
                    sonra “Doğrula”ya basın. Kaydı <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">{k.konu}</code> köküne
                    ya da <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">_qrtim.{k.konu}</code> altına koyabilirsiniz.
                  </p>
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <code className="text-xs text-gray-800 dark:text-gray-200 break-all flex-1">{k.kayit_degeri}</code>
                    <button onClick={() => kopyala(k.kayit_degeri, k.id)} title="Kopyala"
                      className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200 shrink-0">
                      {kopyalanan === k.id ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-400">
                    Bu değer gizli değildir; zaten herkese açık bir DNS kaydına yazılır.
                    Güvenlik, o kaydı yalnızca alan adının sahibinin yazabilmesinden gelir.
                  </p>
                </div>
              )}
            </div>
          ))}

          <form onSubmit={ekle} className="flex gap-2 pt-1">
            <input
              value={alanAdi}
              onChange={(e) => setAlanAdi(e.target.value)}
              placeholder="ornek.com.tr"
              autoComplete="off"
              autoCapitalize="off"
              spellCheck="false"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm"
            />
            <button type="submit" disabled={ekleniyor || !alanAdi.trim()}
              className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-semibold disabled:opacity-50">
              {ekleniyor ? 'Ekleniyor…' : 'Alan adı ekle'}
            </button>
          </form>

          {/* Henüz açılmamış doğrulama türlerini gizlemiyoruz ama "yakında"
              diye süsleyip beklenti de yaratmıyoruz: neden kapalı, yazıyor. */}
          <p className="text-xs text-gray-500 dark:text-gray-400 pt-2 leading-relaxed">
            Telefon ve resmi kimlik doğrulaması henüz açık değil; ikisi de dış
            sağlayıcı anlaşması gerektiriyor. Açıldığında burada görünecek.
            Kurum rozeti için kurumun alan adının doğrulanmış olması gerekir —
            kurum kaydını herkes açabildiği için üyelik tek başına kanıt sayılmaz.
          </p>
        </div>
      )}
    </div>
  )
}
