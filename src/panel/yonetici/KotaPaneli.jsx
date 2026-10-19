// Kurum koltuk kotası — yönetici panelindeki "Kota" düğmesi açar.
//
// Toplu alım TEKLİFLE yürüyor (platformda adetli satın alma yok), bu yüzden
// kotayı platform yöneticisi giriyor: şirket teklifi kabul edip ödeyince kota
// tanımlanır, dağıtımı şirket kendi yapar (kurumsal panel).
//
// Sunucu kuralları (admin_set_seat_quota) burada da gösteriliyor ki kişi
// reddi sonradan öğrenmesin:
//   • Kota > 0 ise kademe ve bitiş tarihi ZORUNLU (süresiz yetki kazası
//     olmasın — admin_set_plan'da aynı hata yaşandı).
//   • Kota, DAĞITILMIŞ koltuk sayısının altına indirilemez; hangi koltuğun
//     iptal edileceğine sunucu karar vermez.
import { useEffect, useId, useRef, useState } from 'react'
import { X, Armchair } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { bildir } from '../../lib/bildirim'
import { Kart, KartBaslik, Dugme, Secim, Girdi, Rozet, IkonDugme } from '../ui'
import { sayi, tarih, birlestir } from '../bicim'

const HATALAR = {
  yetkisiz: 'Bu işlem için yönetici olmanız gerekiyor.',
  gecersiz_kota: 'Koltuk adedi 0 veya daha büyük olmalı.',
  gecersiz_plan: 'Koltuk kademesi seçin.',
  bitis_tarihi_gerekli: 'Kota için bitiş tarihi seçin. Süresiz koltuk kotası tanımlanmıyor.',
  kurum_bulunamadi: 'Kurum bulunamadı.',
  dagitilmis_koltuk_fazla: 'Dağıtılmış koltuk sayısı girdiğiniz kotadan fazla. Kurum önce koltuk geri almalı.',
}

// Kota kademeleri: koltuğun verdiği plan. 'free' YOK — koltuk vermek ücretli
// bir kademe vermek demek.
const KADEMELER = [
  { deger: 'student', ad: 'Öğrenci' },
  { deger: 'professional', ad: 'Profesyonel' },
  { deger: 'stk', ad: 'STK Özel' },
  { deger: 'business', ad: 'Kurumsal' },
  { deger: 'corporate', ad: 'Kurumsal (pazarlıklı)' },
]

const SURELER = [
  { ay: 3, ad: '3 ay' },
  { ay: 6, ad: '6 ay' },
  { ay: 12, ad: '1 yıl' },
  { ay: 24, ad: '2 yıl' },
]
const ayEkle = (ay) => {
  const d = new Date()
  d.setMonth(d.getMonth() + Number(ay))
  return d
}

export default function KotaPaneli({ kurum, acikKoltuk, onKapat, onayIste, onDegisti }) {
  const baslikId = useId()
  const gerekceId = useId()
  const kapatRef = useRef(null)
  const [adet, setAdet] = useState(String(kurum.seat_quota ?? 0))
  const [kademe, setKademe] = useState(kurum.seat_plan || 'business')
  const [sureAy, setSureAy] = useState(12)
  const [gerekce, setGerekce] = useState('')
  const [uyari, setUyari] = useState('')
  const [mesgul, setMesgul] = useState(false)

  useEffect(() => {
    kapatRef.current?.focus()
    const onceki = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = onceki }
  }, [])

  const n = Number.parseInt(adet, 10)
  const gecerliAdet = Number.isFinite(n) && n >= 0
  // Mevcut bitiş korunuyorsa tekrar tarih seçmeye zorlamıyoruz.
  const mevcutBitisGecerli = kurum.seat_quota_expires_at && new Date(kurum.seat_quota_expires_at) > new Date()
  const yeniBitis = n > 0 ? ayEkle(sureAy) : null

  const calistir = async (g) => {
    setMesgul(true)
    try {
      const { data, error } = await supabase.rpc('admin_set_seat_quota', {
        p_org_id: kurum.id,
        p_quota: n,
        p_plan: n > 0 ? kademe : null,
        p_expires_at: n > 0 ? yeniBitis.toISOString() : null,
        p_reason: g,
      })
      if (error) throw error
      if (!data?.ok) {
        bildir(HATALAR[data?.hata] || ('Kota ayarlanamadı: ' + (data?.hata || 'bilinmeyen hata')), 'error')
        return
      }
      bildir(n === 0
        ? `${kurum.name} koltuk kotası kaldırıldı.`
        : `${kurum.name} için ${n} koltuk tanımlandı (${tarih(yeniBitis)} sonuna kadar).`, 'success')
      setGerekce('')
      onDegisti?.()
      onKapat()
    } catch (e) {
      bildir('Hata: ' + e.message, 'error')
    } finally {
      setMesgul(false)
    }
  }

  const kaydet = () => {
    if (!gecerliAdet) { setUyari('Koltuk adedi 0 veya daha büyük bir sayı olmalı.'); return }
    if (!gerekce.trim()) { setUyari('Gerekçe zorunlu: işlem denetim kaydına bu gerekçeyle yazılıyor.'); return }
    if (n > 0 && n < acikKoltuk) {
      setUyari(`Kurumda ${acikKoltuk} koltuk dağıtılmış durumda. Kotayı bunun altına indirmek için kurum önce koltuk geri almalı.`)
      return
    }
    setUyari('')
    const g = gerekce.trim()
    onayIste({
      title: n === 0 ? 'Koltuk kotasını kaldır' : 'Koltuk kotasını ayarla',
      message: n === 0
        ? `"${kurum.name}" koltuk dağıtamayacak. DAĞITILMIŞ koltuklar kendiliğinden kalkmaz; kurum yöneticisi geri alır ya da süresi dolar. Gerekçe: ${g}`
        : `"${kurum.name}" için ${n} koltuk, ${KADEMELER.find((k) => k.deger === kademe)?.ad} kademesinde, ${tarih(yeniBitis)} tarihine kadar. Koltuk alan üyelerin planı bu kademeye çıkar. Gerekçe: ${g}`,
      confirmText: n === 0 ? 'Kotayı kaldır' : 'Kotayı ayarla',
      variant: n === 0 ? 'danger' : undefined,
      onConfirm: () => calistir(g),
    })
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Paneli kapat" tabIndex={-1} onClick={onKapat} className="absolute inset-0 bg-murekkep/40 dark:bg-black/60 cursor-default" />
      <aside role="dialog" aria-modal="true" aria-labelledby={baslikId}
        className="relative w-full max-w-[420px] h-full bg-yuzey border-l border-cizgi flex flex-col">
        <div className="flex items-start gap-3 px-5 py-4 border-b border-cizgi">
          <span className="w-10 h-10 rounded-[10px] bg-murekkep text-yuzey inline-flex items-center justify-center shrink-0">
            <Armchair size={20} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={baslikId} className="font-baslik text-[17px] font-bold leading-tight text-metin truncate">{kurum.name}</h2>
            <p className="text-[13px] text-metin-2">Koltuk kotası</p>
          </div>
          <IkonDugme ref={kapatRef} etiket="Kapat" ikon={X} onClick={onKapat} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-5">
          <Kart className="p-4 flex flex-col gap-2">
            <div className="flex gap-2 flex-wrap text-xs">
              <Rozet ton="notr">{sayi(kurum.member_count ?? 0)} üye</Rozet>
              <Rozet ton={acikKoltuk > 0 ? 'vurgu' : 'notr'}>{sayi(acikKoltuk)} koltuk dağıtılmış</Rozet>
              {kurum.seat_quota > 0 && <Rozet ton="notr">kota {sayi(kurum.seat_quota)}</Rozet>}
            </div>
            <p className="text-xs text-metin-2">
              {mevcutBitisGecerli
                ? `Mevcut kota ${tarih(kurum.seat_quota_expires_at)} tarihinde bitiyor.`
                : kurum.seat_quota > 0
                  ? 'Mevcut kotanın süresi dolmuş: koltuklar geçersiz.'
                  : 'Bu kurumun koltuk kotası yok, dağıtım yapamıyor.'}
            </p>
          </Kart>

          <div className="flex flex-col gap-3">
            <div className="flex gap-2 flex-wrap items-end">
              <div className="flex flex-col gap-1.5 w-[104px]">
                <label htmlFor="kota-adet" className="text-[13px] font-semibold">Koltuk</label>
                <Girdi id="kota-adet" type="number" min="0" max="10000" value={adet}
                  onChange={(e) => { setAdet(e.target.value); if (uyari) setUyari('') }} className="h-10 tabular-nums" />
              </div>
              {n > 0 && (
                <>
                  <Secim etiket="Kademe" value={kademe} onChange={setKademe} className="flex-1 min-w-[150px]">
                    {KADEMELER.map((k) => <option key={k.deger} value={k.deger}>{k.ad}</option>)}
                  </Secim>
                  <Secim etiket="Süre" value={sureAy} onChange={setSureAy} className="w-[108px]">
                    {SURELER.map((x) => <option key={x.ay} value={x.ay}>{x.ad}</option>)}
                  </Secim>
                </>
              )}
            </div>
            {n > 0 && (
              <span className="text-xs text-metin-2">
                Bitiş: <b className="text-metin">{tarih(yeniBitis)}</b>. Verilen koltuklar bu tarihten uzun yaşamaz.
              </span>
            )}
            {n === 0 && (
              <span className="text-xs text-metin-2">
                0 girmek kotayı kaldırır: kurum yeni koltuk dağıtamaz. Dağıtılmış koltuklar kendiliğinden kalkmaz.
              </span>
            )}

            <div className="flex flex-col gap-1.5">
              <label htmlFor={gerekceId} className="text-[13px] font-semibold">Gerekçe</label>
              <textarea id={gerekceId} rows={2} value={gerekce}
                onChange={(e) => { setGerekce(e.target.value); if (uyari) setUyari('') }}
                aria-invalid={uyari ? true : undefined}
                placeholder="Örn. 20 koltukluk yıllık sözleşme, teklif #1234"
                className={birlestir(
                  'w-full rounded-[10px] border bg-yuzey px-3 py-2 text-[13.5px] text-metin placeholder:text-metin-2/70 focus:outline-none focus:ring-2 focus:ring-aksan/40 resize-y',
                  uyari ? 'border-red-300 dark:border-red-500/50' : 'border-cizgi',
                )} />
              <span className={birlestir('text-xs', uyari ? 'text-red-600 dark:text-red-400' : 'text-metin-2')}>
                {uyari || 'İşlem bu gerekçeyle denetim kaydına yazılır ve ikinci onay ister.'}
              </span>
            </div>

            <Dugme tur="ana" disabled={mesgul} onClick={kaydet} className="self-start">
              {mesgul ? 'İşleniyor…' : n === 0 ? 'Kotayı kaldır' : 'Kotayı ayarla'}
            </Dugme>
          </div>
        </div>
      </aside>
    </div>
  )
}
