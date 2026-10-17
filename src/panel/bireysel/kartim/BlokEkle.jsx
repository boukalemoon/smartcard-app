// "Blok ekle" paneli. Gerçek karşılığı olan bloklar (içeriği henüz girilmemiş
// olanlar) buradan listeye alınıp düzenlenir; arka ucu olmayan yeni blok
// türleri "Yakında" olarak devre dışı durur.
import { X, Link2, RectangleHorizontal, Image, Video, ClipboardList, MapPin } from 'lucide-react'
import { Kart } from '../../ui'
import { birlestir } from '../../bicim'
import { Yakinda } from './parcalar'

const YENI_TURLER = [
  { anahtar: 'baglanti', ad: 'Bağlantı', ikon: Link2 },
  { anahtar: 'buton', ad: 'Buton', ikon: RectangleHorizontal },
  { anahtar: 'galeri', ad: 'Galeri', ikon: Image },
  { anahtar: 'video', ad: 'Video', ikon: Video },
  { anahtar: 'form', ad: 'Form', ikon: ClipboardList },
  { anahtar: 'konum', ad: 'Konum', ikon: MapPin },
]

function Kutu({ ikon, ad, yakinda, onClick }) {
  const Ikon = ikon
  return (
    <button
      type="button"
      disabled={yakinda}
      onClick={onClick}
      className={birlestir(
        'flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border border-cizgi bg-yuzey text-xs font-semibold text-center min-w-0',
        yakinda ? 'cursor-not-allowed text-metin-2' : 'hover:border-aksan transition-colors',
      )}
    >
      <span className={birlestir('w-[34px] h-[34px] rounded-[9px] inline-flex items-center justify-center', yakinda ? 'bg-yuzey-2 text-metin-2' : 'bg-yuzey-2 text-metin')}>
        <Ikon size={16} aria-hidden="true" />
      </span>
      <span className="leading-tight">{ad}</span>
      {yakinda && <Yakinda />}
    </button>
  )
}

export default function BlokEkle({ eklenebilir, onEkle, onKapat, plan }) {
  return (
    <Kart vurgu="aksan" className="p-5 flex flex-col gap-3" aria-labelledby="kartim-blok-ekle" id="kartim-blok-ekle-panel">
      <div className="flex justify-between items-center">
        <h2 id="kartim-blok-ekle" className="font-baslik text-[15px] font-bold">Blok ekle</h2>
        <button type="button" aria-label="Kapat" onClick={onKapat} className="w-8 h-8 inline-flex items-center justify-center rounded-lg text-metin-2 hover:text-metin hover:bg-yuzey-2">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      <div className={birlestir('grid grid-cols-3 sm:grid-cols-4 gap-2', eklenebilir.length + YENI_TURLER.length > 7 ? 'lg:grid-cols-8' : 'lg:grid-cols-7')}>
        {eklenebilir.map((b) => <Kutu key={b.anahtar} ikon={b.ikon} ad={b.ad} onClick={() => onEkle(b.anahtar)} />)}
        {YENI_TURLER.map((t) => <Kutu key={t.anahtar} ikon={t.ikon} ad={t.ad} yakinda />)}
      </div>
      <p className="text-xs text-metin-2">
        Eklenen blok listeye alınır; içeriğini girip kimlerin göreceğini siz seçersiniz.
        {plan ? ` ${plan}` : ''}
      </p>
    </Kart>
  )
}
