// Giriş / kayıt ekranının sol paneli (tasarım panosu: Giris).
//
// Masaüstünde 420 px marka mavisi panel; telefonda formun üstünde kısa bir
// bant (logo + başlık). Panel tema ile değişmez: `marka` her iki temada aynı.
import { Link } from 'react-router-dom'
import { Check, Clock } from 'lucide-react'
import { MFA_AKTIF } from '../../lib/mfaAyari'
import { SiteLogo } from '../SiteKabugu'
import { BulucuDesen } from './parcalar'

const MADDELER = [
  { metin: 'Şifreniz hiçbir partner uygulamaya gitmez', acik: true },
  // Korgard (iki adımlı doğrulama) servisi yayında değilse "yakında" yazılır;
  // çalışmayan bir korumayı varmış gibi göstermeyiz (bkz. lib/mfaAyari.js).
  { metin: MFA_AKTIF ? 'İki adımlı doğrulama ile ek koruma (Korgard)' : 'İki adımlı doğrulama (Korgard)', acik: MFA_AKTIF },
  { metin: 'Oturumlar ve bağlı uygulamalar Hesap bölümünden yönetilir', acik: true },
]

export default function SolPanel() {
  const yil = new Date().getFullYear()
  return (
    <aside className="relative overflow-hidden bg-marka text-white lg:w-[420px] lg:shrink-0 lg:min-h-screen px-4 py-4 sm:px-6 lg:p-12 flex flex-col lg:justify-between gap-3 lg:gap-10">
      <BulucuDesen className="absolute -right-20 -bottom-20 w-[460px] h-[460px] hidden lg:block" />
      <BulucuDesen className="absolute -right-10 -top-16 w-[180px] h-[180px] lg:hidden" />

      <div className="relative flex items-center justify-between">
        <SiteLogo koyuZemin />
      </div>

      <div className="relative flex flex-col gap-5 max-w-[440px]">
        <p className="font-baslik text-xl lg:text-[36px] font-extrabold leading-[1.15] tracking-[-0.02em] text-white">
          Tek hesap, bağlı tüm uygulamalar.
        </p>
        <p className="hidden lg:block text-base leading-relaxed text-marka-acik">
          QRtım hesabınız Arku Remote, İlgezdi ve Tınga'da da kimliğinizdir. Giriş yaptığınızda hangi
          uygulamanın ne bilgi aldığını her seferinde görürsünüz.
        </p>
        <ul className="hidden lg:flex flex-col gap-2.5 text-sm text-marka-acik">
          {MADDELER.map((m) => (
            <li key={m.metin} className="flex gap-2.5 items-start">
              {m.acik
                ? <Check size={18} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-px text-white" />
                : <Clock size={18} aria-hidden="true" className="shrink-0 mt-px text-white/70" />}
              <span>
                {m.metin}
                {!m.acik && (
                  <span className="ml-2 inline-flex items-center h-5 px-2 rounded-full bg-white/15 text-[11px] font-semibold text-white align-middle">
                    Yakında
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <p className="relative hidden lg:block text-[13px] text-marka-acik">
        © {yil} QRtım ·{' '}
        <Link to="/gizlilik" className="text-white hover:underline underline-offset-2">Gizlilik</Link> ·{' '}
        <Link to="/kvkk" className="text-white hover:underline underline-offset-2">KVKK</Link>
      </p>
    </aside>
  )
}
