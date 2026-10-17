import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Share2, FileImage, Copy } from 'lucide-react';
import { cardUrl, kaynakliAdres } from '../lib/siteUrl';

import { bildir } from '../lib/bildirim'
export default function QRCodeDisplay({ 
  username, 
  url = null,        // verilirse bu adres kodlanir (persona paylasimi)
  fileLabel = null,  // indirilen dosyanin adi
  fullName,
  qrForegroundColor = '#1F2937',  // ← YENİ!
  qrBackgroundColor = '#FFFFFF',  // ← YENİ!
  qrLogoEnabled = false,          // ← YENİ!
  profileImage = null             // ← YENİ!
 }) {
  const canvasRef = useRef(null);
  // Baskı boyutu. Ekranda 300 px yeter ama matbaaya giden dosya büyük olmalı:
  // 1000 px kartvizit, 2000 px afiş/tabela için.
  const [indirmeBoyutu, setIndirmeBoyutu] = useState(1000);
  // Basılan QR kod bu adresi kalıcı olarak taşır; tarayıcının o anda
  // hangi adreste olduğundan bağımsız olmalı. Bkz. lib/siteUrl.js
  const profileUrl = url || cardUrl(username);
  // Koda basılan adres kaynağını taşır ("QR ile gelindi"); ekranda gösterilen
  // ve kopyalanan adres sade kalır.
  const qrUrl = kaynakliAdres(profileUrl, 'qr');

  useEffect(() => {
    if (canvasRef.current && qrUrl) {
      generateQRCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qrUrl, qrForegroundColor, qrBackgroundColor, qrLogoEnabled, profileImage]);

  // Logo QR'nin ortasındaki %20'lik alanı kapatıyor. Varsayılan hata düzeltme
  // seviyesi (M) yalnızca ~%15 kaybı tolere eder → logolu kodların bir kısmı
  // okunamıyordu. Logo varken en yüksek seviye (H, ~%30) kullanılır.
  const hataDuzeltme = qrLogoEnabled && profileImage ? 'H' : 'M';

  const generateQRCode = async () => {
    try {
      const canvas = canvasRef.current;

      // Generate QR code on canvas
      await QRCode.toCanvas(canvasRef.current, qrUrl, {
        width: 300,
        margin: 2,
        errorCorrectionLevel: hataDuzeltme,
        color: {
          dark: qrForegroundColor,   // ← ÖZELLEŞ!
          light: qrBackgroundColor   // ← ÖZELLEŞ!
        }
      });

      // Add logo if enabled
    if (qrLogoEnabled && profileImage) {
      await addLogoToQR(canvas, profileImage);
    }
    } catch (error) {
      console.error('QR kod oluşturma hatası:', error);
    }
  };

 // YENİ FONKSIYON: Logo ekle
const addLogoToQR = (canvas, logoUrl) => {
  return new Promise((resolve, reject) => {
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.crossOrigin = 'anonymous';
    
    img.onload = () => {
      const logoSize = canvas.width * 0.2; // QR'nin %20'si
      const x = (canvas.width - logoSize) / 2;
      const y = (canvas.height - logoSize) / 2;
      
      // Beyaz arka plan (logo etrafında)
      ctx.fillStyle = qrBackgroundColor;
      ctx.fillRect(x - 5, y - 5, logoSize + 10, logoSize + 10);
      
      // Logo çiz (yuvarlak)
      ctx.save();
      ctx.beginPath();
      ctx.arc(x + logoSize/2, y + logoSize/2, logoSize/2, 0, Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      ctx.drawImage(img, x, y, logoSize, logoSize);
      ctx.restore();
      
      resolve();
    };
    
    img.onerror = reject;
    img.src = logoUrl;
  });
}; 

  // BASKI NOTU: indirilen dosyada kenar boşluğu (quiet zone) 4 modül
  // bırakılır. Ekran önizlemesinde 2 yeterli, ama baskıda kodun etrafında
  // yeterli beyaz alan kalmazsa okuyucular kodu bulamaz.
  const BASKI_KENAR_PAYI = 4;

  const downloadQRCode = async () => {
    try {
      const dataUrl = await QRCode.toDataURL(qrUrl, {
        width: indirmeBoyutu,
        margin: BASKI_KENAR_PAYI,
        errorCorrectionLevel: hataDuzeltme,
        color: { dark: qrForegroundColor, light: qrBackgroundColor },
      });
      const link = document.createElement('a');
      link.download = `${fileLabel || username}-qr-${indirmeBoyutu}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('QR indirilemedi:', error);
      bildir('QR kod indirilemedi.');
    }
  };

  // Vektör çıktı: matbaada istenen boyutta büyütülür, hiç bozulmaz.
  // (Logolu kodda logo SVG'ye gömülmez; basımcıya ayrıca verilmelidir.)
  const downloadSVG = async () => {
    try {
      const svg = await QRCode.toString(qrUrl, {
        type: 'svg',
        margin: BASKI_KENAR_PAYI,
        errorCorrectionLevel: hataDuzeltme,
        color: { dark: qrForegroundColor, light: qrBackgroundColor },
      });
      const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `${fileLabel || username}-qr.svg`;
      link.click();
      URL.revokeObjectURL(link.href);
    } catch (error) {
      console.error('SVG indirilemedi:', error);
      bildir('SVG indirilemedi.');
    }
  };

  const shareCard = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${fullName} - Dijital Kartvizit`,
          text: 'Dijital kartvizitimi görüntüle',
          url: profileUrl
        });
      } catch (error) {
        if (error.name !== 'AbortError') {
          console.error('Paylaşım hatası:', error);
          copyToClipboard();
        }
      }
    } else {
      copyToClipboard();
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(profileUrl);
    bildir('Link panoya kopyalandı!');
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-900 dark:text-gray-100">Dijital Kartınız</h2>
      
      <div className="flex flex-col items-center space-y-4">
        {/* QR Code Canvas */}
        <div className="bg-white p-4 rounded-lg border-2 border-gray-200 dark:border-gray-700">
          <canvas ref={canvasRef} />
        </div>

        {/* Profile URL */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Kart Linkiniz
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={profileUrl}
              readOnly
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-gray-100"
            />
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
              title="Kopyala"
            >
              <Copy size={16} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* Baskı boyutu */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            İndirme boyutu
          </label>
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
            {[
              { deger: 600, etiket: 'Ekran', not: 'Sosyal medya, e-posta imzası' },
              { deger: 1000, etiket: 'Kartvizit', not: 'Kartvizit, etiket, broşür' },
              { deger: 2000, etiket: 'Afiş', not: 'Tabela, afiş, vitrin' },
            ].map((o) => (
              <button
                key={o.deger}
                onClick={() => setIndirmeBoyutu(o.deger)}
                title={o.not}
                className={`flex-1 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                  indirmeBoyutu === o.deger
                    ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow'
                    : 'text-gray-500 dark:text-gray-400'
                }`}
              >
                {o.etiket}
              </button>
            ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 w-full">
          <button
            onClick={downloadQRCode}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download size={18} />
            PNG İndir
          </button>
          <button
            onClick={downloadSVG}
            title="Matbaa için vektör dosya: istenen boyutta büyütülür, bozulmaz"
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800 transition-colors"
          >
            <FileImage size={18} />
            SVG (Baskı)
          </button>
          <button
            onClick={shareCard}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <Share2 size={18} />
            Paylaş
          </button>
        </div>

        {/* Usage Instructions */}
        <div className="w-full mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-300 mb-2">
            Nasıl Kullanılır?
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
            <li>• Matbaa için <strong>SVG</strong> verin; küçültüp büyütmek kodu bozmaz</li>
            <li>• Kodun etrafındaki beyaz boşluğu kapatmayın, okunmaz hale gelir</li>
            <li>• Kartvizitte kenarı en az 2 cm olsun; küçük baskıda okunma düşer</li>
            <li>• Bu kod kalıcıdır: kullanıcı adınızı değiştirseniz de çalışır</li>
          </ul>
        </div>
      </div>
    </div>
  );
}