// Partner SSO için tek kullanımlık token üretir.
//
// QRtım'de giriş yapan kullanıcının oturumu (JWT) ile çağrılır. Partner adı
// doğrulanır, kısa ömürlü tek kullanımlık bir token üretilip partner_link_tokens
// tablosuna yazılır ve partner uygulamaya geri yönlendirme için döndürülür.
//
// verify_jwt = true: yalnızca geçerli QRtım oturumu olan kullanıcılar token alabilir.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const KNOWN_PARTNERS = ["arku", "ilgezdi", "tinga"];
const TOKEN_TTL_MS = 5 * 60 * 1000; // 5 dakika

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
  if (req.method !== "POST") return json({ error: "Yalnızca POST desteklenir" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Yetkisiz" }, 401);

    const { partner_name } = await req.json().catch(() => ({ partner_name: null }));
    if (!partner_name || !KNOWN_PARTNERS.includes(partner_name)) {
      return json({ error: "Bilinmeyen partner" }, 400);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    // Oturum sahibini JWT'den belirle
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) return json({ error: "Geçersiz oturum" }, 401);

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
    const expires_at = new Date(Date.now() + TOKEN_TTL_MS).toISOString();

    const { error: insErr } = await admin.from("partner_link_tokens").insert({
      token,
      user_id: user.id,
      partner: partner_name,
      expires_at,
    });
    if (insErr) return json({ error: "Token oluşturulamadı" }, 500);

    const { data: prof } = await admin
      .from("profiles")
      .select("email, name, username")
      .eq("user_id", user.id)
      .maybeSingle();

    return json({
      token,
      email: prof?.email ?? user.email ?? "",
      name: prof?.name ?? (user.user_metadata?.name as string | undefined) ?? "",
      username: prof?.username ?? "",
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});
