import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Share2 } from 'lucide-react';

export default function QRCodeDisplay({ username, fullName }) {
  const canvasRef = useRef(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const profileUrl = `${window.location.origin}/card/${username}`;

  useEffect(() => {
    if (canvasRef.current && username) {
      generateQRCode();
    }
  }, [username]);

  const generateQRCode = async () => {
    try {
      // Generate QR code on canvas
      await QRCode.toCanvas(canvasRef.current, profileUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#1F2937',
          light: '#FFFFFF'
        }
      });

      // Also get data URL for download
      const dataUrl = await QRCode.toDataURL(profileUrl, {
        width: 600,
        margin: 2
      });
      setQrDataUrl(dataUrl);
    } catch (error) {
      console.error('QR kod oluşturma hatası:', error);
    }
  };

  const downloadQRCode = () => {
    if (qrDataUrl) {
      const link = document.createElement('a');
      link.download = `${username}-qr-code.png`;
      link.href = qrDataUrl;
      link.click();
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
    alert('Link panoya kopyalandı!');
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
              📋
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3 w-full">
          <button
            onClick={downloadQRCode}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download size={18} />
            QR İndir
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
            <li>• QR kodu indirip baskı yaptırabilirsiniz</li>
            <li>• Dijital imzanızda kullanabilirsiniz</li>
            <li>• NFC etiketine yazabilirsiniz (yakında)</li>
            <li>• Link ile doğrudan paylaşabilirsiniz</li>
          </ul>
        </div>
      </div>
    </div>
  );
}