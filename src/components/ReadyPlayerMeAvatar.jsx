import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

export default function ReadyPlayerMeAvatar({ 
  profileId, 
  currentAvatarUrl, 
  onAvatarUpdate,
  type = 'profile'
}) {
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl)

  console.log('🎭 ReadyPlayerMe Props:', { profileId, currentAvatarUrl, avatarUrl })

// currentAvatarUrl değişince state'i güncelle
  useEffect(() => {
    setAvatarUrl(currentAvatarUrl)
  }, [currentAvatarUrl])

  const openAvatarCreator = () => {
    // Ready Player Me iframe popup aç
    const subdomain = 'demo' // veya kendi subdomain'in
    const frame = document.createElement('iframe')
    frame.src = `https://${subdomain}.readyplayer.me/avatar?frameApi`
    frame.allow = 'camera *; microphone *'
    frame.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      border: none;
      z-index: 99999;
      background: rgba(0,0,0,0.8);
    `
    
    document.body.appendChild(frame)

    // Message listener
    const handleMessage = async (event) => {
  try {
    const json = JSON.parse(event.data)

    console.log('🎭 RPM Event:', JSON.stringify(json, null, 2))
    
    if (json?.source !== 'readyplayerme') return

    // Avatar exported
    if (json.eventName === 'v1.avatar.exported') {
      const newAvatarUrl = json.data.url
      
      // Önce iframe ve close button'ı kapat
      if (document.body.contains(frame)) {
        document.body.removeChild(frame)
      }
      
      const closeBtn = document.querySelector('button[style*="position: fixed"]')
      if (closeBtn && document.body.contains(closeBtn)) {
        document.body.removeChild(closeBtn)
      }
      
      window.removeEventListener('message', handleMessage)
      
      // Sonra kaydet
      await handleAvatarCreated(newAvatarUrl)
    }

    // Subscribe to events
    if (json.eventName === 'v1.frame.ready') {
      frame.contentWindow.postMessage(
        JSON.stringify({
          target: 'readyplayerme',
          type: 'subscribe',
          eventName: 'v1.**'
        }),
        '*'
      )
    }
  } catch (error) {
    // Ignore parse errors
  }
}

    window.addEventListener('message', handleMessage)

    // Close button
    const closeBtn = document.createElement('button')
    closeBtn.innerHTML = '✕'
    closeBtn.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 999999;
      background: red;
      color: white;
      border: none;
      border-radius: 50%;
      width: 40px;
      height: 40px;
      font-size: 24px;
      cursor: pointer;
      box-shadow: 0 4px 8px rgba(0,0,0,0.3);
    `
    closeBtn.onclick = () => {
      document.body.removeChild(frame)
      document.body.removeChild(closeBtn)
      window.removeEventListener('message', handleMessage)
    }
    
    document.body.appendChild(closeBtn)
  }

  const handleAvatarCreated = async (url) => {
    console.log('💾 Saving avatar:', url, 'for profile:', profileId)
    try {
      const table = type === 'profile' ? 'profiles' : 'organizations'
      const { error } = await supabase
        .from(table)
        .update({ avatar_3d_url: url })
        .eq('id', profileId)


        
      if (error) {
        console.error('❌ Save error:', error)
        throw error
      }
    console.log('✅ Avatar saved!')
      setAvatarUrl(url)
      onAvatarUpdate?.(url)
      alert('✅ 3D Avatar oluşturuldu!')
    } catch (error) {
      console.error('Avatar save error:', error)
      alert('Hata: ' + error.message)
    }
  }

  const removeAvatar = async () => {
    if (!confirm('3D Avatar silinsin mi?')) return

    try {
      const table = type === 'profile' ? 'profiles' : 'organizations'
      const { error } = await supabase
        .from(table)
        .update({ avatar_3d_url: null })
        .eq('id', profileId)

      if (error) throw error

      setAvatarUrl(null)
      onAvatarUpdate?.(null)
      alert('✅ Avatar silindi!')
    } catch (error) {
      console.error('Remove error:', error)
      alert('Hata: ' + error.message)
    }
  }

  return (
    <div className="space-y-4 text-center">
      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
        3D Avatar
      </label>

      {avatarUrl ? (
        <div className="space-y-3 flex flex-col items-center">
          <div className="relative inline-block">
            <img 
              src={`https://models.readyplayer.me/${avatarUrl.split('/').pop().replace('.glb', '')}.png?scene=fullbody-portrait-v1`}
              alt="3D Avatar" 
              className="w-32 h-32 object-cover rounded-full border-4 border-purple-500 shadow-lg"
            />
            <button
              onClick={removeAvatar}
              className="absolute -top-2 -right-2 p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg"
            >
              ✕
            </button>
          </div>

          <button
            onClick={openAvatarCreator}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-all text-sm"
          >
            🎨 Avatar'ı Düzenle
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <button
            onClick={openAvatarCreator}
            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-semibold hover:shadow-lg transition-all"
          >
            <span className="text-2xl">🎭</span>
            <span>3D Avatar Oluştur</span>
          </button>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Ready Player Me ile kişiselleştirilmiş 3D avatar oluşturun
      </p>
    </div>
  )
}