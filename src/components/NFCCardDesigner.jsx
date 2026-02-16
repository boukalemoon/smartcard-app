import { useState } from 'react'
import { CreditCard, Check } from 'lucide-react'

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
    pvc: { name: 'Renkli PVC Kart', price: 899, description: 'Dayanıklı plastik malzeme' },
    metal: { name: 'Metal Kart', price: 1499, description: 'Premium metal kart' },
    transparent: { name: 'Şeffaf Kart', price: 1699, description: 'Modern şeffaf tasarım' },
    bamboo: { name: 'Bambu Kart', price: 2299, description: 'Doğa dostu ahşap' }
  }

  // Fiyat hesaplama
  const hasFreeCardIncluded = (subscription?.nfc_cards_included || 0) > 0
  const hasOrderedBefore = (subscription?.nfc_cards_ordered || 0) > 0
  
  const getCardPrice = () => {
    if (hasFreeCardIncluded && !hasOrderedBefore) {
      return 0 // İlk kart ücretsiz
    }
    return CARD_TYPES[cardType].price
  }

  const cardPrice = getCardPrice()
  const totalPrice = cardPrice * quantity

  return (
    <div className="space-y-6">
      {/* Kart Önizleme - Sticky Container */}
      <div className="sticky top-4 z-10 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8 shadow-xl">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6 text-center">
          Kart Önizleme
        </h3>
        
        {/* 3D Kart Mockup */}
        <div className="flex justify-center mb-6">
          <div 
            className="w-80 h-48 rounded-xl relative overflow-hidden transition-transform duration-500 ease-out"
            style={{ 
              backgroundColor: cardType === 'pvc' ? cardColor : 
                             cardType === 'metal' ? '#1a1a1a' :
                             cardType === 'transparent' ? 'rgba(255, 255, 255, 0.1)' :
                             '#D2691E',
              transform: `perspective(1200px) rotateY(${cardSide === 'back' ? rotateY + 180 : rotateY}deg) rotateX(${rotateX}deg)`,
              transformStyle: 'preserve-3d',
              backdropFilter: cardType === 'transparent' ? 'blur(20px)' : 'none',
              border: cardType === 'transparent' ? '2px solid rgba(255, 255, 255, 0.5)' : 
                      cardType === 'metal' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
              boxShadow: cardType === 'metal' ? '0 20px 60px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)' : 
                         cardType === 'transparent' ? '0 20px 60px rgba(31, 38, 135, 0.37)' : 
                         '0 20px 60px rgba(0,0,0,0.3)'
            }}
          >
            {/* Metal Efektler */}
            {cardType === 'metal' && (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-gray-300 via-gray-500 to-gray-900 opacity-90" />
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent" 
                     style={{ backgroundSize: '200% 200%' }} />
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-white/20 via-transparent to-transparent opacity-50" />
              </>
            )}
            
            {/* Bambu Efektler */}
            {cardType === 'bamboo' && (
              <>
                <div 
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage: `
                      repeating-linear-gradient(90deg, transparent, transparent 8px, rgba(101, 67, 33, 0.3) 8px, rgba(101, 67, 33, 0.3) 9px),
                      repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(101, 67, 33, 0.2) 40px, rgba(101, 67, 33, 0.2) 42px)
                    `
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-br from-amber-700/30 to-amber-900/30" />
              </>
            )}
            
            {/* Transparent Efektler */}
            {cardType === 'transparent' && (
              <>
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-white/10 to-transparent" />
                <div className="absolute inset-0 shadow-inner" />
                <div className="absolute top-0 left-0 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
              </>
            )}

            {/* Glossy Finish */}
            {cardFinish === 'glossy' && (
              <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-transparent" />
            )}
            
            {/* ÖN YÜZ */}
            {cardSide === 'front' && (
              <div className="absolute inset-0 p-6">
                {/* Logo */}
                <div className={`absolute transition-all duration-300 ${
                  logoPosition === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' :
                  logoPosition === 'top-right' ? 'top-4 right-4' :
                  'bottom-4 left-4'
                }`}>
                  {profile?.avatar_url ? (
                    <img 
                      src={profile.avatar_url} 
                      alt="Logo"
                      className="w-16 h-16 rounded-full border-2 border-white shadow-lg object-cover"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                      {profile?.name?.charAt(0) || '?'}
                    </div>
                  )}
                </div>

                {/* İsim */}
                <div className={`absolute text-white drop-shadow-lg transition-all duration-300 ${
                  namePosition === 'bottom-left' ? 'bottom-4 left-4' :
                  namePosition === 'bottom-right' ? 'bottom-4 right-4' :
                  'top-4 left-4'
                }`}>
                  <p className="text-lg font-bold">{profile?.name || 'İsim Soyisim'}</p>
                  <p className="text-xs opacity-75">{profile?.company || 'Şirket Adı'}</p>
                </div>

                {/* NFC İkonu */}
                <div className={`absolute transition-all duration-300 ${
                  nfcIconPosition === 'top-left' ? 'top-4 left-4' :
                  nfcIconPosition === 'top-right' ? 'top-4 right-4' :
                  'bottom-4 right-4'
                }`}>
                  <div className="w-8 h-8 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                    <CreditCard size={16} className="text-white" />
                  </div>
                </div>
              </div>
            )}

            {/* ARKA YÜZ */}
            {cardSide === 'back' && (
              <div className="absolute inset-0 p-6" style={{ transform: 'scaleX(-1)' }}>
                {/* QR Kod */}
                <div className={`absolute transition-all duration-300 ${
                  qrPosition === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' :
                  qrPosition === 'top-right' ? 'top-4 right-4' :
                  'bottom-4 left-4'
                }`}>
                  <div 
                    className={`bg-white rounded-lg p-2 shadow-lg transition-all duration-300 ${
                      qrSize === 'small' ? 'w-20 h-20' :
                      qrSize === 'large' ? 'w-32 h-32' :
                      'w-24 h-24'
                    }`}
                  >
                    <div className="w-full h-full bg-gray-900 rounded flex items-center justify-center text-white text-xs font-bold">
                      QR
                    </div>
                  </div>
                </div>

                {/* Şirket Logosu (opsiyonel) */}
                {showCompanyLogoOnBack && (
                  <div className={`absolute transition-all duration-300 ${
                    companyLogoPosition === 'top-right' ? 'top-4 right-4' :
                    companyLogoPosition === 'top-left' ? 'top-4 left-4' :
                    'bottom-4 right-4'
                  }`}>
                    {profile?.avatar_url ? (
                      <img 
                        src={profile.avatar_url} 
                        alt="Company Logo"
                        className="w-12 h-12 rounded-full border-2 border-white shadow-lg object-cover"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-white font-bold shadow-lg">
                        {profile?.company?.charAt(0) || '?'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3D Kontrol Paneli - Kompakt */}
        <div className="space-y-3">
          {/* Yatay Döndürme */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-32">
              🔄 Yatay
            </span>
            <input
              type="range"
              min="-180"
              max="180"
              value={rotateY}
              onChange={(e) => setRotateY(parseInt(e.target.value))}
              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${((rotateY + 180) / 360) * 100}%, #E5E7EB ${((rotateY + 180) / 360) * 100}%, #E5E7EB 100%)`
              }}
            />
            <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-12 text-right">
              {rotateY}°
            </span>
          </div>

          {/* Dikey Döndürme */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 w-32">
              ↕️ Dikey
            </span>
            <input
              type="range"
              min="-180"
              max="180"
              value={rotateX}
              onChange={(e) => setRotateX(parseInt(e.target.value))}
              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer"
              style={{
                background: `linear-gradient(to right, #8B5CF6 0%, #8B5CF6 ${((rotateX + 180) / 360) * 100}%, #E5E7EB ${((rotateX + 180) / 360) * 100}%, #E5E7EB 100%)`
              }}
            />
            <span className="text-sm font-mono text-gray-600 dark:text-gray-400 w-12 text-right">
              {rotateX}°
            </span>
          </div>
        </div>

        {/* ÖN/ARKA YÜZ SEÇİMİ */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={() => setCardSide('front')}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
              cardSide === 'front'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            📇 Ön Yüz
          </button>
          <button
            onClick={() => setCardSide('back')}
            className={`flex-1 py-2 px-4 rounded-lg font-semibold transition-all ${
              cardSide === 'back'
                ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200'
            }`}
          >
            🔲 Arka Yüz
          </button>
        </div>
      </div>

      {/* Özelleştirme Paneli - Scroll Yapılabilir */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
        
        {/* Kart Tipi */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Kart Tipi
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Object.entries(CARD_TYPES).map(([type, info]) => (
              <button
                key={type}
                onClick={() => setCardType(type)}
                className={`p-4 rounded-xl border-2 transition-all ${
                  cardType === type
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    {info.name}
                  </span>
                  {cardType === type && <Check size={16} className="text-blue-500" />}
                </div>
                <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
                  {info.description}
                </p>
                <p className="text-lg font-bold text-blue-600">
                  ₺{info.price.toLocaleString('tr-TR')}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Renk - Sadece PVC */}
        {cardType === 'pvc' && (
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
              Kart Rengi
            </label>
            <div className="flex items-center gap-3">
              <input
                type="color"
                value={cardColor}
                onChange={(e) => setCardColor(e.target.value)}
                className="w-16 h-10 rounded cursor-pointer border-2 border-gray-300"
              />
              <span className="text-sm font-mono text-gray-600 dark:text-gray-400">
                {cardColor}
              </span>
            </div>
          </div>
        )}

        {/* Finish */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Yüzey
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => setCardFinish('matte')}
              className={`p-3 rounded-lg border-2 transition-all ${
                cardFinish === 'matte'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <span className="font-semibold text-sm">Mat</span>
            </button>
            <button
              onClick={() => setCardFinish('glossy')}
              className={`p-3 rounded-lg border-2 transition-all ${
                cardFinish === 'glossy'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <span className="font-semibold text-sm">Parlak</span>
            </button>
          </div>
        </div>

        {/* ÖN YÜZ ÖZELLEŞTİRME */}
        {cardSide === 'front' && (
          <>
            {/* Logo Pozisyon */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                Logo Pozisyonu
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['center', 'top-right', 'bottom-left'].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setLogoPosition(pos)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      logoPosition === pos
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="font-semibold text-sm capitalize">
                      {pos === 'center' ? 'Orta' : pos === 'top-right' ? 'Sağ Üst' : 'Sol Alt'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* İsim Pozisyon */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                İsim Pozisyonu
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['bottom-left', 'bottom-right', 'top-left'].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setNamePosition(pos)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      namePosition === pos
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="font-semibold text-sm capitalize">
                      {pos === 'bottom-left' ? 'Sol Alt' : pos === 'bottom-right' ? 'Sağ Alt' : 'Sol Üst'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* NFC İkon Pozisyon */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                NFC İkon Pozisyonu
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['top-left', 'top-right', 'bottom-right'].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setNfcIconPosition(pos)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      nfcIconPosition === pos
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="font-semibold text-sm capitalize">
                      {pos === 'top-left' ? 'Sol Üst' : pos === 'top-right' ? 'Sağ Üst' : 'Sağ Alt'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ARKA YÜZ ÖZELLEŞTİRME */}
        {cardSide === 'back' && (
          <>
            {/* QR Pozisyon */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                QR Kod Pozisyonu
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['center', 'top-right', 'bottom-left'].map((pos) => (
                  <button
                    key={pos}
                    onClick={() => setQrPosition(pos)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      qrPosition === pos
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="font-semibold text-sm capitalize">
                      {pos === 'center' ? 'Orta' : pos === 'top-right' ? 'Sağ Üst' : 'Sol Alt'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* QR Boyut */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                QR Kod Boyutu
              </label>
              <div className="grid grid-cols-3 gap-3">
                {['small', 'medium', 'large'].map((size) => (
                  <button
                    key={size}
                    onClick={() => setQrSize(size)}
                    className={`p-3 rounded-lg border-2 transition-all ${
                      qrSize === size
                        ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                        : 'border-gray-200 dark:border-gray-700'
                    }`}
                  >
                    <span className="font-semibold text-sm capitalize">
                      {size === 'small' ? 'Küçük' : size === 'large' ? 'Büyük' : 'Orta'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Şirket Logosu Toggle */}
            <div>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showCompanyLogoOnBack}
                  onChange={(e) => setShowCompanyLogoOnBack(e.target.checked)}
                  className="w-5 h-5 rounded border-gray-300"
                />
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Arka yüzde şirket logosu göster
                </span>
              </label>
            </div>

            {/* Şirket Logo Pozisyon (sadece aktifse) */}
            {showCompanyLogoOnBack && (
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                  Şirket Logosu Pozisyonu
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {['top-right', 'top-left', 'bottom-right'].map((pos) => (
                    <button
                      key={pos}
                      onClick={() => setCompanyLogoPosition(pos)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        companyLogoPosition === pos
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <span className="font-semibold text-sm capitalize">
                        {pos === 'top-right' ? 'Sağ Üst' : pos === 'top-left' ? 'Sol Üst' : 'Sağ Alt'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {/* Adet */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Adet
          </label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold"
            >
              -
            </button>
            <input
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 text-center px-4 py-2 border-2 border-gray-200 dark:border-gray-700 rounded-lg"
            />
            <button
              onClick={() => setQuantity(quantity + 1)}
              className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 font-bold"
            >
              +
            </button>
          </div>
        </div>

        {/* Toplam Fiyat */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
          {hasFreeCardIncluded && subscription?.nfc_cards_ordered === 0 && (
            <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <p className="text-sm text-green-800 dark:text-green-300 font-semibold">
                🎉 İlk kartınız ücretsiz! (Aboneliğinize dahil)
              </p>
            </div>
          )}
          
          <div className="flex items-center justify-between mb-4">
            <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Toplam:
            </span>
            <div className="text-right">
              {totalPrice === 0 ? (
                <span className="text-2xl font-bold text-green-600">
                  ÜCRETSİZ
                </span>
              ) : (
                <span className="text-2xl font-bold text-blue-600">
                  ₺{totalPrice.toLocaleString('tr-TR')}
                </span>
              )}
            </div>
          </div>
          
          <button
            onClick={() => alert('Sipariş özelliği yakında!')}
            className="w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-bold hover:shadow-lg transition-all"
          >
            {totalPrice === 0 ? 'Ücretsiz Kart Talep Et' : 'Sipariş Ver'}
          </button>
        </div>
      </div>
    </div>
  )
}