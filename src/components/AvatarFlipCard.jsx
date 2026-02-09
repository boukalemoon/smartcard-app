import { useState } from 'react'

export default function AvatarFlipCard({ 
  profileImage, 
  avatar3dUrl, 
  name 
}) {
  const [isFlipped, setIsFlipped] = useState(false)

  const handleFlip = () => {
    setIsFlipped(!isFlipped)
  }

  return (
    <div className="perspective-1000 w-32 h-32 mx-auto mb-4">
      <div 
        className={`relative w-full h-full transition-transform duration-700 transform-style-3d cursor-pointer ${
          isFlipped ? 'rotate-y-180' : ''
        }`}
        onClick={handleFlip}
      >
        {/* Front - Profile Photo */}
        <div className="absolute w-full h-full backface-hidden">
          <div className="w-32 h-32 rounded-full bg-white dark:bg-gray-700 flex items-center justify-center text-5xl font-bold text-blue-600 shadow-lg border-4 border-white dark:border-gray-600 overflow-hidden">
            {profileImage ? (
              <img 
                src={profileImage} 
                alt={name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span>{name?.charAt(0) || '?'}</span>
            )}
          </div>
          {avatar3dUrl && (
            <div className="absolute bottom-0 right-0 bg-purple-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg animate-pulse">
              3D
            </div>
          )}
        </div>

        {/* Back - 3D Avatar */}
        {avatar3dUrl && (
          <div className="absolute w-full h-full backface-hidden rotate-y-180">
            <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg border-4 border-white dark:border-gray-600 overflow-hidden">
              <img 
                src={`https://models.readyplayer.me/${avatar3dUrl.split('/').pop().replace('.glb', '')}.png?scene=fullbody-portrait-v1`}
                alt="3D Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 right-0 bg-blue-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xs font-bold shadow-lg">
              📸
            </div>
          </div>
        )}
      </div>

      <style>{`
        .perspective-1000 {
          perspective: 1000px;
        }
        .transform-style-3d {
          transform-style: preserve-3d;
        }
        .backface-hidden {
          backface-visibility: hidden;
        }
        .rotate-y-180 {
          transform: rotateY(180deg);
        }
      `}</style>
    </div>
  )
}