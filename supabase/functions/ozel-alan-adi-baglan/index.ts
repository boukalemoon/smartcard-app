// Özel alan adını barındırma sağlayıcısına (Vercel) kaydeder.
//
// AKIŞ: kişi alan adını zaten DOĞRULAMIŞ olmalı (identity_verifications).
// custom_domain_claim adresi kaydeder; bu fonksiyon adresi projeye ekler ve
// DNS'in yerine oturup oturmadığını sorar. Sonucu yalnızca service_role
// yazabilir (custom_domain_mark).
//
// JETON: VERCEL_TOKEN bir Supabase secret'ı olarak durur. Asla istemciye
// gönderilmez, asla VITE_ değişkeni olmaz — istemciye giden her değer
// herkese açıktır.

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

// Proje ve takım kimliği gizli bilgi değil; yine de ortamdan değiştirilebilsin.
const PROJE = Deno.env.get("VERCEL_PROJECT_ID") ?? "prj_X40sJ1rQJoy5L2dVbOoZ28i4onfd";
const TAKIM = Deno.env.get("VERCEL_TEAM_ID") ?? "team_CKDOEY22KHC9PphynltdnJ6w";
const ALAN_ADI_BICIMI = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

async function vercel(yol: string, jeton: string, govde?: unknown) {
  const res = await fetch(`https://api.vercel.com${yol}${yol.includes("?") ? "&" : "?"}teamId=${TAKIM}`, {
    method: govde ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${jeton}`,
      ...(govde ? { "Content-Type": "application/json" } : {}),
    },
    body: govde ? JSON.stringify(govde) : undefined,
    signal: AbortSignal.timeout(10000),
  });
  return { durum: res.status, veri: await res.json().catch(() => ({})) };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, hata: "yontem" }, 405);

  try {
    const jeton = Deno.env.get("VERCEL_TOKEN");
    if (!jeton) {
      // Eksik yapılandırmayı sessizce "hata" diye göstermiyoruz; kullanıcı
      // kendi DNS'ini boşuna kurcalamasın.
      return json({ ok: false, hata: "saglayici_ayari_eksik" }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, hata: "oturum_yok" }, 401);

    const { id } = await req.json().catch(() => ({ id: null }));
    if (!id || typeof id !== "string") return json({ ok: false, hata: "kayit_yok" }, 400);

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ ok: false, hata: "oturum_yok" }, 401);

    // Sahiplik kontrolü RLS'te: satır kullanıcının değilse hiç gelmez.
    const { data: kayit } = await userClient
      .from("custom_domains")
      .select("id, host, durum")
      .eq("id", id)
      .maybeSingle();

    if (!kayit || kayit.durum === "iptal") return json({ ok: false, hata: "kayit_yok" }, 404);
    if (!ALAN_ADI_BICIMI.test(kayit.host)) return json({ ok: false, hata: "gecersiz_alan_adi" }, 400);

    // 1) Adresi projeye ekle. Zaten eklenmişse hata değil.
    const ekle = await vercel(`/v10/projects/${PROJE}/domains`, jeton, { name: kayit.host });
    const zatenVar = ekle.durum === 409 ||
      ekle.veri?.error?.code === "domain_already_in_use_by_this_project";

    if (ekle.durum >= 400 && !zatenVar) {
      const admin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
        { auth: { persistSession: false } },
      );
      await admin.rpc("custom_domain_mark", {
        p_id: id,
        p_durum: "hata",
        p_saglayici: { kod: ekle.veri?.error?.code ?? "bilinmeyen" },
      });
      // Hatayı tek torbaya doldurmuyoruz: kullanıcı ya da yönetici ne
      // yapması gerektiğini ancak sebebi bilirse anlar.
      //   403        → jetonun bu takıma yetkisi yok (en sık: kişisel
      //                kapsamlı jeton, proje ise takımda) ya da süresi dolmuş.
      //   404        → proje/takım kimliği yanlış.
      //   in_use     → adres başka bir projede.
      const kod = ekle.veri?.error?.code ?? "";
      const hata = ekle.durum === 401 || ekle.durum === 403
        ? "saglayici_yetkisi_yok"
        : ekle.durum === 404
          ? "saglayici_proje_bulunamadi"
          : kod === "domain_already_in_use"
            ? "adres_baska_projede"
            : "saglayici_reddetti";

      return json({ ok: false, hata }, 400);
    }

    // 2) DNS yerine oturmuş mu?
    const durum = await vercel(`/v9/projects/${PROJE}/domains/${encodeURIComponent(kayit.host)}`, jeton);
    const dogrulandi = durum.veri?.verified === true;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );
    await admin.rpc("custom_domain_mark", {
      p_id: id,
      p_durum: dogrulandi ? "baglandi" : "beklemede",
      p_saglayici: {
        dogrulandi,
        kontrol_zamani: new Date().toISOString(),
      },
    });

    if (dogrulandi) return json({ ok: true, durum: "baglandi" });

    // Sağlayıcı ek kayıt istiyorsa olduğu gibi iletiyoruz; uydurmuyoruz.
    return json({
      ok: false,
      durum: "beklemede",
      hata: "dns_bekleniyor",
      gereken_kayitlar: Array.isArray(durum.veri?.verification)
        ? durum.veri.verification.map((v: { type?: string; domain?: string; value?: string }) => ({
          tur: v?.type, ad: v?.domain, deger: v?.value,
        }))
        : [],
    });
  } catch {
    return json({ ok: false, hata: "islem_tamamlanamadi" }, 500);
  }
});
