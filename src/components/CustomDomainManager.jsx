import { useEffect, useState } from 'react'
import { Link2, Copy, Check, RefreshCw, Trash2, Globe, AlertTriangle } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// ÖZEL ALAN ADI
//
// Kart kişinin kendi adresinde açılır: kart.ornek.com.tr
//
// Linktree'de bu ücretli pakette ve tek yaptıkları DNS yönlendirmesi. Bizde
// bir adım fazlası var: adresi bağlayabilmek için o alan adının SAHİBİ
// olduğunu zaten kanıtlamış olman gerekiyor. Yani rozet sisteminin üstüne
// oturuyor, ayrı bir güven mekanizması icat etmiyoruz.

const HATALAR = {
  alan_adi_dogrulanmamis: 'Önce bu alan adını yukarıdaki "Doğrulama" bölümünden doğrulamanız gerekiyor.',
  gecersiz_alan_adi: 'Adres geçerli görünmüyor. Örnek: kart.ornek.com.tr',
  adres_kullanimda: 'Bu adres başka bir hesapta kullanılıyor.',
  adres_baska_projede: 'Bu adres başka bir yerde kullanımda; önce oradan kaldırılması gerekiyor.',
  cok_fazla_deneme: 'Çok fazla deneme yapıldı. Bir saat sonra tekrar deneyin.',
  kart_yok: 'Seçilen kart bulunamadı.',
  kayit_yok: 'Kayıt bulunamadı.',
  dns_bekleniyor: 'Adres eklendi, DNS kaydınız henüz görünmüyor. Yayılması biraz sürebilir; birazdan tekrar deneyin.',
  saglayici_ayari_eksik: 'Bu özellik için yönetici ayarı (barındırma sağlayıcı anahtarı) henüz tanımlanmamış.',
  saglayici_yetkisi_yok: 'Barındırma sağlayıcısı yetkiyi reddetti. Yönetici anahtarının süresi dolmuş ya da doğru takım kapsamında oluşturulmamış olabilir.',
  saglayici_proje_bulunamadi: 'Barındırma sağlayıcısında proje bulunamadı; yönetici ayarındaki proje kimliği yanlış olabilir.',
  saglayici_reddetti: 'Adres barındırma sağlayıcısına eklenemedi.',
  islem_tamamlanamadi: 'İşlem tamamlanamadı. Lütfen tekrar deneyin.',
}

const DURUM_ETIKET = {
  baglandi: { metin: 'Yayında', sinif: 'text-green-700 bg-green-50' },
  beklemede: { metin: 'DNS bekleniyor', sinif: 'text-amber-700 bg-amber-50' },
  hata: { metin: 'Bağlanamadı', sinif: 'text-red-700 bg-red-50' },
}

export default function CustomDomainManager() {
  const [liste, setListe] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [host, setHost] = useState('')
  const [ekleniyor, setEkleniyor] = useState(false)
  const [kontrolEdilen, setKontrolEdilen] = useState(null)
  const [kopyalandi, setKopyalandi] = useState(false)
  const [mesaj, setMesaj] = useState(null)

  const yukle = async () => {
    const { data, error } = await supabase.rpc('my_custom_domains')
    if (error) console.error('Özel alan adları alınamadı:', error)
    setListe(data || [])
    setYukleniyor(false)
  }

  useEffect(() => {
    let iptal = false
    ;(async () => {
      const { data, error } = await supabase.rpc('my_custom_domains')
      if (iptal) return
      if (error) console.error('Özel alan adları alınamadı:', error)
      setListe(data || [])
      setYukleniyor(false)
    })()
    return () => { iptal = true }
  }, [])

  const ekle = async (e) => {
    e.preventDefault()
    setMesaj(null)
    setEkleniyor(true)
    try {
      const { data, error } = await supabase.rpc('custom_domain_claim', {
        p_host: host,
        p_persona_id: null,
      })
      if (error) throw error
      if (!data?.ok) { setMesaj({ tur: 'hata', metin: HATALAR[data?.hata] || 'İşlem tamamlanamadı.' }); return }
      setHost('')
      await yukle()
      setMesaj({ tur: 'bilgi', metin: 'Adres kaydedildi. Şimdi DNS kaydını ekleyip "Bağla"ya basın.' })
    } catch (err) {
      setMesaj({ tur: 'hata', metin: 'Bağlantı hatası: ' + err.message })
    } finally {
      setEkleniyor(false)
    }
  }

  const bagla = async (kayit) => {
    setMesaj(null)
    setKontrolEdilen(kayit.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setMesaj({ tur: 'hata', metin: 'Oturumunuz sona ermiş. Tekrar giriş yapın.' }); return }

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ozel-alan-adi-baglan`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ id: kayit.id }),
        }
      )
      const sonuc = await res.json().catch(() => ({}))
      setMesaj(sonuc?.ok
        ? { tur: 'basari', metin: `${kayit.host} yayında. Kartınız bu adreste açılıyor.` }
        : { tur: 'uyari', metin: HATALAR[sonuc?.hata] || 'Bağlanamadı.' })
      await yukle()
    } catch (err) {
      setMesaj({ tur: 'hata', metin: 'Bağlantı hatası: ' + err.message })
    } finally {
      setKontrolEdilen(null)
    }
  }

  const kaldir = async (kayit) => {
    if (!confirm(`${kayit.host} adresi kaldırılsın mı? Kartınız bu adreste açılmayı bırakır.`)) return
    const { data, error } = await supabase.rpc('custom_domain_remove', { p_id: kayit.id })
    if (error || !data?.ok) { alert(HATALAR[data?.hata] || 'Kaldırılamadı.'); return }
    await yukle()
  }

  const kopyala = async () => {
    try {
      await navigator.clipboard.writeText('cname.vercel-dns.com')
      setKopyalandi(true)
      setTimeout(() => setKopyalandi(false), 1500)
    } catch {
      setMesaj({ tur: 'uyari', metin: 'Kopyalanamadı; değeri elle seçip kopyalayın.' })
    }
  }

  if (yukleniyor) return null

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center gap-2 mb-1">
        <Link2 className="text-blue-600 dark:text-blue-400" size={22} />
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">Kendi Alan Adınız</h2>
      </div>
      <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
        Kartınız kendi adresinizde açılabilir: <code className="px-1 bg-gray-100 dark:bg-gray-700 rounded">kart.ornek.com.tr</code>.
        Bunun için o alan adını önce <strong>Doğrulama</strong> bölümünden doğrulamış olmanız gerekir —
        kimsenin sahibi olmadığı bir adrese kart bağlayamayız.
      </p>

      {mesaj && (
        <div className={`mb-4 p-3 rounded-lg text-sm ${
          mesaj.tur === 'basari' ? 'bg-green-50 text-green-800 border border-green-200'
          : mesaj.tur === 'uyari' ? 'bg-amber-50 text-amber-800 border border-amber-200'
          : mesaj.tur === 'bilgi' ? 'bg-blue-50 text-blue-800 border border-blue-200'
          : 'bg-red-50 text-red-700 border border-red-200'
        }`}>
          {mesaj.metin}
        </div>
      )}

      <div className="space-y-3">
        {liste.map((k) => {
          const d = DURUM_ETIKET[k.durum] || DURUM_ETIKET.beklemede
          return (
            <div key={k.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-700">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-gray-900 dark:text-gray-100">
                    <Globe size={16} />
                    <span className="break-all">{k.host}</span>
                  </div>
                  <span className={`inline-block mt-1 text-xs font-semibold px-2 py-0.5 rounded-full ${d.sinif}`}>
                    {d.metin}
                  </span>
                  {k.kart_adi && (
                    <div className="text-xs text-gray-500 mt-1">Açılacak kart: {k.kart_adi}</div>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {k.durum !== 'baglandi' && (
                    <button
                      onClick={() => bagla(k)}
                      disabled={kontrolEdilen === k.id}
                      className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
                    >
                      <RefreshCw size={14} className={kontrolEdilen === k.id ? 'animate-spin' : ''} />
                      {kontrolEdilen === k.id ? 'Bağlanıyor…' : 'Bağla'}
                    </button>
                  )}
                  <button onClick={() => kaldir(k)} title="Kaldır"
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg">
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {k.durum !== 'baglandi' && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700 space-y-2">
                  <p className="text-xs text-gray-600 dark:text-gray-400">
                    Alan adı sağlayıcınızda <strong>{k.host.split('.')[0]}</strong> için bir{' '}
                    <strong>CNAME</strong> kaydı oluşturun ve şunu hedef gösterin:
                  </p>
                  <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <code className="text-xs text-gray-800 dark:text-gray-200 flex-1">cname.vercel-dns.com</code>
                    <button onClick={kopyala} title="Kopyala"
                      className="p-1.5 text-gray-500 hover:text-gray-800 dark:hover:text-gray-200">
                      {kopyalandi ? <Check size={15} className="text-green-600" /> : <Copy size={15} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-gray-500 flex items-start gap-1">
                    <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                    Bu adreste yalnızca kartınız açılır; panel ve giriş QRtım adresinde kalır.
                    Güvenlik sertifikası otomatik kurulur.
                  </p>
                </div>
              )}
            </div>
          )
        })}

        <form onSubmit={ekle} className="flex gap-2 pt-1">
          <input
            value={host}
            onChange={(e) => setHost(e.target.value)}
            placeholder="kart.ornek.com.tr"
            autoComplete="off"
            autoCapitalize="off"
            spellCheck="false"
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg text-sm"
          />
          <button type="submit" disabled={ekleniyor || !host.trim()}
            className="px-4 py-2 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 rounded-lg text-sm font-semibold disabled:opacity-50">
            {ekleniyor ? 'Ekleniyor…' : 'Adres ekle'}
          </button>
        </form>
      </div>
    </div>
  )
}
