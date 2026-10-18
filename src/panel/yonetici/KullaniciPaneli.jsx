// Kullanıcı ayrıntı yan paneli — tablodaki "Aç".
//
// İşlemler eski AdminCRM'deki denetimli RPC'ler: admin_set_role,
// admin_set_plan, admin_delete_user. prompt()/confirm() yerine gerekçe
// paneldeki alandan alınır, ikinci onay ConfirmModal ile (üst bileşen açar).
// Her RPC kendi denetim kaydını yazar; burada ekrana yalnızca sonucu yansıtırız.
import { useEffect, useId, useRef, useState } from 'react'
import { X, ExternalLink, Shield, ShieldOff, Trash2, Ban, LockOpen } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { bildir } from '../../lib/bildirim'
import { cardUrl } from '../../lib/siteUrl'
import { Avatar, Rozet, Dugme, Secim, IkonDugme } from '../ui'
import { sayi, tarih, birlestir } from '../bicim'
import { PLANLAR, planBul, ABONELIK_DURUM, ROL_AD, durumBul } from './veri'

const SILME_HATALARI = {
  yetkisiz: 'Bu işlem için yönetici olmanız gerekiyor.',
  kendini_silemezsin: 'Kendi hesabınızı buradan silemezsiniz.',
  yonetici_silinemez: 'Yönetici hesapları silinemez. Önce yönetici yetkisini kaldırın.',
  gerekce_zorunlu: 'Silme gerekçesi zorunludur.',
  kullanici_bulunamadi: 'Kullanıcı bulunamadı; zaten silinmiş olabilir.',
}
const ROL_HATALARI = {
  yetkisiz: 'Bu işlem için yönetici olmanız gerekiyor.',
  kendi_rolunu_degistiremezsin: 'Kendi rolünüzü değiştiremezsiniz.',
  son_yonetici: 'Sistemdeki son yöneticinin yetkisi kaldırılamaz.',
  gecersiz_rol: 'Geçersiz rol.',
  gerekce_zorunlu: 'Rol değişikliği için gerekçe zorunludur.',
  profil_bulunamadi: 'Profil bulunamadı.',
}
const PLAN_HATALARI = {
  yetkisiz: 'Bu işlem için yönetici olmanız gerekiyor.',
  gecersiz_plan: 'Geçersiz plan.',
  abonelik_bulunamadi: 'Bu kişinin abonelik kaydı yok.',
  bitis_tarihi_gerekli: 'Ücretli plan için süre seçin. Süresiz ücretli plan kaydedilmiyor.',
}
const ERISIM_HATALARI = {
  yetkisiz: 'Bu işlem için yönetici olmanız gerekiyor.',
  kullanici_bulunamadi: 'Kullanıcı bulunamadı.',
  kendini_engelleyemezsin: 'Kendi erişiminizi engelleyemezsiniz.',
  yonetici_engellenemez: 'Yönetici hesapları engellenemez; önce yönetici yetkisini alın.',
  gecersiz_tarih: 'Geçersiz tarih.',
}

// Ücretli planda süre ZORUNLU: admin_set_plan tarihsiz çağrıyı reddediyor.
// Sebebi canlıda yaşandı — panel tarih göndermediği için verilen ücretli plan
// süresiz kaydolmuştu (expires_at null = sonsuza kadar geçerli).
const SURELER = [
  { ay: 1, ad: '1 ay' },
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

// Süresiz engel sunucuda "şimdi + 100 yıl" olarak yazılıyor ('infinity' bazı
// istemcilerde JSON'a çevrilemiyor). Panelde o tarihi göstermek anlamsız
// olurdu ("18 Eki 2126"): 50 yıldan uzağı "kalıcı" diye yazıyoruz.
const KALICI_ESIK_YIL = 50
function engelMetni(bitis) {
  if (!bitis) return 'Açık'
  const yil = (new Date(bitis) - Date.now()) / (365.25 * 24 * 3600 * 1000)
  return yil > KALICI_ESIK_YIL ? 'Engelli — kalıcı' : `Engelli — ${tarih(bitis)} tarihine kadar`
}

function Bilgi({ etiket, children }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-cizgi/70 last:border-b-0 text-[13px]">
      <dt className="text-metin-2 shrink-0">{etiket}</dt>
      <dd className="text-metin text-right min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Bolum({ baslik, children }) {
  return (
    <section className="flex flex-col gap-2.5">
      <h3 className="text-[11.5px] font-semibold tracking-[.06em] uppercase text-metin-2">{baslik}</h3>
      {children}
    </section>
  )
}

// engelli: ÜST BİLEŞENİN onay penceresi açık mı (Escape'i kapatmak için).
// erisimBitis: kişinin erişim engelinin bitiş tarihi (null = engelli değil).
// İkisi ayrı şeyler; adları karışmasın.
export default function KullaniciPaneli({ kullanici: u, abonelik: s, kurumlar, benimProfilId, onKapat, onayIste, onDegisti, engelli, erisimBitis, onErisimDegisti }) {
  const baslikId = useId()
  const gerekceId = useId()
  const kapatRef = useRef(null)
  const [gerekce, setGerekce] = useState('')
  const [uyari, setUyari] = useState('')
  const [yeniPlan, setYeniPlan] = useState(planBul(s?.plan)?.deger || 'free')
  const [sureAy, setSureAy] = useState(12)
  const [kotuye, setKotuye] = useState(false)
  const [islem, setIslem] = useState(null)

  // Açılınca odak kapat düğmesine; arka sayfa kaymasın.
  useEffect(() => {
    kapatRef.current?.focus()
    const onceki = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = onceki }
  }, [])
  useEffect(() => {
    if (engelli) return
    const esc = (e) => { if (e.key === 'Escape') onKapat() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [engelli, onKapat])

  const ad = u.name || u.email || 'İsimsiz'
  const kendisi = u.id === benimProfilId
  const yonetici = u.role === 'admin' || u.role === 'superadmin'
  const d = s ? durumBul(ABONELIK_DURUM, s.status) : null
  const p = planBul(s?.plan)

  const gerekceAl = () => {
    const g = gerekce.trim()
    if (!g) {
      setUyari('Önce gerekçe yazın; denetim kaydına bu metin düşer.')
      document.getElementById(gerekceId)?.focus()
      return null
    }
    setUyari('')
    return g
  }

  // ---------------------------------------------------------------- rol
  const rolCalistir = async (yeniRol, g) => {
    setIslem('rol')
    try {
      const { data, error } = await supabase.rpc('admin_set_role', { p_profile_id: u.id, p_role: yeniRol, p_reason: g })
      if (error) throw error
      if (!data?.ok) {
        bildir(ROL_HATALARI[data?.hata] || ('Rol değiştirilemedi: ' + (data?.hata || 'bilinmeyen hata')), 'error')
        return
      }
      onDegisti({ tur: 'rol', id: u.id, rol: yeniRol })
      setGerekce('')
      bildir(`Rol ${ROL_AD[data.eski_rol] || data.eski_rol} → ${ROL_AD[yeniRol]} olarak güncellendi.`, 'success')
    } catch (e) {
      bildir('Hata: ' + e.message, 'error')
    } finally {
      setIslem(null)
    }
  }
  const rolDegistir = () => {
    const yeniRol = u.role === 'admin' ? 'user' : 'admin'
    const g = gerekceAl()
    if (!g) return
    onayIste({
      title: yeniRol === 'admin' ? 'Yönetici yetkisi ver' : 'Yönetici yetkisini al',
      message: `"${ad}" kişisinin rolü ${ROL_AD[u.role] || ROL_AD.user} → ${ROL_AD[yeniRol]} olarak değişecek. Gerekçe: ${g}`,
      confirmText: yeniRol === 'admin' ? 'Yetkiyi ver' : 'Yetkiyi al',
      variant: yeniRol === 'admin' ? 'primary' : 'danger',
      onConfirm: () => rolCalistir(yeniRol, g),
    })
  }

  // ---------------------------------------------------------------- plan
  const planCalistir = async (g) => {
    setIslem('plan')
    try {
      // Ücretsize dönüşte tarih gönderilmez (sunucu null yazıyor).
      const bitis = yeniPlan === 'free' ? null : ayEkle(sureAy).toISOString()
      const { data, error } = await supabase.rpc('admin_set_plan',
        { p_profile_id: u.id, p_plan: yeniPlan, p_expires_at: bitis, p_reason: g })
      if (error) throw error
      if (!data?.ok) {
        bildir(PLAN_HATALARI[data?.hata] || ('Plan değiştirilemedi: ' + (data?.hata || 'bilinmeyen hata')), 'error')
        return
      }
      onDegisti({ tur: 'plan', id: u.id, plan: yeniPlan })
      setGerekce('')
      bildir(`Plan ${planBul(data.eski_plan)?.ad || data.eski_plan} → ${planBul(yeniPlan)?.ad}${data.bitis ? ' (' + tarih(data.bitis) + ' sonuna kadar)' : ''} olarak güncellendi.`, 'success')
    } catch (e) {
      bildir('Hata: ' + e.message, 'error')
    } finally {
      setIslem(null)
    }
  }
  const planAta = () => {
    const g = gerekceAl()
    if (!g) return
    onayIste({
      title: 'Planı değiştir',
      message: `"${ad}" kişisinin planı ${p?.ad || '—'} → ${planBul(yeniPlan)?.ad} olacak${yeniPlan === 'free' ? '' : ` ve ${tarih(ayEkle(sureAy))} tarihinde sona erecek`}. Ödemesiz plan değişikliği denetim kaydına kritik olarak düşer. Gerekçe: ${g}`,
      confirmText: 'Planı ata',
      onConfirm: () => planCalistir(g),
    })
  }

  // ---------------------------------------------------------------- erişim
  const erisimCalistir = async (g, engelle) => {
    setIslem('erisim')
    try {
      const { data, error } = await supabase.rpc('admin_set_access',
        { p_profile_id: u.id, p_engelli: engelle, p_until: null, p_reason: g })
      if (error) throw error
      if (!data?.ok) {
        bildir(ERISIM_HATALARI[data?.hata] || ('Erişim değiştirilemedi: ' + (data?.hata || 'bilinmeyen hata')), 'error')
        return
      }
      setGerekce('')
      bildir(engelle
        ? `Erişim engellendi${data.kapatilan_oturum ? `; ${data.kapatilan_oturum} oturum kapatıldı` : ''}.`
        : 'Erişim yeniden açıldı.', 'success')
      onErisimDegisti?.()
    } catch (e) {
      bildir('Hata: ' + e.message, 'error')
    } finally {
      setIslem(null)
    }
  }
  const erisimDegistir = () => {
    const g = gerekceAl()
    if (!g) return
    const engelle = !erisimBitis
    onayIste({
      title: engelle ? 'Erişimi engelle' : 'Erişimi aç',
      message: engelle
        ? `"${ad}" hesabı giriş yapamayacak ve açık oturumları kapatılacak. Hesap SİLİNMEZ; engel kaldırılınca her şey yerinde kalır. Elindeki belirteç süresi dolana kadar (en çok 1 saat) erişimi sürebilir. Gerekçe: ${g}`
        : `"${ad}" hesabı yeniden giriş yapabilecek. Gerekçe: ${g}`,
      confirmText: engelle ? 'Erişimi engelle' : 'Erişimi aç',
      variant: engelle ? 'danger' : undefined,
      onConfirm: () => erisimCalistir(g, engelle),
    })
  }

  // ---------------------------------------------------------------- silme
  const silCalistir = async (g, zorla) => {
    setIslem('sil')
    try {
      const { data, error } = await supabase.rpc('admin_delete_user', {
        p_user_id: u.user_id,
        p_reason: g,
        p_force: zorla,
        p_kotuye_kullanim: kotuye,
      })
      if (error) throw error
      if (!data?.ok && data?.hata === 'sahipsiz_kalacak_organizasyon') {
        const adlar = (data.organizasyonlar || []).map((o) => o.ad).join(', ')
        onayIste({
          title: 'Kurumlar yöneticisiz kalacak',
          message: `Bu kişi şu kurumların tek yöneticisi ve başka üyeleri var: ${adlar}. Silinirse bu kurumlar yöneticisiz kalır. Yine de silinsin mi?`,
          confirmText: 'Yine de sil',
          variant: 'danger',
          onConfirm: () => silCalistir(`${g} [sahipsiz kalacak organizasyon uyarısı onaylandı]`, true),
        })
        return
      }
      if (!data?.ok) {
        bildir(SILME_HATALARI[data?.hata] || ('Kullanıcı silinemedi: ' + (data?.hata || 'bilinmeyen hata')), 'error')
        return
      }
      onDegisti({ tur: 'sil', id: u.id })
      bildir(data.kalan_dosya > 0
        ? `Kullanıcı silindi. Uyarı: ${data.kalan_dosya} dosyası depolamada kaldı.`
        : 'Kullanıcı ve hesabı tamamen silindi.', 'success')
    } catch (e) {
      bildir('Hata: ' + e.message, 'error')
    } finally {
      setIslem(null)
    }
  }
  const sil = () => {
    const g = gerekceAl()
    if (!g) return
    onayIste({
      title: 'Hesabı kalıcı olarak sil',
      message: `"${ad}" ve hesabı silinecek; bu işlem geri alınamaz. Finansal ve davet kayıtları korunur, kişiyle bağı kopar.${kotuye ? ' Kötüye kullanım olarak işaretlenecek.' : ''} Gerekçe: ${g}`,
      confirmText: 'Kalıcı olarak sil',
      variant: 'danger',
      onConfirm: () => silCalistir(g, false),
    })
  }

  const silmeEngeli = kendisi
    ? 'Kendi hesabınızı buradan silemezsiniz.'
    : yonetici
      ? 'Yönetici hesapları silinemez; önce yönetici yetkisini alın.'
      : !u.user_id
        ? 'Bu profilin bağlı bir kullanıcı hesabı yok.'
        : null

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button type="button" aria-label="Paneli kapat" tabIndex={-1} onClick={onKapat} className="absolute inset-0 bg-murekkep/40 dark:bg-black/60 cursor-default" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby={baslikId}
        className="relative w-full max-w-[440px] h-full bg-yuzey border-l border-cizgi flex flex-col"
      >
        <div className="flex items-start gap-3 px-5 py-4 border-b border-cizgi">
          <Avatar ad={ad} url={u.avatar_url} boyut={48} />
          <div className="min-w-0 flex-1">
            <h2 id={baslikId} className="font-baslik text-[17px] font-bold leading-tight text-metin truncate">{ad}</h2>
            {u.email && <p className="text-[13px] text-metin-2 truncate">{u.email}</p>}
            <div className="flex gap-1.5 flex-wrap mt-2">
              {yonetici && <Rozet ton="vurguDolu">{ROL_AD[u.role]}</Rozet>}
              {p && <Rozet ton={p.ton}>{p.ad}</Rozet>}
              {d ? <Rozet ton={d.ton}>{d.ad}</Rozet> : <Rozet>Abonelik yok</Rozet>}
              {erisimBitis && <Rozet ton="tehlike" ikon={Ban}>Erişim engelli</Rozet>}
            </div>
          </div>
          <IkonDugme ref={kapatRef} etiket="Kapat" ikon={X} onClick={onKapat} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-6">
          <Bolum baslik="Hesap">
            <dl>
              <Bilgi etiket="Kart adresi">
                {u.username ? (
                  <a href={cardUrl(u.username)} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-mono text-xs text-aksan hover:underline">
                    {u.username}<ExternalLink size={12} aria-hidden="true" />
                  </a>
                ) : '—'}
              </Bilgi>
              {u.card_code && <Bilgi etiket="Kart kodu"><span className="font-mono text-xs">{u.card_code}</span></Bilgi>}
              <Bilgi etiket="Kayıt">{tarih(u.created_at)}</Bilgi>
              <Bilgi etiket="Kart görüntülenme"><span className="tabular-nums">{sayi(u.card_views ?? 0)}</span></Bilgi>
              <Bilgi etiket="Kurduğu kurum">{kurumlar?.length ? kurumlar.map((o) => o.name).join(', ') : '—'}</Bilgi>
            </dl>
          </Bolum>

          <Bolum baslik="Abonelik">
            {s ? (
              <dl>
                <Bilgi etiket="Plan">{p?.ad || s.plan}</Bilgi>
                <Bilgi etiket="Dönem">{s.plan === 'free' ? '—' : s.billing_cycle === 'yearly' ? 'Yıllık' : 'Aylık'}</Bilgi>
                <Bilgi etiket="Başlangıç">{tarih(s.created_at)}</Bilgi>
                <Bilgi etiket="Bitiş">{s.expires_at ? tarih(s.expires_at) : s.plan === 'free' ? '—' : 'Süresiz'}</Bilgi>
                <Bilgi etiket="NFC hakkı">{s.nfc_cards_included ? `${sayi(s.nfc_cards_used || 0)} / ${sayi(s.nfc_cards_included)} kullanıldı` : '—'}</Bilgi>
              </dl>
            ) : (
              <p className="text-[13px] text-metin-2">Bu kişinin abonelik kaydı yok.</p>
            )}
          </Bolum>

          <Bolum baslik="Yönetici işlemleri">
            {kendisi ? (
              <p className="text-[13px] text-metin-2">Kendi hesabınızda rol ve silme işlemi yapılamaz.</p>
            ) : null}
            <div className="flex flex-col gap-1.5">
              <label htmlFor={gerekceId} className="text-[13px] font-semibold text-metin">Gerekçe</label>
              <textarea
                id={gerekceId}
                rows={2}
                value={gerekce}
                onChange={(e) => { setGerekce(e.target.value); if (uyari) setUyari('') }}
                aria-invalid={uyari ? true : undefined}
                aria-describedby={`${gerekceId}-ipucu`}
                placeholder="Örn. destek talebi #1234 üzerine"
                className={birlestir(
                  'w-full rounded-[10px] border bg-yuzey px-3 py-2 text-[13.5px] text-metin placeholder:text-metin-2/70 focus:outline-none focus:ring-2 focus:ring-aksan/40 resize-y',
                  uyari ? 'border-red-300 dark:border-red-500/50' : 'border-cizgi',
                )}
              />
              <span id={`${gerekceId}-ipucu`} className={birlestir('text-xs', uyari ? 'text-red-600 dark:text-red-400' : 'text-metin-2')}>
                {uyari || 'Aşağıdaki her işlem bu gerekçeyle denetim kaydına yazılır ve ikinci onay ister.'}
              </span>
            </div>

            <div className="rounded-xl border border-cizgi p-3.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-metin">Rol</div>
                <div className="text-xs text-metin-2">{ROL_AD[u.role] || ROL_AD.user}</div>
              </div>
              {u.role === 'superadmin' ? (
                <span className="text-xs text-metin-2">Süper yönetici buradan değiştirilemez</span>
              ) : (
                <Dugme
                  boyut="k"
                  tur={u.role === 'admin' ? 'tehlike' : 'ikincil'}
                  ikon={u.role === 'admin' ? ShieldOff : Shield}
                  disabled={kendisi || !!islem}
                  onClick={rolDegistir}
                >
                  {islem === 'rol' ? 'İşleniyor…' : u.role === 'admin' ? 'Yönetici yetkisini al' : 'Yönetici yap'}
                </Dugme>
              )}
            </div>

            <div className="rounded-xl border border-cizgi p-3.5 flex flex-col gap-2.5">
              <div className="text-[13px] font-semibold text-metin">Plan ata</div>
              <div className="flex gap-2 flex-wrap">
                <Secim etiket="Yeni plan" value={yeniPlan} onChange={setYeniPlan} disabled={!s || !!islem} className="flex-1 min-w-[140px]">
                  {PLANLAR.map((x) => <option key={x.deger} value={x.deger}>{x.ad}</option>)}
                </Secim>
                {/* Ücretsizde süre sorulmaz: bitiş tarihi null olur. */}
                {yeniPlan !== 'free' && (
                  <Secim etiket="Süre" value={sureAy} onChange={setSureAy} disabled={!s || !!islem} className="w-[112px]">
                    {SURELER.map((x) => <option key={x.ay} value={x.ay}>{x.ad}</option>)}
                  </Secim>
                )}
                <Dugme boyut="k" tur="ana" className="h-9 self-end" disabled={!s || !!islem || yeniPlan === p?.deger} onClick={planAta}>
                  {islem === 'plan' ? 'İşleniyor…' : 'Planı ata'}
                </Dugme>
              </div>
              {yeniPlan !== 'free' && s && (
                <span className="text-xs text-metin-2">
                  Bitiş: <b className="text-metin">{tarih(ayEkle(sureAy))}</b>. Ücretli plan süresiz verilemez.
                </span>
              )}
              {!s && <span className="text-xs text-metin-2">Abonelik kaydı olmadığı için plan atanamaz.</span>}
            </div>

            <div className="rounded-xl border border-cizgi p-3.5 flex flex-col gap-2.5">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="text-[13px] font-semibold text-metin">Erişim</div>
                  <div className="text-xs text-metin-2">
                    {engelMetni(erisimBitis)}
                  </div>
                </div>
                {kendisi ? (
                  <span className="text-xs text-metin-2">Kendi erişiminizi engelleyemezsiniz</span>
                ) : yonetici ? (
                  <span className="text-xs text-metin-2">Yönetici hesabı engellenemez</span>
                ) : !u.user_id ? (
                  <span className="text-xs text-metin-2">Bağlı kullanıcı hesabı yok</span>
                ) : (
                  <Dugme
                    boyut="k"
                    tur={erisimBitis ? 'ikincil' : 'tehlike'}
                    ikon={erisimBitis ? LockOpen : Ban}
                    disabled={!!islem}
                    onClick={erisimDegistir}
                  >
                    {islem === 'erisim' ? 'İşleniyor…' : erisimBitis ? 'Erişimi aç' : 'Erişimi engelle'}
                  </Dugme>
                )}
              </div>
              <span className="text-xs text-metin-2">
                Engel hesabı silmez: veriler yerinde kalır, kişi giriş yapamaz. Silmeden önce buradan engellemek
                geri dönülebilir olanı seçmek demektir.
              </span>
            </div>

            <div className="rounded-xl border border-red-200 dark:border-red-500/40 p-3.5 flex flex-col gap-2.5">
              <div className="text-[13px] font-semibold text-red-700 dark:text-red-300">Hesabı sil</div>
              {silmeEngeli ? (
                <span className="text-xs text-metin-2">{silmeEngeli}</span>
              ) : (
                <>
                  <label className="flex items-start gap-2 text-xs text-metin-2">
                    <input type="checkbox" checked={kotuye} onChange={(e) => setKotuye(e.target.checked)} className="mt-0.5 accent-red-600 dark:accent-red-400" />
                    <span>
                      <b className="text-metin">Kötüye kullanım nedeniyle</b> (spam, sahte hesap, saldırı). Aynı e-posta ya da telefonla
                      yeniden kayıt olunursa kritik güvenlik kaydı düşer.
                    </span>
                  </label>
                  <Dugme boyut="k" tur="tehlike" ikon={Trash2} disabled={!!islem} onClick={sil} className="self-start">
                    {islem === 'sil' ? 'Siliniyor…' : 'Hesabı kalıcı olarak sil'}
                  </Dugme>
                </>
              )}
            </div>
          </Bolum>
        </div>
      </aside>
    </div>
  )
}
