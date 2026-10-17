// KURUM — Partner (tasarım: KurumPartner)
//
// Tasarımdaki kurum partner kodu için arka uç YOK: referral_codes kişi
// bazlı, kurumlar için kod/hak ediş tablosu ya da RPC bulunmuyor
// (organizational_commissions yalnızca üye sayısı hak edişi ve yalnız
// platform yöneticisine açık). Uydurma kod/tutar göstermek yerine sayfa
// "Yakında" durumunda; kişisel partner koduna yönlendirir.
import { Handshake } from 'lucide-react'
import { Kart, Dugme, Rozet } from '../ui'
import { SayfaBas } from './ortak'

const PLANLANAN = [
  { baslik: 'Kurum partner kodu', aciklama: 'Kuruma özel kayıt bağlantısı ve QR; üyelerinize dağıtılan davetler bu koda bağlanır.' },
  { baslik: 'Kodla gelenler', aciklama: 'Kodla kayıt olan kişi ve kurumlar, hangi üye ya da kanal üzerinden geldikleri.' },
  { baslik: 'Hak ediş ve ödeme', aciklama: 'Bekleyen, onaylanan ve kurum hesabına ödenen tutarlar.' },
]

export default function KurumPartner({ bireyseleGec }) {
  return (
    <>
      <SayfaBas
        baslik="Kurum partner programı"
        alt="Kurumunuzun partner koduyla QRtım’a katılan kişi ve kurumları izleyeceğiniz sayfa. Kurum adına kod ve hak ediş takibi henüz açılmadı."
      />

      <Kart kesik className="p-6 flex flex-col gap-5">
        <div className="flex items-start gap-3.5 flex-wrap">
          <span className="w-11 h-11 rounded-xl bg-yuzey-2 text-metin-2 inline-flex items-center justify-center shrink-0">
            <Handshake size={20} aria-hidden="true" />
          </span>
          <div className="flex-1 min-w-[220px]">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-baslik text-lg font-extrabold">Kurum partner kodu yakında</h2>
              <Rozet ton="vurgu">Yakında</Rozet>
            </div>
            <p className="mt-1 text-sm text-metin-2 max-w-2xl">
              Bugün partner kodu kişi bazlı çalışıyor. Kurumunuzu tanıtmak için kişisel partner kodunuzu kullanabilirsiniz;
              kurum kodu açıldığında bu sayfa kendiliğinden dolacak.
            </p>
          </div>
          <Dugme tur="ana" onClick={() => bireyseleGec('partner')}>Kişisel partner koduma git</Dugme>
        </div>

        <ul className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {PLANLANAN.map((p) => (
            <li key={p.baslik} className="rounded-xl border border-cizgi bg-zemin p-4 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <b className="text-sm font-semibold text-metin">{p.baslik}</b>
                <Rozet>Yakında</Rozet>
              </div>
              <span className="text-[13px] text-metin-2">{p.aciklama}</span>
            </li>
          ))}
        </ul>
      </Kart>
    </>
  )
}
