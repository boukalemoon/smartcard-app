import { createClient } from '@supabase/supabase-js'
import { ozelAlanAdiMi } from './ozelAlanAdi'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

// ÖZEL ALAN ADINDA OTURUM YOK
//
// Kuralımız: kişinin kendi alan adında (kart.ornek.com.tr) yalnızca kart
// açılır; panel ve giriş QRtım adresinde kalır. Ama kural yalnızca
// YÖNLENDİRMEDE uygulanmıştı — oturum katmanı her adreste çalışmaya devam
// ediyordu:
//
//   • detectSessionInUrl varsayılan olarak AÇIK. Adres çubuğundaki
//     #access_token=… parçası o kökenin deposuna yazılır.
//   • persistSession varsayılan olarak AÇIK. Yazılan oturum orada kalır.
//
// Sonuç: özel alan adında görünmez bir oturum oluşabiliyordu — üstelik o
// adreste panel rotası olmadığı için kimse fark etmeden. Oturumun tarayıcıda
// adrese göre ayrıldığını bildiğimiz hâlde oturum katmanını her adreste açık
// bırakmak, kendi kuralımızı yalnızca yarısından uygulamak demekti.
//
// Kart hiçbir oturum gerektirmez: herkese açık RPC'lerle çalışır.
const ozelAlan = typeof window !== 'undefined' && ozelAlanAdiMi()

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    detectSessionInUrl: !ozelAlan,
    persistSession: !ozelAlan,
    autoRefreshToken: !ozelAlan,
  },
})
