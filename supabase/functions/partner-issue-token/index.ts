// Partner SSO için tek kullanımlık token üretir.
//
// QRtım'de giriş yapan kullanıcının oturumu (JWT) ile çağrılır. Partner adı
// doğrulanır, kısa ömürlü tek kullanımlık bir token üretilip partner_link_tokens
// tablosuna yazılır ve partner uygulamaya geri yönlendirme için döndürülür.
//
// verify_jwt = true: yalnızca geçerli QRtım oturumu olan kullanıcılar token alabilir.
// (Anon anahtar da geçerli bir JWT'dir; bu yüzden aşağıda getUser() ile
// GERÇEK bir kullanıcı oturumu ayrıca şart koşuluyor.)
//
// YÖNLENDİRMESİZ GİRİŞ (20.09.2026): İlgezdi kullanıcısı zaten QRtım'e
// girişli. İlgezdi bu fonksiyonu kendi QRtım oturumuyla çağırıp
// `ttl_seconds: 60` ile Arku için belirteç alır; kullanıcıya ikinci kez web
// girişi yaptırmaz. Ayrı bir "arku-link-token" fonksiyonu bu yüzden gereksiz:
// belirteç zaten sub'a (user_id) ve aud'a (partner) bağlı, tek kullanımlık.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const KNOWN_PARTNERS = ["arku", "ilgezdi", "tinga"];
const TTL_VARSAYILAN_SN = 300; // web yönlendirme akışı için
const TTL_EN_AZ_SN = 30;
const TTL_EN_COK_SN = 300;
// Kullanıcı başına dakikada en çok bu kadar belirteç.
const HIZ_SINIRI = 10;

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

    const { partner_name, ttl_seconds } = await req.json()
      .catch(() => ({ partner_name: null, ttl_seconds: null }));
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

    // KİMLİK SAĞLAYICI SORUMLULUĞU — doğrulanmamış e-posta partner'a verilmez.
    //
    // Partner uygulamalar (Arku, Tınga, İlgezdi) QRtım'in döndürdüğü e-postayı
    // DOĞRULANMIŞ kabul edip o e-postaya ait hesabı açıyor. QRtım e-posta
    // doğrulamasını dayatmazsa saldırgan `kurban@firma.com` ile QRtım hesabı
    // açıp partner tarafında kurbanın hesabını devralabilir — şifreyle
    // korunan hesaplar dahil. (Arku tarafında S1 olarak tespit edildi ve
    // entegrasyon bu yüzden askıya alındı.)
    //
    // Kural: doğrulanmamış kimlik, kimlik değildir.
    if (!user.email_confirmed_at) {
      return json({
        error: "E-posta adresiniz doğrulanmamış. Bağlantı kurmadan önce " +
               "e-postanıza gönderilen doğrulama linkine tıklayın.",
        code: "email_not_verified",
      }, 403);
    }

    const admin = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Hız sınırı: çalınmış bir oturumla toplu belirteç üretilmesin.
    const { data: izin } = await admin.rpc("check_rate_limit", {
      p_key: `partner-token:${user.id}`,
      p_max: HIZ_SINIRI,
      p_window_seconds: 60,
    });
    if (izin === false) {
      return json({ error: "Çok fazla istek. Bir dakika sonra tekrar deneyin.", code: "rate_limited" }, 429);
    }

    const ttlSn = Math.min(TTL_EN_COK_SN, Math.max(TTL_EN_AZ_SN,
      Number.isFinite(Number(ttl_seconds)) ? Math.floor(Number(ttl_seconds)) : TTL_VARSAYILAN_SN));

    const token = crypto.randomUUID() + crypto.randomUUID().replaceAll("-", "");
    const expires_at = new Date(Date.now() + ttlSn * 1000).toISOString();

    const { error: insErr } = await admin.from("partner_link_tokens").insert({
      token,
      user_id: user.id,
      partner: partner_name,
      expires_at,
    });
    if (insErr) return json({ error: "Token oluşturulamadı" }, 500);

    // Denetim kaydı: kullanıcı kendi etkinlik geçmişinde görür
    // ("Arku için giriş belirteci verildi"). Belirtecin kendisi yazılmaz.
    await admin.rpc("log_event", {
      p_action: "partner.token_issued",
      p_actor_user_id: user.id,
      p_app_key: partner_name,
      p_resource_type: "partner_token",
      p_result: "success",
      p_severity: "info",
      p_visibility: "user",
      p_meta: { partner: partner_name, sure_sn: ttlSn },
      p_actor_kind: "user",
      p_subject: user.id,
    });

    const { data: prof } = await admin
      .from("profiles")
      .select("email, name, username")
      .eq("user_id", user.id)
      .maybeSingle();

    // Döndürülen e-posta, DOĞRULANMIŞ OLANIN AYNISI olmalı. profiles.email
    // kullanıcı tarafından değiştirilebildiği için ondan okunursa "şunu
    // doğruladım, bunu gönderdim" durumu oluşur ve yukarıdaki denetim
    // anlamsızlaşır.
    return json({
      token,
      expires_at,
      email: user.email ?? "",
      email_verified: true,              // yukarıda denetlendi; aksi halde 403
      name: prof?.name ?? (user.user_metadata?.name as string | undefined) ?? "",
      username: prof?.username ?? "",
    });
  } catch (_e) {
    // İç hata ayrıntısı istemciye verilmez.
    return json({ error: "Beklenmeyen hata" }, 500);
  }
});
