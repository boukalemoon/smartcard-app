// Partner uygulamalar için: "bu e-posta QRtım'da kayıtlı mı?"
//
// Bu dosya daha önce depoda yoktu, yalnızca Supabase'de yaşıyordu (Mayıs 2026).
// 20.09.2026'da sürüm kontrolüne alındı ve sertleştirildi.
//
// NE İŞE YARAR: Partner (CRM gibi) kendi tarafında bir kişiyi QRtım hesabıyla
// eşleştirmeden önce hesabın varlığını sorar.
//
// RİSK: Bu uç bir KULLANICI SORGULAMA servisidir — e-postayı bilen, kişinin
// adını ve kullanıcı adını öğrenir. Bu yüzden:
//   • verify_jwt kapalıdır ama partner anahtarı ZORUNLUDUR (sunucudan sunucuya).
//   • Anahtar İSTEMCİYE GÖMÜLMEMELİDİR. Gömülürse bu uç herkese açık bir
//     e-posta sorgulama servisine dönüşür. (20.09: İlgezdi anahtarı
//     istemcisinde taşımadığını, bu ucu hiç çağırmadığını doğruladı.)
//   • Anahtar karşılaştırması sabit sürelidir, sorgu hız sınırlıdır ve her
//     sorgu denetim kaydına düşer (e-posta maskeli).
//
// Kullanan kalmadığı teyit edilirse bu uç tamamen kapatılacak.

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

// Sabit süreli karşılaştırma: doğru anahtarın kaç karakteri tuttuğu
// yanıt süresinden anlaşılmasın.
function esit(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let fark = 0
  for (let i = 0; i < a.length; i++) fark |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return fark === 0
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const partnerKey = req.headers.get('x-partner-key')
    const partnerSource = req.headers.get('x-partner-source')

    if (!partnerSource || !partnerKey) {
      return json({ error: 'Missing partner credentials' }, 401)
    }

    const expectedKey = PARTNER_KEYS[partnerSource]
    if (!expectedKey || !esit(expectedKey, partnerKey)) {
      return json({ error: 'Invalid partner credentials' }, 401)
    }

    const { email } = await req.json().catch(() => ({ email: null }))
    if (!email || typeof email !== 'string') {
      return json({ error: 'email required' }, 400)
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false } },
    )

    // Toplu kullanıcı taraması yapılamasın.
    const { data: izin } = await supabase.rpc('check_rate_limit', {
      p_key: `partner-check:${partnerSource}`,
      p_max: 60,
      p_window_seconds: 60,
    })
    if (izin === false) return json({ error: 'rate_limited' }, 429)

    const temizEposta = email.toLowerCase().trim()

    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, username')
      .eq('email', temizEposta)
      .maybeSingle()

    // Kimin kimi sorguladığı kayıt altında (e-posta maskeli).
    await supabase.rpc('log_event', {
      p_action: 'partner.user_lookup',
      p_actor_user_id: null,
      p_app_key: partnerSource,
      p_resource_type: 'profile',
      p_resource_id: profile?.id ?? null,
      p_result: 'success',
      p_severity: 'notice',
      p_visibility: 'internal',
      p_meta: {
        partner: partnerSource,
        eposta_maskeli: temizEposta.replace(/^(.).*(@.*)$/, '$1***$2'),
        bulundu: Boolean(profile),
      },
      p_actor_kind: 'service',
    })

    return json({
      exists: !!profile,
      name: profile?.name ?? null,
      username: profile?.username ?? null,
    })
  } catch (_err) {
    return json({ error: 'Internal error' }, 500)
  }
})
