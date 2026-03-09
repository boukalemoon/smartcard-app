// src/components/landing/AnimatedHero.jsx

import { useState, useEffect } from 'react';
import { QrCode, Wifi } from 'lucide-react';

export default function AnimatedHero() {
  const [isDigital, setIsDigital] = useState(false);
  const [showEcoIndicator, setShowEcoIndicator] = useState(false);

  useEffect(() => {
    // 2 saniye sonra dijitale dönüş
    const timer1 = setTimeout(() => {
      setIsDigital(true);
    }, 2000);

    // 2.5 saniye sonra eco indicator
    const timer2 = setTimeout(() => {
      setShowEcoIndicator(true);
    }, 2500);

    // 6 saniye sonra tekrar kağıda dön (döngü)
    const timer3 = setTimeout(() => {
      setIsDigital(false);
      setShowEcoIndicator(false);
    }, 6000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [isDigital]);

  return (
    <div className="relative w-full max-w-md mx-auto h-[96px] flex items-center justify-center">
      
      {/* Kağıt Kartvizit */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${
          isDigital 
            ? 'opacity-0 scale-75 rotate-12 blur-sm' 
            : 'opacity-100 scale-100 rotate-0 blur-0'
        }`}
      >
        <div className="w-80 h-52 bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 rounded-2xl shadow-2xl p-6 border-4 border-dashed border-gray-400 dark:border-gray-600 relative">
          {/* Yırtık kenarlar efekti */}
          <div className="absolute top-0 right-0 w-8 h-8 bg-white dark:bg-gray-900 transform rotate-45 -translate-y-2 translate-x-2"></div>
          <div className="absolute bottom-0 left-0 w-6 h-6 bg-white dark:bg-gray-900 transform rotate-12 translate-y-2 -translate-x-2"></div>
          
          {/* Bulanık metin (eski kartvizit) */}
          <div className="space-y-3 opacity-60">
            <div className="w-32 h-6 bg-gray-400 dark:bg-gray-600 rounded animate-pulse"></div>
            <div className="w-24 h-4 bg-gray-400 dark:bg-gray-600 rounded animate-pulse"></div>
            <div className="w-28 h-4 bg-gray-400 dark:bg-gray-600 rounded animate-pulse"></div>
            <div className="mt-6 space-y-2">
              <div className="w-36 h-3 bg-gray-400 dark:bg-gray-600 rounded animate-pulse"></div>
              <div className="w-32 h-3 bg-gray-400 dark:bg-gray-600 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Yırtılma çizgileri */}
          <div className="absolute inset-0 pointer-events-none">
            <svg className="w-full h-full opacity-30" viewBox="0 0 100 100" preserveAspectRatio="none">
              <line x1="10" y1="0" x2="15" y2="100" stroke="currentColor" strokeWidth="0.5" className="text-gray-500" />
              <line x1="85" y1="0" x2="90" y2="100" stroke="currentColor" strokeWidth="0.5" className="text-gray-500" />
            </svg>
          </div>

          {/* "Eski" etiketi */}
          <div className="absolute -top-3 -right-3 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full rotate-12 shadow-lg">
            Eski Yöntem
          </div>
        </div>
      </div>

      {/* Dijital Kartvizit */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-all duration-1000 ${
          isDigital 
            ? 'opacity-100 scale-100 rotate-0 blur-0' 
            : 'opacity-0 scale-75 -rotate-12 blur-sm'
        }`}
      >
        <div className="w-80 h-52 bg-gradient-to-br from-blue-600 via-purple-600 to-blue-700 rounded-2xl shadow-2xl p-6 relative overflow-visible">
          {/* Parlama efekti */}
          <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/20 to-transparent animate-pulse"></div>
          
          {/* İçerik */}
          <div className="relative z-10 text-white space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-full flex items-center justify-center">
                <span className="text-2xl">👤</span>
              </div>
              <div>
                <h3 className="font-bold text-lg">Ahmet Yılmaz</h3>
                <p className="text-sm opacity-90">Yazılım Geliştirici</p>
              </div>
            </div>
            
            <div className="text-sm opacity-90 space-y-1">
              <p>📧 ahmet@example.com</p>
              <p>📱 +90 555 123 4567</p>
              <p>🏢 Tech Startup</p>
            </div>

            {/* Sosyal medya iconları */}
            <div className="flex gap-2 pt-2">
              <div className="w-8 h-8 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <span className="text-xs">in</span>
              </div>
              <div className="w-8 h-8 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <span className="text-xs">📷</span>
              </div>
              <div className="w-8 h-8 bg-white/20 backdrop-blur rounded-lg flex items-center justify-center">
                <span className="text-xs">🌐</span>
              </div>
            </div>
          </div>

          {/* QR + NFC iconları */}
          <div className="absolute bottom-4 right-4 flex gap-2">
            <div className="w-10 h-10 bg-white/30 backdrop-blur rounded-lg flex items-center justify-center">
              <QrCode size={20} className="text-white" />
            </div>
            <div className="w-10 h-10 bg-white/30 backdrop-blur rounded-lg flex items-center justify-center">
              <Wifi size={20} className="text-white" />
            </div>
          </div>

          {/* "Dijital" etiketi */}
          <div className="absolute -top-3 -right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full -rotate-12 shadow-lg animate-bounce">
            Dijital 🌱
          </div>
        </div>
      </div>

      {/* Eco Indicator (floating) */}
      <div
        className={`absolute -bottom-8 -right-8 z-20 transition-all duration-700 ${
          showEcoIndicator 
            ? 'opacity-100 translate-y-0' 
            : 'opacity-0 translate-y-4'
        }`}
      >
        <div className="bg-white dark:bg-gray-800 rounded-full px-4 py-2 shadow-2xl border-2 border-green-500 flex items-center gap-2 animate-float">
          <span className="text-2xl">🌍</span>
          <div className="text-left">
            <p className="text-xs font-semibold text-green-600 dark:text-green-400">
              %100 Dijital
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Sıfır kağıt israfı
            </p>
          </div>
        </div>
      </div>

      {/* Dönüşüm parçacıkları */}
      {isDigital && (
        <div className="absolute inset-0 pointer-events-none">
          {[...Array(8)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-green-400 rounded-full animate-ping"
              style={{
                top: `${Math.random() * 100}%`,
                left: `${Math.random() * 100}%`,
                animationDelay: `${i * 0.1}s`,
                animationDuration: '1s'
              }}
            ></div>
          ))}
        </div>
      )}

      {/* CSS animasyonları için stil */}
      <style>{`
        @keyframes float {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-10px);
          }
        }
        .animate-float {
          animation: float 3s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}