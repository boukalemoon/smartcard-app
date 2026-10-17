import { useEffect, useId, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CircleCheck } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { mfaDurumum } from '../lib/shieldauth'
import { MFA_AKTIF } from '../lib/mfaAyari'
import { useAdimAtlama } from '../hooks/useAdimAtlama'
import {
  AdimGostergesi, BilgiKutusu, Dugme, KimlikKarti, KimlikSayfasi, METIN_BAGLANTI, SifreAlani, SifreGucuCubugu, Yukleniyor,
} from '../site/giris/parcalar'
import { MIN_SIFRE, SIFRE_ADIMLARI } from '../site/giris/kurallar'

// PAROLA YENİLEME — "Şifremi unuttum" e-postasındaki bağlantının indiği sayfa
// (2. adım; 1. adım giriş ekranında, bkz. site/giris/SifirlamaIstegi).
//
// Bağlantı Supabase'in kurtarma oturumunu açar (adres çubuğundaki belirteç ya
// da /auth/confirm üzerinden token_hash). Bu sayfa yalnızca oturum varsa yeni
// parola formunu gösterir.
//
// İKİ ADIMLI DOĞRULAMA: e-posta kutusunu ele geçiren biri parola sıfırlama
// bağlantısını da alır. Doğrulama uygulaması kurmuş kişiye bu formda TOTP ya
// da yedek kod sorulur.
//
// SINIR (dürüstlük): bu bir ARAYÜZ adımıdır. Kurtarma bağlantısı tam bir
// Supabase oturumu açar; o oturumla supabase.auth.updateUser() doğrudan
// çağrılabilir. Parola değişse bile saldırgan kimlik verisine YAZAMAZ
// (veritabanı kapısı, denetim G-01) ama gerçek sahibi parolasıyla giremez.
// Kalıcı çözüm Supabase'in yerleşik MFA seviyesi (aal2) — Faz 2.
//
// Kurallar listesi yalnızca GERÇEKTEN uygulanan kuralları yazar: uzunluk
// (burada ve Supabase'de) ve "eskisinden farklı" (Supabase reddeder).
// Diğer cihazlardaki oturumlar bu işlemle KAPANMAZ; bu yüzden öyle yazılmaz.
const MIN_PAROLA = MIN_SIFRE

export default function SifreYenile() {
  const navigate = useNavigate()
  const { adimAtla } = useAdimAtlama()
  const id = useId()
  const [oturum, setOturum] = useState(undefined)
  const [parola, setParola] = useState('')
  const [tekrar, setTekrar] = useState('')
  const [mesgul, setMesgul] = useState(false)
  const [hata, setHata] = useState('')
  const [bitti, setBitti] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setOturum(data.session ?? null))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setOturum(s ?? null))
    return () => subscription.unsubscribe()
  }, [])

  const gonder = async (e) => {
    e.preventDefault()
    setHata('')
    if (parola.length < MIN_PAROLA) return setHata(`Parola en az ${MIN_PAROLA} karakter olmalı.`)
    if (parola !== tekrar) return setHata('Parolalar eşleşmiyor.')

    setMesgul(true)
    try {
      const durum = await mfaDurumum()
      if (durum?.totp_kurulu) {
        const tamam = await adimAtla({ sebep: 'Parolanızı değiştirmek', zorla: true })
        if (!tamam) {
          setHata('Parolayı değiştirmek için iki adımlı doğrulama gerekiyor.')
          return
        }
      }
      const { error } = await supabase.auth.updateUser({ password: parola })
      if (error) {
        const m = (error.message ?? '').toLowerCase()
        if (m.includes('same') || m.includes('different')) setHata('Yeni parola eskisinden farklı olmalı.')
        else if (m.includes('weak') || m.includes('characters')) setHata('Parola yeterince güçlü değil. Daha uzun bir parola deneyin.')
        else setHata('Parola değiştirilemedi. Bağlantının süresi dolmuş olabilir; yeniden sıfırlama isteyin.')
        return
      }
      setBitti(true)
      setTimeout(() => navigate('/dashboard'), 1500)
    } finally {
      setMesgul(false)
    }
  }

  const baslik = (metin, hid) => (
    <h1 id={hid} className="font-baslik text-[26px] font-extrabold leading-tight tracking-[-0.015em]">{metin}</h1>
  )

  if (oturum === undefined) {
    return (
      <KimlikSayfasi>
        <KimlikKarti>
          <AdimGostergesi adimlar={SIFRE_ADIMLARI} aktif={2} />
          {baslik('Yeni şifrenizi belirleyin')}
          <Yukleniyor />
        </KimlikKarti>
      </KimlikSayfasi>
    )
  }

  if (!oturum) {
    return (
      <KimlikSayfasi>
        <KimlikKarti>
          <AdimGostergesi adimlar={SIFRE_ADIMLARI} aktif={2} />
          <div className="flex flex-col gap-1.5">
            {baslik('Bağlantı geçersiz')}
            <p className="text-metin-2">
              Bağlantı geçersiz ya da süresi dolmuş. Giriş ekranından yeniden "Şifremi unuttum" isteyin.
            </p>
          </div>
          <Dugme onClick={() => navigate('/login?sifre=unuttum')}>Yeni bağlantı iste</Dugme>
          <Link to="/login" className={`${METIN_BAGLANTI} self-start text-sm`}>Giriş ekranına dön</Link>
        </KimlikKarti>
      </KimlikSayfasi>
    )
  }

  if (bitti) {
    return (
      <KimlikSayfasi>
        <KimlikKarti>
          <AdimGostergesi adimlar={SIFRE_ADIMLARI} aktif={2} />
          {baslik('Şifreniz değiştirildi')}
          <BilgiKutusu ton="olumlu" ikon={CircleCheck} rol="status">Panele yönlendiriliyorsunuz…</BilgiKutusu>
        </KimlikKarti>
      </KimlikSayfasi>
    )
  }

  return (
    <KimlikSayfasi>
      <KimlikKarti as="form" onSubmit={gonder} aria-labelledby={`${id}-b`}>
        <AdimGostergesi adimlar={SIFRE_ADIMLARI} aktif={2} />
        <div className="flex flex-col gap-1.5">
          {baslik('Yeni şifrenizi belirleyin', `${id}-b`)}
          {oturum.user?.email && (
            <p className="text-metin-2"><b className="text-metin">{oturum.user.email}</b> hesabı için.</p>
          )}
        </div>
        <SifreAlani
          id={`${id}-yeni`} etiket="Yeni şifre" required minLength={MIN_PAROLA} autoComplete="new-password"
          value={parola} onChange={(e) => setParola(e.target.value)} placeholder={`En az ${MIN_PAROLA} karakter`}
          alt={<SifreGucuCubugu sifre={parola} />}
        />
        <SifreAlani
          id={`${id}-tekrar`} etiket="Yeni şifre (tekrar)" required minLength={MIN_PAROLA} autoComplete="new-password"
          value={tekrar} onChange={(e) => setTekrar(e.target.value)}
        />
        {hata && <BilgiKutusu ton="tehlike" rol="alert">{hata}</BilgiKutusu>}
        <Dugme type="submit" disabled={mesgul}>{mesgul ? 'Kaydediliyor…' : 'Şifreyi kaydet'}</Dugme>
        <ul className="list-disc pl-[18px] text-[13px] text-metin-2 flex flex-col gap-0.5">
          <li>En az {MIN_PAROLA} karakter</li>
          <li>Eski şifrenizden farklı olmalı</li>
          {MFA_AKTIF && <li>Doğrulama uygulaması kurduysanız kaydetmeden önce kod istenir</li>}
        </ul>
      </KimlikKarti>
    </KimlikSayfasi>
  )
}
