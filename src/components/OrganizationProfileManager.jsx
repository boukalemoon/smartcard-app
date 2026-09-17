import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'
import ImageUpload from './ImageUpload'
import { Building2, Globe, Mail, Phone, MapPin, Save, X, Link2, Copy } from 'lucide-react'
import { SITE_URL } from '../lib/siteUrl'

// STK türleri sunucudaki is_stk_org_type ile aynı listedir; herkese açık
// dizin ve başvuru sayfaları yalnızca bu türlerde çalışır.
const STK_TURLERI = ['association', 'foundation', 'community', 'union',
                     'dernek', 'vakif', 'vakıf', 'topluluk', 'sendika', 'stk']

export default function OrganizationProfileManager({ organizationId, onClose, onUpdate }) {
  const [organization, setOrganization] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Form states
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState('company')
  const [website, setWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')
  const [city, setCity] = useState('')
  // Paylaşım ayarları. Bunlar bugüne kadar hiçbir ekrandan değiştirilemiyordu;
  // varsayılan "yalnızca üyeler" olduğu için herkese açık üye dizini her
  // organizasyonda BOŞ dönüyordu.
  const [dizinAcik, setDizinAcik] = useState(false)
  const [uyelerGorunur, setUyelerGorunur] = useState(false)
  const [iletisimGorunur, setIletisimGorunur] = useState(false)

  useEffect(() => {
    loadOrganization()
  }, [organizationId])

  const loadOrganization = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', organizationId)
        .single()

      if (error) throw error

      setOrganization(data)
      setName(data.name || '')
      setDescription(data.description || '')
      setType(data.type || 'company')
      setWebsite(data.website || '')
      setEmail(data.email || '')
      setPhone(data.phone || '')
      setAddress(data.address || '')
      setCity(data.city || '')
      const ayar = data.settings || {}
      setDizinAcik(Boolean(ayar.allowPublicDirectory))
      setUyelerGorunur(String(ayar.memberVisibility || '').toLowerCase() === 'public')
      setIletisimGorunur(Boolean(ayar.showMemberContact))
    } catch (error) {
      console.error('Error loading organization:', error)
      alert('Organizasyon yüklenemedi!')
    } finally {
      setLoading(false)
    }
  }

  const saveOrganization = async () => {
    try {
      setSaving(true)

      // Etkilenen satır kontrolü: erişim kuralı engellediğinde Supabase hata
      // döndürmez, 0 satır günceller. Bu kontrol olmadan yönetici olmayan
      // kişiye "güncellendi" deniyordu.
      const { data, error } = await supabase
        .from('organizations')
        .update({
          name,
          description,
          type,
          website,
          email,
          phone,
          address,
          city,
          settings: {
            ...(organization?.settings || {}),
            allowPublicDirectory: dizinAcik,
            memberVisibility: uyelerGorunur ? 'public' : 'members_only',
            showMemberContact: iletisimGorunur,
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', organizationId)
        .select('id')

      if (error) throw error
      if (!data || data.length === 0) {
        alert('Güncellenemedi. Bu işlem için organizasyon yöneticisi olmanız gerekiyor.')
        return
      }

      alert('✅ Organizasyon güncellendi!')
      onUpdate?.()
      onClose?.()
    } catch (error) {
      console.error('Save error:', error)
      alert('Hata: ' + error.message)
    } finally {
      setSaving(false)
    }
  }

  const updateLogo = async (logoUrl) => {
    try {
      const { data, error } = await supabase
        .from('organizations')
        .update({ logo_url: logoUrl })
        .eq('id', organizationId)
        .select('id')

      if (error) throw error
      if (!data || data.length === 0) {
        alert('Logo güncellenemedi. Bu işlem için organizasyon yöneticisi olmanız gerekiyor.')
        return
      }

      setOrganization({ ...organization, logo_url: logoUrl })
      alert('Logo güncellendi!')
    } catch (error) {
      console.error('Logo update error:', error)
      alert('Hata: ' + error.message)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Organizasyon Profili
        </h2>
        <button
          onClick={onClose}
          className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
        >
          <X size={24} />
        </button>
      </div>

      {/* Logo Upload */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Logo
        </h3>
        <ImageUpload
          currentImageUrl={organization?.logo_url}
          onUploadSuccess={updateLogo}
          bucket="logos"
          label="Organizasyon Logosu"
          maxSize={2}
        />
      </div>

      {/* Herkese açık paylaşım ayarları (yalnızca STK türleri) */}
      {STK_TURLERI.includes(String(type).toLowerCase()) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-1">
            Herkese Açık Sayfalar
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Üye dizini ve başvuru formu bu ayarlara göre çalışır. Kapalıyken
            bağlantıyı açan kişi boş sayfa görür.
          </p>

          <div className="space-y-3">
            {[
              { deger: dizinAcik, ayarla: setDizinAcik, baslik: 'Herkese açık sayfalar aktif',
                aciklama: 'Organizasyon bilgileriniz ve başvuru formu paylaşılabilir olur.' },
              { deger: uyelerGorunur, ayarla: setUyelerGorunur, baslik: 'Üye listesi herkese açık',
                aciklama: 'Kapalıyken dizin yalnızca üyelere görünür (varsayılan).' },
              { deger: iletisimGorunur, ayarla: setIletisimGorunur, baslik: 'Üye iletişim bilgileri görünsün',
                aciklama: 'Üyelerin e-posta ve telefonu dizinde herkese açılır. Açmadan önce üyelerinize sorun.' },
            ].map(({ deger, ayarla, baslik, aciklama }) => (
              <label key={baslik} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/40">
                <input
                  type="checkbox"
                  checked={deger}
                  onChange={(e) => ayarla(e.target.checked)}
                  className="mt-1 w-4 h-4"
                />
                <span>
                  <span className="block text-sm font-medium text-gray-900 dark:text-gray-100">{baslik}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">{aciklama}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Paylaşılabilir bağlantılar — hiçbir ekranda gösterilmiyordu */}
          <div className="mt-4 space-y-2">
            {[
              { etiket: 'Başvuru formu', adres: `${SITE_URL}/org/${organizationId}/apply` },
              { etiket: 'Üye dizini', adres: `${SITE_URL}/org/${organizationId}/members` },
            ].map(({ etiket, adres }) => (
              <div key={etiket} className="flex items-center gap-2 text-sm">
                <Link2 size={14} className="text-gray-400 flex-shrink-0" />
                <span className="text-gray-600 dark:text-gray-400 w-28 flex-shrink-0">{etiket}</span>
                <input readOnly value={adres} className="flex-1 px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded text-xs text-gray-700 dark:text-gray-200" />
                <button
                  type="button"
                  onClick={() => navigator.clipboard?.writeText(adres)}
                  className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-600 rounded"
                  title="Kopyala"
                >
                  <Copy size={14} className="text-gray-500" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Profile Information */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          Temel Bilgiler
        </h3>
        
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Organizasyon Adı *
            </label>
            <div className="relative">
              <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none"
                placeholder="Şirket/STK Adı"
              />
            </div>
          </div>

          {/* Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Organizasyon Tipi *
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none"
            >
              <option value="company">Şirket</option>
              <option value="corporation">Holding</option>
              <option value="association">Dernek</option>
              <option value="foundation">Vakıf</option>
              <option value="community">Topluluk</option>
              <option value="union">Birlik</option>
            </select>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Açıklama
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none"
              placeholder="Organizasyon hakkında kısa açıklama..."
            />
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
          İletişim Bilgileri
        </h3>
        
        <div className="space-y-4">
          {/* Website */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Website
            </label>
            <div className="relative">
              <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="url"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none"
                placeholder="https://example.com"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Email
            </label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none"
                placeholder="info@example.com"
              />
            </div>
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Telefon
            </label>
            <div className="relative">
              <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none"
                placeholder="+90 555 123 4567"
              />
            </div>
          </div>

          {/* Address & City */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Şehir
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none"
                  placeholder="İstanbul"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                Adres
              </label>
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none"
                placeholder="Tam adres"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3">
        <button
          onClick={saveOrganization}
          disabled={saving || !name}
          className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={20} />
          {saving ? 'Kaydediliyor...' : 'Kaydet'}
        </button>
        
        <button
          onClick={onClose}
          className="px-6 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-all"
        >
          İptal
        </button>
      </div>
    </div>
  )
}