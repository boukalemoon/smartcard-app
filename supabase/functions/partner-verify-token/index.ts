// Eski partner SSO doğrulama ucu (partner_tokens tablosu üzerinden).
//
// DURUM: Bu akış TERK EDİLMİŞ. Güncel akış partner_link_tokens tablosunu ve
// arku-link / tinga-link uçlarını kullanıyor. Ölçüm (2026-09-10):
//   partner_tokens      -> 0 satır  (hiç kullanılmamış)
//   partner_connections -> 0 satır
//   partner_link_tokens -> 5 satır  (güncel akış)
//
// Silmek yerine sertleştirildi: bir partner hâlâ bu adresi işaret ediyor
// olabilir. Uç canlı kaldığı sürece, yeni uçlarla AYNI güvenlik garantisini
// vermek zorunda — aksi halde e-posta doğrulama zorunluluğunu atlatan bir
// yan yol olurdu.
//
// Bu dosya daha önce depoda yoktu; yalnızca Supabase üzerinde yaşıyordu.
// Sürüm kontrolüne alındı.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-partner-key, x-partner-source',
}

const PARTNER_KEYS: Record<string, string> = {
  arku: Deno.env.get('ARKU_API_KEY') ?? '',
  ilgezdi: Deno.env.get('ILGEZDI_API_KEY') ?? '',
  crm: Deno.env.get('CRM_API_KEY') ?? '',
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const partnerKey = req.headers.get('x-partner-key')
    const partnerSource = req.headers.get('x-partner-source')

    if (!partnerSource || !partnerKey) {
      return json({ error: 'Missing partner credentials' }, 401)
    }

    const expectedKey = PARTNER_KEYS[partnerSource]
    if (!expectedKey || expectedKey !== partnerKey) {
      return json({ error: 'Invalid partner credentials' }, 401)
    }

    const { token } = await req.json()
    if (!token || typeof token !== 'string') {
      return json({ error: 'token required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: tokenRow } = await supabase
      .from('partner_tokens')
      .select('id, profile_id, partner_name, expires_at, used_at')
      .eq('token', token)
      .eq('partner_name', partnerSource)
      .maybeSingle()

    if (!tokenRow) return json({ valid: false, error: 'Token not found' }, 404)
    if (tokenRow.used_at) return json({ valid: false, error: 'Token already used' }, 400)

    if (new Date(tokenRow.expires_at) < new Date()) {
      await supabase.from('partner_tokens').delete().eq('id', tokenRow.id)
      return json({ valid: false, error: 'Token expired' }, 400)
    }

    // Kullanıcı profilini getir
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, user_id, name, email, username, photo_url, title, company')
      .eq('id', tokenRow.profile_id)
      .single()

    if (!profile?.user_id) {
      return json({ valid: false, error: 'Profile not found' }, 404)
    }

    // E-POSTA DOĞRULAMASI — jetonu YAKMADAN ÖNCE.
    //
    // Partner, dönen e-postayı doğrulanmış kabul edip hesabı ona bağlıyor.
    // Doğrulama dayatılmazsa saldırgan kurban@firma.com ile QRtım hesabı açıp
    // partner tarafındaki hesabı devralabilir (Arku'da S1 olarak tespit
    // edildi). Diğer uçlarla aynı garanti burada da geçerli olmalı.
    const { data: authUser } = await supabase.auth.admin.getUserById(profile.user_id)
    if (!authUser?.user?.email_confirmed_at) {
      return json({ valid: false, error: 'email_not_verified', code: 'email_not_verified' }, 403)
    }

    // Token'ı kullanıldı olarak işaretle
    await supabase
      .from('partner_tokens')
      .update({ used_at: new Date().toISOString() })
      .eq('id', tokenRow.id)

    await supabase
      .from('partner_connections')
      .upsert({
        profile_id: tokenRow.profile_id,
        partner_name: partnerSource,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'profile_id,partner_name' })

    // Döndürülen e-posta, DOĞRULANMIŞ OLANIN AYNISI olmalı. profiles.email
    // kullanıcı tarafından değiştirilebildiği için ondan okunursa denetim
    // anlamsızlaşır.
    return json({
      valid: true,
      user: {
        qrtim_user_id: profile.id,
        email: authUser.user.email ?? '',
        email_verified: true,
        name: profile.name,
        username: profile.username,
        photo_url: profile.photo_url,
        title: profile.title,
        company: profile.company,
      },
    })
  } catch {
    return json({ error: 'Internal error' }, 500)
  }
})
