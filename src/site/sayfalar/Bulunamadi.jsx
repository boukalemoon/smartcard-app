// Tanımsız adresler için 404 sayfası (yalnız ana alan adı rota grubunda).
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import SiteKabugu from '../SiteKabugu'
import { QrMotif } from './ortak'
import { dugme, UST_ETIKET } from './siniflar'
import { birlestir } from '../../panel/bicim'

export default function Bulunamadi() {
  return (
    <SiteKabugu className="flex items-center">
      <div className="w-full max-w-[1120px] mx-auto px-4 sm:px-6 lg:px-0 py-16 sm:py-24">
        <div className="relative overflow-hidden rounded-3xl border border-cizgi bg-yuzey px-6 py-14 sm:px-14 sm:py-20 flex flex-col items-center text-center gap-4">
          <QrMotif className="absolute -right-16 -top-16 text-cizgi hidden sm:block" boyut={260} />
          <QrMotif className="absolute -left-20 -bottom-20 text-cizgi hidden sm:block" boyut={220} />
          <span className={birlestir(UST_ETIKET, 'relative text-aksan')}>Hata 404</span>
          <h1 className="relative font-baslik text-[34px] sm:text-[48px] leading-[1.08] font-extrabold tracking-[-0.02em] text-metin text-balance">
            Bu sayfa bulunamadı
          </h1>
          <p className="relative max-w-[520px] text-[17px] leading-relaxed text-metin-2">
            Aradığınız adres taşınmış, silinmiş ya da hiç var olmamış olabilir. Adresi kontrol edin ya da ana sayfadan devam edin.
          </p>
          <div className="relative mt-3 flex flex-wrap justify-center gap-3">
            <Link to="/" className={dugme('ana')}>
              <ArrowLeft size={18} aria-hidden="true" />
              Ana sayfaya dön
            </Link>
            <Link to="/iletisim" className={dugme('ikincil')}>Bize ulaşın</Link>
          </div>
        </div>
      </div>
    </SiteKabugu>
  )
}
