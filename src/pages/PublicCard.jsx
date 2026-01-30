import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { 
  Mail, Phone, MapPin, Briefcase, Building, 
  Globe, Linkedin, Twitter, Instagram, Facebook,
  ExternalLink, ArrowLeft, UserPlus
} from 'lucide-react';

export default function PublicCard() {
  const { username } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [socialLinks, setSocialLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadProfile();
    trackView();
  }, [username]);

  const loadProfile = async () => {
    try {
      // Load profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('username', username)
        .single();

      if (profileError) throw profileError;

      setProfile(profileData);

      // Load social links
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

  const trackView = async () => {
    try {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('id, card_views')
        .eq('username', username)
        .single();

      if (profileData) {
        await supabase
          .from('profiles')
          .update({
            card_views: (profileData.card_views || 0) + 1,
            last_viewed_at: new Date().toISOString()
          })
          .eq('id', profileData.id);
      }
    } catch (error) {
      console.error('View tracking hatası:', error);
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

  const saveContact = () => {
    if (!profile) return;

    // Create vCard format
    const vCard = `BEGIN:VCARD
VERSION:3.0
FN:${profile.full_name}
TEL:${profile.phone || ''}
EMAIL:${profile.email || ''}
TITLE:${profile.title || ''}
ORG:${profile.company || ''}
ADR:;;${profile.location || ''};;;;
URL:${profile.website || ''}
END:VCARD`;

    const blob = new Blob([vCard], { type: 'text/vcard' });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${profile.username}.vcf`;
    link.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">❌</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Profil Bulunamadı</h1>
          <p className="text-gray-600 mb-6">Bu kullanıcı adı mevcut değil.</p>
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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-600 hover:text-gray-800"
          >
            <ArrowLeft size={20} />
            <span>Ana Sayfa</span>
          </button>
          <div className="text-sm text-gray-500">
            Powered by SmartCard
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Profile Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8 text-white text-center">
            <div className="w-32 h-32 mx-auto mb-4 rounded-full bg-white flex items-center justify-center text-5xl font-bold text-blue-600 shadow-lg">
              {profile.full_name?.charAt(0) || '?'}
            </div>
            <h1 className="text-3xl font-bold mb-2">{profile.full_name}</h1>
            {profile.title && (
              <p className="text-blue-100 text-lg mb-1">{profile.title}</p>
            )}
            {profile.company && (
              <p className="text-blue-200">{profile.company}</p>
            )}
          </div>

          {/* Contact Information */}
          <div className="p-6 space-y-4">
            {profile.bio && (
              <div className="pb-4 border-b border-gray-200">
                <p className="text-gray-700 text-center">{profile.bio}</p>
              </div>
            )}

            <div className="grid gap-3">
              {profile.email && (
                <a
                  href={`mailto:${profile.email}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Mail className="text-blue-600" size={20} />
                  <span className="text-gray-700">{profile.email}</span>
                </a>
              )}

              {profile.phone && (
                <a
                  href={`tel:${profile.phone}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Phone className="text-green-600" size={20} />
                  <span className="text-gray-700">{profile.phone}</span>
                </a>
              )}

              {profile.location && (
                <div className="flex items-center gap-3 p-3 rounded-lg">
                  <MapPin className="text-red-600" size={20} />
                  <span className="text-gray-700">{profile.location}</span>
                </div>
              )}

              {profile.website && (
                <a
                  href={profile.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Globe className="text-purple-600" size={20} />
                  <span className="text-gray-700">{profile.website}</span>
                  <ExternalLink className="ml-auto text-gray-400" size={16} />
                </a>
              )}
            </div>

            {/* Social Links */}
            {socialLinks.length > 0 && (
              <div className="pt-4 border-t border-gray-200">
                <h3 className="font-semibold text-gray-800 mb-3">Sosyal Medya</h3>
                <div className="grid gap-2">
                  {socialLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <span className="text-gray-600">
                        {getSocialIcon(link.platform)}
                      </span>
                      <span className="text-gray-700 capitalize">{link.platform}</span>
                      <ExternalLink className="ml-auto text-gray-400" size={16} />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Action Button */}
            <button
              onClick={saveContact}
              className="w-full mt-6 flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              <UserPlus size={20} />
              Rehbere Ekle
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center">
          <p className="text-gray-600 text-sm mb-2">
            Sen de dijital kartvizitini oluştur!
          </p>
          <button
            onClick={() => navigate('/register')}
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Ücretsiz Kaydol →
          </button>
        </div>
      </div>
    </div>
  );
}