import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Check, X, AlertCircle, Loader } from 'lucide-react';

export default function UsernameEditor({ currentUsername, profileId, onUpdate }) {
  const [editing, setEditing] = useState(false);
  const [username, setUsername] = useState(currentUsername || '');
  const [checking, setChecking] = useState(false);
  const [available, setAvailable] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const validateUsername = (value) => {
    // Sadece küçük harf, rakam, alt çizgi ve tire
    const regex = /^[a-z0-9_-]+$/;
    
    if (!value) {
      return 'Username boş olamaz';
    }
    if (value.length < 3) {
      return 'Username en az 3 karakter olmalı';
    }
    if (value.length > 30) {
      return 'Username en fazla 30 karakter olabilir';
    }
    if (!regex.test(value)) {
      return 'Sadece küçük harf, rakam, - ve _ kullanılabilir';
    }
    if (value.startsWith('-') || value.startsWith('_')) {
      return 'Username - veya _ ile başlayamaz';
    }
    
    return null;
  };

  const checkAvailability = async (value) => {
    const validationError = validateUsername(value);
    
    if (validationError) {
      setError(validationError);
      setAvailable(false);
      return;
    }

    if (value === currentUsername) {
      setError('');
      setAvailable(true);
      return;
    }

    setChecking(true);
    setError('');

    try {
      const { data, error: dbError } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', value)
        .single();

      if (dbError && dbError.code !== 'PGRST116') {
        throw dbError;
      }

      if (data) {
        setError('Bu username kullanılıyor');
        setAvailable(false);
      } else {
        setAvailable(true);
      }
    } catch (err) {
      console.error('Error checking username:', err);
      setError('Kontrol edilemedi, tekrar deneyin');
      setAvailable(false);
    } finally {
      setChecking(false);
    }
  };

  const handleChange = (e) => {
    const value = e.target.value.toLowerCase().trim();
    setUsername(value);
    setAvailable(null);
    setError('');
    
    // Debounce check
    if (value) {
      const timer = setTimeout(() => {
        checkAvailability(value);
      }, 500);
      return () => clearTimeout(timer);
    }
  };

  const saveUsername = async () => {
    if (!available || error) {
      return;
    }

    setSaving(true);

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ username })
        .eq('id', profileId);

      if (updateError) throw updateError;

      alert('Username güncellendi!');
      setEditing(false);
      if (onUpdate) onUpdate(username);
    } catch (err) {
      alert('Hata: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => {
    setUsername(currentUsername || '');
    setEditing(false);
    setError('');
    setAvailable(null);
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Username</h2>
          <p className="text-sm text-gray-500 mt-1">
            Profil kartınızın URL'inde görünür
          </p>
        </div>
        {!editing && (
          <button
            onClick={() => setEditing(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
          >
            Değiştir
          </button>
        )}
      </div>

      {editing ? (
        <div className="space-y-4">
          {/* URL Preview */}
          <div className="p-3 bg-gray-50 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Profil URL'iniz:</p>
            <p className="text-sm font-mono text-gray-900">
              {window.location.origin}/card/<span className="text-blue-600 font-bold">{username || '...'}</span>
            </p>
          </div>

          {/* Input */}
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={handleChange}
              placeholder="username"
              className={`w-full px-4 py-3 pr-12 border-2 rounded-xl transition-all outline-none font-mono
                ${error ? 'border-red-300 focus:border-red-500' : 
                  available ? 'border-green-300 focus:border-green-500' : 
                  'border-gray-200 focus:border-blue-500'}`}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {checking && <Loader size={20} className="text-gray-400 animate-spin" />}
              {!checking && available && <Check size={20} className="text-green-600" />}
              {!checking && available === false && <X size={20} className="text-red-600" />}
            </div>
          </div>

          {/* Error/Success Message */}
          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {available && !error && username !== currentUsername && (
            <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <Check size={18} className="text-green-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-800">Bu username kullanılabilir!</p>
            </div>
          )}

          {/* Rules */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs font-semibold text-blue-900 mb-2">Username Kuralları:</p>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• 3-30 karakter arası olmalı</li>
              <li>• Sadece küçük harf, rakam, - ve _ kullanılabilir</li>
              <li>• - veya _ ile başlayamaz</li>
              <li>• Benzersiz olmalı</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={saveUsername}
              disabled={!available || error || saving || username === currentUsername}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {saving ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  Kaydediliyor...
                </>
              ) : (
                <>
                  <Check size={18} />
                  Kaydet
                </>
              )}
            </button>
            <button
              onClick={cancel}
              disabled={saving}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gray-500 text-white rounded-xl hover:bg-gray-600 transition-colors font-medium"
            >
              <X size={18} />
              İptal
            </button>
          </div>
        </div>
      ) : (
        <div className="p-4 bg-gray-50 rounded-xl">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Mevcut username:</p>
              <p className="text-lg font-mono font-bold text-gray-900">
                {currentUsername || 'Henüz ayarlanmamış'}
              </p>
            </div>
            {currentUsername && (
              <a
                href={`/card/${currentUsername}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 transition-colors text-sm font-medium"
              >
                Görüntüle
              </a>
            )}
          </div>
        </div>
      )}
    </div>
  );
}