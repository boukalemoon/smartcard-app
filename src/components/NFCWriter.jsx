import { useState, useEffect } from 'react';
import { Nfc, AlertCircle, CheckCircle, Smartphone } from 'lucide-react';

export default function NFCWriter({ username }) {
  const [isNFCSupported, setIsNFCSupported] = useState(false);
  const [isWriting, setIsWriting] = useState(false);
  const [status, setStatus] = useState('');
  const [statusType, setStatusType] = useState('info'); // info, success, error

  const profileUrl = `${window.location.origin}/card/${username}`;

  useEffect(() => {
    checkNFCSupport();
  }, []);

  const checkNFCSupport = () => {
    if ('NDEFReader' in window) {
      setIsNFCSupported(true);
      setStatus('NFC destekli cihaz tespit edildi');
      setStatusType('success');
    } else {
      setIsNFCSupported(false);
      setStatus('NFC özelliği sadece Android Chrome\'da desteklenmektedir');
      setStatusType('info');
    }
  };

  const writeToNFC = async () => {
    if (!isNFCSupported) {
      setStatus('NFC desteklenmiyor. Android Chrome kullanmanız gerekiyor.');
      setStatusType('error');
      return;
    }

    try {
      setIsWriting(true);
      setStatus('NFC etiketini cihazınıza yaklaştırın...');
      setStatusType('info');

      // Request NFC permission and write
      const ndef = new NDEFReader();
      await ndef.write({
        records: [
          {
            recordType: "url",
            data: profileUrl
          },
          {
            recordType: "text",
            data: `SmartCard - ${username}`
          }
        ]
      });

      setStatus('✅ NFC etikete başarıyla yazıldı!');
      setStatusType('success');
      
      // Reset status after 5 seconds
      setTimeout(() => {
        setStatus('NFC destekli cihaz tespit edildi');
        setStatusType('success');
        setIsWriting(false);
      }, 5000);

    } catch (error) {
      console.error('NFC yazma hatası:', error);
      
      let errorMessage = 'NFC yazma başarısız oldu';
      
      if (error.name === 'NotAllowedError') {
        errorMessage = 'NFC izni reddedildi. Lütfen izin verin.';
      } else if (error.name === 'NotSupportedError') {
        errorMessage = 'NFC bu cihazda desteklenmiyor.';
      } else if (error.name === 'NotReadableError') {
        errorMessage = 'NFC etiketi okunamıyor. Başka bir etiket deneyin.';
      } else if (error.name === 'AbortError') {
        errorMessage = 'İşlem iptal edildi.';
      }
      
      setStatus(errorMessage);
      setStatusType('error');
      setIsWriting(false);
    }
  };

  const readFromNFC = async () => {
    if (!isNFCSupported) {
      return;
    }

    try {
      setStatus('NFC okuma başlatıldı. Etiketi yaklaştırın...');
      setStatusType('info');

      const ndef = new NDEFReader();
      await ndef.scan();

      ndef.addEventListener("reading", ({ message, serialNumber }) => {
        const textDecoder = new TextDecoder();
        const records = [];

        for (const record of message.records) {
          if (record.recordType === "text") {
            records.push(textDecoder.decode(record.data));
          } else if (record.recordType === "url") {
            records.push(textDecoder.decode(record.data));
          }
        }

        setStatus(`✅ Okundu: ${records.join(', ')}`);
        setStatusType('success');
      });

    } catch (error) {
      console.error('NFC okuma hatası:', error);
      setStatus('NFC okuma başarısız oldu');
      setStatusType('error');
    }
  };

  const getStatusColor = () => {
    switch (statusType) {
      case 'success':
        return 'bg-green-50 text-green-800 border-green-200';
      case 'error':
        return 'bg-red-50 text-red-800 border-red-200';
      default:
        return 'bg-blue-50 text-blue-800 border-blue-200';
    }
  };

  const getStatusIcon = () => {
    switch (statusType) {
      case 'success':
        return <CheckCircle className="text-green-600" size={20} />;
      case 'error':
        return <AlertCircle className="text-red-600" size={20} />;
      default:
        return <Smartphone className="text-blue-600" size={20} />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Nfc className="text-blue-600" size={24} />
        <h2 className="text-xl font-semibold">NFC Etiket Yazma</h2>
      </div>

      {/* Status Message */}
      {status && (
        <div className={`mb-4 p-3 rounded-lg border flex items-start gap-2 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm flex-1">{status}</span>
        </div>
      )}

      {/* Instructions */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold text-sm text-gray-900 mb-2">
          NFC Nasıl Kullanılır?
        </h3>
        <ol className="text-sm text-gray-700 space-y-1 list-decimal list-inside">
          <li>Boş bir NFC etiketi (tag) edinin</li>
          <li>Android Chrome tarayıcısını kullandığınızdan emin olun</li>
          <li>"NFC'ye Yaz" butonuna tıklayın</li>
          <li>NFC etiketini telefonunuzun arkasına yaklaştırın</li>
          <li>Yazma işlemi tamamlanana kadar bekleyin</li>
        </ol>
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <button
          onClick={writeToNFC}
          disabled={!isNFCSupported || isWriting}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors
            ${isNFCSupported && !isWriting
              ? 'bg-blue-600 hover:bg-blue-700 text-white'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          <Nfc size={20} />
          {isWriting ? 'Yazılıyor...' : 'NFC\'ye Yaz'}
        </button>

        <button
          onClick={readFromNFC}
          disabled={!isNFCSupported}
          className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors border-2
            ${isNFCSupported
              ? 'border-blue-600 text-blue-600 hover:bg-blue-50'
              : 'border-gray-300 text-gray-500 cursor-not-allowed'
            }`}
        >
          <Smartphone size={20} />
          Test: NFC Oku
        </button>
      </div>

      {/* Browser Compatibility Info */}
      {!isNFCSupported && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ Uyumluluk Notu:</strong> NFC yazma özelliği şu anda sadece{' '}
            <strong>Android cihazlarda Chrome tarayıcısı</strong> ile çalışmaktadır.
            iOS cihazlarda NFC okuma yapılabilir ancak yazma desteklenmemektedir.
          </p>
        </div>
      )}

      {/* What is NFC */}
      <div className="mt-6 p-4 bg-blue-50 rounded-lg">
        <h3 className="font-semibold text-sm text-blue-900 mb-2">
          NFC Nedir?
        </h3>
        <p className="text-sm text-blue-800">
          NFC (Near Field Communication), kısa mesafeli kablosuz iletişim teknolojisidir.
          Profilinizi NFC etiketine yazarak, akıllı telefonları etikete dokundurarak
          kartvizitinizi anında paylaşabilirsiniz. Fiziksel kartvizit yerine modern
          ve çevre dostu bir alternatiftir.
        </p>
      </div>
    </div>
  );
}