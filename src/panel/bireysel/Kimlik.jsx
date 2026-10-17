// Kimlik — doğrulamalar, QRtım kimliği ve kurumlar.
//
// Tasarım panosunda ayrı bir ekranı yok; PanelGenel'deki "Kimlik durumu"
// kartının dili tam sayfaya taşındı. Doğrulama mantığı VerificationManager
// ile aynı (my_verifications, verification_start_domain, verification_cancel,
// alan-adi-dogrula fonksiyonu); yalnızca görünüm yeni.
import { createElement, useEffect, useState } from 'react'
import { Globe, Building2, Mail, Phone, IdCard, Fingerprint, RefreshCw, Trash2, Copy, Check, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { useDashboardMode } from '../../contexts/DashboardModeContext'
import Modal from '../../components/Modal'
import OrganizationManager from '../../components/OrganizationManager'
import { Kart, KartBaslik, SayfaBaslik, Dugme, IkonDugme, Rozet, Girdi, Satir, Avatar, BosDurum, Yukleniyor } from '../ui'
import { tarih, sayi, birlestir } from '../bicim'

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

const MESAJ_TON = {
  basari: 'bg-emerald-50 text-emerald-800 border-emerald-300 dark:bg-emerald-400/10 dark:text-emerald-300 dark:border-emerald-400/30',
  uyari: 'bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-400/10 dark:text-amber-300 dark:border-amber-400/30',
  hata: 'bg-red-50 text-red-700 border-red-300 dark:bg-red-500/10 dark:text-red-300 dark:border-red-500/30',
}

const ROL_AD = { admin: 'Yönetici', member: 'Üye', moderator: 'Moderatör', editor: 'Editör' }

const dogrulanmisMi = (k) => k.durum === 'dogrulandi' && !k.suresi_gecti

function DurumRozeti({ k }) {
  if (dogrulanmisMi(k)) return <Rozet ton="olumlu">Doğrulandı</Rozet>
  if (k.durum === 'dogrulandi') return <Rozet ton="uyari">Yeniden doğrulanmalı</Rozet>
  if (k.durum === 'basarisiz') return <Rozet ton="tehlike">Kayıt bulunamadı</Rozet>
  return <Rozet ton="uyari">Bekliyor</Rozet>
}

// ---------------------------------------------------------------- doğrulamalar
function Dogrulamalar({ veri, yukle, onayIste }) {
  const [alanAdi, setAlanAdi] = useState('')
  const [ekleniyor, setEkleniyor] = useState(false)
  const [kontrolEdilen, setKontrolEdilen] = useState(null)
  const [kopyalanan, setKopyalanan] = useState(null)
  const [mesaj, setMesaj] = useState(null)

  const liste = veri?.liste || []

  const ekle = async (e) => {
    e.preventDefault()
    setMesaj(null)
    setEkleniyor(true)
    try {
      const { data, error } = await supabase.rpc('verification_start_domain', { p_domain: alanAdi, p_org_id: null })
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

  // Sonucu SUNUCU yazar (iki bağımsız DNS sunucusuna sorar); düğme yalnızca
  // kontrolü tetikler.
  const kontrolEt = async (k) => {
    setMesaj(null)
    setKontrolEdilen(k.id)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setMesaj({ tur: 'hata', metin: 'Oturumunuz sona ermiş. Tekrar giriş yapın.' }); return }
      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/alan-adi-dogrula`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id: k.id }),
      })
      const sonuc = await res.json().catch(() => ({}))
      if (sonuc?.ok) setMesaj({ tur: 'basari', metin: `${k.konu} doğrulandı. Kartınızda rozet olarak görünecek.` })
      else setMesaj({ tur: 'uyari', metin: HATALAR[sonuc?.hata] || 'Doğrulama tamamlanamadı.' })
      await yukle()
    } catch (err) {
      setMesaj({ tur: 'hata', metin: 'Bağlantı hatası: ' + err.message })
    } finally {
      setKontrolEdilen(null)
    }
  }

  const kaldir = (k) => {
    onayIste({
      title: 'Doğrulama kaldırılsın mı?',
      message: `${k.konu} doğrulaması kaldırılır; kartınızdaki rozet kalkar.`,
      onConfirm: async () => {
        const { data, error } = await supabase.rpc('verification_cancel', { p_id: k.id })
        if (error || !data?.ok) { setMesaj({ tur: 'hata', metin: HATALAR[data?.hata] || 'Kaldırılamadı.' }); return }
        await yukle()
      },
    })
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

  return (
    <Kart className="p-5 flex flex-col gap-3" aria-labelledby="k-dogrulama">
      <KartBaslik
        id="k-dogrulama"
        baslik="Doğrulamalar"
        alt="Doğruladığınız şeyler kartınızda rozet olarak görünür. Rozet “onaylı hesap” demez; tam olarak neyin doğrulandığını söyler."
      />

      {mesaj && <div role="status" className={birlestir('rounded-xl border px-3.5 py-2.5 text-[13px]', MESAJ_TON[mesaj.tur])}>{mesaj.metin}</div>}

      {veri === null ? <Yukleniyor /> : (
        <div className="flex flex-col">
          {/* E-posta rozet değil, durum bilgisi: herkeste olduğu için kartta
              göstermek rozeti değersizleştirirdi. */}
          {veri.eposta && (
            <Satir>
              <span className="w-10 h-10 rounded-[10px] bg-yuzey-2 text-metin-2 inline-flex items-center justify-center shrink-0"><Mail size={18} aria-hidden="true" /></span>
              <div className="flex-1 min-w-0">
                <b className="text-sm">Hesap e-postası</b>
                <div className="text-xs text-metin-2">{veri.eposta.dogrulandi ? `${tarih(veri.eposta.tarih)} · kartta rozet olarak gösterilmez` : 'Gelen kutunuzdaki onay bağlantısını açın'}</div>
              </div>
              {veri.eposta.dogrulandi ? <Rozet ton="olumlu">Doğrulandı</Rozet> : <Rozet ton="uyari">Bekliyor</Rozet>}
            </Satir>
          )}

          {liste.map((k) => {
            const acik = (!dogrulanmisMi(k)) && k.kayit_degeri
            return (
              <div key={k.id} className="py-3 border-b border-cizgi/70 last:border-b-0">
                <div className="flex items-center gap-3 min-w-0 flex-wrap sm:flex-nowrap">
                  <span className="w-10 h-10 rounded-[10px] bg-aksan-acik text-aksan-koyu dark:text-aksan inline-flex items-center justify-center shrink-0">
                    {k.kurum_id ? <Building2 size={18} aria-hidden="true" /> : <Globe size={18} aria-hidden="true" />}
                  </span>
                  {/* Dar ekranda metin sıkışmasın: yer kalmazsa eylemler alt satıra iner. */}
                  <div className="flex-1 min-w-[160px]">
                    <b className="text-sm break-all">{k.konu}</b>
                    <div className="text-xs text-metin-2">
                      {[k.kurum_adi && `Kurum: ${k.kurum_adi}`,
                        dogrulanmisMi(k) ? `doğrulandı ${tarih(k.dogrulandi_at)}`
                          : k.durum === 'basarisiz' ? `son deneme ${tarih(k.son_deneme_at)}`
                          : k.durum === 'dogrulandi' ? 'süresi doldu' : 'DNS kaydı bekleniyor',
                      ].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                    <DurumRozeti k={k} />
                    {!dogrulanmisMi(k) && (
                      <Dugme boyut="k" tur="ana" ikon={RefreshCw} onClick={() => kontrolEt(k)} disabled={kontrolEdilen === k.id}>
                        {kontrolEdilen === k.id ? 'Kontrol ediliyor…' : 'Doğrula'}
                      </Dugme>
                    )}
                    <IkonDugme etiket={`${k.konu} doğrulamasını kaldır`} ikon={Trash2} onClick={() => kaldir(k)} className="w-8 h-8 hover:text-red-600 dark:hover:text-red-400" />
                  </div>
                </div>

                {/* DNS yönergesi yalnızca gerektiğinde açık durur. */}
                {acik && (
                  <div className="mt-3 rounded-xl bg-yuzey-2 p-3 flex flex-col gap-2">
                    <p className="text-xs text-metin-2">
                      Alan adınızın DNS ayarlarına aşağıdaki <b className="text-metin">TXT</b> kaydını ekleyin, sonra “Doğrula”ya basın.
                      Kaydı <code className="font-mono text-metin">{k.konu}</code> köküne ya da <code className="font-mono text-metin">_qrtim.{k.konu}</code> altına koyabilirsiniz.
                    </p>
                    <div className="flex items-center gap-2 rounded-lg border border-cizgi bg-yuzey px-2.5 py-1.5">
                      <code className="flex-1 min-w-0 font-mono text-xs break-all">{k.kayit_degeri}</code>
                      <button type="button" onClick={() => kopyala(k.kayit_degeri, k.id)} aria-label="TXT değerini kopyala" className="p-1.5 rounded-md text-metin-2 hover:text-metin hover:bg-yuzey-2 shrink-0">
                        {kopyalanan === k.id ? <Check size={15} className="text-emerald-700 dark:text-emerald-300" aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}
                      </button>
                    </div>
                    <p className="text-[11px] text-metin-2">Bu değer gizli değildir; zaten herkese açık bir DNS kaydına yazılır. Güvenlik, kaydı yalnızca alan adının sahibinin yazabilmesinden gelir.</p>
                  </div>
                )}
              </div>
            )
          })}

          {/* Telefon ve resmi kimlik dış sağlayıcı anlaşması bekliyor. */}
          {[{ ad: 'Telefon numarası', ikon: Phone }, { ad: 'Resmi kimlik', ikon: IdCard }].map(({ ad, ikon }) => (
            <Satir key={ad}>
              <span className="w-10 h-10 rounded-[10px] bg-yuzey-2 text-metin-2 inline-flex items-center justify-center shrink-0">{createElement(ikon, { size: 18, 'aria-hidden': true })}</span>
              <div className="flex-1 min-w-0">
                <b className="text-sm text-metin-2">{ad}</b>
                <div className="text-xs text-metin-2">Dış sağlayıcı anlaşması gerekiyor; açıldığında burada görünecek.</div>
              </div>
              <Rozet>Yakında</Rozet>
            </Satir>
          ))}
        </div>
      )}

      <form onSubmit={ekle} className="flex gap-2 flex-wrap pt-1">
        <label htmlFor="k-alan-adi" className="sr-only">Doğrulanacak alan adı</label>
        <Girdi
          id="k-alan-adi"
          value={alanAdi}
          onChange={(e) => setAlanAdi(e.target.value)}
          placeholder="ornek.com.tr"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck="false"
          className="h-10 flex-1 min-w-[180px] text-sm"
        />
        <Dugme type="submit" tur="ana" ikon={Plus} disabled={ekleniyor || !alanAdi.trim()}>{ekleniyor ? 'Ekleniyor…' : 'Alan adı ekle'}</Dugme>
      </form>
      <p className="text-xs text-metin-2">Kurum rozeti için kurumun alan adının doğrulanmış olması gerekir; kurum kaydını herkes açabildiği için üyelik tek başına kanıt sayılmaz.</p>
    </Kart>
  )
}

// ---------------------------------------------------------------- QRtım kimliği
function QrtimKimligi({ userId }) {
  const [kimlik, setKimlik] = useState(undefined)

  useEffect(() => {
    if (!userId) return
    let iptal = false
    supabase.from('qrtim_user_ids').select('qrtim_uid').eq('user_id', userId).maybeSingle()
      .then(({ data }) => { if (!iptal) setKimlik(data?.qrtim_uid || null) })
    return () => { iptal = true }
  }, [userId])

  // Kopyalama/paylaşım caydırılır: kimlik bilgi amaçlı, paylaşılacak bir şey değil.
  const engelle = (e) => e.preventDefault()

  return (
    <Kart className="p-5 flex flex-col gap-3" aria-labelledby="k-qrtim">
      <KartBaslik
        id="k-qrtim"
        baslik="QRtım kimliği"
        alt="Hesabınıza özel kimlik. Bağlı uygulamalar sizi bununla tanır; paylaşmanız gerekmez."
        ikon={<span className="w-10 h-10 rounded-[10px] bg-murekkep text-yuzey inline-flex items-center justify-center shrink-0"><Fingerprint size={20} aria-hidden="true" /></span>}
      />
      {kimlik === undefined ? (
        <span className="h-10 rounded-[10px] bg-yuzey-2 animate-pulse" aria-label="Yükleniyor" />
      ) : kimlik ? (
        <code
          className="block rounded-[10px] bg-yuzey-2 px-3 py-2.5 font-mono text-[13px] text-metin break-all select-none"
          onCopy={engelle}
          onContextMenu={engelle}
          onDragStart={engelle}
        >
          {kimlik}
        </code>
      ) : (
        <p className="text-[13px] text-metin-2">Kimliğiniz henüz oluşturulmamış. İlk uygulama girişinde otomatik oluşur.</p>
      )}
    </Kart>
  )
}

// ---------------------------------------------------------------- kurumlar
function Kurumlarim({ kurumlar, dogrulamalar, onYonet, onKurumsal }) {
  const onayli = (id) => (dogrulamalar || []).some((k) => k.kurum_id === id && dogrulanmisMi(k))
  return (
    <Kart className="p-5 flex flex-col gap-2" aria-labelledby="k-kurum">
      <KartBaslik
        id="k-kurum"
        baslik="Kurumlarım"
        className="items-center"
        sag={<Dugme boyut="k" tur="sessiz" onClick={onYonet}>{kurumlar?.length ? 'Yönet' : 'Kurum oluştur'}</Dugme>}
      />
      {kurumlar === null ? <Yukleniyor /> : kurumlar.length === 0 ? (
        <BosDurum
          ikon={Building2}
          baslik="Henüz bir kuruma bağlı değilsiniz"
          aciklama="Bir kurum kurabilir ya da bir kurumun davetini kabul edebilirsiniz. Davetler panelin üstünde görünür."
          eylem={<Dugme boyut="k" ikon={Plus} onClick={onYonet}>Kurum oluştur</Dugme>}
          className="py-5"
        />
      ) : (
        <>
          <div className="flex flex-col">
            {kurumlar.map((o) => (
              <Satir key={o.id} className="flex-wrap">
                <Avatar ad={o.name} url={o.logo_url} boyut={40} kare />
                <div className="flex-1 min-w-[150px]">
                  <b className="text-sm block truncate">{o.name}</b>
                  <div className="text-xs text-metin-2">{[ROL_AD[o.my_role] || o.my_role, `${sayi(o.member_count)} üye`].filter(Boolean).join(' · ')}</div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
                  {onayli(o.id) && <Rozet ton="olumlu">Kurum onaylı</Rozet>}
                  <Rozet ton={o.is_admin ? 'aksan' : 'notr'}>{o.is_admin ? 'Yönetici' : 'Üye'}</Rozet>
                </div>
              </Satir>
            ))}
          </div>
          <Dugme boyut="k" className="self-start mt-1" onClick={onKurumsal}>Kurumsal panele geç</Dugme>
        </>
      )}
    </Kart>
  )
}

export default function Kimlik({ ctx }) {
  const { setCorporate } = useDashboardMode()
  const [dogrulama, setDogrulama] = useState(null)
  const [kurumlar, setKurumlar] = useState(null)
  const [yonet, setYonet] = useState(false)

  const dogrulamaYukle = async () => {
    const { data, error } = await supabase.rpc('my_verifications')
    setDogrulama(!error && data?.ok ? data : { liste: [], eposta: null })
  }
  const kurumYukle = async () => {
    const { data, error } = await supabase.rpc('my_organizations')
    setKurumlar(!error && Array.isArray(data) ? data : [])
  }

  useEffect(() => {
    supabase.rpc('my_verifications').then(({ data, error }) => setDogrulama(!error && data?.ok ? data : { liste: [], eposta: null }))
    supabase.rpc('my_organizations').then(({ data, error }) => setKurumlar(!error && Array.isArray(data) ? data : []))
  }, [])

  const dogrulanan = (dogrulama?.liste || []).filter(dogrulanmisMi).length

  return (
    <>
      <SayfaBaslik
        baslik="Kimlik"
        alt="Kartınızda neyin doğrulandığını ve hangi kurumlara bağlı olduğunuzu buradan yönetin."
        solEk={dogrulama && dogrulanan > 0 ? <Rozet ton="olumlu">{dogrulanan} doğrulama</Rozet> : null}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-5 items-start">
        <Dogrulamalar veri={dogrulama} yukle={dogrulamaYukle} onayIste={ctx.onayIste} />
        <div className="flex flex-col gap-5 min-w-0">
          <QrtimKimligi userId={ctx.session?.user?.id} />
          <Kurumlarim kurumlar={kurumlar} dogrulamalar={dogrulama?.liste} onYonet={() => setYonet(true)} onKurumsal={setCorporate} />
        </div>
      </div>

      {/* Kurum kurma/düzenleme/üye yönetimi eski bileşende çalışıyor; olduğu
          gibi pencere içinde açılır (görünümü henüz eski). */}
      <Modal isOpen={yonet} onClose={() => { setYonet(false); kurumYukle() }} title="Kurumlarım" size="xl">
        {yonet && <OrganizationManager profileId={ctx.profile?.id} />}
      </Modal>
    </>
  )
}
