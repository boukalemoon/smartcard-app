// Arku Remote bağlantı doğrulama endpoint'i.
//
// Arku, kullanıcı QRtım'de giriş yaptıktan sonra aldığı tek kullanımlık token'ı
// buraya gönderir. Token doğrulanır ve kullanıcının QRtım kimliği döndürülür.
//
// Güvenlik: Arku'ya yalnızca herkese açık kimlik alanları (ad, kullanıcı adı,
// e-posta, ünvan, firma, plan) döner. QRtım şifresi/oturum jetonu paylaşılmaz.
// Token tek kullanımlıktır ve 5 dakika içinde geçersiz olur.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

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
  if (req.method !== "POST") {
    return json({ valid: false, error: "Yalnızca POST desteklenir" }, 405);
  }

  try {
    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token || typeof token !== "string") {
      return json({ valid: false, error: "Token gerekli" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data: tok, error: tokErr } = await admin
      .from("partner_link_tokens")
      .select("token, user_id, partner, expires_at, used_at")
      .eq("token", token)
      .maybeSingle();

    if (tokErr) return json({ valid: false, error: "Doğrulama hatası" }, 500);
    if (!tok) return json({ valid: false, error: "Geçersiz token" }, 401);
    if (tok.partner !== "arku") return json({ valid: false, error: "Geçersiz token" }, 401);
    if (tok.used_at) return json({ valid: false, error: "Token zaten kullanıldı" }, 401);
    if (new Date(tok.expires_at).getTime() < Date.now()) {
      return json({ valid: false, error: "Token süresi doldu" }, 401);
    }

    // E-posta doğrulaması — jetonu YAKMADAN ÖNCE denetlenir, aksi halde
    // reddedilen kullanıcı jetonunu da kaybederdi.
    //
    // Arku, dönen e-postayı doğrulanmış kabul edip o e-posta için oturum
    // açıyordu (Arku tarafında S1 olarak tespit edilip entegrasyon askıya
    // alındı). Saldırgan `kurban@firma.com` ile QRtım hesabı açıp Arku'daki
    // hesabı devralabiliyordu. Kök neden kimlik sağlayıcıdaydı; burada
    // kapatılıyor. Arku entegrasyonu ancak bu dağıtıldıktan sonra açılmalı.
    const { data: authUser } = await admin.auth.admin.getUserById(tok.user_id);
    if (!authUser?.user?.email_confirmed_at) {
      return json({
        valid: false,
        error: "E-posta doğrulanmamış",
        code: "email_not_verified",
      }, 403);
    }

    // Tek kullanımlık: hemen kullanıldı olarak işaretle
    await admin
      .from("partner_link_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token", token);

    const { data: prof } = await admin
      .from("profiles")
      .select("user_id, email, name, phone, username, photo_url, title, company, subscription_plan")
      .eq("user_id", tok.user_id)
      .maybeSingle();

    // Döndürülen e-posta, DOĞRULANMIŞ OLANIN AYNISI olmalı. profiles.email
    // kullanıcı tarafından değiştirilebildiği için ondan okunursa "şunu
    // doğruladım, bunu gönderdim" durumu oluşur ve denetim anlamsızlaşır.
    const email = authUser.user.email ?? "";
    const name = prof?.name ??
      (authUser.user.user_metadata?.name as string | undefined) ??
      (email ? email.split("@")[0] : "");

    return json({
      valid: true,
      user: {
        qrtim_id: tok.user_id,
        email,
        email_verified: true,              // yukarıda denetlendi; aksi halde 403
        name,
        phone: prof?.phone ?? null,
        username: prof?.username ?? "",
        photo_url: prof?.photo_url ?? null,
        title: prof?.title ?? null,
        company: prof?.company ?? null,
        plan: prof?.subscription_plan ?? "free",
      },
    });
  } catch (e) {
    return json({ valid: false, error: String(e) }, 500);
  }
});
