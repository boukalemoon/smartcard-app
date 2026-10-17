import { useState } from 'react'
import { CreditCard, Check, Gift, MoveHorizontal, MoveVertical, Minus, Plus } from 'lucide-react'
import { birlestir } from '../panel/bicim'
import { KART_FIYATLARI } from '../lib/planlar'

// Seçenek düğmesi (segment benzeri): seçili olan aksan çerçeveli.
function Secenek({ secili, onClick, children, className }) {
  return (
    <button
      type="button"
      aria-pressed={secili}
      onClick={onClick}
      className={birlestir(
        'min-h-[44px] px-3 py-2.5 rounded-xl border text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksan',
        secili ? 'border-aksan bg-aksan-acik text-aksan-koyu dark:text-aksan' : 'border-cizgi bg-yuzey text-metin hover:bg-yuzey-2',
        className,
      )}
    >
      {children}
    </button>
  )
}

function Grup({ baslik, children }) {
  return (
    <fieldset className="min-w-0">
      <legend className="text-[13px] font-semibold text-metin mb-2.5">{baslik}</legend>
      {children}
    </fieldset>
  )
}

export default function NFCCardDesigner({ profile, subscription }) {
  const [cardType, setCardType] = useState('pvc')
  const [cardColor, setCardColor] = useState('#000000')
  const [cardFinish, setCardFinish] = useState('matte')
  const [quantity, setQuantity] = useState(1)
  const [rotateY, setRotateY] = useState(15)
  const [rotateX, setRotateX] = useState(0)
  const [cardSide, setCardSide] = useState('front')
  const [logoPosition, setLogoPosition] = useState('center')
  const [namePosition, setNamePosition] = useState('bottom-left')
  const [nfcIconPosition, setNfcIconPosition] = useState('top-left')
  const [qrPosition, setQrPosition] = useState('center')
  const [qrSize, setQrSize] = useState('medium')
  const [showCompanyLogoOnBack, setShowCompanyLogoOnBack] = useState(false)
  const [companyLogoPosition, setCompanyLogoPosition] = useState('top-right')

  const CARD_TYPES = {
    // PVC bedeli tek kaynaktan (planlar.js); diğerleri orada henüz yok.
    // Fiyatlar lib/planlar.js'deki KART_FIYATLARI'ndan gelir; burada elle
    // yazılmaz. Eskiden yazılıydı ve NFCCardsPage ile ayrışmıştı (metal
    // burada 1.499 ₺, orada 1.490 ₺ görünüyordu).
    pvc: { name: 'Renkli PVC Kart', price: KART_FIYATLARI.pvc, description: 'Dayanıklı plastik malzeme' },
    metal: { name: 'Metal Kart', price: KART_FIYATLARI.metal, description: 'Premium metal kart' },
    transparent: { name: 'Şeffaf Kart', price: KART_FIYATLARI.seffaf, description: 'Modern şeffaf tasarım' },
    bamboo: { name: 'Bambu Kart', price: KART_FIYATLARI.bambu, description: 'Doğa dostu ahşap' }
  }

  // Fiyat hesaplama
  //
  // DÜZELTME: burada `nfc_cards_ordered` okunuyordu — böyle bir kolon YOK.
  // undefined > 0 her zaman false olduğu için "daha önce sipariş verdi mi"
  // sorusu hep "hayır" çıkıyor, her adet ÜCRETSİZ görünüyordu.
  // Doğru kolon: nfc_cards_used.
  const hasFreeCardIncluded = (subscription?.nfc_cards_included || 0) > 0
  const hasOrderedBefore = (subscription?.nfc_cards_used || 0) > 0

  const getCardPrice = () => {
    if (hasFreeCardIncluded && !hasOrderedBefore) {
      return 0 // İlk kart ücretsiz
    }
    return CARD_TYPES[cardType].price
  }

  const cardPrice = getCardPrice()
  const totalPrice = cardPrice * quantity

  // Kart malzemesinin önizleme rengi (ürünün kendisi; tema ile değişmez).
  const kartZemini = cardType === 'pvc' ? cardColor
    : cardType === 'metal' ? '#2A2D33'
    : cardType === 'transparent' ? 'rgba(255, 255, 255, 0.1)'
    : '#B07A45'

  const konum = {
    'center': 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-left': 'bottom-4 left-4',
    'bottom-right': 'bottom-4 right-4',
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start">
      {/* Kart önizleme — masaüstünde yapışkan */}
      <section aria-labelledby="onizleme-baslik" className="lg:sticky lg:top-[96px] rounded-2xl border border-cizgi bg-yuzey-2 p-6 sm:p-8">
        <h2 id="onizleme-baslik" className="font-baslik text-[17px] font-bold text-metin text-center mb-6">
          Kart önizleme
        </h2>

        {/* 3D kart */}
        <div className="flex justify-center mb-4 -mx-2 px-2 -mt-4 py-8 overflow-hidden">
          <div
            className="w-full max-w-[320px] aspect-[320/192] rounded-xl relative overflow-hidden transition-transform duration-500 ease-out"
            style={{
              backgroundColor: kartZemini,
              transform: `perspective(1200px) rotateY(${cardSide === 'back' ? rotateY + 180 : rotateY}deg) rotateX(${rotateX}deg)`,
              transformStyle: 'preserve-3d',
              border: cardType === 'transparent' ? '2px solid rgba(255, 255, 255, 0.5)'
                : cardType === 'metal' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              boxShadow: '0 12px 24px rgba(14, 23, 51, 0.24)',
            }}
          >
            {/* Metal: fırçalanmış çelik dokusu */}
            {cardType === 'metal' && (
              <div className="absolute inset-0 opacity-[0.08]" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #fff 0 1px, transparent 1px 3px)' }} />
            )}

            {/* Bambu: lif dokusu */}
            {cardType === 'bamboo' && (
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage: `
                    repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(101, 67, 33, 0.3) 8px, rgba(101, 67, 33, 0.3) 9px),
                    repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(101, 67, 33, 0.2) 40px, rgba(101, 67, 33, 0.2) 42px)
                  `
                }}
              />
            )}

            {/* Şeffaf: açık yüzey */}
            {cardType === 'transparent' && <div className="absolute inset-0 bg-lacivert-300/30" />}

            {/* Parlak yüzey: köşeden düşen tek ışık yansıması */}
            {cardFinish === 'glossy' && (
              <div className="absolute inset-0 bg-white/15" style={{ clipPath: 'polygon(0 0, 62% 0, 0 78%)' }} />
            )}

            {/* ÖN YÜZ */}
            {cardSide === 'front' && (
              <div className="absolute inset-0 p-6">
                {/* Logo */}
                <div className={birlestir('absolute transition-all duration-300', konum[logoPosition])}>
                  {profile?.avatar_url ? (
                    <img
                      src={profile.avatar_url}
                      alt="Logo"
                      className="w-16 h-16 rounded-full border-2 border-white object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold font-baslik">
                      {profile?.name?.charAt(0) || '?'}
                    </div>
                  )}
                </div>

                {/* İsim */}
                <div className={birlestir('absolute text-white transition-all duration-300 [text-shadow:0_1px_3px_rgba(0,0,0,0.35)]', konum[namePosition])}>
                  <p className="text-lg font-bold font-baslik">{profile?.name || 'İsim Soyisim'}</p>
                  <p className="text-xs opacity-75">{profile?.company || 'Şirket Adı'}</p>
                </div>

                {/* NFC ikonu */}
                <div className={birlestir('absolute transition-all duration-300', konum[nfcIconPosition])}>
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <CreditCard size={16} className="text-white" aria-hidden="true" />
                  </div>
                </div>
              </div>
            )}

            {/* ARKA YÜZ */}
            {cardSide === 'back' && (
              <div className="absolute inset-0 p-6" style={{ transform: 'scaleX(-1)' }}>
                {/* QR kod */}
                <div className={birlestir('absolute transition-all duration-300', konum[qrPosition])}>
                  <div
                    className={birlestir(
                      'bg-white rounded-lg p-2 transition-all duration-300',
                      qrSize === 'small' ? 'w-20 h-20' : qrSize === 'large' ? 'w-32 h-32' : 'w-24 h-24',
                    )}
                  >
                    <div className="w-full h-full bg-lacivert-950 rounded flex items-center justify-center text-white text-xs font-bold">
                      QR
                    </div>
                  </div>
                </div>

                {/* Şirket logosu (isteğe bağlı) */}
                {showCompanyLogoOnBack && (
                  <div className={birlestir('absolute transition-all duration-300', konum[companyLogoPosition])}>
                    {profile?.avatar_url ? (
                      <img
                        src={profile.avatar_url}
                        alt="Company Logo"
                        className="w-12 h-12 rounded-full border-2 border-white object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center text-white font-bold font-baslik">
                        {profile?.company?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3D döndürme */}
        <div className="flex flex-col gap-3">
          <label className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-metin w-24 shrink-0">
              <MoveHorizontal size={16} className="text-metin-2" aria-hidden="true" />
              Yatay
            </span>
            <input
              type="range"
              min="-180"
              max="180"
              value={rotateY}
              onChange={(e) => setRotateY(parseInt(e.target.value))}
              className="flex-1 min-w-0 accent-aksan cursor-pointer"
            />
            <span className="text-sm font-mono tabular-nums text-metin-2 w-12 text-right">
              {rotateY}°
            </span>
          </label>

          <label className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-metin w-24 shrink-0">
              <MoveVertical size={16} className="text-metin-2" aria-hidden="true" />
              Dikey
            </span>
            <input
              type="range"
              min="-180"
              max="180"
              value={rotateX}
              onChange={(e) => setRotateX(parseInt(e.target.value))}
              className="flex-1 min-w-0 accent-aksan cursor-pointer"
            />
            <span className="text-sm font-mono tabular-nums text-metin-2 w-12 text-right">
              {rotateX}°
            </span>
          </label>
        </div>

        {/* Ön / arka yüz */}
        <div role="group" aria-label="Kart yüzü" className="mt-5 grid grid-cols-2 gap-1 p-1 rounded-xl bg-yuzey border border-cizgi">
          {[['front', 'Ön Yüz'], ['back', 'Arka Yüz']].map(([deger, ad]) => (
            <button
              key={deger}
              type="button"
              aria-pressed={cardSide === deger}
              onClick={() => setCardSide(deger)}
              className={birlestir(
                'h-10 rounded-lg text-sm font-semibold transition-colors',
                cardSide === deger ? 'bg-murekkep text-yuzey' : 'text-metin-2 hover:text-metin',
              )}
            >
              {ad}
            </button>
          ))}
        </div>
      </section>

      {/* Özelleştirme */}
      <section aria-label="Kart seçenekleri" className="rounded-2xl border border-cizgi bg-yuzey p-6 sm:p-8 flex flex-col gap-7">

        {/* Kart tipi */}
        <Grup baslik="Kart Tipi">
          <div className="grid grid-cols-2 gap-3">
            {Object.entries(CARD_TYPES).map(([type, info]) => {
              const secili = cardType === type
              return (
                <button
                  key={type}
                  type="button"
                  aria-pressed={secili}
                  onClick={() => setCardType(type)}
                  className={birlestir(
                    'p-4 rounded-xl border text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksan',
                    secili ? 'border-aksan bg-aksan-acik' : 'border-cizgi bg-yuzey hover:bg-yuzey-2',
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-sm text-metin">{info.name}</span>
                    {secili && <Check size={16} strokeWidth={2.5} className="text-aksan shrink-0" aria-hidden="true" />}
                  </span>
                  <span className="block mt-1 text-xs text-metin-2">{info.description}</span>
                  <span className="block mt-2 font-baslik text-lg font-extrabold text-metin tabular-nums">
                    ₺{info.price.toLocaleString('tr-TR')}
                  </span>
                </button>
              )
            })}
          </div>
        </Grup>

        {/* Renk — yalnız PVC */}
        {cardType === 'pvc' && (
          <div>
            <label htmlFor="kart-rengi" className="block text-[13px] font-semibold text-metin mb-2.5">
              Kart Rengi
            </label>
            <div className="flex items-center gap-3">
              <input
                id="kart-rengi"
                type="color"
                value={cardColor}
                onChange={(e) => setCardColor(e.target.value)}
                className="w-16 h-11 rounded-lg cursor-pointer border border-cizgi bg-yuzey p-1"
              />
              <span className="text-sm font-mono text-metin-2">
                {cardColor}
              </span>
            </div>
          </div>
        )}

        {/* Yüzey */}
        <Grup baslik="Yüzey">
          <div className="grid grid-cols-2 gap-3">
            <Secenek secili={cardFinish === 'matte'} onClick={() => setCardFinish('matte')}>Mat</Secenek>
            <Secenek secili={cardFinish === 'glossy'} onClick={() => setCardFinish('glossy')}>Parlak</Secenek>
          </div>
        </Grup>

        {/* ÖN YÜZ ÖZELLEŞTİRME */}
        {cardSide === 'front' && (
          <>
            <Grup baslik="Logo Pozisyonu">
              <div className="grid grid-cols-3 gap-3">
                {['center', 'top-right', 'bottom-left'].map((pos) => (
                  <Secenek key={pos} secili={logoPosition === pos} onClick={() => setLogoPosition(pos)}>
                    {pos === 'center' ? 'Orta' : pos === 'top-right' ? 'Sağ Üst' : 'Sol Alt'}
                  </Secenek>
                ))}
              </div>
            </Grup>

            <Grup baslik="İsim Pozisyonu">
              <div className="grid grid-cols-3 gap-3">
                {['bottom-left', 'bottom-right', 'top-left'].map((pos) => (
                  <Secenek key={pos} secili={namePosition === pos} onClick={() => setNamePosition(pos)}>
                    {pos === 'bottom-left' ? 'Sol Alt' : pos === 'bottom-right' ? 'Sağ Alt' : 'Sol Üst'}
                  </Secenek>
                ))}
              </div>
            </Grup>

            <Grup baslik="NFC İkon Pozisyonu">
              <div className="grid grid-cols-3 gap-3">
                {['top-left', 'top-right', 'bottom-right'].map((pos) => (
                  <Secenek key={pos} secili={nfcIconPosition === pos} onClick={() => setNfcIconPosition(pos)}>
                    {pos === 'top-left' ? 'Sol Üst' : pos === 'top-right' ? 'Sağ Üst' : 'Sağ Alt'}
                  </Secenek>
                ))}
              </div>
            </Grup>
          </>
        )}

        {/* ARKA YÜZ ÖZELLEŞTİRME */}
        {cardSide === 'back' && (
          <>
            <Grup baslik="QR Kod Pozisyonu">
              <div className="grid grid-cols-3 gap-3">
                {['center', 'top-right', 'bottom-left'].map((pos) => (
                  <Secenek key={pos} secili={qrPosition === pos} onClick={() => setQrPosition(pos)}>
                    {pos === 'center' ? 'Orta' : pos === 'top-right' ? 'Sağ Üst' : 'Sol Alt'}
                  </Secenek>
                ))}
              </div>
            </Grup>

            <Grup baslik="QR Kod Boyutu">
              <div className="grid grid-cols-3 gap-3">
                {['small', 'medium', 'large'].map((size) => (
                  <Secenek key={size} secili={qrSize === size} onClick={() => setQrSize(size)}>
                    {size === 'small' ? 'Küçük' : size === 'large' ? 'Büyük' : 'Orta'}
                  </Secenek>
                ))}
              </div>
            </Grup>

            <label className="flex items-center gap-3 cursor-pointer min-h-[44px]">
              <input
                type="checkbox"
                checked={showCompanyLogoOnBack}
                onChange={(e) => setShowCompanyLogoOnBack(e.target.checked)}
                className="w-5 h-5 rounded border-cizgi accent-aksan"
              />
              <span className="text-sm font-semibold text-metin">
                Arka yüzde şirket logosu göster
              </span>
            </label>

            {showCompanyLogoOnBack && (
              <Grup baslik="Şirket Logosu Pozisyonu">
                <div className="grid grid-cols-3 gap-3">
                  {['top-right', 'top-left', 'bottom-right'].map((pos) => (
                    <Secenek key={pos} secili={companyLogoPosition === pos} onClick={() => setCompanyLogoPosition(pos)}>
                      {pos === 'top-right' ? 'Sağ Üst' : pos === 'top-left' ? 'Sol Üst' : 'Sağ Alt'}
                    </Secenek>
                  ))}
                </div>
              </Grup>
            )}
          </>
        )}

        {/* Adet */}
        <div>
          <label htmlFor="kart-adet" className="block text-[13px] font-semibold text-metin mb-2.5">
            Adet
          </label>
          <div className="inline-flex items-center rounded-xl border border-cizgi bg-yuzey overflow-hidden">
            <button
              type="button"
              aria-label="Adedi azalt"
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-11 h-11 inline-flex items-center justify-center text-metin hover:bg-yuzey-2"
            >
              <Minus size={16} aria-hidden="true" />
            </button>
            <input
              id="kart-adet"
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-16 h-11 text-center bg-yuzey text-metin font-semibold tabular-nums border-x border-cizgi focus:outline-none focus:ring-2 focus:ring-inset focus:ring-aksan/40"
            />
            <button
              type="button"
              aria-label="Adedi artır"
              onClick={() => setQuantity(quantity + 1)}
              className="w-11 h-11 inline-flex items-center justify-center text-metin hover:bg-yuzey-2"
            >
              <Plus size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Toplam */}
        <div className="pt-6 border-t border-cizgi flex flex-col gap-4">
          {hasFreeCardIncluded && !hasOrderedBefore && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-400/30 dark:bg-emerald-400/10">
              <Gift size={18} className="shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
              <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                İlk kartınız ücretsiz! (Aboneliğinize dahil)
              </p>
            </div>
          )}

          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-metin">
              Toplam:
            </span>
            {totalPrice === 0 ? (
              <span className="font-baslik text-[26px] font-extrabold text-emerald-700 dark:text-emerald-300">
                ÜCRETSİZ
              </span>
            ) : (
              <span className="font-baslik text-[26px] font-extrabold text-metin tabular-nums">
                ₺{totalPrice.toLocaleString('tr-TR')}
              </span>
            )}
          </div>

          {/* Sipariş akışı ödeme entegrasyonuna bağlı; hazır olmayan bir
              düğmeyi "Sipariş Ver" diye göstermek yerine durum açıkça yazılıyor. */}
          <button
            type="button"
            disabled
            title="Kart siparişi ödeme altyapısı tamamlanınca açılacak"
            className="w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl border border-cizgi bg-yuzey-2 text-[15px] font-semibold text-metin-2 cursor-not-allowed"
          >
            Sipariş yakında
          </button>
          <p className="text-[13px] text-center text-metin-2">
            Tasarımınızı şimdi hazırlayabilirsiniz; sipariş alma açıldığında
            buradan devam edeceksiniz.
          </p>
        </div>
      </section>
    </div>
  )
}
