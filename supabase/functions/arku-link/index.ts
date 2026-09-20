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

    // Tek kullanımlık — ATOMİK yakma (20.09.2026).
    //
    // Eskiden önce okunup sonra koşulsuz işaretleniyordu. Aynı belirteçle
    // aynı anda gelen iki istek ikisi de "kullanılmamış" görüp ikisi de
    // geçerli sayılabiliyordu. Artık tek UPDATE, yalnızca kullanılmamış ve
    // süresi dolmamış satırı işaretler; satır dönmezse başkası önce yakmıştır.
    const simdi = new Date().toISOString();
    const { data: yakilan, error: yakErr } = await admin
      .from("partner_link_tokens")
      .update({ used_at: simdi })
      .eq("token", token)
      .eq("partner", "arku")
      .is("used_at", null)
      .gt("expires_at", simdi)
      .select("user_id")
      .maybeSingle();
    if (yakErr) return json({ valid: false, error: "Doğrulama hatası" }, 500);
    if (!yakilan) return json({ valid: false, error: "Token zaten kullanıldı" }, 401);

    await admin.rpc("log_event", {
      p_action: "partner.token_redeemed",
      p_actor_user_id: tok.user_id,
      p_app_key: "arku",
      p_resource_type: "partner_token",
      p_result: "success",
      p_severity: "info",
      p_visibility: "user",
      p_meta: { partner: "arku" },
      p_actor_kind: "service",
      p_subject: tok.user_id,
    });

    const { data: prof } = await admin
      .from("profiles")
      .select("user_id, email, name, phone, username, photo_url, title, company, subscription_plan")
      .eq("user_id", tok.user_id)
      .maybeSingle();

    // EKOSİSTEM KİMLİĞİ (20.09.2026).
    //
    // Partner uygulamalar hesabı E-POSTAYLA eşleştiriyordu. E-posta
    // değişebilir, devredilebilir ve kişiyi kalıcı olarak tanımlamaz; QRtım
    // dijital kimlik olacaksa eşleştirme DEĞİŞMEYEN bir kimliğe dayanmalı.
    // qrtim_uid her QRtım hesabı için bir kez üretilir ve hiç değişmez.
    const { data: qid } = await admin
      .from("qrtim_user_ids")
      .select("qrtim_uid")
      .eq("user_id", tok.user_id)
      .maybeSingle();

    // Bağlantı kaydı: bu kimliğin hangi uygulamalara bağlandığı görünür olsun.
    // (link_secret burada DÖNDÜRÜLMEZ; Arku sinyal yazmıyor — en az yetki.)
    await admin
      .from("partner_user_links")
      .upsert({ user_id: tok.user_id, partner: "arku" },
              { onConflict: "user_id,partner", ignoreDuplicates: true });

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
        // Eşleştirme ANAHTARI: kalıcı ekosistem kimliği.
        qrtim_uid: qid?.qrtim_uid ?? null,
        // Geriye uyumluluk: auth kullanıcı kimliği (eski alan).
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
  } catch (_e) {
    // İç hata ayrıntısı dışarı verilmez.
    return json({ valid: false, error: "Beklenmeyen hata" }, 500);
  }
});
