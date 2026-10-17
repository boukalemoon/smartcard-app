// "Şifremi unuttum" — 1. adım: bağlantı iste (tasarım panosu: SifreYenile, sol kart).
// İstek mantığı Auth.jsx'te; 2. adım pages/SifreYenile.jsx.
import { useId } from 'react'
import { ArrowLeft, MailCheck } from 'lucide-react'
import { AdimGostergesi, BilgiKutusu, Dugme, GirisAlani, KimlikKarti, KimlikSayfasi, METIN_BAGLANTI } from './parcalar'
import { SIFRE_ADIMLARI } from './kurallar'

export default function SifirlamaIstegi({ email, setEmail, durum, mesgul, onGonder, onGeri }) {
  const id = useId()
  const geri = (
    <button type="button" onClick={onGeri} className={`${METIN_BAGLANTI} self-start text-sm inline-flex items-center gap-1.5`}>
      <ArrowLeft size={16} aria-hidden="true" />Girişe dön
    </button>
  )
  return (
    <KimlikSayfasi>
      {durum === 'gonderildi' ? (
        <KimlikKarti>
          <AdimGostergesi adimlar={SIFRE_ADIMLARI} aktif={1} />
          <div className="flex flex-col gap-1.5">
            <h1 className="font-baslik text-[26px] font-extrabold leading-tight tracking-[-0.015em]">E-postanızı kontrol edin</h1>
            <p className="text-metin-2">
              Bu adres kayıtlıysa şifre yenileme bağlantısı gönderdik. Gelmediyse spam klasörünü de kontrol edin.
            </p>
          </div>
          <BilgiKutusu ton="olumlu" ikon={MailCheck} rol="status">
            <b>{email}</b>
          </BilgiKutusu>
          {geri}
        </KimlikKarti>
      ) : (
        <KimlikKarti as="form" onSubmit={onGonder} aria-labelledby={`${id}-b`}>
          <AdimGostergesi adimlar={SIFRE_ADIMLARI} aktif={1} />
          <div className="flex flex-col gap-1.5">
            <h1 id={`${id}-b`} className="font-baslik text-[26px] font-extrabold leading-tight tracking-[-0.015em]">Şifrenizi mi unuttunuz?</h1>
            <p className="text-metin-2">E-posta adresinizi yazın; şifrenizi yenilemeniz için tek kullanımlık bir bağlantı gönderelim.</p>
          </div>
          <GirisAlani
            id={`${id}-e`} etiket="E-posta" type="email" required autoComplete="email"
            value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ad@ornek.com"
          />
          <Dugme type="submit" disabled={mesgul}>{mesgul ? 'Gönderiliyor…' : 'Yenileme bağlantısı gönder'}</Dugme>
          <p className="text-[13px] text-metin-2">
            Hesap bulunsa da bulunmasa da aynı mesajı gösteririz; e-posta adreslerini doğrulamak için bu form kullanılamaz.
          </p>
          {geri}
        </KimlikKarti>
      )}
    </KimlikSayfasi>
  )
}
