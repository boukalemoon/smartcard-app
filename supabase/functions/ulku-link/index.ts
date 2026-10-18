// Ülkü bağlantı doğrulama endpoint'i.
//
// Ülkü, kullanıcı QRtım'de giriş yaptıktan sonra aldığı tek kullanımlık
// belirteci buraya gönderir. Desen draw-link ile birebir aynı; farklar aşağıda.
//
// KAPSAM (Ülkü oturumunun talebi, Burak onayı 18.10.2026): YALNIZCA kimlik
// bağlama. Plan ve senkron istenmedi.
//   • PLAN GÖNDERİLMİYOR, link_secret DÖNDÜRÜLMÜYOR (draw-link'teki gerekçe:
//     plan okumayacak partnere plan tazeleme sırrı vermek gereksiz yetki).
//     Onay ekranındaki alan listesinden de "Abonelik planı" çıkarıldı
//     (Auth.jsx → PARTNER_ALANLARI).
//   • EK ALAN: card_url. Kartın kanonik adresini QRtım üretiyor ki Ülkü
//     kendi adres kurmasın; yol değişirse tek yerden değişir. username boşsa
//     null döner — uydurma adres gönderilmez.
//
// Ülkü'de QRtım ile giriş ÜYELİK VERMEZ: Ülkü'de zaten oturumu olan üye
// hesabını bağlar (Ülkü tarafının kuralı). Burada eşleştirme anahtarı
// qrtim_uid; e-posta doğrulanmamışsa 403.
//
// Güvenlik: yalnızca herkese açık kimlik alanları döner. QRtım şifresi ya da
// oturum jetonu paylaşılmaz. Belirteç tek kullanımlıktır ve 5 dakikada
// geçersiz olur.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { belirtecOzeti } from "../_shared/belirtec.ts";

const PARTNER = "ulku";

// Kartın kanonik adresi sunucuda kurulur. payment-callback ile aynı değişken
// ve aynı yedek adres: ikinci bir "site adresi" tanımı doğmasın.
const SITE_URL = (Deno.env.get("PUBLIC_SITE_URL") ?? "https://www.qrtim.com.tr").replace(/\/+$/, "");

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
    return json({ valid: false, code: "method_not_allowed", error: "Yalnızca POST desteklenir" }, 405);
  }

  try {
    const { token } = await req.json().catch(() => ({ token: null }));
    if (!token || typeof token !== "string") {
      return json({ valid: false, code: "token_missing", error: "Token gerekli" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // Tabloda belirtecin yalnızca ÖZETİ durur (bkz. _shared/belirtec.ts).
    // arku-link'teki düz metin geçiş yolu BURADA YOK: bu uç ilk kez
    // yayınlanıyor, hiç düz metin belirteç yazılmadı.
    const ozet = await belirtecOzeti(token);
    const { data: tok, error: tokErr } = await admin
      .from("partner_link_tokens")
      .select("token, user_id, partner, expires_at, used_at")
      .eq("token", ozet)
      .maybeSingle();

    if (tokErr) return json({ valid: false, code: "lookup_failed", error: "Doğrulama hatası" }, 500);
    if (!tok) return json({ valid: false, code: "token_invalid", error: "Geçersiz token" }, 401);
    if (tok.partner !== PARTNER) return json({ valid: false, code: "token_invalid", error: "Geçersiz token" }, 401);
    if (tok.used_at) return json({ valid: false, code: "token_already_used", error: "Token zaten kullanıldı" }, 401);
    if (new Date(tok.expires_at).getTime() < Date.now()) {
      return json({ valid: false, code: "token_expired", error: "Token süresi doldu" }, 401);
    }

    // E-posta doğrulaması — belirteci YAKMADAN ÖNCE denetlenir, aksi halde
    // reddedilen kullanıcı belirtecini de kaybederdi.
    //
    // Partner, dönen e-postayı doğrulanmış kabul edip o e-posta için oturum
    // açarsa, saldırgan `kurban@firma.com` ile QRtım hesabı açıp partnerdeki
    // hesabı devralabilir (Arku'da S1 olarak tespit edildi). Kök neden kimlik
    // sağlayıcıdadır; burada kapatılıyor.
    const { data: authUser } = await admin.auth.admin.getUserById(tok.user_id);
    if (!authUser?.user?.email_confirmed_at) {
      return json({ valid: false, error: "E-posta doğrulanmamış", code: "email_not_verified" }, 403);
    }

    // Tek kullanımlık — ATOMİK yakma. Tek UPDATE, yalnızca kullanılmamış ve
    // süresi dolmamış satırı işaretler; satır dönmezse başkası önce yakmıştır.
    // Önce okuyup sonra koşulsuz işaretlemek, aynı belirteçle eşzamanlı iki
    // isteğin ikisini de geçerli saymasına yol açardı.
    const simdi = new Date().toISOString();
    const { data: yakilan, error: yakErr } = await admin
      .from("partner_link_tokens")
      .update({ used_at: simdi })
      .eq("token", ozet)
      .eq("partner", PARTNER)
      .is("used_at", null)
      .gt("expires_at", simdi)
      .select("user_id")
      .maybeSingle();
    if (yakErr) return json({ valid: false, code: "lookup_failed", error: "Doğrulama hatası" }, 500);
    if (!yakilan) return json({ valid: false, code: "token_already_used", error: "Token zaten kullanıldı" }, 401);

    await admin.rpc("log_event", {
      p_action: "partner.token_redeemed",
      p_actor_user_id: tok.user_id,
      p_app_key: PARTNER,
      p_resource_type: "partner_token",
      p_result: "success",
      p_severity: "info",
      p_visibility: "user",
      p_meta: { partner: PARTNER },
      p_actor_kind: "service",
      p_subject: tok.user_id,
    });

    const { data: prof } = await admin
      .from("profiles")
      .select("user_id, email, name, phone, username, photo_url, title, company")
      .eq("user_id", tok.user_id)
      .maybeSingle();

    // EŞLEŞTİRME ANAHTARI: kalıcı ekosistem kimliği. E-postayla eşleştirme
    // yapılmaz — e-posta değişebilir, devredilebilir ve kişiyi kalıcı olarak
    // tanımlamaz. qrtim_uid her hesap için bir kez üretilir ve hiç değişmez.
    const { data: qid } = await admin
      .from("qrtim_user_ids")
      .select("qrtim_uid")
      .eq("user_id", tok.user_id)
      .maybeSingle();

    // Bağlantı kaydı: bu kimliğin hangi uygulamalara bağlandığı görünür olsun.
    // link_secret üretilir ama DÖNDÜRÜLMEZ (yukarıdaki fark notu).
    await admin
      .from("partner_user_links")
      .upsert({ user_id: tok.user_id, partner: PARTNER },
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
        qrtim_uid: qid?.qrtim_uid ?? null,
        qrtim_id: tok.user_id,
        email,
        email_verified: true,              // yukarıda denetlendi; aksi halde 403
        name,
        phone: prof?.phone ?? null,
        username: prof?.username ?? "",
        photo_url: prof?.photo_url ?? null,
        title: prof?.title ?? null,
        company: prof?.company ?? null,
        // Kartın kanonik adresi. username yoksa kart da yok: null döner,
        // ".../card/" gibi kırık bir adres gönderilmez.
        card_url: prof?.username ? `${SITE_URL}/card/${encodeURIComponent(prof.username)}` : null,
        // plan / paid ALANLARI YOK — bkz. başlıktaki fark notu.
      },
    });
  } catch (_e) {
    // İç hata ayrıntısı dışarı verilmez.
    return json({ valid: false, code: "unexpected_error", error: "Beklenmeyen hata" }, 500);
  }
});
