import { useState } from 'react'
import { CreditCard, Check } from 'lucide-react'

export default function NFCCardDesigner({ profile, subscription }) {
  const [cardType, setCardType] = useState('pvc')
  const [cardColor, setCardColor] = useState('#000000')
  const [cardFinish, setCardFinish] = useState('matte')
  const [logoPosition, setLogoPosition] = useState('center')
  const [quantity, setQuantity] = useState(1)

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
      {/* Kart Önizleme */}
      <div className="bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800 dark:to-gray-900 rounded-2xl p-8">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4 text-center">
          Kart Önizleme
        </h3>
        
        {/* 3D Kart Mockup */}
        <div className="flex justify-center">
          <div 
            className="w-80 h-48 rounded-xl shadow-2xl relative overflow-hidden"
            style={{ 
              backgroundColor: cardColor,
              transform: 'perspective(1000px) rotateY(-5deg) rotateX(5deg)'
            }}
          >
            {/* Finish Efekti */}
            {cardFinish === 'glossy' && (
              <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
            )}
            
            {/* Logo */}
            <div className={`absolute ${
              logoPosition === 'center' ? 'top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2' :
              logoPosition === 'top-right' ? 'top-4 right-4' :
              'bottom-4 left-4'
            }`}>
              {profile?.avatar_url ? (
                <img 
                  src={profile.avatar_url} 
                  alt="Logo"
                  className="w-16 h-16 rounded-full border-2 border-white"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
                  {profile?.name?.charAt(0) || '?'}
                </div>
              )}
            </div>

            {/* İsim */}
            <div className="absolute bottom-4 left-4 text-white">
              <p className="text-lg font-bold">{profile?.name}</p>
              <p className="text-xs opacity-75">{profile?.company}</p>
            </div>

            {/* NFC İkonu */}
            <div className="absolute top-4 left-4">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <CreditCard size={16} className="text-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Özelleştirme Paneli */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 space-y-6">
        
        {/* Kart Tipi */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Kart Tipi
          </label>
          <div className="grid grid-cols-3 gap-3">
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