// Partner uygulamanın SUNUCUSUNDAN çağırdığı geçerli plan sorgusu.
//
// NEDEN VAR: QRtım planı partner uygulamaya yalnızca giriş/bağlama anında
// yazılıyordu. Partner kendi veritabanındaki satıra bakarak yetki veriyor ve
// o satır hiç tazelenmiyordu. Sonuç: QRtım aboneliği BİTEN kullanıcı partner
// uygulamada ücretli kademede süresiz kalıyordu — planı tazelemek için
// yeniden QRtım'le giriş yapması gerekiyor, ki yapmaz.
//
// NEDEN OTURUMA DAYANMIYOR: ilgezdi_effective_plan() auth.uid() kullanır,
// yani çağıranın QRtım oturumu olmasını gerektirir. İlgezdi bu veritabanını
// paylaştığı için orada çalışır. Kendi veritabanı olan bir partnerin
// ihtiyacı ise "girişten bağımsız periyodik tazeleme" — kullanıcı ortada
// yokken. Oturuma dayanan bir uç tam da gereken anda çalışmaz.
//
// KİMLİK: paylaşılan partner ana anahtarı DEĞİL, kullanıcı başına
// link_secret. Bir sırrın sızması yalnızca o kullanıcıyı etkiler; ana anahtar
// sızsaydı herkesin planı okunurdu.
//
// EN AZ VERİ: yalnızca plan, bitiş ve yetki bayrakları döner. Kimlik, e-posta
// ve ad dönmez — bunlar bağlama anında zaten verildi.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
  if (req.method !== "POST") return json({ ok: false, code: "method_not_allowed" }, 405);

  try {
    const govde = await req.json().catch(() => ({}));
    const partner = typeof govde?.partner === "string" ? govde.partner : "";
    const qrtimUid = typeof govde?.qrtim_uid === "string" ? govde.qrtim_uid : "";
    const linkSecret = typeof govde?.link_secret === "string" ? govde.link_secret : "";

    if (!partner || !qrtimUid || !linkSecret) {
      return json({ ok: false, code: "invalid_request" }, 400);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    const { data, error } = await admin.rpc("partner_effective_plan", {
      p_partner: partner,
      p_qrtim_uid: qrtimUid,
      p_link_secret: linkSecret,
    });

    if (error) return json({ ok: false, code: "lookup_failed" }, 500);

    if (!data?.ok) {
      // Makine tarafından okunabilir kod; partner doğru davranışı seçebilsin.
      //
      // link_revoked (410) ile unauthorized (401) BİLEREK ayrı:
      //   • link_revoked → bağlantı gerçekten koptu (hesap silindi ya da
      //     bağlantı kaldırıldı). Partner yetkiyi HEMEN düşürmeli.
      //   • unauthorized → sunulan sır hiç geçerli olmamış. Bu partnerin
      //     kendi kayıt bozulması da olabilir; buna dayanarak kullanıcıyı
      //     düşürmek yanlış olur.
      // Ayrım kimlik numaralandırmaya kapı açmıyor: "iptal edildi" cevabını
      // ancak bir zamanlar GEÇERLİ olmuş bir sır sunan alabiliyor.
      const eslestir: Record<string, { kod: string; http: number }> = {
        cok_fazla_deneme: { kod: "rate_limited", http: 429 },
        gecersiz_istek: { kod: "invalid_request", http: 400 },
        baglanti_iptal: { kod: "link_revoked", http: 410 },
      };
      const secim = eslestir[String(data?.hata ?? "")] ??
        { kod: "unauthorized", http: 401 };
      return json({ ok: false, code: secim.kod }, secim.http);
    }

    return json({
      ok: true,
      plan: data.plan,
      // YETKİ KARARININ DAYANAĞI BU ALAN, plan ADI değil.
      //
      // Partner plan adına bakıp "bilinmeyen ad = ücretli" sayıyordu; yani
      // QRtım'de bir gün ücretsiz bir deneme planı çıksa partner onu sessizce
      // ücretli sayıp bedava lisans dağıtırdı. Bilgi artık bizde üretiliyor ve
      // cevapla birlikte gidiyor: yeni plan eklendiğinde partnerin kod
      // değiştirmesi ya da bizim haber vermemiz gerekmiyor.
      //
      // Tanımsız bir plan adı geldiğinde false döner — güvenli taraf.
      paid: data.ucretli === true,
      expires_at: data.expires_at,
      max_sync_devices: data.max_sync_devices,
      password_sync: data.password_sync,
      checked_at: data.kontrol_zamani,
    });
  } catch {
    return json({ ok: false, code: "unexpected_error" }, 500);
  }
});
