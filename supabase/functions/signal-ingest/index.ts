// Sinyal ingest — Mini Ülgen'ler kullanıcı davranış/tercih sinyallerini yazar.
//
// Akış: Uygulama, SSO handshake'inde aldığı kalıcı `link_secret` ile bu uca
// POST atar. link_secret doğrulanır → (user_id, partner) çözülür → sinyaller
// user_signals tablosuna yazılır. Client'ta service key YOKtur; yazma yalnız
// gerçek (SSO'dan geçmiş) kullanıcıya bağlıdır.
//
// İstek gövdesi:
//   { "link_secret": "...", "signals": [ { "type": "play", "payload": {...} }, ... ] }
// Yanıt: { ok: true, yazilan: N }

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const MAX_SIGNALS = 200;
// Tek sinyal gövdesi için üst sınır (denetim D-14). Sinyaller davranış/tercih
// özetidir; birkaç KB'yi aşan gövde ya hata ya kötüye kullanımdır.
const MAX_PAYLOAD_BYTES = 4096;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, error: "Yalnızca POST" }, 405);

  // Gövde ayrıştırılmadan önce boyut tavanı (denetim D-14): 200 sinyal × 4 KB.
  const uzunluk = Number(req.headers.get("content-length") ?? "0");
  if (uzunluk > MAX_SIGNALS * MAX_PAYLOAD_BYTES + 16384) {
    return json({ ok: false, error: "Gövde çok büyük" }, 413);
  }

  try {
    const body = await req.json().catch(() => ({}));
    const linkSecret = body?.link_secret;
    const signals = Array.isArray(body?.signals) ? body.signals : [];

    if (!linkSecret || typeof linkSecret !== "string") {
      return json({ ok: false, error: "link_secret gerekli" }, 400);
    }
    if (!signals.length) return json({ ok: true, yazilan: 0 });
    if (signals.length > MAX_SIGNALS) {
      return json({ ok: false, error: `En fazla ${MAX_SIGNALS} sinyal` }, 413);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // link_secret → (user_id, partner)
    const { data: link, error: linkErr } = await admin
      .from("partner_user_links")
      .select("user_id, partner")
      .eq("link_secret", linkSecret)
      .maybeSingle();
    if (linkErr) return json({ ok: false, error: "Doğrulama hatası" }, 500);
    if (!link) return json({ ok: false, error: "Geçersiz link_secret" }, 401);

    // Hız sınırı (bulgu O-3). link_secret, çevrimdışı dağıtılan masaüstü
    // uygulamasında kullanıcının makinesinde duruyor; sızarsa o kullanıcı
    // adına sınırsız sinyal yazılabilirdi. İstek başına 200 sinyal sınırı
    // vardı ama istek sayısı sınırsızdı.
    //
    // 5 dakikada 60 istek: gerçek kullanımın çok üzerinde, sel için çok altında.
    const { data: allowed, error: rlErr } = await admin.rpc("check_rate_limit", {
      p_key: `signal:${link.user_id}:${link.partner}`,
      p_max: 60,
      p_window_seconds: 300,
    });
    if (rlErr) {
      // Sayaç çalışmıyorsa isteği engelleme; ama iz bırak.
      console.error("check_rate_limit hatası:", rlErr.message);
    } else if (allowed === false) {
      return json({ ok: false, error: "Çok fazla istek, sonra tekrar deneyin" }, 429);
    }

    // Sinyalleri normalize et ve yaz
    const rows = [];
    for (const s of signals) {
      const type = typeof s?.type === "string" ? s.type.slice(0, 60) : null;
      if (!type) continue;
      const payload = (s?.payload && typeof s.payload === "object") ? s.payload : {};
      if (new TextEncoder().encode(JSON.stringify(payload)).length > MAX_PAYLOAD_BYTES) continue;
      rows.push({
        user_id: link.user_id,
        partner: link.partner,
        signal_type: type,
        payload,
      });
    }
    if (!rows.length) return json({ ok: true, yazilan: 0 });

    const { error: insErr } = await admin.from("user_signals").insert(rows);
    if (insErr) return json({ ok: false, error: "Yazma hatası" }, 500);

    // Aktiflik izi
    await admin
      .from("partner_user_links")
      .update({ last_seen: new Date().toISOString() })
      .eq("link_secret", linkSecret);

    return json({ ok: true, yazilan: rows.length });
  } catch (_e) {
    // İç hata ayrıntısı dışarı verilmez.
    return json({ ok: false, error: "Beklenmeyen hata" }, 500);
  }
});
