import { useState, useEffect } from 'react'
import { Eye, EyeOff, ShieldCheck, Lock } from 'lucide-react'
import { supabase } from '../lib/supabaseClient'
import { useToast } from './Toast'

// Kartvizit sayfasında hangi bilginin paylaşılacağını kullanıcı burada belirler.
//
// ÖNEMLİ: Bu bir görsel filtre DEĞİLDİR. Gizli işaretlenen alan sunucudan hiç
// gönderilmez — kartı açan kişi tarayıcısının ağ sekmesinde de göremez.
// Eskiden gizlilik yalnızca React koşuluydu ve veri yine de gidiyordu.
//
// Şema dört seviye taşıyor (public / link_only / on_request / private) ancak
// bugün sunucu yalnızca 'public' olanı yayımlıyor. Bu yüzden arayüzde şimdilik
// yalnızca gerçekten çalışan iki seçenek sunuluyor; kalan iki seviye
// karşılıklı bağlantı özelliğiyle birlikte (Faz 3) anlam kazanacak.

const FIELD_LABELS = {
  email:              { label: 'E-posta',              hint: 'Kartınızda tıklanabilir e-posta bağlantısı' },
  phone:              { label: 'Telefon',              hint: 'Kartınızda tıklanabilir telefon bağlantısı' },
  title:              { label: 'Ünvan',                hint: 'Adınızın altında görünür' },
  company:            { label: 'Şirket',               hint: 'Adınızın altında görünür' },
  bio:                { label: 'Hakkımda',             hint: 'Kartınızın üst bölümündeki tanıtım yazısı' },
  google_review_link: { label: 'Google yorum bağlantısı', hint: 'Ziyaretçileri yorum bırakmaya yönlendirir' },
  catalog_links:      { label: 'Katalog & dökümanlar', hint: 'Paylaştığınız dosya bağlantıları' },
  services:           { label: 'Hizmetler',            hint: 'Fiyatlı hizmet listeniz' },
}

const ORDER = ['email', 'phone', 'title', 'company', 'bio', 'google_review_link', 'catalog_links', 'services']

export default function FieldVisibilityManager({ profileId }) {
  const { showToast } = useToast()
  const [fields, setFields] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(null)

  useEffect(() => {
    if (profileId) load()
  }, [profileId])

  const load = async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('profile_fields')
        .select('field_key, visibility, verified_at')
        .eq('profile_id', profileId)
        .eq('persona', 'default')
      if (error) throw error
      const map = {}
      for (const row of data || []) {
        map[row.field_key] = { visibility: row.visibility, verified: !!row.verified_at }
      }
      setFields(map)
    } catch (err) {
      console.error('Görünürlük ayarları yüklenemedi:', err)
    } finally {
      setLoading(false)
    }
  }

  const setVisibility = async (key, visibility) => {
    setSaving(key)
    const previous = fields[key]
    // İyimser güncelleme — hata olursa geri alınır.
    setFields(prev => ({ ...prev, [key]: { ...prev[key], visibility } }))
    try {
      const { error } = await supabase
        .from('profile_fields')
        .upsert(
          { profile_id: profileId, field_key: key, persona: 'default', visibility },
          { onConflict: 'profile_id,field_key,persona' }
        )
      if (error) throw error
      showToast(
        visibility === 'public'
          ? `${FIELD_LABELS[key]?.label ?? key} artık kartınızda görünüyor`
          : `${FIELD_LABELS[key]?.label ?? key} gizlendi`,
        'success'
      )
    } catch (err) {
      setFields(prev => ({ ...prev, [key]: previous }))
      showToast('Ayar kaydedilemedi, tekrar deneyin', 'error')
      console.error('Görünürlük kaydedilemedi:', err)
    } finally {
      setSaving(null)
    }
  }

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div className="h-5 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-4" />
        <div className="space-y-3">
          {ORDER.slice(0, 4).map(k => (
            <div key={k} className="h-12 bg-gray-100 dark:bg-gray-700/50 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    )
  }

  const publicCount = ORDER.filter(k => fields[k]?.visibility === 'public').length

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-start justify-between gap-4 mb-1">
        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ShieldCheck size={18} className="text-indigo-500" /> Paylaşım Ayarları
        </h3>
        <span className="text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap mt-1">
          {publicCount}/{ORDER.length} açık
        </span>
      </div>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-5">
        Gizli işaretlediğiniz bilgi kartınızı açan kişiye <strong>hiç gönderilmez</strong>.
        Bilgisayarında saklanmaz, ağ trafiğinde de görünmez.
      </p>

      <div className="divide-y divide-gray-100 dark:divide-gray-700">
        {ORDER.map((key) => {
          const meta = FIELD_LABELS[key]
          const isPublic = fields[key]?.visibility === 'public'
          const busy = saving === key
          return (
            <div key={key} className="flex items-center justify-between gap-4 py-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{meta.label}</span>
                  {fields[key]?.verified && (
                    <span
                      title="Bu bilgi doğrulandı"
                      className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                    >
                      ✓ doğrulandı
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{meta.hint}</p>
              </div>

              <button
                type="button"
                disabled={busy}
                aria-pressed={isPublic}
                aria-label={`${meta.label}: ${isPublic ? 'herkese açık' : 'gizli'}`}
                onClick={() => setVisibility(key, isPublic ? 'private' : 'public')}
                className={`shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full transition-colors disabled:opacity-50 ${
                  isPublic
                    ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300'
                }`}
              >
                {isPublic ? <Eye size={14} /> : <EyeOff size={14} />}
                {isPublic ? 'Herkese açık' : 'Gizli'}
              </button>
            </div>
          )
        })}
      </div>

      <p className="mt-5 text-xs text-gray-400 dark:text-gray-500 flex items-start gap-1.5">
        <Lock size={13} className="mt-0.5 shrink-0" />
        Adınız, kullanıcı adınız ve profil fotoğrafınız kartın kimliğidir; bunlar
        her zaman görünür. Banka ve fatura bilgilerinizin paylaşımını ilgili
        bölümlerinden yönetebilirsiniz.
      </p>
    </div>
  )
}
