// Banka ödeme bildirimi.
//
// DAĞITIM: verify_jwt = false (bankanın oturum belirteci yoktur).
// Bu yüzden bu uca gelen HER İSTEK sahte olabilir; tek güven kaynağı imzadır.
//
// SIRA ÖNEMLİ:
//   1. Protokol doğrulanmadıysa → hiçbir şey işleme (kapalı başarısızlık)
//   2. İmzayı doğrula → geçersizse DUR, başka hiçbir alana bakma
//   3. (Varsa) sunucudan sunucuya ikinci teyit
//   4. payment_settle → tutar kontrolü, idempotens ve hak tanımlama
//      veritabanında, tek işlemde
//   5. Kullanıcıyı sonuç sayfasına yönlendir
//
// Tarayıcının döndüğü sayfa ödemenin gerçekleştiğini KANITLAMAZ. Karar her
// zaman imzası doğrulanmış bildirimle ve veritabanındaki tutar kontrolüyle
// verilir.

import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  bildirimiDogrula,
  hazirMi,
  odemeyiSorgula,
  yapilandirmayiOku,
} from '../_shared/paynkolay.ts'

// Kart verisi hiçbir koşulda kalıcı kayda girmez (PCI DSS).
const HASSAS_ALAN = /card|kart|pan|cvv|cvc|expir|son_kullanma|sk[tu]/i

function temizle(p: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(p)) {
    out[k] = HASSAS_ALAN.test(k) ? '[gizlendi]' : String(v).slice(0, 500)
  }
  return out
}

async function parametreleriOku(req: Request): Promise<Record<string, string>> {
  const tur = req.headers.get('content-type') ?? ''
  if (tur.includes('application/json')) {
    const j = await req.json()
    return Object.fromEntries(Object.entries(j ?? {}).map(([k, v]) => [k, String(v)]))
  }
  if (tur.includes('application/x-www-form-urlencoded') || tur.includes('multipart/form-data')) {
    const f = await req.formData()
    const out: Record<string, string> = {}
    for (const [k, v] of f.entries()) out[k] = typeof v === 'string' ? v : ''
    return out
  }
  return Object.fromEntries(new URL(req.url).searchParams.entries())
}

Deno.serve(async (req: Request) => {
  const servis = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )
  // cf-connecting-ip taklit edilemez; x-forwarded-for'un ilk değeri istemcinin yazdığıdır (son çare).
  const ip = req.headers.get('cf-connecting-ip')?.trim() ||
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null
  const ua = req.headers.get('user-agent')
  const siteUrl = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://www.qartim.com').replace(/\/+$/, '')
  const tarayiciMi = (req.headers.get('accept') ?? '').includes('text/html')

  const log = (action: string, result: string, severity: string, meta: Record<string, unknown>, ref?: string | null) =>
    servis.rpc('log_event', {
      p_action: action, p_app_key: 'qrtim', p_resource_type: 'payment_intent',
      p_resource_id: ref ?? null, p_result: result, p_severity: severity,
      p_visibility: 'internal', p_meta: meta, p_actor_kind: 'service',
      p_ip: ip, p_user_agent: ua,
    })

  // Kayıt sınırı: sınırlayıcı hata verirse kaydı yaz (denetim izi kaybolmasın).
  const kayitIzni = async (anahtar: string) => {
    const { data, error } = await servis.rpc('check_rate_limit', {
      p_key: anahtar, p_max: 5, p_window_seconds: 60,
    })
    return error ? true : data !== false
  }

  const sonuc = (durum: string, niyetId?: string | null, http = 200) => {
    if (tarayiciMi) {
      const hedef = new URL(`${siteUrl}/odeme/sonuc`)
      hedef.searchParams.set('durum', durum)
      if (niyetId) hedef.searchParams.set('niyet', niyetId)
      return Response.redirect(hedef.toString(), 303)
    }
    return new Response(durum === 'odendi' || durum === 'zaten_islendi' ? 'OK' : durum, { status: http })
  }

  if (req.method !== 'POST' && req.method !== 'GET') {
    return new Response('yontem desteklenmiyor', { status: 405 })
  }

  let param: Record<string, string>
  try {
    param = await parametreleriOku(req)
  } catch {
    await log('payment.callback_unparseable', 'failure', 'warning', {})
    return sonuc('gecersiz_istek', null, 400)
  }

  // 1) KAPALI BAŞARISIZLIK
  if (!hazirMi()) {
    // Bu uç kimliksizdir (bankanın oturumu yok). Her isteğe "critical" kayıt
    // yazmak, denetim kaydını dışarıdan şişirilebilir yapıyordu (denetim D-13).
    // IP başına dakikada en çok 5 kayıt; fazlası sessizce reddedilir.
    if (await kayitIzni(`odeme-bildirim:${ip ?? 'bilinmeyen'}`)) {
      await log('payment.callback_blocked', 'denied', 'critical',
        { sebep: 'protokol_dogrulanmadi', parametreler: temizle(param) })
    }
    return sonuc('altyapi_hazir_degil', null, 503)
  }

  const yap = yapilandirmayiOku()!

  // 2) İMZA
  const b = await bildirimiDogrula(yap, param)
  if (!b.gecerli || !b.merchantRef) {
    if (await kayitIzni(`odeme-imza:${ip ?? 'bilinmeyen'}`)) {
      await log('payment.callback_invalid_signature', 'denied', 'critical',
        { parametreler: temizle(param) }, b.merchantRef)
    }
    return sonuc('dogrulanamadi', null, 400)
  }

  // 3) İKİNCİ TEYİT (sağlayıcı destekliyorsa)
  const teyit = await odemeyiSorgula(yap, b.merchantRef)
  if (teyit && (teyit.basarili !== b.basarili || teyit.tutarKurus !== b.tutarKurus)) {
    await log('payment.callback_inquiry_mismatch', 'denied', 'critical',
      { bildirim: { basarili: b.basarili, tutar: b.tutarKurus },
        sorgu: { basarili: teyit.basarili, tutar: teyit.tutarKurus } }, b.merchantRef)
    return sonuc('dogrulanamadi', null, 409)
  }

  // 4) HAK TANIMLAMA — tutar kontrolü ve idempotens veritabanında
  const { data: settle, error } = await servis.rpc('payment_settle', {
    p_merchant_ref: b.merchantRef,
    p_success: b.basarili,
    p_provider_ref: b.providerRef,
    p_raw: temizle(param),
    p_reason: b.sebep,
    p_amount_kurus: b.tutarKurus,
  })

  const { data: niyet } = await servis
    .from('payment_intents').select('id').eq('merchant_ref', b.merchantRef).maybeSingle()

  if (error) {
    await log('payment.settle_error', 'failure', 'critical', { hata: error.message }, b.merchantRef)
    return sonuc('islenemedi', niyet?.id, 500)
  }

  const s = settle as { ok: boolean; sonuc?: string; hata?: string; zaten_islendi?: boolean }
  const durum = s.zaten_islendi ? 'zaten_islendi' : (s.ok ? (s.sonuc ?? 'bilinmiyor') : (s.hata ?? 'hata'))
  return sonuc(durum, niyet?.id)
})
