import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Linkedin, Facebook, Twitter, Instagram, Youtube, 
  Github, Globe, Twitch, Music, Camera, Send,
  Plus, Trash2, ExternalLink, Check, X, Crown
} from 'lucide-react';
import { guvenliUrl } from '../utils/guvenliUrl';

const SOCIAL_PLATFORMS = [
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/username', color: 'bg-blue-600' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/username', color: 'bg-blue-700' },
  { id: 'twitter', name: 'Twitter/X', icon: Twitter, placeholder: 'https://twitter.com/username', color: 'bg-black dark:bg-gray-700' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/username', color: 'bg-pink-600' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@username', color: 'bg-red-600' },
  { id: 'tiktok', name: 'TikTok', icon: Music, placeholder: 'https://tiktok.com/@username', color: 'bg-black dark:bg-gray-700' },
  { id: 'pinterest', name: 'Pinterest', icon: Camera, placeholder: 'https://pinterest.com/username', color: 'bg-red-700' },
  { id: 'twitch', name: 'Twitch', icon: Twitch, placeholder: 'https://twitch.tv/username', color: 'bg-purple-600' },
  { id: 'kick', name: 'Kick', icon: Send, placeholder: 'https://kick.com/username', color: 'bg-green-500' },
  { id: 'snapchat', name: 'Snapchat', icon: Camera, placeholder: 'https://snapchat.com/add/username', color: 'bg-yellow-400' },
  { id: 'github', name: 'GitHub', icon: Github, placeholder: 'https://github.com/username', color: 'bg-gray-800 dark:bg-gray-700' },
  { id: 'website', name: 'Website', icon: Globe, placeholder: 'https://yourwebsite.com', color: 'bg-gray-600' },
  // E-ticaret platformları
  { id: 'trendyol', name: 'Trendyol', icon: Globe, placeholder: 'https://trendyol.com/magaza/username', color: 'bg-orange-500' },
  { id: 'hepsiburada', name: 'Hepsiburada', icon: Globe, placeholder: 'https://hepsiburada.com/magaza/username', color: 'bg-orange-600' },
  { id: 'n11', name: 'N11', icon: Globe, placeholder: 'https://n11.com/magaza/username', color: 'bg-blue-500' },
  { id: 'amazon_tr', name: 'Amazon TR', icon: Globe, placeholder: 'https://amazon.com.tr/magaza/username', color: 'bg-yellow-500' },
  { id: 'etsy', name: 'Etsy', icon: Globe, placeholder: 'https://etsy.com/shop/username', color: 'bg-orange-400' },
  { id: 'shopify', name: 'Shopify Mağaza', icon: Globe, placeholder: 'https://yourstore.myshopify.com', color: 'bg-green-600' },
  { id: 'woocommerce', name: 'WooCommerce', icon: Globe, placeholder: 'https://yourstore.com', color: 'bg-purple-600' },
  { id: 'katalog_link', name: 'Ürün Kataloğu', icon: Globe, placeholder: 'https://katalog.yoursite.com', color: 'bg-gray-600' },
];

// Sınır artık kod içinde SABİT DEĞİL: plan_features tablosundan
// (my_plan_limits) okunur ve sunucu da aynı sınırı uygular
// (social_links_limit_trg). Önceden yalnızca arayüzde vardı, yani aşılabilirdi.

export default function SocialLinksManager({ profileId }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newLink, setNewLink] = useState({ platform: '', url: '' });
  const [editLink, setEditLink] = useState({ platform: '', url: '' });
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [sinir, setSinir] = useState(null); // plan_features'tan
  const sinirsiz = sinir !== null && sinir >= 999;
  const canAddMore = sinir === null ? true : links.length < sinir;

  useEffect(() => {
    if (profileId) loadLinks();
  }, [profileId]);

  useEffect(() => {
    supabase.rpc('my_plan_limits').then(({ data, error }) => {
      if (error) { console.error('Plan sınırı alınamadı:', error); return }
      if (data?.ok) setSinir(data.sinir.sosyal_medya)
    })
  }, []);

  const loadLinks = async () => {
    try {
      const { data, error } = await supabase
        .from('social_links')
        .select('*')
        .eq('profile_id', profileId)
        .order('display_order');

      if (error) throw error;
      setLinks(data || []);
    } catch (error) {
      console.error('Error loading links:', error);
    } finally {
      setLoading(false);
    }
  };

  const addLink = async () => {
    if (!newLink.platform || !newLink.url) {
      alert('Platform ve URL zorunludur');
      return;
    }

    if (!canAddMore) {
      setShowUpgrade(true);
      return;
    }

    const normalizeUrl = (url) => {
    if (!url) return url
    url = url.trim()
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return 'https://' + url
  }

  const normalizedUrl = normalizeUrl(newLink.url)

    try {
      setLoading(true);

      const { error } = await supabase
        .from('social_links')
        .insert({
          profile_id: profileId,
          platform: newLink.platform,
          url: normalizedUrl,
          display_order: links.length
        });

      if (error) throw error;

      setNewLink({ platform: '', url: '' });
      setAdding(false);
      loadLinks();
      alert('Sosyal medya hesabı eklendi!');
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteLink = async (id) => {
    if (!confirm('Bu sosyal medya hesabını silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const { data, error } = await supabase
        .from('social_links')
        .delete()
        .eq('id', id)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Bağlantı silinemedi: bu işlem için yetkiniz yok.');
        return;
      }

      loadLinks();
      alert('Sosyal medya hesabı silindi');
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  const startEdit = (link) => {
    setEditingId(link.id);
    setEditLink({
      platform: link.platform,
      url: link.url,
      etiket: link.etiket || '',
      one_cikan: !!link.one_cikan,
      aktif: link.aktif !== false,
      // <input type="date"> yalnızca YYYY-MM-DD kabul eder.
      yayin_bitis: link.yayin_bitis ? link.yayin_bitis.slice(0, 10) : '',
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditLink({ platform: '', url: '' });
  };

  const updateLink = async (id) => {
    if (!editLink.url) {
      alert('URL boş olamaz');
      return;
    }

    const normalizeUrl = (url) => {
    if (!url) return url
    url = url.trim()
    if (url.startsWith('http://') || url.startsWith('https://')) return url
    return 'https://' + url
  }

  const normalizedUrl = normalizeUrl(editLink.url)

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('social_links')
        .update({
          url: normalizedUrl,
          etiket: editLink.etiket?.trim() ? editLink.etiket.trim() : null,
          one_cikan: !!editLink.one_cikan,
          aktif: editLink.aktif !== false,
          // Bitiş günü DAHİL olsun: kullanıcı "31 Aralık" derken 31'i de
          // kapsadığını varsayar. Günün sonuna kadar açık kalır.
          yayin_bitis: editLink.yayin_bitis
            ? new Date(`${editLink.yayin_bitis}T23:59:59`).toISOString()
            : null,
        })
        .eq('id', id)
        .select('id');

      if (error) throw error;
      if (!data || data.length === 0) {
        alert('Bağlantı güncellenemedi: bu işlem için yetkiniz yok.');
        return;
      }

      setEditingId(null);
      setEditLink({ platform: '', url: '' });
      loadLinks();
      alert('Sosyal medya hesabı güncellendi!');
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const getPlatformInfo = (platformId) => {
    return SOCIAL_PLATFORMS.find(p => p.id === platformId) || {
      id: platformId,
      name: platformId,
      icon: Globe,
      color: 'bg-gray-500'
    };
  };

  const availablePlatforms = SOCIAL_PLATFORMS.filter(
    platform => !links.some(link => link.platform === platform.id)
  );

  if (loading && !adding) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded"></div>
            <div className="h-12 bg-gray-100 dark:bg-gray-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Sosyal Medya Hesapları</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {sinirsiz ? (
              <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <Crown size={14} />
                Sınırsız hesap ekleyebilirsiniz
              </span>
            ) : (
              <span>
                {links.length}/{sinir ?? '—'} hesap kullanıldı
              </span>
            )}
          </p>
        </div>
        {!adding && (
          <button
            onClick={() => {
              if (canAddMore) {
                setAdding(true);
              } else {
                setShowUpgrade(true);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Hesap Ekle
          </button>
        )}
      </div>

      {/* Upgrade Modal */}
      {showUpgrade && (
        <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl">
          <div className="flex items-start gap-3">
            <Crown className="text-yellow-600 dark:text-yellow-400 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                Ücretsiz Plan Limiti Doldu
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                Daha fazla sosyal medya hesabı eklemek için premium plana yükseltin.
                Premium ile sınırsız sosyal medya hesabı ekleyebilirsiniz!
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUpgrade(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium"
                >
                  Kapat
                </button>
                {/* Buradaki düğmenin hiçbir işlevi yoktu (onClick yok).
                    Yükseltme paneldeki "Planı Yükselt" düğmelerinden yapılır. */}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Link Form */}
      {adding && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Yeni Sosyal Medya Hesabı</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Platform Seçin
              </label>
              <select
                value={newLink.platform}
                onChange={(e) => setNewLink({ ...newLink, platform: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
              >
                <option value="">Platform seçin...</option>
                {availablePlatforms.map(platform => (
                  <option key={platform.id} value={platform.id}>
                    {platform.name}
                  </option>
                ))}
              </select>
            </div>

            {newLink.platform && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Profil URL
                </label>
                <input
                  type="url"
                  value={newLink.url}
                  onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                  placeholder={getPlatformInfo(newLink.platform).placeholder}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                />
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={addLink}
                disabled={!newLink.platform || !newLink.url || loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Check size={18} />
                Kaydet
              </button>
              <button
                onClick={() => {
                  setAdding(false);
                  setNewLink({ platform: '', url: '' });
                }}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors font-medium"
              >
                <X size={18} />
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Links List */}
      {links.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Globe size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Henüz sosyal medya hesabı eklenmemiş</p>
          <p className="text-sm mt-1">Yukarıdaki butonu kullanarak hesap ekleyin</p>
        </div>
      ) : (
        <div className="space-y-3">
          {links.map((link) => {
            const platformInfo = getPlatformInfo(link.platform);
            const Icon = platformInfo.icon;
            const isEditing = editingId === link.id;
            
            return (
              <div
                key={link.id}
                className={`p-4 border-2 rounded-xl transition-all ${
                  isEditing 
                    ? 'border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20' 
                    : 'border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600'
                }`}
              >
                {isEditing ? (
                  // Edit Mode
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 ${platformInfo.color} rounded-lg flex items-center justify-center text-white flex-shrink-0`}>
                        <Icon size={20} />
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{platformInfo.name}</p>
                        <input
                          type="url"
                          value={editLink.url}
                          onChange={(e) => setEditLink({ ...editLink, url: e.target.value })}
                          placeholder={platformInfo.placeholder}
                          className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none text-sm"
                        />
                      </div>
                    </div>

                    {/* Başlık, öne çıkarma ve yayın süresi. Kampanya
                        bağlantısını silmeden bitirebilmek için. */}
                    <input
                      type="text"
                      maxLength={60}
                      value={editLink.etiket || ''}
                      onChange={(e) => setEditLink({ ...editLink, etiket: e.target.value })}
                      placeholder={`Başlık (boş bırakılırsa "${platformInfo.name}" yazar)`}
                      className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:border-blue-500 dark:focus:border-blue-400 outline-none text-sm"
                    />

                    <div className="grid sm:grid-cols-2 gap-3">
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={!!editLink.one_cikan}
                          onChange={(e) => setEditLink({ ...editLink, one_cikan: e.target.checked })}
                        />
                        Öne çıkar (kartta başlığıyla, en üstte)
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                        <input
                          type="checkbox"
                          checked={editLink.aktif !== false}
                          onChange={(e) => setEditLink({ ...editLink, aktif: e.target.checked })}
                        />
                        Kartta görünsün
                      </label>
                    </div>

                    <label className="block text-sm text-gray-700 dark:text-gray-300">
                      <span className="block mb-1">Yayından kalkma tarihi (isteğe bağlı)</span>
                      <input
                        type="date"
                        value={editLink.yayin_bitis || ''}
                        onChange={(e) => setEditLink({ ...editLink, yayin_bitis: e.target.value })}
                        className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg outline-none text-sm"
                      />
                      <span className="block text-xs text-gray-500 mt-1">
                        O günün sonunda kartta görünmeyi bırakır; bağlantı silinmez.
                      </span>
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => updateLink(link.id)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
                      >
                        <Check size={16} />
                        Kaydet
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors text-sm font-medium"
                      >
                        <X size={16} />
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  // View Mode
                  <div className="flex items-center gap-3 group">
                    <div className={`w-10 h-10 ${platformInfo.color} rounded-lg flex items-center justify-center text-white`}>
                      <Icon size={20} />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 dark:text-gray-100 flex flex-wrap items-center gap-1.5">
                        {link.etiket || platformInfo.name}
                        {link.one_cikan && (
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            öne çıkan
                          </span>
                        )}
                        {link.aktif === false && (
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-700">
                            kartta gizli
                          </span>
                        )}
                        {link.yayin_bitis && new Date(link.yayin_bitis) <= new Date() && (
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-700">
                            süresi doldu
                          </span>
                        )}
                        {link.yayin_bitis && new Date(link.yayin_bitis) > new Date() && (
                          <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">
                            {new Date(link.yayin_bitis).toLocaleDateString('tr-TR')} tarihine kadar
                          </span>
                        )}
                      </p>
                      <a
                        href={guvenliUrl(link.url) ?? undefined}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 truncate"
                      >
                        {link.url}
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(link)}
                        className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all"
                        title="Düzenle"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteLink(link.id)}
                        className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all"
                        title="Sil"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Limit Warning for Free Users */}
      {!sinirsiz && sinir !== null && links.length > 0 && links.length < sinir && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            💡 {sinir - links.length} sosyal medya hesabı daha ekleyebilirsiniz
          </p>
        </div>
      )}
    </div>
  );
}