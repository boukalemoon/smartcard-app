import { useState, useEffect, useCallback } from 'react'
import { History, AlertTriangle, UserCog, RefreshCw } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'

// Hesabınızda ne olduğunu gösteren kayıt defteri.
//
// Veri `my_activity` RPC'sinden gelir; o da audit_log'u okur. audit_log
// SALT-EKLEMEdir: tetikleyici UPDATE'i tamamen, DELETE'i 90 gün dolmadan
// engeller. Yani buradaki satırlar sonradan düzeltilmiş olamaz.
//
// Kullanıcı yalnızca visibility='user' satırlarını görür; güvenlik
// incelemesi için tutulan 'internal' satırlar buraya hiç gelmez.

const PAGE = 25

const ACTION_LABELS = {
  'profiles.insert':         'Profilin oluşturuldu',
  'profiles.update':         'Profil bilgilerin güncellendi',
  'profiles.delete':         'Profilin silindi',
  'social_links.insert':     'Sosyal bağlantı eklendi',
  'social_links.update':     'Sosyal bağlantı düzenlendi',
  'social_links.delete':     'Sosyal bağlantı silindi',
  'profile_fields.insert':   'Paylaşım ayarı eklendi',
  'profile_fields.update':   'Paylaşım ayarı değiştirildi',
  'profile_fields.delete':   'Paylaşım ayarı silindi',
  'subscriptions.insert':    'Aboneliğin başlatıldı',
  'subscriptions.update':    'Aboneliğin güncellendi',
  'subscriptions.delete':    'Aboneliğin sonlandırıldı',
  'members.insert':          'Bir organizasyona üye oldun',
  'members.update':          'Organizasyon üyeliğin güncellendi',
  'members.delete':          'Organizasyon üyeliğin kaldırıldı',
  'organizations.insert':    'Organizasyon oluşturuldu',
  'organizations.update':    'Organizasyon bilgileri güncellendi',
  'organizations.delete':    'Organizasyon silindi',
  'nfc_orders.insert':       'NFC kart siparişi oluşturuldu',
  'nfc_orders.update':       'NFC kart siparişi güncellendi',
  'profile_payment.insert':  'Ödeme bilgilerin kaydedildi',
  'profile_payment.update':  'Ödeme bilgilerin güncellendi',
  'profile_payment.delete':  'Ödeme bilgilerin silindi',
  'app.connect':             'Uygulama hesabına bağlandı',
  'app.disconnect':          'Uygulama bağlantısı kesildi',
  'sync.push':               'Veriler senkronlandı',
  'prefs.set':               'Tercihlerin güncellendi',
}

// meta.degisen içindeki kolon adlarını okunur hale getirir.
const FIELD_LABELS = {
  name: 'ad', email: 'e-posta', phone: 'telefon', title: 'ünvan',
  company: 'şirket', bio: 'hakkımda', username: 'kullanıcı adı',
  avatar_url: 'profil fotoğrafı', avatar_3d_url: '3B avatar',
  background_image_url: 'arka plan', theme_color: 'tema rengi',
  theme_style: 'tema stili', visibility: 'görünürlük', plan: 'plan',
  status: 'durum', role: 'rol', url: 'bağlantı', platform: 'platform',
  catalog_links: 'kataloglar', services: 'hizmetler',
  google_review_link: 'Google yorum bağlantısı', is_verified: 'doğrulama',
  website: 'web sitesi', description: 'açıklama', address: 'adres',
}

function zamanMetni(iso) {
  const t = new Date(iso)
  const fark = Math.floor((Date.now() - t.getTime()) / 1000)
  if (fark < 60) return 'az önce'
  if (fark < 3600) return `${Math.floor(fark / 60)} dakika önce`
  if (fark < 86400) return `${Math.floor(fark / 3600)} saat önce`
  if (fark < 604800) return `${Math.floor(fark / 86400)} gün önce`
  return t.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
}

function tamZaman(iso) {
  return new Date(iso).toLocaleString('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function degisenMetni(meta) {
  const degisen = meta?.degisen
  if (!Array.isArray(degisen) || degisen.length === 0) return null
  const adlar = degisen.map(k => FIELD_LABELS[k] || k)
  if (adlar.length <= 3) return adlar.join(', ')
  return `${adlar.slice(0, 3).join(', ')} ve ${adlar.length - 3} alan daha`
}

export default function ActivityLog() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [more, setMore] = useState(false)
  const [error, setError] = useState(null)
  const [offset, setOffset] = useState(0)

  const load = useCallback(async (yeniOffset = 0) => {
    try {
      if (yeniOffset === 0) setLoading(true); else setMore(true)
      const { data, error: err } = await supabase.rpc('my_activity', {
        p_limit: PAGE,
        p_offset: yeniOffset,
      })
      if (err) throw err
      const gelen = data || []
      setRows(prev => (yeniOffset === 0 ? gelen : [...prev, ...gelen]))
      setOffset(yeniOffset + gelen.length)
      setError(null)
    } catch (err) {
      console.error('Hesap hareketleri yüklenemedi:', err)
      setError('Hareket geçmişi şu an yüklenemedi.')
    } finally {
      setLoading(false)
      setMore(false)
    }
  }, [])

  useEffect(() => { load(0) }, [load])

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div className="h-5 w-44 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-5" />
        <div className="space-y-3">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <History size={18} className="text-indigo-500" /> Hesap Hareketleri
        </h3>
        <button
          onClick={() => load(0)}
          className="text-xs text-gray-500 hover:text-indigo-600 dark:text-gray-400
                     dark:hover:text-indigo-400 flex items-center gap-1 mt-1"
        >
          <RefreshCw size={13} /> Yenile
        </button>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Hesabında yapılan her değişiklik burada tutulur. Bu kayıtlar sonradan
        <strong> değiştirilemez veya silinemez</strong>.
      </p>

      {error && (
        <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20
                        rounded-lg px-4 py-3 mb-4">
          {error}
        </div>
      )}

      {!error && rows.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400 py-8 text-center">
          Henüz kayıtlı bir hareket yok. Profilinde bir şey değiştirdiğinde burada görünecek.
        </p>
      )}

      <ul className="divide-y divide-gray-100 dark:divide-gray-700">
        {rows.map((r, i) => {
          const baslik = ACTION_LABELS[r.action] || r.action
          const detay = degisenMetni(r.meta)
          const uyari = r.severity === 'warning' || r.severity === 'critical'
          return (
            <li key={`${r.occurred_at}-${i}`} className="flex items-start gap-3 py-3">
              <span
                className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${
                  uyari ? 'bg-amber-500'
                    : r.severity === 'notice' ? 'bg-indigo-500'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">
                    {baslik}
                  </span>
                  {r.app_name && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700
                                     dark:bg-indigo-900/30 dark:text-indigo-300">
                      {r.app_name}
                    </span>
                  )}
                  {r.baskasi_yapti && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-700
                                     dark:bg-amber-900/30 dark:text-amber-300
                                     flex items-center gap-1">
                      <UserCog size={11} /> başkası yaptı
                    </span>
                  )}
                  {r.result !== 'success' && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-50 text-red-700
                                     dark:bg-red-900/30 dark:text-red-300
                                     flex items-center gap-1">
                      <AlertTriangle size={11} />
                      {r.result === 'denied' ? 'reddedildi' : 'başarısız'}
                    </span>
                  )}
                </div>
                {detay && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                    Değişen: {detay}
                  </p>
                )}
              </div>
              <time
                className="text-xs text-gray-400 dark:text-gray-500 whitespace-nowrap shrink-0 mt-0.5"
                dateTime={r.occurred_at}
                title={tamZaman(r.occurred_at)}
              >
                {zamanMetni(r.occurred_at)}
              </time>
            </li>
          )
        })}
      </ul>

      {rows.length >= PAGE && rows.length === offset && (
        <button
          onClick={() => load(offset)}
          disabled={more}
          className="w-full mt-4 py-2 text-sm font-medium text-indigo-600 dark:text-indigo-400
                     hover:bg-indigo-50 dark:hover:bg-indigo-900/20 rounded-lg
                     disabled:opacity-50 transition-colors"
        >
          {more ? 'Yükleniyor…' : 'Daha eskisini göster'}
        </button>
      )}
    </div>
  )
}
