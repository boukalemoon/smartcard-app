import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import {
  Building2, Plus, Users, Crown,
  Edit2, Trash2, Check, X, ChevronRight,
  ChevronLeft, UserPlus, UserMinus
} from 'lucide-react';

import { bildir } from '../lib/bildirim'
// Organizasyon sınırı artık kod içinde SABİT DEĞİL: plan_features tablosundan
// (my_plan_limits) okunur. Eski harita sunucudaki kuralla çelişiyordu ve
// öğrenci planına ücretsizden az hak veriyordu.

// TOPLU İNDİRİM VAADİ KALDIRILDI (18.09.2026)
// Ekran "10 üyeye ulaştınız, %20 indirim aktif edildi, bir sonraki ödemede
// otomatik uygulanacak" diyordu. Ödeme akışında böyle bir indirim YOK:
// yalnızca organizations.bulk_discount_active bayrağı doluyordu, fiyat
// hesabına hiç girmiyordu. Verilmeyen indirimi vaat etmek yerine metin
// kaldırıldı; fiyat/paket revizyonunda gerçekten uygulanırsa geri gelir.

export default function OrganizationManager({ profileId }) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  const [selectedOrg, setSelectedOrg] = useState(null);
  const [members, setMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);

  const [editingOrg, setEditingOrg] = useState(null);
  const [editForm, setEditForm] = useState({});

  const [newOrg, setNewOrg] = useState({
    name: '',
    type: 'company',
    description: '',
    website: '',
    email: '',
    phone: ''
  });

  const [planBilgisi, setPlanBilgisi] = useState(null)
  const orgLimit = planBilgisi?.sinir?.organizasyon ?? 2
  // Sunucu YÖNETİCİLİK sayar (başkasının kurumuna üye olmak hakkı tüketmez).
  const yonettigim = organizations.filter(o => o.role === 'admin').length
  const canAddMore = yonettigim < orgLimit

  useEffect(() => {
    loadOrganizations();
    supabase.rpc('my_plan_limits').then(({ data, error }) => {
      if (error) { console.error('Plan sınırları alınamadı:', error); return }
      if (data?.ok) setPlanBilgisi(data)
    });
  }, []);

  const loadOrganizations = async () => {
    try {
      const { data, error } = await supabase
        .from('members')
        .select(`
          organization_id,
          role,
          organizations (
            id, name, type, description,
            logo_url, website, email, phone, created_at
          )
        `)
        .eq('profile_id', profileId)
        .order('created_at', { ascending: false });

      if (error) throw error;

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

  const loadMembers = async (orgId) => {
    setMembersLoading(true);
    try {
      // Başka kullanıcıların profili istemciden okunamaz (gizlilik). Üye bilgisi
      // sunucudan, kişinin paylaşım tercihlerine göre süzülerek gelir: e-postasını
      // gizli tutan üyenin e-postası burada da görünmez.
      const { data, error } = await supabase.rpc('org_member_list', { p_org_id: orgId });
      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setMembersLoading(false);
    }
  };

  const openMemberManager = (org) => {
    setSelectedOrg(org);
    loadMembers(org.id);
  };

  const closeMemberManager = () => {
    setSelectedOrg(null);
    setMembers([]);
    setInviteEmail('');
  };

  const UYE_EKLEME_HATALARI = {
    yetkisiz: 'Bu organizasyona davet göndermek için yönetici olmanız gerekiyor.',
    kullanici_bulunamadi: 'Bu e-posta adresiyle doğrulanmış bir QRtım hesabı bulunamadı.\n\nKişinin önce hesap oluşturup e-postasını doğrulaması gerekiyor.',
    zaten_uye: 'Bu kişi zaten organizasyon üyesi.',
    davet_zaten_gonderildi: 'Bu kişiye davet zaten gönderilmiş, yanıtı bekleniyor.',
    cok_fazla_deneme: 'Çok fazla deneme yaptınız. Lütfen bir saat sonra tekrar deneyin.',
  };

  const inviteMember = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);

    try {
      // Arama, yetki kontrolü ve ekleme sunucuda tek adımda. Toplu indirim
      // bayrağı artık istemciden yazılmıyor; üye sayısından sunucuda türetiliyor.
      const { data, error } = await supabase.rpc('org_add_member_by_email', {
        p_org_id: selectedOrg.id,
        p_email: inviteEmail.trim(),
      });
      if (error) throw error;
      if (!data?.ok) {
        bildir(UYE_EKLEME_HATALARI[data?.hata] || 'Üye eklenemedi.');
        return;
      }

      const ad = data.ad || inviteEmail.trim();
      // Üyelik artık kişinin onayıyla başlıyor; "eklendi" demek yanlış olurdu.
      bildir(`${ad} kişisine davet gönderildi.\n\nKişi kendi panelinden kabul ettiğinde üye olacak.`);

      setInviteEmail('');
      loadMembers(selectedOrg.id);
    } catch (error) {
      bildir('Hata: ' + error.message);
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberId, memberName) => {
    if (!confirm(`${memberName} adlı üyeyi organizasyondan çıkarmak istediğinizden emin misiniz?`)) return;
    try {
      const { data, error } = await supabase.from('members').delete().eq('id', memberId).select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        bildir('Üye çıkarılamadı. Yönetici olmanız gerekiyor; son yönetici ise önce başka bir yönetici atayın.');
        return;
      }
      loadMembers(selectedOrg.id);
    } catch (error) {
      bildir('Hata: ' + error.message);
    }
  };

  const changeRole = async (memberId, newRole) => {
    try {
      const { data, error } = await supabase.from('members').update({ role: newRole }).eq('id', memberId).select('id');
      if (error) throw error;
      if (!data || data.length === 0) {
        bildir('Rol değiştirilemedi. Yönetici olmanız gerekiyor; son yöneticiyi düşüremezsiniz.');
        return;
      }
      loadMembers(selectedOrg.id);
    } catch (error) {
      bildir('Hata: ' + error.message);
    }
  };

  // Sunucu tarafı hata kodlarının kullanıcıya gösterilecek karşılıkları
  const KURUM_HATALARI = {
    profil_yok:    'Profiliniz henüz hazır değil. Sayfayı yenileyip tekrar deneyin.',
    ad_zorunlu:    'Organizasyon adı zorunludur.',
    ayni_isim_var: 'Bu isimde bir organizasyonunuz zaten var.',
    limit_asildi:  'Planınızın organizasyon sınırına ulaştınız.',
  };

  const createOrganization = async () => {
    if (!newOrg.name) { bildir('Organizasyon adı zorunludur'); return; }
    if (!canAddMore) { setShowUpgrade(true); return; }

    try {
      setLoading(true);

      // Kurum ve kurucu üyelik TEK işlemde oluşturulur.
      // Eskiden iki ayrı yazma yapılıyordu ve arada işlem yoktu: ikinci adım
      // patlayınca kurum kaydı zaten kaydedilmiş oluyor, arayüz kurumları
      // üyelik üzerinden listelediği için kullanıcı hiçbir şey görmüyor ve
      // tekrar deniyordu. Her deneme bir yetim kurum bırakıyordu (33 kurumun
      // 24'ü bu şekilde oluşmuş). Limit kontrolü de artık sunucuda.
      const { data, error } = await supabase.rpc('create_organization', {
        p_name: newOrg.name,
        p_type: newOrg.type,
        p_description: newOrg.description || null,
        p_website: newOrg.website || null,
        p_email: newOrg.email || null,
        p_phone: newOrg.phone || null,
      });

      if (error) throw error;

      if (!data?.ok) {
        if (data?.hata === 'limit_asildi') { setShowUpgrade(true); return; }
        bildir(KURUM_HATALARI[data?.hata] ?? 'Organizasyon oluşturulamadı.');
        return;
      }

      setNewOrg({ name: '', type: 'company', description: '', website: '', email: '', phone: '' });
      setCreating(false);
      loadOrganizations();
      bildir('Organizasyon oluşturuldu!');
    } catch (error) {
      console.error('Organizasyon oluşturma hatası:', error);
      bildir('Organizasyon oluşturulamadı. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };

  const startEditing = (org) => {
    setEditingOrg(org.id);
    setEditForm({
      name: org.name || '',
      type: org.type || 'company',
      description: org.description || '',
      website: org.website || '',
      email: org.email || '',
      phone: org.phone || ''
    });
  };

 const saveEdit = async (orgId) => {
  try {
    const { error } = await supabase
      .from('organizations')
      .update({
        name: editForm.name,
        type: editForm.type,
        description: editForm.description,
        website: editForm.website,
        email: editForm.email,
        phone: editForm.phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', orgId)
      
    if (error) throw error
    
    // Local state'i de güncelle
    setOrganizations(prev => prev.map(org => 
      org.id === orgId ? { ...org, ...editForm } : org
    ))
    setEditingOrg(null)
    bildir('Organizasyon güncellendi!')
  } catch (error) {
    console.error('Save error:', error)
    bildir('Hata: ' + error.message)
  }
}

  const deleteOrganization = async (orgId) => {
    if (!confirm('Bu organizasyonu silmek istediğinizden emin misiniz?')) return;
    try {
      const { error } = await supabase.from('organizations').delete().eq('id', orgId);
      if (error) throw error;
      loadOrganizations();
    } catch (error) {
      bildir('Hata: ' + error.message);
    }
  };

  const getOrgTypeLabel = (type) => {
    const types = {
      company: 'Şirket',
      chamber: 'Esnaf Odası',
      association: 'Dernek',
      community: 'Topluluk',
      foundation: 'Vakıf',
      union: 'Sendika'
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

  // ÜYE YÖNETİMİ EKRANI
  if (selectedOrg) {

    return (
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={closeMemberManager}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Üye Yönetimi</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">{selectedOrg.name}</p>
          </div>
        </div>

        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">{members.length} üye</p>
        </div>

        {/* Üye Davet */}
        {selectedOrg.role === 'admin' && (
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <UserPlus size={18} className="text-blue-600" />
              Üye Ekle
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Eklemek istediğiniz kişinin QRtım hesabında kayıtlı email adresini girin.
            </p>
            <div className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && inviteMember()}
                placeholder="ornek@email.com"
                className="flex-1 px-4 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:border-blue-500 outline-none"
              />
              <button
                onClick={inviteMember}
                disabled={inviting || !inviteEmail.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 font-medium"
              >
                {inviting ? '...' : 'Ekle'}
              </button>
            </div>
          </div>
        )}

        {/* Üye Listesi */}
        {membersLoading ? (
          <div className="text-center py-8 text-gray-400">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
            <p className="text-sm">Üyeler yükleniyor...</p>
          </div>
        ) : members.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Users size={40} className="mx-auto mb-2 opacity-40" />
            <p>Henüz üye yok</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">Toplam {members.length} üye</p>
            {members.map((member) => {
              const roleBadge = getRoleBadge(member.role);
              const isCurrentUser = member.is_me;
              return (
                <div key={member.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-xl">
                  <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {member.name?.charAt(0) || member.email?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm truncate">
                      {member.name || 'İsimsiz'}
                      {isCurrentUser && <span className="ml-1 text-xs text-gray-400">(Siz)</span>}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.email}</p>
                    {member.title && (
                      <p className="text-xs text-gray-400 truncate">{member.title}</p>
                    )}
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${roleBadge.color}`}>
                    {roleBadge.label}
                  </span>
                  {selectedOrg.role === 'admin' && !isCurrentUser && (
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {member.role === 'member' ? (
                        <button onClick={() => changeRole(member.id, 'admin')} title="Yönetici yap" className="p-1.5 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors">
                          <Crown size={14} />
                        </button>
                      ) : (
                        <button onClick={() => changeRole(member.id, 'member')} title="Üye yap" className="p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-lg transition-colors">
                          <Users size={14} />
                        </button>
                      )}
                      <button onClick={() => removeMember(member.id, member.name || member.email)} title="Üyeyi çıkar" className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <UserMinus size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ANA EKRAN
  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Organizasyonlarım</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {orgLimit === 999 ? (
              <span className="flex items-center gap-1 text-yellow-600 dark:text-yellow-400">
                <Crown size={14} /> Sınırsız organizasyon
              </span>
            ) : (
              <span>{organizations.length}/{orgLimit} organizasyon kullanıldı</span>
            )}
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => canAddMore ? setCreating(true) : setShowUpgrade(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} /> Yeni Organizasyon
          </button>
        )}
      </div>

      {/* Upgrade uyarısı */}
      {showUpgrade && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl">
          <div className="flex items-start gap-3">
            <Crown className="text-yellow-600 dark:text-yellow-400 mt-1" size={24} />
            <div className="flex-1">
              <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-1">
                Plan limiti doldu
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
                {`Planınızda ${orgLimit} organizasyon yönetebilirsiniz. Daha fazlası için planınızı yükseltin.`}
              </p>
              <button
                onClick={() => setShowUpgrade(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Oluşturma Formu */}
      {creating && (
        <div className="mb-6 p-6 bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-800 rounded-xl">
          <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Yeni Organizasyon Oluştur</h3>
          <div className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Organizasyon Adı *</label>
                <input type="text" value={newOrg.name} onChange={(e) => setNewOrg({ ...newOrg, name: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="Şirket / STK Adı" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Tip</label>
                <select value={newOrg.type} onChange={(e) => setNewOrg({ ...newOrg, type: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none">
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Açıklama</label>
              <textarea value={newOrg.description} onChange={(e) => setNewOrg({ ...newOrg, description: e.target.value })} rows={3} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="Organizasyon hakkında kısa bilgi..." />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Website</label>
                <input type="url" value={newOrg.website} onChange={(e) => setNewOrg({ ...newOrg, website: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Email</label>
                <input type="email" value={newOrg.email} onChange={(e) => setNewOrg({ ...newOrg, email: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="info@ornek.com" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Telefon</label>
                <input type="tel" value={newOrg.phone} onChange={(e) => setNewOrg({ ...newOrg, phone: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none" placeholder="+90 555 123 4567" />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={createOrganization} disabled={!newOrg.name || loading} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 font-medium">
                <Check size={18} /> Oluştur
              </button>
              <button onClick={() => { setCreating(false); setNewOrg({ name: '', type: 'company', description: '', website: '', email: '', phone: '' }); }} className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors font-medium">
                <X size={18} /> İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Organizasyon Listesi */}
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
            const isEditing = editingOrg === org.id;

            return (
              <div key={org.id} className="p-4 border-2 border-gray-100 dark:border-gray-700 rounded-xl hover:border-blue-200 dark:hover:border-blue-800 transition-all">
                {isEditing ? (
                  <div className="space-y-3">
                    <input type="text" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} className="w-full px-3 py-2 border-2 border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg outline-none font-semibold" placeholder="Organizasyon adı" />
                    <textarea value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} rows={2} className="w-full px-3 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg outline-none text-sm" placeholder="Açıklama" />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="url" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} className="px-3 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg outline-none text-sm" placeholder="Website" />
                      <input type="email" value={editForm.email} onChange={(e) => setEditForm({ ...editForm, email: e.target.value })} className="px-3 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg outline-none text-sm" placeholder="Email" />
<input type="tel" value={editForm.phone} 
  onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} 
  className="px-3 py-2 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg outline-none text-sm" 
  placeholder="Telefon" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(org.id)} className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium"><Check size={14} /> Kaydet</button>
                      <button onClick={() => setEditingOrg(null)} className="flex items-center gap-1 px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm font-medium"><X size={14} /> İptal</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-4">
                    <div className="w-16 h-16 bg-blue-600 rounded-xl flex items-center justify-center text-white font-bold text-2xl flex-shrink-0">
                      {org.name?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">{org.name}</h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-gray-600 dark:text-gray-400">{getOrgTypeLabel(org.type)}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${roleBadge.color}`}>{roleBadge.label}</span>
                          </div>
                        </div>
                      </div>
                      {org.description && <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">{org.description}</p>}
                      <div className="flex items-center gap-2">
                        <button onClick={() => openMemberManager(org)} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors">
                          <Users size={16} /> Üyeleri Yönet <ChevronRight size={16} />
                        </button>
                        {org.role === 'admin' && (
                          <>
                            <button onClick={() => startEditing(org)} className="p-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors" title="Düzenle">
                              <Edit2 size={18} />
                            </button>
                            <button onClick={() => deleteOrganization(org.id)} className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors" title="Sil">
                              <Trash2 size={18} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!canAddMore && orgLimit !== 999 && (
        <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
          <p className="text-sm text-yellow-800 dark:text-yellow-300">
            Plan limitine ulaştınız ({orgLimit} organizasyon). Daha fazlası için planınızı yükseltin.
          </p>
        </div>
      )}
    </div>
  );
}