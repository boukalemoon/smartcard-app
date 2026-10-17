import { useState, useEffect, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from './Toast'
import { checkLoginRateLimit, checkSignupRateLimit } from '../utils/rateLimiting'
import { useAdimAtlama } from '../hooks/useAdimAtlama'
import { SITE_URL } from '../lib/siteUrl'
import { birlestir } from '../panel/bicim'
import { TemaDugmesi } from '../site/SiteKabugu'
import SolPanel from '../site/giris/SolPanel'
import PartnerOnay from '../site/giris/PartnerOnay'
import SifirlamaIstegi from '../site/giris/SifirlamaIstegi'
import { BilgiKutusu, Dugme, GirisAlani, METIN_BAGLANTI, SifreAlani, SifreGucuCubugu } from '../site/giris/parcalar'
import { MIN_SIFRE } from '../site/giris/kurallar'

// Şifre asgari uzunluğu (tek kaynak: site/giris/kurallar.js). Supabase
// panelinden de aynı değere çekilmeli (Authentication → Policies), aksi halde
// bu yalnızca arayüz kontrolü kalır.
const MIN_PASSWORD_LENGTH = MIN_SIFRE

// Ham `error.message` kullanıcıya gösterilmez: teknik ayrıntı sızdırır ve
// saldırgana sistemin iç durumunu anlatır (bulgu O-8). Bilinen durumlar
// anlaşılır Türkçeye çevrilir, gerisi genel bir mesaja düşer.
const AUTH_ERROR_MESSAGES = [
  ['Invalid login credentials', 'E-posta veya şifre hatalı.'],
  ['Email not confirmed', 'Hesabınız henüz etkinleştirilmemiş. E-postanıza gönderdiğimiz doğrulama bağlantısına tıklayın.'],
  ['User already registered', 'Bu e-posta ile daha önce kayıt olunmuş. Giriş yapmayı deneyin.'],
  ['Password should be at least', `Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`],
  // Doğrulama e-postası gönderilemediğinde kayıt 500 ile tamamen başarısız
  // oluyor ve kullanıcı ham İngilizce hata görüyordu. İki ayrı sebep var:
  // adres teslim edilemiyor (SMTP 501/550) ya da saatlik e-posta kotası dolu.
  ['Error sending confirmation email',
   'Doğrulama e-postası gönderilemedi. E-posta adresinizi kontrol edin; adres doğruysa birkaç dakika sonra tekrar deneyin.'],
  ['Unable to validate email address', 'E-posta adresi geçerli görünmüyor. Yazımını kontrol edin.'],
  ['over_email_send_rate_limit', 'Şu an çok fazla e-posta gönderiliyor. Lütfen birkaç dakika sonra tekrar deneyin.'],
  ['rate limit', 'Çok fazla deneme yapıldı. Lütfen birkaç dakika bekleyip tekrar deneyin.'],
]

function friendlyAuthError(error) {
  const raw = (error?.message ?? '').toLowerCase()
  for (const [needle, message] of AUTH_ERROR_MESSAGES) {
    if (raw.includes(needle.toLowerCase())) return message
  }
  return 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
}

// Partner geri dönüş adresleri ORIGIN olarak tutulur ve tam eşitlikle
// karşılaştırılır. Ön ek (startsWith) karşılaştırması güvenli DEĞİLDİR:
// 'https://arku-remote.vercel.app@saldirgan.com' ve
// 'https://arku-remote.vercel.app.saldirgan.com' gibi adresler ön ek testini
// geçer ama gerçekte saldırganın alan adına gider — SSO jetonu sızardı.
const TRUSTED_PARTNERS = {
  arku: ['https://arku-remote.vercel.app'],
  ilgezdi: ['https://ilgezdi.vercel.app'],
  // Tınga masaüstü uygulaması: OAuth loopback (RFC 8252) — sabit yerel port.
  // Loopback adresleri masaüstü akışının parçasıdır, üretimde de geçerlidir.
  tinga: ['http://127.0.0.1:17605', 'http://localhost:17605'],
}

// Yerel geliştirme sunucuları yalnızca dev derlemesinde güvenilir sayılır;
// üretim paketine hiç girmez.
if (import.meta.env.DEV) {
  TRUSTED_PARTNERS.arku.push('http://localhost:3000', 'http://localhost:5173')
  TRUSTED_PARTNERS.ilgezdi.push('http://localhost:4000')
}

// Callback URL'in origin'i hangi partner'a ait? Değilse null.
// new URL(...).origin, kullanıcı-bilgisi (@) ve alt alan adı hilelerini eler.
function detectPartnerSource(url) {
  let origin
  try {
    origin = new URL(url).origin
  } catch {
    return null
  }
  for (const [name, origins] of Object.entries(TRUSTED_PARTNERS)) {
    if (origins.includes(origin)) return name
  }
  return null
}

function isSafeCallback(url) {
  return detectPartnerSource(url) !== null
}

// ONAY EKRANI (denetim G-03). Eskiden QRtım'e girişli biri partnerin
// /login?callback=… adresine geldiğinde belirteç SORULMADAN üretilip
// yönlendiriliyordu: herhangi bir sayfa girişli kişiyi bu adrese gönderip
// kimliğini sessizce bir uygulamaya bağlatabiliyordu. Artık kişi hangi
// uygulamanın hangi bilgilerini alacağını görür ve kendisi onaylar.
// Alan listesi arku-link / tinga-link'in döndürdüğü alanlarla aynı olmalı.
// kisa: uygulama simgesindeki harfler; donus / adaDonus: Türkçe yönelme eki
// ("İzin ver ve Arku'ya dön", "Arku Remote'a dönülür").
const PARTNER_BILGI = {
  arku: { ad: 'Arku Remote', kisa: 'AR', donus: "Arku'ya", adaDonus: "Arku Remote'a" },
  ilgezdi: { ad: 'İlgezdi', kisa: 'İL', donus: "İlgezdi'ye", adaDonus: "İlgezdi'ye" },
  tinga: { ad: 'Tınga', kisa: 'TI', donus: "Tınga'ya", adaDonus: "Tınga'ya" },
}
const PAYLASILAN_ALANLAR = [
  'Ad soyad ve kullanıcı adı',
  'Doğrulanmış e-posta adresi',
  'Telefon, unvan ve firma (profilinizde varsa)',
  'Profil fotoğrafı',
  'Abonelik planı',
]

function partnerBilgisi(ad) {
  return PARTNER_BILGI[ad] ?? { ad, kisa: String(ad).slice(0, 2).toUpperCase(), donus: 'uygulamaya', adaDonus: 'Uygulamaya' }
}

// Kullanıcı onay vermediğinde partnere boş elle dönülür; partner bilinmeyen
// parametreyi yok sayarsa "giriş yapılmadı" görünür.
function reddiPartnereBildir(cb) {
  const u = new URL(cb)
  u.searchParams.set('qrtim_error', 'access_denied')
  window.location.href = u.toString()
}

// Doğrulama uygulaması kurmuş kişide partner belirteci taze iki adımlı
// doğrulama ister (sunucu 403 { code: "mfa_required" } döner). Böyle bir
// durumda `adimAtla` ile doğrulatıp BİR kez daha deneriz; yine olmazsa belirteç
// verilmez (null) ve partner uygulamaya belirteçsiz dönülür.
async function issuePartnerToken(partnerName, session, adimAtla) {
  const ilk = await requestPartnerToken(partnerName, session)
  if (ilk?.code === 'mfa_required' && adimAtla
      && await adimAtla({ sebep: 'Bağlı uygulamaya giriş', zorla: true })) {
    const tekrar = await requestPartnerToken(partnerName, session)
    return tekrar?.token ? tekrar : null
  }
  return ilk?.token ? ilk : null
}

async function requestPartnerToken(partnerName, session) {
  try {
    const res = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/partner-issue-token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ partner_name: partnerName }),
      }
    )
    const govde = await res.json().catch(() => null)
    if (!res.ok) return govde?.code === 'mfa_required' ? { code: 'mfa_required' } : null
    return govde
  } catch {
    return null
  }
}

// İlk açılışta adres çubuğu / tarayıcı deposundan okunan değerler.
// (Eskiden effect içinde setState ile kuruluyordu; aynı sonuç, ilk çizimde.)
function ilkCallback() {
  const cb = new URLSearchParams(window.location.search).get('callback')
  if (cb && isSafeCallback(cb)) return cb
  const saved = sessionStorage.getItem('partner_callback')
  return saved && isSafeCallback(saved) ? saved : null
}

function ilkDavetKodu() {
  const ref = new URLSearchParams(window.location.search).get('ref')
  if (ref) return ref
  // Eski ad altında saklanmış kod hâlâ okunur: marka adı değişti diye
  // elinde davet kodu olan kişinin kodu düşmesin.
  return localStorage.getItem('qrtim_referral_code')
    || localStorage.getItem('qartim_referral_code')
    || null
}

export default function Auth({ initialMode = 'signup' }) {
  const navigate = useNavigate()
  const { showToast } = useToast()
  const { adimAtla } = useAdimAtlama()
  const id = useId()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  // Mod rotadan gelir (/login | /signup). Eski kodda ?ref= modu 'signup'a
  // çekiyordu ama hemen ardından çalışan effect onu yeniden initialMode'a
  // eşitliyordu; görünen davranış hep "rotanın modu"ydu. Aynısı korunur.
  const mode = initialMode
  const [referralCode] = useState(ilkDavetKodu)
  const [arkuCallback] = useState(ilkCallback)
  // Partner onay ekranı: { partnerName, cb, session }
  const [onay, setOnay] = useState(null)
  // "Şifremi unuttum": null | 'form' | 'gonderildi'
  // /login?sifre=unuttum doğrudan forma açar (süresi dolmuş yenileme
  // bağlantısından "yeni bağlantı iste" ile gelinir).
  const [sifirlama, setSifirlama] = useState(() =>
    new URLSearchParams(window.location.search).get('sifre') === 'unuttum' ? 'form' : null)

  // Adres çubuğundaki güvenli callback, kişi giriş/kayıt arasında gezinirken
  // kaybolmasın diye oturum deposuna yazılır.
  useEffect(() => {
    const cb = new URLSearchParams(window.location.search).get('callback')
    if (cb && isSafeCallback(cb)) sessionStorage.setItem('partner_callback', cb)
  }, [])

  // Kullanıcı zaten giriş yapmışsa ve partner bağlama akışındaysa (callback varsa),
  // yeniden giriş istemeden onay ekranını göster.
  useEffect(() => {
    const autoLinkIfLoggedIn = async () => {
      const urlParams = new URLSearchParams(window.location.search)
      const cb = urlParams.get('callback') || sessionStorage.getItem('partner_callback')
      if (!cb || !isSafeCallback(cb)) return
      const partnerName = detectPartnerSource(cb)
      if (!partnerName) return
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      // Belirteç burada ÜRETİLMEZ: önce kişinin onayı (bkz. PARTNER_BILGI).
      setOnay({ partnerName, cb, session })
    }
    autoLinkIfLoggedIn()
  }, [])

  // Onaydan sonra: belirteci üret, partnere dön. Oturum TIKLAMA ANINDA
  // okunur: onay ekranında uzun beklenirse ilk oturumun erişim belirteci
  // eskimiş olabilir (supabase-js onu arka planda yeniler).
  const partnereGonder = async () => {
    if (!onay) return
    setLoading(true)
    sessionStorage.removeItem('partner_callback')
    const { data: { session: guncel } } = await supabase.auth.getSession()
    const tokenData = guncel ? await issuePartnerToken(onay.partnerName, guncel, adimAtla) : null
    const redirectUrl = new URL(onay.cb)
    if (tokenData?.token) {
      redirectUrl.searchParams.set('qrtim_token', tokenData.token)
      redirectUrl.searchParams.set('qrtim_email', tokenData.email ?? '')
      redirectUrl.searchParams.set('qrtim_name', tokenData.name ?? '')
      redirectUrl.searchParams.set('qrtim_username', tokenData.username ?? '')
    } else {
      // Belirteç alınamadı (oturum bitti, doğrulama iptal edildi): partner
      // sessizce "girişsiz" kalmasın, sebebini bilsin.
      redirectUrl.searchParams.set('qrtim_error', 'token_unavailable')
    }
    window.location.href = redirectUrl.toString()
  }

  const partneriReddet = () => {
    if (!onay) return
    sessionStorage.removeItem('partner_callback')
    reddiPartnereBildir(onay.cb)
  }

  // "Hesap değiştir": yalnızca BU tarayıcının oturumu kapanır (scope: local;
  // kişinin diğer cihazlarına dokunulmaz). Callback oturum deposunda kalır:
  // başka hesapla giriş yapılınca onay ekranı o hesap için yeniden gelir.
  const hesapDegistir = async () => {
    setLoading(true)
    try {
      await supabase.auth.signOut({ scope: 'local' })
    } finally {
      setOnay(null)
      setEmail('')
      setPassword('')
      setLoading(false)
      navigate('/login')
    }
  }

  const sifirlamaIste = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${SITE_URL}/sifre-yenile`,
      })
      // Adresin kayıtlı olup olmadığı SÖYLENMEZ: her durumda aynı mesaj.
      // Hız sınırı da istisna değil — Supabase yalnızca KAYITLI adres için
      // "N saniye sonra tekrar deneyin" der; farklı mesaj göstermek iki hızlı
      // denemeyle hesabın varlığını ele verirdi.
      setSifirlama('gonderildi')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (referralCode) {
      localStorage.setItem('qrtim_referral_code', referralCode)
    }
  }, [referralCode])

  const handleAuth = async (e) => {
    e.preventDefault()
    setLoading(true)

    try {
      if (mode === 'signup') {
        if (password.length < MIN_PASSWORD_LENGTH) {
          showToast(`Şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalı.`, 'warning')
          setLoading(false)
          return
        }

        const signupCheck = checkSignupRateLimit('client')
        if (!signupCheck.allowed) {
          showToast(signupCheck.message, 'warning')
          setLoading(false)
          return
        }

        const { error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name || email.split('@')[0],
              // Davet kodu önceden tarayıcıda saklanıp HİÇBİR YERE gönderilmiyordu:
              // davetle gelen kimse davet edene bağlanmıyordu. Davet kaydını artık
              // sunucu (handle_new_user) oluşturur; kod yanlışsa kayıt yine tamamlanır.
              ...(referralCode ? { referral_code: String(referralCode).trim().slice(0, 40) } : {})
            }
          }
        })

        if (authError) throw authError

        showToast(
          'Kayıt alındı. E-posta adresinize gönderdiğimiz doğrulama bağlantısına tıklayın (gelmediyse spam klasörünü kontrol edin).',
          'success'
        )
        localStorage.removeItem('qrtim_referral_code')
        localStorage.removeItem('qartim_referral_code')
        navigate('/login')

      } else {
        const loginCheck = checkLoginRateLimit(email)
        if (!loginCheck.allowed) {
          showToast(loginCheck.message, 'warning')
          setLoading(false)
          return
        }

        const { data: signInData, error } = await supabase.auth.signInWithPassword({
          email,
          password
        })

        if (error) throw error

        const cb = sessionStorage.getItem('partner_callback')
        if (cb && isSafeCallback(cb)) {
          const partnerName = detectPartnerSource(cb)
          if (partnerName && signInData?.session) {
            // Belirteç onay ekranından sonra üretilir.
            setOnay({ partnerName, cb, session: signInData.session })
            return
          }
          sessionStorage.removeItem('partner_callback')
          window.location.href = cb
          return
        }
      }
    } catch (error) {
      console.error('Auth error:', error)
      showToast(friendlyAuthError(error), 'error')
    } finally {
      setLoading(false)
    }
  }

  const modaGec = (hedef) => {
    if (hedef === mode) return
    setName('')
    setEmail('')
    setPassword('')
    navigate(hedef === 'login' ? '/login' : '/signup')
  }

  if (onay) {
    return (
      <PartnerOnay
        partnerAnahtari={onay.partnerName}
        bilgi={partnerBilgisi(onay.partnerName)}
        cb={onay.cb}
        kullanici={onay.session.user}
        alanlar={PAYLASILAN_ALANLAR}
        mesgul={loading}
        onIzin={partnereGonder}
        onReddet={partneriReddet}
        onHesapDegistir={hesapDegistir}
      />
    )
  }

  if (sifirlama) {
    return (
      <SifirlamaIstegi
        email={email}
        setEmail={setEmail}
        durum={sifirlama}
        mesgul={loading}
        onGonder={sifirlamaIste}
        onGeri={() => setSifirlama(null)}
      />
    )
  }

  const giris = mode === 'login'
  const gelenPartner = arkuCallback ? partnerBilgisi(detectPartnerSource(arkuCallback)) : null

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-zemin text-metin">
      <SolPanel />

      <main className="relative flex-1 min-w-0 flex items-start lg:items-center justify-center px-4 sm:px-6 pt-6 pb-10 lg:py-12">
        <TemaDugmesi className="absolute top-3 right-3 sm:top-5 sm:right-5" />
        <form onSubmit={handleAuth} aria-labelledby={`${id}-baslik`} className="w-full max-w-[420px] flex flex-col gap-5">
          <div role="group" aria-label="Giriş veya kayıt" className="flex bg-yuzey-2 rounded-xl p-1 mr-12 sm:mr-0">
            {[['login', 'Giriş yap'], ['signup', 'Kayıt ol']].map(([m, ad]) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                onClick={() => modaGec(m)}
                disabled={loading}
                className={birlestir(
                  'flex-1 h-10 rounded-[9px] text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-aksan',
                  mode === m ? 'bg-yuzey text-metin shadow-sm' : 'text-metin-2 hover:text-metin',
                )}
              >
                {ad}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <h1 id={`${id}-baslik`} className="font-baslik text-[28px] font-extrabold leading-tight tracking-[-0.015em]">
              {giris ? 'Tekrar hoş geldiniz' : 'Ücretsiz hesap oluşturun'}
            </h1>
            <p className="text-metin-2">
              {giris
                ? 'Panelinize ve kartlarınıza erişmek için giriş yapın.'
                : 'Dijital kartınızı ve kimliğinizi tek hesaptan yönetin.'}
            </p>
          </div>

          {referralCode && !giris && (
            <BilgiKutusu ton="olumlu">
              Davet koduyla kayıt oluyorsunuz: <b className="font-semibold tracking-wide">{String(referralCode).slice(0, 40)}</b>
            </BilgiKutusu>
          )}

          {!giris && (
            <GirisAlani
              id={`${id}-ad`} etiket="Ad soyad" type="text" required autoComplete="name"
              value={name} onChange={(e) => setName(e.target.value)} placeholder="Adınız ve soyadınız"
            />
          )}

          <GirisAlani
            id={`${id}-eposta`} etiket="E-posta" type="email" required autoComplete={giris ? 'username' : 'email'}
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad@ornek.com"
          />

          <SifreAlani
            id={`${id}-sifre`}
            etiket="Şifre"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={giris ? undefined : `En az ${MIN_PASSWORD_LENGTH} karakter`}
            required
            minLength={giris ? undefined : MIN_PASSWORD_LENGTH}
            autoComplete={giris ? 'current-password' : 'new-password'}
            sag={giris && (
              <button type="button" onClick={() => setSifirlama('form')} className={METIN_BAGLANTI}>
                Şifremi unuttum
              </button>
            )}
            alt={!giris && <SifreGucuCubugu sifre={password} />}
          />

          <Dugme type="submit" disabled={loading}>
            {loading ? 'Yükleniyor…' : (giris ? 'Giriş yap' : 'Kayıt ol')}
          </Dugme>

          <p className="text-[13px] text-metin-2 text-center">
            {giris ? 'Hesabınız yok mu? ' : 'Zaten hesabınız var mı? '}
            <button type="button" onClick={() => modaGec(giris ? 'signup' : 'login')} disabled={loading} className={METIN_BAGLANTI}>
              {giris ? 'Ücretsiz kayıt olun' : 'Giriş yapın'}
            </button>
          </p>

          <BilgiKutusu ikon={ShieldCheck}>
            {gelenPartner
              ? <>
                  <b className="text-metin">{gelenPartner.ad} uygulamasından geldiniz.</b> Giriş yaptıktan sonra hangi
                  bilgilerin paylaşılacağını soran bir onay ekranı gösterilir; kararınızdan sonra uygulamaya dönersiniz.
                </>
              : 'Bir partner uygulamadan (Arku, İlgezdi, Tınga) yönlendirildiyseniz girişten sonra size hangi bilgilerin paylaşılacağını soran bir onay ekranı gösterilir.'}
          </BilgiKutusu>
        </form>
      </main>
    </div>
  )
}
