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
        return 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 border-green-200 dark:border-green-800';
      case 'error':
        return 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300 border-red-200 dark:border-red-800';
      default:
        return 'bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 border-blue-200 dark:border-blue-800';
    }
  };

  const getStatusIcon = () => {
    switch (statusType) {
      case 'success':
        return <CheckCircle className="text-green-600 dark:text-green-400" size={20} />;
      case 'error':
        return <AlertCircle className="text-red-600 dark:text-red-400" size={20} />;
      default:
        return <Smartphone className="text-blue-600 dark:text-blue-400" size={20} />;
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <div className="flex items-center gap-2 mb-4">
        <Nfc className="text-blue-600 dark:text-blue-400" size={24} />
        <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">NFC Etiket Yazma</h2>
      </div>

      {/* Status Message */}
      {status && (
        <div className={`mb-4 p-3 rounded-lg border flex items-start gap-2 ${getStatusColor()}`}>
          {getStatusIcon()}
          <span className="text-sm flex-1">{status}</span>
        </div>
      )}

      {/* Instructions */}
      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 mb-2">
          NFC Nasıl Kullanılır?
        </h3>
        <ol className="text-sm text-gray-700 dark:text-gray-300 space-y-1 list-decimal list-inside">
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
              : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
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
              ? 'border-blue-600 dark:border-blue-400 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
              : 'border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
            }`}
        >
          <Smartphone size={20} />
          Test: NFC Oku
        </button>
      </div>

      {/* Browser Compatibility Info */}
      {!isNFCSupported && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            <strong>⚠️ Uyumluluk Notu:</strong> NFC yazma özelliği şu anda sadece{' '}
            <strong>Android cihazlarda Chrome tarayıcısı</strong> ile çalışmaktadır.
            iOS cihazlarda NFC okuma yapılabilir ancak yazma desteklenmemektedir.
          </p>
        </div>
      )}

      {/* What is NFC */}
      <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <h3 className="font-semibold text-sm text-blue-900 dark:text-blue-300 mb-2">
          NFC Nedir?
        </h3>
        <p className="text-sm text-blue-800 dark:text-blue-400">
          NFC (Near Field Communication), kısa mesafeli kablosuz iletişim teknolojisidir.
          Profilinizi NFC etiketine yazarak, akıllı telefonları etikete dokundurarak
          kartvizitinizi anında paylaşabilirsiniz. Fiziksel kartvizit yerine modern
          ve çevre dostu bir alternatiftir.
        </p>
      </div>
    </div>
  );
}