import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Linkedin, Facebook, Twitter, Instagram, Youtube, 
  Github, Globe, Twitch, Music, Camera, Send,
  Plus, Trash2, ExternalLink, Check, X, Crown
} from 'lucide-react';

const SOCIAL_PLATFORMS = [
  { id: 'linkedin', name: 'LinkedIn', icon: Linkedin, placeholder: 'https://linkedin.com/in/username', color: 'bg-blue-600' },
  { id: 'facebook', name: 'Facebook', icon: Facebook, placeholder: 'https://facebook.com/username', color: 'bg-blue-700' },
  { id: 'twitter', name: 'Twitter/X', icon: Twitter, placeholder: 'https://twitter.com/username', color: 'bg-black' },
  { id: 'instagram', name: 'Instagram', icon: Instagram, placeholder: 'https://instagram.com/username', color: 'bg-pink-600' },
  { id: 'youtube', name: 'YouTube', icon: Youtube, placeholder: 'https://youtube.com/@username', color: 'bg-red-600' },
  { id: 'tiktok', name: 'TikTok', icon: Music, placeholder: 'https://tiktok.com/@username', color: 'bg-black' },
  { id: 'pinterest', name: 'Pinterest', icon: Camera, placeholder: 'https://pinterest.com/username', color: 'bg-red-700' },
  { id: 'twitch', name: 'Twitch', icon: Twitch, placeholder: 'https://twitch.tv/username', color: 'bg-purple-600' },
  { id: 'kick', name: 'Kick', icon: Send, placeholder: 'https://kick.com/username', color: 'bg-green-500' },
  { id: 'snapchat', name: 'Snapchat', icon: Camera, placeholder: 'https://snapchat.com/add/username', color: 'bg-yellow-400' },
  { id: 'github', name: 'GitHub', icon: Github, placeholder: 'https://github.com/username', color: 'bg-gray-800' },
  { id: 'website', name: 'Website', icon: Globe, placeholder: 'https://yourwebsite.com', color: 'bg-gray-600' },
];

const FREE_PLAN_LIMIT = 3;

export default function SocialLinksManager({ profileId, subscriptionPlan }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [newLink, setNewLink] = useState({ platform: '', url: '' });
  const [editLink, setEditLink] = useState({ platform: '', url: '' });
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isPremium = subscriptionPlan === 'premium' || subscriptionPlan === 'business';
  const canAddMore = isPremium || links.length < FREE_PLAN_LIMIT;

  useEffect(() => {
    if (profileId) loadLinks();
  }, [profileId]);

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

    try {
      setLoading(true);

      const { error } = await supabase
        .from('social_links')
        .insert({
          profile_id: profileId,
          platform: newLink.platform,
          url: newLink.url,
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
      const { error } = await supabase
        .from('social_links')
        .delete()
        .eq('id', id);

      if (error) throw error;

      loadLinks();
      alert('Sosyal medya hesabı silindi');
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  const startEdit = (link) => {
    setEditingId(link.id);
    setEditLink({ platform: link.platform, url: link.url });
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

    try {
      setLoading(true);

      const { error } = await supabase
        .from('social_links')
        .update({
          url: editLink.url
        })
        .eq('id', id);

      if (error) throw error;

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
      <div className="bg-white rounded-2xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-12 bg-gray-100 rounded"></div>
            <div className="h-12 bg-gray-100 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Sosyal Medya Hesapları</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isPremium ? (
              <span className="flex items-center gap-1 text-yellow-600">
                <Crown size={14} />
                Sınırsız hesap ekleyebilirsiniz
              </span>
            ) : (
              <span>
                {links.length}/{FREE_PLAN_LIMIT} hesap kullanıldı (Ücretsiz Plan)
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
        <div className="mb-6 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300 rounded-xl">
          <div className="flex items-start gap-3">
            <Crown className="text-yellow-600 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 mb-1">
                Ücretsiz Plan Limiti Doldu
              </h3>
              <p className="text-sm text-gray-700 mb-3">
                Daha fazla sosyal medya hesabı eklemek için premium plana yükseltin.
                Premium ile sınırsız sosyal medya hesabı ekleyebilirsiniz!
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUpgrade(false)}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm font-medium"
                >
                  Kapat
                </button>
                <button
                  className="px-4 py-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white rounded-lg hover:shadow-lg text-sm font-medium"
                >
                  Premium'a Yükselt
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add New Link Form */}
      {adding && (
        <div className="mb-6 p-4 bg-blue-50 border-2 border-blue-200 rounded-xl">
          <h3 className="font-semibold text-gray-900 mb-3">Yeni Sosyal Medya Hesabı</h3>
          
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Platform Seçin
              </label>
              <select
                value={newLink.platform}
                onChange={(e) => setNewLink({ ...newLink, platform: e.target.value })}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 transition-all outline-none"
              >
                <option value="">Platform seçin...</option>
                {availablePlatforms.map(platform => {
                  const Icon = platform.icon;
                  return (
                    <option key={platform.id} value={platform.id}>
                      {platform.name}
                    </option>
                  );
                })}
              </select>
            </div>

            {newLink.platform && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Profil URL
                </label>
                <input
                  type="url"
                  value={newLink.url}
                  onChange={(e) => setNewLink({ ...newLink, url: e.target.value })}
                  placeholder={getPlatformInfo(newLink.platform).placeholder}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 transition-all outline-none"
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
                  isEditing ? 'border-blue-300 bg-blue-50' : 'border-gray-100 hover:border-gray-200'
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
                        <p className="font-semibold text-gray-900 mb-2">{platformInfo.name}</p>
                        <input
                          type="url"
                          value={editLink.url}
                          onChange={(e) => setEditLink({ ...editLink, url: e.target.value })}
                          placeholder={platformInfo.placeholder}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-blue-500 transition-all outline-none text-sm"
                        />
                      </div>
                    </div>
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
                      <p className="font-semibold text-gray-900">{platformInfo.name}</p>
                      <a
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1 truncate"
                      >
                        {link.url}
                        <ExternalLink size={12} />
                      </a>
                    </div>

                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => startEdit(link)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="Düzenle"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => deleteLink(link.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-all"
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
      {!isPremium && links.length > 0 && links.length < FREE_PLAN_LIMIT && (
        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
          <p className="text-sm text-blue-800">
            💡 {FREE_PLAN_LIMIT - links.length} sosyal medya hesabı daha ekleyebilirsiniz (Ücretsiz Plan)
          </p>
        </div>
      )}
    </div>
  );
}