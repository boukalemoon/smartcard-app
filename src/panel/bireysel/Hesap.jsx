// Hesap ve güvenlik (tasarım: PanelHesap).
//
// Sol sütun güvenlik (iki adımlı doğrulama, bağlı uygulamalar, oturumlar),
// sağ sütun hesap (giriş bilgileri, abonelik, partner özeti, veri ve hesap).
// Arka ucu henüz olmayan her şey "Yakında" olarak devre dışı görünür;
// çalışıyormuş gibi davranan düğme yok.
import { useEffect, useState } from 'react'
import { ShieldCheck, Monitor, Smartphone, ArrowRight } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { MFA_AKTIF } from '../../lib/mfaAyari'
import { SITE_URL, signupUrl } from '../../lib/siteUrl'
import GuvenlikKarti from '../../components/GuvenlikKarti'
import { Kart, KartBaslik, SayfaBaslik, Dugme, Rozet, Girdi, Satir } from '../ui'
import { tarih, goreli, tl, birlestir } from '../bicim'

const PLAN_AD = { free: 'Başlangıç Planı', student: 'Öğrenci Planı', professional: 'Profesyonel Plan', stk: 'STK Özel Plan', business: 'Kurumsal Plan', corporate: 'Kurumsal Plan' }

// QRtım hesabıyla girilen kardeş uygulamalar. Liste sabit: kişi bağlı
// olmadığı uygulamayı da görsün ki hesabının nerede kullanılabildiğini bilsin.
const UYGULAMALAR = [
  { anahtar: 'arku', ad: 'Arku Remote', kisa: 'AR', renk: 'bg-murekkep text-yuzey' },
  { anahtar: 'ilgezdi', ad: 'İlgezdi', kisa: 'İL', renk: 'bg-aksan text-white dark:text-zemin' },
  { anahtar: 'tinga', ad: 'Tınga', kisa: 'TI', renk: 'bg-vurgu text-white dark:text-zemin' },
]

// Tarayıcı yalnızca KENDİ oturumunu bilir; diğer cihazların listesi için
// arka uçta bir oturum listesi gerekiyor (henüz yok). Bu cihazı tanıtmak
// için kullanıcı aracısı yeterli.
function buCihaz() {
  const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent
  const sistem = /iPhone|iPad|iPod/.test(ua) ? 'iOS'
    : /Android/.test(ua) ? 'Android'
    : /Windows/.test(ua) ? 'Windows'
    : /Mac OS X|Macintosh/.test(ua) ? 'macOS'
    : /Linux/.test(ua) ? 'Linux' : null
  const tarayici = /Edg\//.test(ua) ? 'Edge'
    : /OPR\//.test(ua) ? 'Opera'
    : /Firefox\//.test(ua) ? 'Firefox'
    : /Chrome\//.test(ua) ? 'Chrome'
    : /Safari\//.test(ua) ? 'Safari' : null
  return {
    ad: [sistem, tarayici].filter(Boolean).join(', ') || 'Bu tarayıcı',
    mobil: /Mobi|iPhone|Android/.test(ua),
  }
}

// Kart içi küçük kutu (Abonelik: Dönem / Yenileme / NFC hakkı)
function Kutu({ etiket, deger }) {
  return (
    <div className="rounded-[10px] bg-zemin px-2.5 py-2.5 min-w-0">
      <div className="text-xs text-metin-2">{etiket}</div>
      <div className="text-[13px] font-semibold truncate">{deger}</div>
    </div>
  )
}

function YakindaEtiket() {
  return <span className="ml-1 inline-flex items-center h-[18px] px-1.5 rounded-full bg-yuzey-2 text-metin-2 text-[10px] font-semibold">Yakında</span>
}

// Geri dönüşü olan işlemler için satır içi onay: ortak onay penceresinin
// düğmesi "Evet, Sil" diye sabit; "oturumları kapat" için yanlış söz olurdu.
function OnayliIslem({ etiket, onayMetni, onOnay, mesgul, tur = 'tehlikeSessiz' }) {
  const [acik, setAcik] = useState(false)
  if (!acik) {
    return <Dugme boyut="k" tur={tur} onClick={() => setAcik(true)} disabled={mesgul}>{etiket}</Dugme>
  }
  return (
    <span className="inline-flex items-center gap-1.5 flex-wrap justify-end">
      <span className="text-xs text-metin-2">{onayMetni}</span>
      <Dugme boyut="k" tur="sessiz" onClick={() => setAcik(false)}>Vazgeç</Dugme>
      <Dugme boyut="k" tur="tehlike" disabled={mesgul} onClick={async () => { await onOnay(); setAcik(false) }}>
        {mesgul ? 'İşleniyor…' : 'Evet'}
      </Dugme>
    </span>
  )
}

// ---------------------------------------------------------------- iki adımlı doğrulama
function IkiAdimKarti() {
  // Servis açıksa çalışan eski kart gömülür (kurulum/yedek kod akışının tamamı orada).
  if (MFA_AKTIF) return <GuvenlikKarti />
  return (
    <Kart vurgu="aksan" className="p-5 flex flex-col gap-3.5" aria-labelledby="h-2fa">
      {/* KartBaslik sarınca rozet alta düşüyor; tasarımda rozet sağ üstte sabit. */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-10 h-10 rounded-[10px] bg-aksan-acik text-aksan-koyu dark:text-aksan inline-flex items-center justify-center shrink-0"><ShieldCheck size={20} aria-hidden="true" /></span>
          <div className="min-w-0">
            <h2 id="h-2fa" className="font-baslik text-[17px] font-bold leading-tight">İki adımlı doğrulama</h2>
            <p className="mt-1 text-[13px] text-metin-2">QRtım ve bağlı uygulamalar (Arku, İlgezdi, Tınga) için ek koruma. Korgard doğrulama servisiyle çalışır.</p>
          </div>
        </div>
        <Rozet ton="uyari" className="shrink-0">Yakında</Rozet>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-cizgi p-3 flex flex-col gap-1.5">
          <b className="text-[13px]">Doğrulama uygulaması</b>
          <span className="text-xs text-metin-2">Zamana dayalı kod (TOTP). Önerilen yöntem.</span>
          <Dugme boyut="k" tur="ana" className="self-start mt-1" disabled>Kur</Dugme>
        </div>
        <div className="rounded-xl border border-cizgi p-3 flex flex-col gap-1.5">
          <b className="text-[13px]">Yedek kodlar</b>
          <span className="text-xs text-metin-2">Uygulamaya erişemediğinizde kullanılan 8 tek kullanımlık kod.</span>
          <Dugme boyut="k" className="self-start mt-1" disabled>Önce uygulamayı kurun</Dugme>
        </div>
      </div>
      <p className="text-xs text-metin-2">
        Korgard yayına girdiğinde buradan açabileceksiniz. Açıldığında bağlı uygulamalara belirteç verilmeden önce taze doğrulama istenir.
      </p>
    </Kart>
  )
}

// ---------------------------------------------------------------- bağlı uygulamalar
function BagliUygulamalar({ showToast }) {
  const [baglantilar, setBaglantilar] = useState(null)
  const [hata, setHata] = useState(false)
  const [kesilen, setKesilen] = useState(null)

  const yukle = () =>
    supabase
      .from('app_connections')
      .select('app_key, connected_at, last_seen_at, revoked_at, scopes')
      .then(({ data, error }) => {
        if (error) { setHata(true); setBaglantilar([]); return }
        setBaglantilar(data || [])
      })

  useEffect(() => { yukle() }, [])

  const kes = async (uyg) => {
    setKesilen(uyg.anahtar)
    const { data, error } = await supabase.rpc('app_disconnect', { p_app_key: uyg.anahtar })
    setKesilen(null)
    if (error || !data?.ok) { showToast('Bağlantı kesilemedi, tekrar deneyin.', 'error'); return }
    showToast(`${uyg.ad} bağlantısı kesildi`, 'success')
    yukle()
  }

  const aktif = (anahtar) => (baglantilar || []).find((b) => b.app_key === anahtar && !b.revoked_at)

  return (
    <Kart className="p-5 flex flex-col gap-2" aria-labelledby="h-bagli">
      <KartBaslik id="h-bagli" baslik="Bağlı uygulamalar" />
      {hata ? (
        <p className="text-[13px] text-metin-2 py-2">Bağlantı listesi alınamadı. Sayfayı yenileyip tekrar deneyin.</p>
      ) : (
        <div className="flex flex-col">
          {UYGULAMALAR.map((u) => {
            const b = aktif(u.anahtar)
            return (
              <Satir key={u.anahtar}>
                <span className={birlestir('w-10 h-10 rounded-[10px] inline-flex items-center justify-center shrink-0 font-baslik font-extrabold text-xs', u.renk)} aria-hidden="true">{u.kisa}</span>
                <div className="flex-1 min-w-0">
                  <b className="text-sm">{u.ad}</b>
                  <div className="text-xs text-metin-2">
                    {baglantilar === null ? 'Yükleniyor…'
                      : b ? ['bağlandı ' + tarih(b.connected_at), b.last_seen_at && 'son kullanım ' + goreli(b.last_seen_at)].filter(Boolean).join(' · ')
                      : 'Bağlı değil'}
                  </div>
                </div>
                {b ? (
                  <OnayliIslem
                    etiket="Bağlantıyı kes"
                    onayMetni="Kesilsin mi?"
                    mesgul={kesilen === u.anahtar}
                    onOnay={() => kes(u)}
                  />
                ) : (
                  <span className="text-xs text-metin-2 px-3" aria-hidden="true">—</span>
                )}
              </Satir>
            )
          })}
        </div>
      )}
      <p className="text-xs text-metin-2">Bağlantıyı kesince uygulamanın QRtım'da sakladığı senkron verisi silinir. Uygulamadaki açık oturumu ayrıca kapatın.</p>
    </Kart>
  )
}

// ---------------------------------------------------------------- oturumlar
function AktifOturumlar({ showToast }) {
  const [mesgul, setMesgul] = useState(false)
  const cihaz = buCihaz()
  const Ikon = cihaz.mobil ? Smartphone : Monitor

  const digerleriniKapat = async () => {
    setMesgul(true)
    const { error } = await supabase.auth.signOut({ scope: 'others' })
    setMesgul(false)
    if (error) { showToast('Oturumlar kapatılamadı, tekrar deneyin.', 'error'); return }
    showToast('Diğer cihazlardaki oturumlar kapatıldı', 'success')
  }

  return (
    <Kart className="p-5 flex flex-col gap-2" aria-labelledby="h-oturum">
      <KartBaslik
        id="h-oturum"
        baslik="Aktif oturumlar"
        className="items-center"
        sag={<OnayliIslem etiket="Diğerlerini kapat" onayMetni="Diğer tüm cihazlardan çıkılsın mı?" mesgul={mesgul} onOnay={digerleriniKapat} />}
      />
      <div className="flex flex-col">
        <Satir>
          <span className="w-10 h-10 rounded-[10px] bg-yuzey-2 text-aksan-koyu dark:text-aksan inline-flex items-center justify-center shrink-0"><Ikon size={18} aria-hidden="true" /></span>
          <div className="flex-1 min-w-0">
            <b className="text-sm">Bu cihaz · {cihaz.ad}</b>
            <div className="text-xs text-metin-2">şimdi</div>
          </div>
          <Rozet ton="aksan">Geçerli</Rozet>
        </Satir>
      </div>
      <p className="text-xs text-metin-2">Diğer cihazların listesi yakında burada görünecek. Şimdilik "Diğerlerini kapat" bu cihaz dışındaki bütün oturumları sonlandırır.</p>
    </Kart>
  )
}

// ---------------------------------------------------------------- giriş bilgileri
function GirisBilgileri({ eposta, showToast }) {
  const [duzenle, setDuzenle] = useState(false)
  const [yeni, setYeni] = useState('')
  const [mesgul, setMesgul] = useState(false)
  const [bekleyen, setBekleyen] = useState(null)
  const [sifreGitti, setSifreGitti] = useState(false)

  const epostaKaydet = async (e) => {
    e.preventDefault()
    const adres = yeni.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adres)) { showToast('Geçerli bir e-posta adresi girin.', 'error'); return }
    if (adres.toLowerCase() === (eposta || '').toLowerCase()) { setDuzenle(false); return }
    setMesgul(true)
    // "Güvenli e-posta değişikliği" açık: onay hem eski hem yeni adrese gider,
    // ikisi de onaylanana kadar giriş adresi değişmez.
    const { error } = await supabase.auth.updateUser({ email: adres }, { emailRedirectTo: `${SITE_URL}/dashboard?bolum=hesap` })
    setMesgul(false)
    if (error) {
      const m = (error.message || '').toLowerCase()
      showToast(m.includes('registered') || m.includes('exists') ? 'Bu adres başka bir hesapta kayıtlı.' : 'E-posta değiştirilemedi, tekrar deneyin.', 'error')
      return
    }
    setBekleyen(adres)
    setDuzenle(false)
    setYeni('')
  }

  const sifreBaglantisi = async () => {
    setMesgul(true)
    const { error } = await supabase.auth.resetPasswordForEmail(eposta, { redirectTo: `${SITE_URL}/sifre-yenile` })
    setMesgul(false)
    if (error) { showToast('Bağlantı gönderilemedi. Biraz sonra tekrar deneyin.', 'error'); return }
    setSifreGitti(true)
  }

  return (
    <Kart className="p-5 flex flex-col gap-2" aria-labelledby="h-giris">
      <KartBaslik id="h-giris" baslik="Giriş bilgileri" />
      <div className="flex flex-col">
        <Satir className="flex-wrap">
          <div className="flex-1 min-w-0">
            <div className="text-xs text-metin-2">E-posta</div>
            <b className="text-sm break-all">{eposta}</b>
            {bekleyen && <div className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">{bekleyen} için onay bekleniyor — iki adrese de gelen bağlantıyı onaylayın.</div>}
          </div>
          {!duzenle && <Dugme boyut="k" onClick={() => setDuzenle(true)}>Değiştir</Dugme>}
          {duzenle && (
            <form onSubmit={epostaKaydet} className="w-full flex gap-2 flex-wrap">
              <label htmlFor="yeni-eposta" className="sr-only">Yeni e-posta adresi</label>
              <Girdi id="yeni-eposta" type="email" autoComplete="email" value={yeni} onChange={(e) => setYeni(e.target.value)} placeholder="yeni@adres.com" className="h-10 flex-1 min-w-[180px] text-sm" autoFocus />
              <Dugme type="submit" tur="ana" disabled={mesgul || !yeni.trim()}>{mesgul ? 'Gönderiliyor…' : 'Onay gönder'}</Dugme>
              <Dugme tur="sessiz" onClick={() => { setDuzenle(false); setYeni('') }}>Vazgeç</Dugme>
            </form>
          )}
        </Satir>
        <Satir>
          <div className="flex-1 min-w-0">
            <div className="text-xs text-metin-2">Şifre</div>
            <b className="text-sm">{sifreGitti ? 'Bağlantı e-postanıza gönderildi' : '••••••••'}</b>
            <div className="text-xs text-metin-2">Değiştirme bağlantısı kayıtlı e-postanıza gönderilir.</div>
          </div>
          <Dugme boyut="k" onClick={sifreBaglantisi} disabled={mesgul || sifreGitti}>{sifreGitti ? 'Gönderildi' : 'Değiştir'}</Dugme>
        </Satir>
      </div>
    </Kart>
  )
}

// ---------------------------------------------------------------- abonelik
function Abonelik({ ctx }) {
  const plan = ctx.planBilgisi?.plan || ctx.subscription?.plan || 'free'
  const ucretsiz = plan === 'free'
  const donem = ucretsiz ? 'Ücretsiz' : ctx.subscription?.billing_cycle === 'monthly' ? 'Aylık' : ctx.subscription?.billing_cycle === 'yearly' ? 'Yıllık' : '—'
  const nfcHak = ctx.planBilgisi?.sinir?.nfc_yillik ?? 0
  // Kullanılan NFC sayısı my_plan_limits'te yok; abonelik satırında varsa gösterilir.
  const nfcKullanilan = ctx.subscription?.nfc_cards_used
  const nfc = !nfcHak ? 'Dahil değil'
    : typeof nfcKullanilan === 'number' ? `${nfcKullanilan} / ${nfcHak} kullanıldı`
    : `Yılda ${nfcHak}`
  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="h-plan">
      <KartBaslik id="h-plan" baslik="Abonelik" className="items-center" sag={<Rozet ton={ucretsiz ? 'notr' : 'aksan'}>{PLAN_AD[plan] || plan}</Rozet>} />
      <div className="grid grid-cols-3 gap-2.5">
        <Kutu etiket="Dönem" deger={donem} />
        <Kutu etiket="Yenileme" deger={ucretsiz ? '—' : tarih(ctx.planBilgisi?.expires_at)} />
        <Kutu etiket="NFC hakkı" deger={nfc} />
      </div>
      <div className="flex gap-2 flex-wrap">
        <Dugme boyut="k" disabled title="Fatura listesi yakında">Faturalar<YakindaEtiket /></Dugme>
        <Dugme boyut="k" onClick={ctx.faturaDuzenle}>Fatura bilgileri</Dugme>
        <Dugme boyut="k" tur="sessiz" onClick={() => ctx.odemeyiAc(ucretsiz ? 'professional' : plan, ctx.subscription?.billing_cycle || 'yearly')}>
          {ucretsiz ? "Profesyonel'e geç" : 'Planı değiştir'}
        </Dugme>
      </div>
    </Kart>
  )
}

// ---------------------------------------------------------------- partner özeti
function PartnerOzeti({ ctx }) {
  const [kod, setKod] = useState(null)
  const [liste, setListe] = useState(null)

  useEffect(() => {
    supabase.rpc('get_or_create_referral_code').then(({ data }) => { if (data?.ok) setKod(data) })
    supabase.rpc('my_referrals').then(({ data }) => setListe(Array.isArray(data) ? data : []))
  }, [])

  const baglanti = kod?.code ? signupUrl(kod.code) : ''
  const ucretli = (liste || []).filter((r) => r.status === 'active').length
  // Tutarlar sunucudan gelir (komisyon kaydı); burada yalnızca toplanır.
  const toplam = (liste || []).reduce((t, r) => t + Number(r.commission_amount || 0), 0)

  const kopyala = async () => {
    try { await navigator.clipboard.writeText(baglanti); ctx.showToast('Bağlantı kopyalandı', 'success') }
    catch { ctx.showToast('Kopyalanamadı; bağlantıyı elle seçin.', 'error') }
  }

  return (
    <Kart className="p-5 flex flex-col gap-3.5" aria-labelledby="h-partner">
      <KartBaslik
        id="h-partner"
        baslik="Partner programı · %10 hak ediş"
        className="items-center"
        sag={<button type="button" onClick={() => ctx.bolumDegistir('partner')} className="inline-flex items-center gap-1 text-[13px] font-semibold text-aksan hover:underline">Partner paneli <ArrowRight size={14} aria-hidden="true" /></button>}
      />
      <p className="text-[13px] text-metin-2">
        Partner kodunuzla gelen kullanıcı ve kurumların ücretli ödemelerinden %10.
        {liste && ` ${liste.length} yönlendirme · ${ucretli} ücretli paket.`}
        {toplam > 0 && ` Hak ediş: ${tl(toplam)}, kayıtlı IBAN'ınıza aktarılır.`}
      </p>
      <div className="flex items-center border border-cizgi rounded-[10px] overflow-hidden h-10">
        <span className="flex-1 min-w-0 px-3 font-mono text-xs text-metin-2 truncate">{baglanti.replace(/^https?:\/\//, '') || 'Bağlantı hazırlanıyor…'}</span>
        <button type="button" onClick={kopyala} disabled={!baglanti} className="h-full px-3.5 border-l border-cizgi bg-yuzey text-[13px] font-semibold hover:bg-yuzey-2 disabled:opacity-45">Kopyala</button>
      </div>
    </Kart>
  )
}

// ---------------------------------------------------------------- veri ve hesap
function VeriVeHesap({ ctx }) {
  const [hazirlaniyor, setHazirlaniyor] = useState(false)

  // Hazır bir dışa aktarım ucu yok: kişinin kendi okuyabildiği her şey
  // istemcide toplanıp tek JSON dosyası olarak indirilir.
  const indir = async () => {
    setHazirlaniyor(true)
    try {
      const al = async (istek) => {
        const { data, error } = await istek
        return error ? { hata: error.message } : data
      }
      const [kisiler, randevular, profiller, yonlendirmeler, baglantilar, dogrulamalar, kurumlar, hareketler] = await Promise.all([
        al(supabase.rpc('my_card_contacts')),
        al(supabase.rpc('my_appointments')),
        al(supabase.rpc('persona_list')),
        al(supabase.rpc('my_referrals')),
        al(supabase.from('app_connections').select('app_key, connected_at, last_seen_at, revoked_at, scopes')),
        al(supabase.rpc('my_verifications')),
        al(supabase.rpc('my_organizations')),
        al(supabase.rpc('my_activity', { p_limit: 200, p_offset: 0 })),
      ])
      const paket = {
        olusturuldu: new Date().toISOString(),
        hesap: { eposta: ctx.session?.user?.email, kayit: ctx.session?.user?.created_at },
        profil: ctx.profile,
        sosyal_baglantilar: ctx.socialLinks,
        profiller,
        kisiler,
        randevular,
        olcum: ctx.analytics,
        abonelik: ctx.subscription,
        plan: ctx.planBilgisi,
        yonlendirmeler,
        uygulama_baglantilari: baglantilar,
        dogrulamalar,
        kurumlar,
        hareket_gecmisi: hareketler,
      }
      const blob = new Blob([JSON.stringify(paket, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `qrtim-verilerim-${new Date().toISOString().slice(0, 10)}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      ctx.showToast('Verileriniz indirildi', 'success')
    } catch {
      ctx.showToast('Veriler hazırlanamadı, tekrar deneyin.', 'error')
    } finally {
      setHazirlaniyor(false)
    }
  }

  return (
    <Kart vurgu="tehlike" className="p-5 flex flex-col gap-2" aria-labelledby="h-veri">
      <h2 id="h-veri" className="font-baslik text-[17px] font-bold leading-tight text-red-800 dark:text-red-300">Veri ve hesap</h2>
      <div className="flex flex-col">
        <Satir>
          <div className="flex-1 min-w-0">
            <b className="text-sm">Verilerimi indir</b>
            <div className="text-xs text-metin-2">Profil, bağlantılar, kişiler, randevular ve ölçüm; JSON dosyası.</div>
          </div>
          <Dugme boyut="k" onClick={indir} disabled={hazirlaniyor}>{hazirlaniyor ? 'Hazırlanıyor…' : 'Hazırla'}</Dugme>
        </Satir>
        <Satir>
          <div className="flex-1 min-w-0">
            <b className="text-sm">Hesabı sil</b>
            <div className="text-xs text-metin-2">Kartlar ve NFC bağlantıları kalıcı olarak kapanır. Panelden silme yakında; şimdilik talebinizi iletişim sayfasından iletin.</div>
          </div>
          {/* Sahibin çağırabileceği bir silme ucu yok (silme çekirdeği yalnız
              sunucu anahtarıyla çalışıyor). Talep yolu gerçek; düğme sahte değil. */}
          <Dugme as="a" href="/iletisim" boyut="k" tur="tehlike">Talep ilet</Dugme>
        </Satir>
      </div>
    </Kart>
  )
}

export default function Hesap({ ctx }) {
  const eposta = ctx.session?.user?.email || ctx.profile?.email
  const uyelik = ctx.session?.user?.created_at || ctx.profile?.created_at
  return (
    <>
      <SayfaBaslik baslik="Hesap ve güvenlik" alt={[eposta, uyelik && `üyelik ${tarih(uyelik)}`].filter(Boolean).join(' · ')} />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <div className="flex flex-col gap-5 min-w-0">
          <IkiAdimKarti />
          <BagliUygulamalar showToast={ctx.showToast} />
          <AktifOturumlar showToast={ctx.showToast} />
        </div>
        <div className="flex flex-col gap-5 min-w-0">
          <GirisBilgileri eposta={eposta} showToast={ctx.showToast} />
          <Abonelik ctx={ctx} />
          <PartnerOzeti ctx={ctx} />
          <VeriVeHesap ctx={ctx} />
        </div>
      </div>
    </>
  )
}
