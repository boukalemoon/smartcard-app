// Ödeme başlatma.
//
// İstemci önce `payment_create_intent` RPC'si ile niyet açar (tutarı SUNUCU
// belirler), sonra bu uca niyet kimliğini gönderir. Bu uç:
//   1. Kullanıcının oturumunu doğrular
//   2. Niyeti KULLANICININ yetkisiyle okur (başkasının niyetini başlatamaz)
//   3. Tutarı veritabanından alır — istemciden gelen tutar YOKTUR
//   4. İmzalı ödeme isteğini üretir (sır bu fonksiyondan dışarı çıkmaz)
//   5. Tarayıcının POST edeceği formu döndürür
//
// Protokol doğrulanmadıysa 503 döner ve HİÇBİR hak tanımlanmaz.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  hazirMi,
  odemeIstegiOlustur,
  ProtokolHazirDegil,
  yapilandirmayiOku,
} from '../_shared/paynkolay.ts'

const IZINLI_KOKENLER = new Set(
  (Deno.env.get('ALLOWED_ORIGINS') ?? 'https://www.qartim.com,https://qartim.com')
    .split(',').map((s) => s.trim()).filter(Boolean),
)

function corsBasliklari(koken: string | null): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': koken && IZINLI_KOKENLER.has(koken) ? koken : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

Deno.serve(async (req: Request) => {
  const koken = req.headers.get('origin')
  const cors = corsBasliklari(koken)
  const json = (govde: unknown, durum = 200) =>
    new Response(JSON.stringify(govde), {
      status: durum,
      headers: { ...cors, 'Content-Type': 'application/json' },
    })

  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })
  if (req.method !== 'POST') return json({ hata: 'yontem_desteklenmiyor' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const servis = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ua = req.headers.get('user-agent')

  const yetki = req.headers.get('authorization')
  if (!yetki) return json({ hata: 'oturum_yok' }, 401)

  const kullaniciIstemci = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: yetki } },
  })
  const { data: kullanici } = await kullaniciIstemci.auth.getUser()
  if (!kullanici?.user) return json({ hata: 'oturum_yok' }, 401)

  let govde: { intent_id?: string }
  try {
    govde = await req.json()
  } catch {
    return json({ hata: 'gecersiz_istek' }, 400)
  }
  if (!govde.intent_id) return json({ hata: 'niyet_kimligi_yok' }, 400)

  // KAPALI BAŞARISIZLIK
  if (!hazirMi()) {
    await servis.rpc('log_event', {
      p_action: 'payment.start_blocked', p_actor_user_id: kullanici.user.id,
      p_app_key: 'qrtim', p_resource_type: 'payment_intent', p_resource_id: govde.intent_id,
      p_result: 'denied', p_severity: 'notice', p_visibility: 'internal',
      p_meta: { sebep: 'odeme_altyapisi_hazir_degil' }, p_ip: ip, p_user_agent: ua,
    })
    return json({ hata: 'odeme_altyapisi_hazir_degil' }, 503)
  }

  // Niyeti KULLANICININ yetkisiyle oku: erişim kuralı yalnızca kendi niyetini gösterir.
  const { data: niyet, error } = await kullaniciIstemci
    .from('payment_intents')
    .select('id, merchant_ref, amount_kurus, currency, plan, period, status')
    .eq('id', govde.intent_id)
    .maybeSingle()

  if (error || !niyet) return json({ hata: 'niyet_bulunamadi' }, 404)
  if (niyet.status !== 'olusturuldu') {
    return json({ hata: 'niyet_kullanilamaz', durum: niyet.status }, 409)
  }

  const yap = yapilandirmayiOku()!
  const donusUrl = `${url}/functions/v1/payment-callback`

  try {
    const istek = await odemeIstegiOlustur(yap, niyet, donusUrl)

    const { data: isaretlendi } = await servis.rpc('payment_mark_redirected', {
      p_intent_id: niyet.id,
    })
    if (!isaretlendi) return json({ hata: 'niyet_kullanilamaz' }, 409)

    await servis.rpc('log_event', {
      p_action: 'payment.redirected', p_actor_user_id: kullanici.user.id,
      p_app_key: 'qrtim', p_resource_type: 'payment_intent', p_resource_id: niyet.id,
      p_result: 'success', p_severity: 'info', p_visibility: 'user',
      p_meta: { tutar_kurus: niyet.amount_kurus }, p_ip: ip, p_user_agent: ua,
    })

    return json({ action_url: istek.actionUrl, fields: istek.fields })
  } catch (e) {
    if (e instanceof ProtokolHazirDegil) {
      return json({ hata: 'odeme_altyapisi_hazir_degil' }, 503)
    }
    await servis.rpc('log_event', {
      p_action: 'payment.start_error', p_actor_user_id: kullanici.user.id,
      p_app_key: 'qrtim', p_resource_type: 'payment_intent', p_resource_id: niyet.id,
      p_result: 'failure', p_severity: 'warning', p_visibility: 'internal',
      p_meta: { hata: String(e) }, p_ip: ip, p_user_agent: ua,
    })
    return json({ hata: 'odeme_baslatilamadi' }, 500)
  }
})
