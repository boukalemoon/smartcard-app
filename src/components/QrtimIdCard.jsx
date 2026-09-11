import { useState, useEffect } from 'react';
import { Fingerprint } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// Kullanıcının QRtım kimliğini SADECE BİLGİ olarak gösterir.
// • Kopyalanamaz / paylaşılamaz (kopya butonu yok, metin seçilemez).
// • Anon erişimi olmayan `qrtim_user_ids` tablosundan; RLS gereği kullanıcı
//   yalnız KENDİ kimliğini okuyabilir (başkasınınki sızmaz).
export default function QrtimIdCard({ userId }) {
  const [qrtimId, setQrtimId] = useState(null);

  useEffect(() => {
    let iptal = false;
    (async () => {
      if (!userId) return;
      const { data } = await supabase
        .from('qrtim_user_ids')
        .select('qrtim_uid')
        .eq('user_id', userId)
        .maybeSingle();
      if (!iptal && data?.qrtim_uid) setQrtimId(data.qrtim_uid);
    })();
    return () => { iptal = true; };
  }, [userId]);

  if (!qrtimId) return null;

  // Kopyalama/paylaşımı caydır: seçim, sağ tık, sürükleme kapalı
  const noShare = {
    userSelect: 'none',
    WebkitUserSelect: 'none',
    MozUserSelect: 'none',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1 flex items-center gap-2">
        <Fingerprint size={18} className="text-indigo-500" /> QRtım Kimliği
      </h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Hesabına özel kimliğin. Yalnızca bilgi amaçlıdır; paylaşman gerekmez.
      </p>
      <code
        className="block text-sm font-mono bg-gray-100 dark:bg-gray-900 text-gray-700 dark:text-gray-300 rounded-lg px-3 py-2 break-all"
        style={noShare}
        onCopy={(e) => e.preventDefault()}
        onContextMenu={(e) => e.preventDefault()}
        onDragStart={(e) => e.preventDefault()}
      >
        {qrtimId}
      </code>
    </div>
  );
}
