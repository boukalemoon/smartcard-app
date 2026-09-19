// İlgezdi — QR ile tarayıcı girişi (QRtım entegrasyonu)
//
// Bu dosya daha önce yalnızca Supabase'de yaşıyordu; 20.09.2026'da sürüm
// kontrolüne alındı ve sertleştirildi.
//
// Akış:
//  1. Tarayıcı  → { action: "create", v: 2, device_label? }
//                 ← { session_token, client_secret, expires_at }
//     (v: 2 göndermeyen eski istemci client_secret ALMAZ; geçiş dönemi.)
//     session_token QR'a basılır; client_secret TARAYICIDA kalır, QR'a girmez.
//  2. QRtım     → { action: "inspect", session_token }   (Authorization: kullanıcı JWT)
//                 ← { requester_label, created_at, expires_at }
//     Onay ekranı isteğin hangi cihazdan geldiğini gösterir.
//  3. QRtım     → { action: "approve", session_token }   (Authorization: kullanıcı JWT)
//  4. Tarayıcı  → { action: "status", session_token, client_secret }  (yoklama)
//                 onaylanınca tek kullanımlık magiclink token_hash döner;
//                 tarayıcı /auth/v1/verify ile GERÇEK Supabase oturumu alır.
//
// NEDEN client_secret (İlgezdi O-05): QR'daki session_token eskiden status
// sorgusunun TEK sırrıydı. QR'ı gören herkes (ekran paylaşımı, fotoğraf,
// omuz üstü) yoklama yapıp, gerçek kullanıcı telefondan onayladığı anda
// oturumu kapabiliyordu — hesap ele geçirme.
//
// GEÇİŞ DÖNEMİ: client_secret göndermeyen eski İlgezdi sürümleri çalışmaya
// devam eder (o oturumlarda sır özeti boştur). İlgezdi yeni sürüme geçince
// ILGEZDI_QR_STRICT=true yapılır ve sırsız oturumlar reddedilir.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const STRICT = Deno.env.get("ILGEZDI_QR_STRICT") === "true";

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Sabit süreli karşılaştırma: iki özetin ne kadar benzediği zamanlamadan
// anlaşılmasın.
function esit(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let fark = 0;
  for (let i = 0; i < a.length; i++) fark |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return fark === 0;
}

function rastgeleHex(bayt = 32): string {
  const a = new Uint8Array(bayt);
  crypto.getRandomValues(a);
  return Array.from(a).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function istemciIp(req: Request): string {
  return (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "bilinmeyen";
}

async function sinirIcinde(anahtar: string, en_cok: number, pencere_sn: number): Promise<boolean> {
  const { data, error } = await admin.rpc("check_rate_limit", {
    p_key: anahtar, p_max: en_cok, p_window_seconds: pencere_sn,
  });
  // Sınırlayıcı hata verirse hizmeti kesmeyiz; ama sonucu "izin yok" diye
  // okumak yerine açıkça izin veririz ki kullanıcı kilitlenmesin.
  if (error) return true;
  return data !== false;
}

async function kullaniciyiAl(req: Request) {
  const jwt = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data, error } = await admin.auth.getUser(jwt);
  if (error || !data?.user) return null;
  return data.user;
}

function cihazEtiketi(ham: unknown, req: Request): string {
  const temiz = typeof ham === "string"
    ? ham.replace(/[\u0000-\u001f<>]/g, "").trim().slice(0, 60)
    : "";
  if (temiz) return temiz;
  const ua = req.headers.get("user-agent") ?? "";
  const isletim = /Windows/i.test(ua) ? "Windows" : /Mac OS/i.test(ua) ? "macOS" : /Linux/i.test(ua) ? "Linux" : "";
  return isletim ? `İlgezdi · ${isletim}` : "İlgezdi tarayıcısı";
}

async function denetim(action: string, userId: string | null, meta: Record<string, unknown>) {
  await admin.rpc("log_event", {
    p_action: action,
    p_actor_user_id: userId,
    p_app_key: "ilgezdi",
    p_resource_type: "qr_session",
    p_result: "success",
    p_severity: "notice",
    p_visibility: "user",
    p_meta: meta,
    p_actor_kind: userId ? "user" : "service",
    p_subject: userId,
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { action?: string; session_token?: string; client_secret?: string; device_label?: string; v?: number };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { action, session_token } = body;
  const ip = istemciIp(req);

  // ── 1) Tarayıcı: yeni QR oturumu ─────────────────────────────────────────
  if (action === "create") {
    // Kimliksiz uç: tabloyu şişirmeye karşı IP başına sınır.
    if (!(await sinirIcinde(`qr-create:${ip}`, 10, 60))) {
      return json({ error: "rate_limited" }, 429);
    }

    // Eski oturumlar birikmesin (hiç sorgulanmayan 'pending' satırlar
    // eskiden sonsuza kadar kalıyordu).
    admin.from("ilgezdi_qr_sessions")
      .delete()
      .lt("created_at", new Date(Date.now() - 24 * 3600 * 1000).toISOString())
      .then(() => {}, () => {});

    // Sır yalnızca yeni protokolü bildiren istemciye verilir (v: 2). Bugünkü
    // İlgezdi sürümü sırrı bilmez ve yoklamada göndermez; ona da sır
    // atansaydı her yoklaması reddedilir, QR girişi tamamen bozulurdu.
    const yeniIstemci = body.v === 2;
    if (!yeniIstemci && STRICT) {
      return json({ error: "client_update_required" }, 400);
    }
    const client_secret = yeniIstemci ? rastgeleHex(32) : null;

    const { data, error } = await admin
      .from("ilgezdi_qr_sessions")
      .insert({
        status: "pending",
        client_secret_hash: client_secret ? await sha256Hex(client_secret) : null,
        requester_label: cihazEtiketi(body.device_label, req),
      })
      .select("session_token, expires_at")
      .single();
    if (error || !data) return json({ error: "create_failed" }, 500);
    return json({
      session_token: data.session_token,
      expires_at: data.expires_at,
      ...(client_secret ? { client_secret } : {}),
    });
  }

  if (!session_token || typeof session_token !== "string" || session_token.length > 128) {
    return json({ error: "missing_session_token" }, 400);
  }

  // ── 2) QRtım: isteği incele (onaydan ÖNCE kullanıcıya gösterilir) ────────
  // Sahte QR ile oturum çalma (QRLjacking) karşısında tek savunma, onaylayan
  // kişinin isteğin KENDİ cihazından geldiğini görebilmesidir.
  if (action === "inspect") {
    const user = await kullaniciyiAl(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    if (!(await sinirIcinde(`qr-inspect:${user.id}`, 30, 60))) return json({ error: "rate_limited" }, 429);

    const { data: row } = await admin
      .from("ilgezdi_qr_sessions")
      .select("status, requester_label, created_at, expires_at")
      .eq("session_token", session_token)
      .maybeSingle();
    if (!row || row.status !== "pending" || new Date(row.expires_at) < new Date()) {
      return json({ error: "not_found_or_expired" }, 404);
    }
    return json({
      requester_label: row.requester_label ?? "Bilinmeyen cihaz",
      created_at: row.created_at,
      expires_at: row.expires_at,
    });
  }

  // ── 3) QRtım: oturumu onayla (JWT zorunlu) ───────────────────────────────
  if (action === "approve") {
    const user = await kullaniciyiAl(req);
    if (!user) return json({ error: "unauthorized" }, 401);
    if (!(await sinirIcinde(`qr-approve:${user.id}`, 10, 60))) return json({ error: "rate_limited" }, 429);

    // Doğrulanmamış hesapla başka cihazda oturum açtırılmaz.
    if (!user.email_confirmed_at) return json({ error: "email_not_verified" }, 403);

    const { data, error } = await admin
      .from("ilgezdi_qr_sessions")
      .update({
        user_id: user.id,
        status: "approved",
        approved_at: new Date().toISOString(),
      })
      .eq("session_token", session_token)
      .eq("status", "pending")
      .gt("expires_at", new Date().toISOString())
      .select("id, requester_label")
      .maybeSingle();

    if (error) return json({ error: "approve_failed" }, 500);
    if (!data) return json({ error: "not_found_or_expired" }, 404);

    await denetim("ilgezdi.qr_approved", user.id, { cihaz: data.requester_label });
    return json({ ok: true });
  }

  // ── 4) Tarayıcı: durum sorgula / oturum değişimi ─────────────────────────
  if (action === "status") {
    // Yoklama 3 sn'de bir: dakikada 20. Pay bırakıp 40'ta kesilir.
    if (!(await sinirIcinde(`qr-status:${ip}:${session_token.slice(0, 16)}`, 40, 60))) {
      return json({ error: "rate_limited" }, 429);
    }

    const { data: row, error } = await admin
      .from("ilgezdi_qr_sessions")
      .select("status, user_id, expires_at, client_secret_hash")
      .eq("session_token", session_token)
      .maybeSingle();

    if (error) return json({ error: "lookup_failed" }, 500);
    if (!row) return json({ status: "not_found" }, 404);

    // İstemci sırrı: QR'ı görmek oturumu almak için yetmez.
    if (row.client_secret_hash) {
      const verilen = typeof body.client_secret === "string" ? body.client_secret : "";
      if (!verilen || !esit(await sha256Hex(verilen), row.client_secret_hash)) {
        // Bilgi sızdırmamak için bulunamadı gibi davranılır.
        return json({ status: "not_found" }, 404);
      }
    } else if (STRICT) {
      return json({ error: "client_secret_required" }, 400);
    }

    if (row.status === "pending" && new Date(row.expires_at) < new Date()) {
      await admin
        .from("ilgezdi_qr_sessions")
        .update({ status: "expired" })
        .eq("session_token", session_token);
      return json({ status: "expired" });
    }

    if (row.status !== "approved" || !row.user_id) {
      // 'used' tekrar sorgulanırsa da expired döner — token_hash tek kullanımlıktır
      return json({ status: row.status === "pending" ? "pending" : "expired" });
    }

    // Onaylandı → token'ı hemen tüket (yarış durumuna karşı önce işaretle)
    const { data: claimed } = await admin
      .from("ilgezdi_qr_sessions")
      .update({ status: "used" })
      .eq("session_token", session_token)
      .eq("status", "approved")
      .select("user_id")
      .maybeSingle();
    if (!claimed) return json({ status: "expired" });

    const { data: userData, error: uErr } = await admin.auth.admin.getUserById(row.user_id);
    if (uErr || !userData?.user?.email) return json({ error: "user_lookup_failed" }, 500);

    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: userData.user.email,
    });
    if (linkErr || !link?.properties?.hashed_token) {
      return json({ error: "token_generation_failed" }, 500);
    }

    await denetim("ilgezdi.qr_login", row.user_id, { sir_ile: Boolean(row.client_secret_hash) });

    return json({
      status: "approved",
      token_hash: link.properties.hashed_token,
      email: userData.user.email,
    });
  }

  return json({ error: "unknown_action" }, 400);
});
