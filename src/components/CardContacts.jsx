import { useCallback, useEffect, useState } from 'react'
import { Users, Trash2, Download, Mail, Phone } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { exportToCSV } from '../utils/exportHelpers'

import { bildir } from '../lib/bildirim'
// KİŞİ DEFTERİ
//
// Kartını okutan kişilerin kendi rızasıyla bıraktığı bilgiler. Veri kart
// sahibine aittir; QRtım onun adına saklar. Bu yüzden ekranda silme ve dışa
// aktarma var: kişi "beni silin" derse kart sahibi bunu kendi yapabilmeli.

const KAYNAK_ETIKET = {
  qr: 'QR kod',
  nfc: 'NFC kart',
  link: 'Bağlantı',
  direct: 'Doğrudan',
}

export default function CardContacts() {
  const [kisiler, setKisiler] = useState([])
  const [yukleniyor, setYukleniyor] = useState(true)
  const [siliniyor, setSiliniyor] = useState(null)

  const yukle = useCallback(async () => {
    setYukleniyor(true)
    const { data, error } = await supabase.rpc('my_card_contacts')
    if (error) console.error('Kişi defteri alınamadı:', error)
    setKisiler(data || [])
    setYukleniyor(false)
  }, [])

  useEffect(() => { yukle() }, [yukle])

  const sil = async (kisi) => {
    if (!confirm(`${kisi.name} kaydı silinsin mi? Bu işlem geri alınamaz.`)) return
    setSiliniyor(kisi.id)
    try {
      // Etkilenen satır kontrolü: erişim kuralı engellerse hata dönmez,
      // 0 satır silinir ve kullanıcıya "silindi" yalanı söylenirdi.
      const { data, error } = await supabase
        .from('card_contacts')
        .delete()
        .eq('id', kisi.id)
        .select('id')
      if (error) throw error
      if (!data || data.length === 0) {
        bildir('Kayıt silinemedi.')
        return
      }
      setKisiler((o) => o.filter((k) => k.id !== kisi.id))
    } catch (e) {
      bildir('Hata: ' + e.message)
    } finally {
      setSiliniyor(null)
    }
  }

  const disaAktar = () => {
    if (kisiler.length === 0) { bildir('Dışa aktarılacak kayıt yok.'); return }
    exportToCSV(
      kisiler.map((k) => ({
        'Ad Soyad': k.name,
        'E-posta': k.email || '-',
        'Telefon': k.phone || '-',
        'Firma': k.company || '-',
        'Not': k.note || '-',
        'Geldiği yer': KAYNAK_ETIKET[k.source] || '-',
        'Profil': k.persona_name || '-',
        'Tarih': new Date(k.created_at).toLocaleDateString('tr-TR'),
      })),
      'kisi_defteri'
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="text-blue-600 dark:text-blue-400" size={22} />
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
            Kişi Defteri{kisiler.length > 0 ? ` (${kisiler.length})` : ''}
          </h2>
        </div>
        {kisiler.length > 0 && (
          <button
            onClick={disaAktar}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-semibold hover:bg-green-700"
          >
            <Download size={16} />
            CSV
          </button>
        )}
      </div>

      {yukleniyor ? (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-6 text-center">Yükleniyor…</p>
      ) : kisiler.length === 0 ? (
        <div className="py-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Henüz kimse kartınıza bilgi bırakmadı.
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Kartınızı okutan kişiler, kartın altındaki “Ben de kartımı bırakayım”
            düğmesiyle kendi bilgilerini bırakabilir. Onlar da sizin kartınızı
            almış olur — kağıt kartvizitteki karşılıklı değişimin dijital hali.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {kisiler.map((k) => (
            <div key={k.id} className="flex items-start justify-between gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="min-w-0">
                <div className="font-semibold text-gray-900 dark:text-gray-100">{k.name}</div>
                {k.company && <div className="text-xs text-gray-500 dark:text-gray-400">{k.company}</div>}
                <div className="flex flex-wrap gap-3 mt-1 text-sm">
                  {k.email && (
                    <a href={`mailto:${k.email}`} className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                      <Mail size={14} />{k.email}
                    </a>
                  )}
                  {k.phone && (
                    <a href={`tel:${k.phone}`} className="flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline">
                      <Phone size={14} />{k.phone}
                    </a>
                  )}
                </div>
                {k.note && <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 break-words">{k.note}</p>}
                <div className="text-[11px] text-gray-400 mt-1">
                  {new Date(k.created_at).toLocaleDateString('tr-TR')}
                  {k.source && ` · ${KAYNAK_ETIKET[k.source] || k.source}`}
                  {k.persona_name && ` · ${k.persona_name}`}
                </div>
              </div>
              <button
                onClick={() => sil(k)}
                disabled={siliniyor === k.id}
                title="Kaydı sil"
                className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg disabled:opacity-50"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
