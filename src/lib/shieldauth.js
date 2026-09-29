import { supabase } from './supabaseClient'

// SHIELDAUTH — iki adımlı doğrulama istemci yardımcıları
//
// Uç nokta QRtım'in kendi Supabase Edge Function'ı: ShieldAuth API anahtarı
// yalnızca orada durur, tarayıcıya hiç gelmez. Oturum localStorage'da
// tuttuğumuz için kimlik çerezle değil, her istekte erişim belirteciyle gider.
export const SHIELDAUTH_ENDPOINT = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/shieldauth`

export async function shieldauthBasliklari() {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token
    ? { Authorization: `Bearer ${token}`, apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }
    : {}
}

// Veritabanının gözünden bu oturumun durumu (yalnızca kişinin kendisi için).
// Hata → null: migration henüz uygulanmamışsa arayüz kişiyi kilitlemez; asıl
// kural zaten veritabanında.
export async function mfaDurumum() {
  const { data, error } = await supabase.rpc('shieldauth_mfa_durumum')
  if (error || !data) return null
  return data
}

// Veritabanı tetikleyicisi "mfa_required" hatası verdiğinde true.
export function mfaGerekliMi(error) {
  return error?.message === 'mfa_required'
}
