import { sanitizeHtml } from '../utils/inputValidation'  // ✅ DO NOT REMOVE - Güvenli input için
import { checkLoginRateLimit } from '../utils/rateLimiting'  // ✅ DO NOT REMOVE - Login rate limiting    
import AvatarFlipCard from '../components/AvatarFlipCard'
import { trackEvent } from '../utils/analyticsHelpers'
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Mail, Phone, MapPin, Briefcase, Building, 
  Globe, Linkedin, Twitter, Instagram, Facebook,
  ExternalLink, ArrowLeft, UserPlus, Download
} from 'lucide-react';

export default function PublicCard() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [socialLinks, setSocialLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Helper: Rengi koyulaştır
  const adjustColor = (color, percent) => {
    if (!color) return '#1e40af'
    const num = parseInt(color.replace("#",""), 16)
    const amt = Math.round(2.55 * percent)
    const R = (num >> 16) + amt
    const G = (num >> 8 & 0x00FF) + amt
    const B = (num & 0x0000FF) + amt
    return "#" + (0x1000000 + (R<255?R<1?0:R:255)*0x10000 
      + (G<255?G<1?0:G:255)*0x100 
      + (B<255?B<1?0:B:255))
      .toString(16).slice(1)
  }

  useEffect(() => {
    if (username) {
      loadProfile();
    }
  }, [username]);

  const loadProfile = async () => {
    try {
      setLoading(true);

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);

      if (profileData?.id) {
        trackEvent(profileData.id, 'profile_view');
        
        await supabase
          .from('profiles')
          .update({
            card_views: (profileData.card_views || 0) + 1,
            last_viewed_at: new Date().toISOString()
          })
          .eq('id', profileData.id);
      }

      const { data: linksData } = await supabase
        .from('social_links')
        .select('*')
        .eq('profile_id', profileData.id)
        .order('created_at');

      setSocialLinks(linksData || []);
    } catch (error) {
      console.error('Profil yükleme hatası:', error);
      setError('Profil bulunamadı');
    } finally {
      setLoading(false);
    }
  };

  const getSocialIcon = (platform) => {
    const icons = {
      linkedin: <Linkedin size={20} />,
      twitter: <Twitter size={20} />,
      instagram: <Instagram size={20} />,
      facebook: <Facebook size={20} />,
      website: <Globe size={20} />
    };
    return icons[platform.toLowerCase()] || <ExternalLink size={20} />;
  };

  const downloadVCard = () => {
    if (!profile) return;

    const nameParts = (profile.name || 'Unknown').split(' ');
    const lastName = nameParts.length > 1 ? nameParts.pop() : '';
    const firstName = nameParts.join(' ') || 'Unknown';

    // vCard - RAW data, sanitize yok!
    const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${profile.name || 'Unknown'}
N:${lastName};${firstName};;;
TEL:${profile.phone || ''}
EMAIL:${profile.email || ''}
TITLE:${profile.title || ''}
ORG:${profile.company || ''}
NOTE:${profile.bio || ''}
URL:${window.location.origin}/card/${profile.username}
END:VCARD`;

    const blob = new Blob([vCard], { type: 'text/vcard;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${profile.username || 'contact'}.vcf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (profile?.id) {
      trackEvent(profile.id, 'vcard_download');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">Profil Bulunamadı</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Bu kullanıcı adı mevcut değil.</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Ana Sayfaya Dön
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
          >
            <ArrowLeft size={20} />
            <span>Ana Sayfa</span>
          </button>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            Powered by QRtım
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl overflow-hidden">
          
          {/* Profile Header */}
          <div 
            className="p-8 text-white text-center relative overflow-hidden"
            style={{
              background: `linear-gradient(to right, ${profile?.theme_color || '#3B82F6'}, ${adjustColor(profile?.theme_color || '#3B82F6', -40)})`
            }}
          >
            {profile?.background_image_url && (
              <div 
                className="absolute inset-0 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${profile.background_image_url})`,
                  opacity: 0.3
                }}
              />
            )}
            
            <div className="relative z-10">
              <AvatarFlipCard
                profileImage={profile.avatar_url}
                avatar3dUrl={profile.avatar_3d_url}
                name={profile.name || ''}
              />
             
              <h1 className="text-3xl font-bold mb-2">{sanitizeHtml(profile.name || '')}</h1>
              {profile.title && (
                <p className="text-blue-100 text-lg mb-1">{sanitizeHtml(profile.title || '')}</p>
              )}
              {profile.company && (
                <p className="text-blue-200">{sanitizeHtml(profile.company || '')}</p>
              )}
            </div>
          </div>

          {/* Contact Information */}
          <div className="p-6 space-y-4">
            {profile.bio && (
              <div className="pb-4 border-b border-gray-200 dark:border-gray-700">
                <p className="text-gray-700 dark:text-gray-300 text-center">{sanitizeHtml(profile.bio || '')}</p>
              </div>
            )}

            <div className="grid gap-3">
              {profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${profile?.theme_color}15`}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Mail size={20} style={{ color: profile?.theme_color || '#3B82F6' }} />
                  <span className="text-gray-700 dark:text-gray-300">{profile.email}</span>
                </a>
              )}

              {profile.phone && (
                <a 
                  href={`tel:${profile.phone}`}
                  className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${profile?.theme_color}15`}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  <Phone size={20} style={{ color: profile?.theme_color || '#10B981' }} />
                  <span className="text-gray-700 dark:text-gray-300">{profile.phone}</span>
                </a>
              )}
            </div>

            {/* Katalog & Dökümanlar */}
            {profile.catalog_links && profile.catalog_links.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">📁 Katalog & Dökümanlar</h3>
                <div className="grid gap-2">
                  {profile.catalog_links.map((link, index) => (
                    <a
                      key={index}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg transition-colors"
                      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${profile?.theme_color}15`}
                      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <span style={{ color: profile?.theme_color || '#6B7280' }}>📄</span>
                      <span className="text-gray-700 dark:text-gray-300 font-medium">{sanitizeHtml(link.title || '')}</span>
                      <ExternalLink className="ml-auto text-gray-400" size={16} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Hizmetler */}
            {profile.services && profile.services.length > 0 && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 mb-3">🛍️ Hizmetlerim</h3>
                <div className="grid gap-3">
                  {profile.services.map((service, index) => (
                    <div
                      key={index}
                      className="p-4 rounded-lg transition-colors"
                      style={{ backgroundColor: `${profile?.theme_color}10` }}
                    >
                      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">
                        {sanitizeHtml(service.title || '')}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {sanitizeHtml(service.description || '')}
                      </p>
                      <div className="flex items-center justify-between">
                        <span className="font-bold" style={{ color: profile?.theme_color || '#10B981' }}>
                          ₺{service.price}
                        </span>
                        {service.delivery_time && (
                          <span className="text-sm text-gray-500">⏱️ {service.delivery_time}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Google Yorum */}
            {profile.google_review_link && (
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <a 
                  href={profile.google_review_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 p-4 rounded-lg transition-all"
                  style={{
                    background: `linear-gradient(to right, ${profile?.theme_color || '#10B981'}, ${adjustColor(profile?.theme_color || '#10B981', -30)})`
                  }}
                >
                  <span className="text-white text-2xl">⭐</span>
                  <span className="text-white font-semibold">Google'da Yorum Yap</span>
                </a>
              </div>
            )}

            {/* vCard Download Button */}
            <button
              onClick={downloadVCard}
              className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 text-white rounded-xl font-semibold hover:shadow-xl transition-all"
              style={{
                background: `linear-gradient(to right, ${profile?.theme_color || '#10B981'}, ${adjustColor(profile?.theme_color || '#10B981', -30)})`
              }}
            >
              <Download size={20} />
              Kişilere Kaydet (vCard)
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 dark:text-gray-400 text-sm mb-2">
            Sen de dijital kartvizitini oluştur!
          </p>
          <button
            onClick={() => {
              const referralCode = profile?.referral_code || profile?.id;
              navigate(`/login?ref=${referralCode}`);
            }}
            className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
          >
            Ücretsiz Kaydol →
          </button>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            {sanitizeHtml(profile?.name || '')} tarafından davet edildiniz! 🎁
          </p>
        </div>
      </div>  
    </div>
  );
}
