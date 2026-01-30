import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { 
  Building2, Plus, Users, Settings, Crown,
  Edit2, Trash2, Check, X, ChevronRight
} from 'lucide-react';

const FREE_PLAN_LIMIT = 2;

export default function OrganizationManager({ profileId, subscriptionPlan }) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [newOrg, setNewOrg] = useState({
    name: '',
    type: 'company',
    description: '',
    website: '',
    email: '',
    phone: ''
  });

  const isPremium = subscriptionPlan === 'premium' || subscriptionPlan === 'business';
  const canAddMore = isPremium || organizations.length < FREE_PLAN_LIMIT;

  useEffect(() => {
    loadOrganizations();
  }, []);

  const loadOrganizations = async () => {
    try {
      // Load organizations where user is a member
      const { data, error } = await supabase
        .from('members')
        .select(`
          organization_id,
          role,
          organizations (
            id,
            name,
            type,
            description,
            logo_url,
            created_at
          )
        `)
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Extract organizations from nested structure
      const orgs = data?.map(item => ({
        ...item.organizations,
        role: item.role
      })) || [];

      setOrganizations(orgs);
    } catch (error) {
      console.error('Error loading organizations:', error);
    } finally {
      setLoading(false);
    }
  };

  const createOrganization = async () => {
    if (!newOrg.name) {
      alert('Organizasyon adı zorunludur');
      return;
    }

    if (!canAddMore) {
      setShowUpgrade(true);
      return;
    }

    try {
      setLoading(true);

      // Create organization
      const { data: orgData, error: orgError } = await supabase
        .from('organizations')
        .insert({
          name: newOrg.name,
          type: newOrg.type,
          description: newOrg.description,
          website: newOrg.website,
          email: newOrg.email,
          phone: newOrg.phone
        })
        .select()
        .single();

      if (orgError) throw orgError;

      // Add creator as admin member
      const { error: memberError } = await supabase
        .from('members')
        .insert({
          organization_id: orgData.id,
          profile_id: profileId,
          role: 'admin'
        });

      if (memberError) throw memberError;

      setNewOrg({
        name: '',
        type: 'company',
        description: '',
        website: '',
        email: '',
        phone: ''
      });
      setCreating(false);
      loadOrganizations();
      alert('Organizasyon oluşturuldu!');
    } catch (error) {
      alert('Hata: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteOrganization = async (orgId) => {
    if (!confirm('Bu organizasyonu silmek istediğinizden emin misiniz?')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('organizations')
        .delete()
        .eq('id', orgId);

      if (error) throw error;

      loadOrganizations();
      alert('Organizasyon silindi');
    } catch (error) {
      alert('Hata: ' + error.message);
    }
  };

  const getOrgTypeLabel = (type) => {
    const types = {
      company: '🏢 Şirket',
      chamber: '🏪 Esnaf Odası',
      association: '👥 Dernek',
      community: '🌐 Topluluk',
      foundation: '🏛️ Vakıf',
      union: '🤝 Sendika'
    };
    return types[type] || type;
  };

  const getRoleBadge = (role) => {
    const roles = {
      admin: { label: 'Yönetici', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
      member: { label: 'Üye', color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' }
    };
    return roles[role] || roles.member;
  };

  if (loading && !creating) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded"></div>
            <div className="h-20 bg-gray-100 dark:bg-gray-700 rounded"></div>
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
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Organizasyonlarım</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {isPremium ? (
              <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <Crown size={14} />
                Sınırsız organizasyon oluşturabilirsiniz
              </span>
            ) : (
              <span>
                {organizations.length}/{FREE_PLAN_LIMIT} organizasyon kullanıldı (Ücretsiz Plan)
              </span>
            )}
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => {
              if (canAddMore) {
                setCreating(true);
              } else {
                setShowUpgrade(true);
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            Yeni Organizasyon
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
                Daha fazla organizasyon oluşturmak için premium plana yükseltin.
                Premium ile sınırsız organizasyon yönetebilirsiniz!
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowUpgrade(false)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm font-medium"
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

      {/* Create Form */}
      {creating && (
        <div className="mb-6 p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Yeni Organizasyon Oluştur</h3>
          
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organizasyon Adı *
                </label>
                <input
                  type="text"
                  value={newOrg.name}
                  onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                  placeholder="Şirket / STK Adı"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Organizasyon Tipi
                </label>
                <select
                  value={newOrg.type}
                  onChange={(e) => setNewOrg({ ...newOrg, type: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                >
                  <option value="company">Şirket</option>
                  <option value="chamber">Esnaf Odası</option>
                  <option value="association">Dernek</option>
                  <option value="community">Topluluk</option>
                  <option value="foundation">Vakıf</option>
                  <option value="union">Sendika</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Açıklama
              </label>
              <textarea
                value={newOrg.description}
                onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })}
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                placeholder="Organizasyon hakkında kısa bilgi..."
              />
            </div>

            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={newOrg.website}
                  onChange={(e) => setNewOrg({ ...newOrg, website: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                  placeholder="https://..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={newOrg.email}
                  onChange={(e) => setNewOrg({ ...newOrg, email: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                  placeholder="info@ornek.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Telefon
                </label>
                <input
                  type="tel"
                  value={newOrg.phone}
                  onChange={(e) => setNewOrg({ ...newOrg, phone: e.target.value })}
                  className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 dark:focus:border-blue-400 transition-all outline-none"
                  placeholder="+90 555 123 4567"
                />
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={createOrganization}
                disabled={!newOrg.name || loading}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                <Check size={18} />
                Oluştur
              </button>
              <button
                onClick={() => {
                  setCreating(false);
                  setNewOrg({
                    name: '',
                    type: 'company',
                    description: '',
                    website: '',
                    email: '',
                    phone: ''
                  });
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

      {/* Organizations List */}
      {organizations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <Building2 size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-lg font-medium">Henüz organizasyon oluşturulmamış</p>
          <p className="text-sm mt-1">Yukarıdaki butonu kullanarak organizasyon oluşturun</p>
        </div>
      ) : (
        <div className="space-y-3">
          {organizations.map((org) => {
            const roleBadge = getRoleBadge(org.role);
            
            return (
              <div
                key={org.id}
                className="p-4 border-2 border-gray-100 dark:border-gray-700 rounded-xl hover:border-blue-200 dark:hover:border-blue-800 transition-all group"
              >
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                    {org.name?.charAt(0) || '?'}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                          {org.name}
                        </h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {getOrgTypeLabel(org.type)}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${roleBadge.color}`}>
                            {roleBadge.label}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {org.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                        {org.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => alert('Üye yönetimi çok yakında! Şimdilik organizasyonu oluşturabildiniz.')}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
                      >
                        <Users size={16} />
                        Üyeleri Yönet
                        <ChevronRight size={16} />
                      </button>
                      
                      {org.role === 'admin' && (
                        <>
                          <button
                            onClick={() => alert('Düzenleme özelliği çok yakında!')}
                            className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            title="Düzenle"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button
                            onClick={() => deleteOrganization(org.id)}
                            className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Sil"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Limit Warning for Free Users */}
      {!isPremium && organizations.length > 0 && organizations.length < FREE_PLAN_LIMIT && (
        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-800 dark:text-blue-300">
            💡 {FREE_PLAN_LIMIT - organizations.length} organizasyon daha oluşturabilirsiniz (Ücretsiz Plan)
          </p>
        </div>
      )}
    </div>
  );
}