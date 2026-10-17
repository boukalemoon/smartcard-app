import { useState, useEffect, useId } from 'react'
import { CircleCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useAdimAtlama } from '../hooks/useAdimAtlama'
import { birlestir, saat } from '../panel/bicim'
import { BilgiKutusu, Dugme, GirisAlani, KimlikSayfasi, SifreAlani, Yukleniyor } from '../site/giris/parcalar'

/**
 * İlgezdi tarayıcısı QR girişi onay sayfası (tasarım panosu: CihazGiris).
 *
 * İlgezdi, QR koduna `https://www.qrtim.com.tr/browser-login?token=<session_token>`
 * gömer. Bu sayfa:
 *  1. Kullanıcı giriş yapmamışsa küçük bir giriş formu gösterir,
 *  2. Girişliyse onay ister,
 *  3. Onayda `ilgezdi-qr` Edge Function'ına (action: approve) kullanıcının
 *     JWT'siyle istek atar — tabloya doğrudan yazım yoktur.
 *
 * SAHTE QR İLE OTURUM ÇALMA (QRLjacking): Saldırgan kendi bilgisayarında QR
 * üretip "şunu okut" diye kurbana gönderirse, kurban onayladığında oturum
 * SALDIRGANIN tarayıcısında açılır. Tek savunma, onaylayan kişinin isteğin
 * kendi cihazından geldiğini görebilmesidir. Bu yüzden onaydan önce istek
 * incelenir (action: inspect) ve cihaz etiketi ile zaman gösterilir.
 *
 * Tabloda yalnızca sunucunun gerçekten döndürdüğü alanlar var
 * (requester_label, created_at, expires_at, same_network). İşletim sistemi,
 * sürüm ve konum bilgisi sunucuda yok; gösterilmez. Sayı eşleştirme yalnızca
 * sunucu `match_options` döndürürse (İlgezdi QR v2) görünür.
 *
 * "Bu ben değilim": sunucuda reddetme işlemi yok; QR onaylanmazsa süresi
 * dolunca kendiliğinden geçersiz olur. Düğme pencereyi kapatmayı dener,
 * kapanmazsa kişiye bunu söyler.
 */
const SATIR = 'flex justify-between gap-3 py-2.5 text-[13px] border-b border-cizgi last:border-0'

function onceMetni(sn) {
  if (sn < 60) return `${sn} sn önce`
  return `${Math.floor(sn / 60)} dk önce`
}

export default function BrowserLogin() {
  const id = useId()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [vazgecildi, setVazgecildi] = useState(false)
  const [error, setError] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [istek, setIstek] = useState(null) // { requester_label, created_at, expires_at, same_network, match_options?, _alindi }
  // Sayı eşleştirme (v2 İlgezdi): kişinin seçtiği sayı
  const [secilenSayi, setSecilenSayi] = useState(null)
  const { adimAtla } = useAdimAtlama()

  const token = new URLSearchParams(window.location.search).get('token')

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => subscription.unsubscribe()
  }, [])

  // Oturum varsa isteği incele: hangi cihaz, ne zaman.
  useEffect(() => {
    if (!session?.access_token || !token) return
    let iptal = false
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ilgezdi-qr`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ action: 'inspect', session_token: token }),
    })
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (iptal) return
        // _alindi: "kaç sn önce" metni için yanıtın geldiği an (çizimde saat okunmaz).
        if (ok) setIstek({ ...d, _alindi: Date.now() })
        else if (d.error === 'not_found_or_expired') setError('QR kodun süresi dolmuş. İlgezdi tarayıcısında QR kodu yenileyip tekrar okutun.')
      })
      .catch(() => {})
    return () => { iptal = true }
  }, [session?.access_token, token])

  const handleLogin = async (e) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Giriş başarısız: e-posta veya şifre hatalı.')
    setBusy(false)
  }

  const handleApprove = async (tekrar = false) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ilgezdi-qr`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: 'approve', session_token: token, match_code: secilenSayi }),
        }
      )
      const data = await res.json()
      if (res.ok && data.ok) {
        setDone(true)
      } else if (data.error === 'mfa_required' && !tekrar) {
        // Başka cihaza oturum açtırmak için bu oturumda son 10 dakikada
        // iki adımlı doğrulama gerekiyor. Doğrulayınca onayı bir kez daha dene.
        setBusy(false)
        if (await adimAtla({ sebep: 'Başka bir cihazda oturum açmayı onaylamak', zorla: true })) {
          return handleApprove(true)
        }
        setError('Onay için iki adımlı doğrulama gerekiyor.')
        return
      } else if (data.error === 'match_failed') {
        setError('Seçilen sayı bilgisayar ekranındakiyle eşleşmedi. Güvenliğiniz için bu QR iptal edildi; İlgezdi\'de yeni QR oluşturun.')
        setIstek(null)
      } else if (data.error === 'not_found_or_expired') {
        setError('QR kodun süresi dolmuş. İlgezdi tarayıcısında QR kodu yenileyip tekrar okutun.')
      } else if (data.error === 'email_not_verified') {
        setError('Başka bir cihazda oturum açmadan önce e-posta adresinizi doğrulamanız gerekiyor.')
      } else if (data.error === 'rate_limited') {
        setError('Çok fazla deneme. Bir dakika sonra tekrar deneyin.')
      } else {
        setError('Onay başarısız oldu, lütfen tekrar deneyin.')
      }
    } catch {
      setError('Bağlantı hatası, lütfen tekrar deneyin.')
    }
    setBusy(false)
  }

  const vazgec = () => {
    setVazgecildi(true)
    window.close()
  }

  const ust = (baslik, aciklama) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold tracking-[0.08em] uppercase text-aksan">İlgezdi tarayıcı girişi</span>
      <h1 id={`${id}-b`} className="font-baslik text-2xl font-extrabold leading-tight tracking-[-0.015em]">{baslik}</h1>
      {aciklama && <p className="text-sm text-metin-2">{aciklama}</p>}
    </div>
  )

  const hataKutusu = error && <BilgiKutusu ton="tehlike" rol="alert">{error}</BilgiKutusu>

  const sayfa = (icerik) => <KimlikSayfasi genislik="max-w-[440px]">{icerik}</KimlikSayfasi>

  if (!token) {
    return sayfa(ust('Geçersiz bağlantı', 'QR kodu İlgezdi tarayıcısından yeniden okutun.'))
  }

  if (loading) {
    return sayfa(<>{ust('Bir bilgisayar hesabınıza girmek istiyor')}<Yukleniyor /></>)
  }

  if (done) {
    return sayfa(
      <div className="flex flex-col items-center text-center gap-4 bg-yuzey border border-cizgi rounded-2xl p-6" role="status">
        <span className="w-14 h-14 rounded-full bg-emerald-50 dark:bg-emerald-400/15 text-emerald-700 dark:text-emerald-300 inline-flex items-center justify-center">
          <CircleCheck size={30} aria-hidden="true" />
        </span>
        <h1 className="font-baslik text-xl font-extrabold">Giriş onaylandı</h1>
        <p className="text-sm text-metin-2">
          İlgezdi tarayıcısına dönebilirsiniz — oturumunuz otomatik açılacak,
          ayarlarınız ve yer imleriniz senkronize edilecek.
        </p>
      </div>
    )
  }

  if (!session) {
    return sayfa(
      <form onSubmit={handleLogin} aria-labelledby={`${id}-b`} className="flex flex-col gap-5">
        {ust('Onaylamak için giriş yapın', 'Tarayıcı girişini onaylamak için QRtım hesabınızla giriş yapın.')}
        <GirisAlani
          id={`${id}-e`} etiket="E-posta" type="email" required autoComplete="username"
          value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad@ornek.com"
        />
        <SifreAlani
          id={`${id}-s`} etiket="Şifre" required autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
        {hataKutusu}
        <Dugme type="submit" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş yap'}</Dugme>
      </form>
    )
  }

  if (vazgecildi) {
    return sayfa(
      ust('Onay verilmedi', 'Bilgisayarda oturum açılmadı. Bu QR kod kullanılmazsa kısa süre içinde kendiliğinden geçersiz olur; bu sekmeyi kapatabilirsiniz.'),
    )
  }

  const ad = session.user?.user_metadata?.name
  const gecen = istek?.created_at ? Math.max(0, Math.round((istek._alindi - new Date(istek.created_at).getTime()) / 1000)) : null

  return sayfa(
    <>
      {ust(
        'Bir bilgisayar hesabınıza girmek istiyor',
        <>
          Giriş <b className="text-metin">{ad || session.user?.email}</b>
          {ad && session.user?.email ? ` (${session.user.email})` : ''} olarak yapılacak. Onaylamadan önce
          ekrandaki bilgileri bilgisayarınızla karşılaştırın.
        </>,
      )}

      {istek && (
        <dl className="bg-yuzey border border-cizgi rounded-2xl px-4 py-1">
          {/* Cihaz adı QR'ı üreten programın KENDİ beyanı; saldırgan istediğini
              yazabilir (denetim G-04). Bu yüzden öyle etiketleniyor ve yanında
              sunucunun kendi gözlemi (aynı ağ mı) gösteriliyor. */}
          {istek.requester_label && (
            <div className={SATIR}><dt className="text-metin-2">Cihazın bildirdiği ad</dt><dd className="font-semibold text-right break-all">{istek.requester_label}</dd></div>
          )}
          {istek.created_at && (
            <div className={SATIR}><dt className="text-metin-2">QR oluşturuldu</dt><dd className="font-semibold text-right tabular-nums">{saat(istek.created_at)}{gecen !== null && ` · ${onceMetni(gecen)}`}</dd></div>
          )}
          {istek.expires_at && (
            <div className={SATIR}><dt className="text-metin-2">Son geçerlilik</dt><dd className="font-semibold text-right tabular-nums">{saat(istek.expires_at)}</dd></div>
          )}
          {typeof istek.same_network === 'boolean' && (
            <div className={SATIR}>
              <dt className="text-metin-2">Ağ</dt>
              <dd className={birlestir('font-semibold text-right', istek.same_network ? 'text-emerald-700 dark:text-emerald-300' : 'text-amber-800 dark:text-amber-300')}>
                {istek.same_network ? 'Sizinle aynı ağ' : 'Farklı ağ'}
              </dd>
            </div>
          )}
        </dl>
      )}

      {istek?.same_network === false && (
        <BilgiKutusu ton="dikkat">
          <b>Bu istek sizinle aynı ağdan gelmiyor.</b> Telefonunuz mobil veride, bilgisayarınız Wi-Fi'da ise bu
          normal olabilir. QR kodu size biri gönderdiyse onaylamayın.
        </BilgiKutusu>
      )}

      {istek?.match_options && (
        <div className="flex flex-col gap-2.5">
          <b id={`${id}-sayi`} className="text-sm">Bilgisayar ekranındaki sayıyı seçin</b>
          <div role="group" aria-labelledby={`${id}-sayi`} className="grid grid-cols-3 gap-2.5">
            {istek.match_options.map((n) => (
              <button
                key={n} type="button" onClick={() => setSecilenSayi(n)} aria-pressed={secilenSayi === n}
                className={birlestir(
                  'h-[72px] rounded-[14px] border-2 font-baslik text-[28px] font-bold tabular-nums transition-colors',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksan',
                  secilenSayi === n ? 'border-aksan bg-aksan-acik text-aksan-koyu dark:text-aksan' : 'border-cizgi bg-yuzey text-metin hover:bg-yuzey-2',
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-xs text-metin-2">
            Yanlış sayı seçilirse bu QR güvenlik için iptal edilir; bilgisayarda yeni QR oluşturulur. Sayıyı
            göremiyorsanız QR size başkası tarafından gönderilmiştir; onaylamayın.
          </p>
        </div>
      )}

      <BilgiKutusu ton="uyari">
        Yalnızca QR kodu <b>şu an kendi bilgisayarınızın ekranında</b> görüyorsanız onaylayın. Birisi size bu
        bağlantıyı gönderdiyse onaylamayın: onay, oturumu QR'ı üreten cihazda açar.
      </BilgiKutusu>

      {hataKutusu}

      <div className="flex flex-col gap-2.5">
        <Dugme className="h-[52px] rounded-[14px]" onClick={() => handleApprove()} disabled={busy || (istek?.match_options && secilenSayi === null)}>
          {busy ? 'Onaylanıyor…' : 'Girişi onayla'}
        </Dugme>
        <Dugme tur="ikincil" className="h-[52px] rounded-[14px]" onClick={vazgec} disabled={busy}>
          Bu ben değilim, vazgeç
        </Dugme>
        <p className="text-xs text-metin-2 text-center">QR kod 5 dakika içinde geçersiz olur.</p>
      </div>
    </>
  )
}
