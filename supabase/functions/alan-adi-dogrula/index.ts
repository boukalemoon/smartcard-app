// Alan adı sahipliği doğrulaması (DNS TXT).
//
// NEDEN EDGE FUNCTION: Postgres DNS sorgusu yapamaz. Kontrol burada yapılır,
// sonuç verification_mark ile yazılır. İstemci sonucu ASLA kendisi yazamaz —
// o fonksiyonun çalıştırma yetkisi yalnızca service_role'de.
//
// NEDEN İKİ ÇÖZÜMLEYİCİ: tek bir DNS çözümleyicisine güvenmek, o çözümleyici
// kandırıldığında sahte rozet demek. Cloudflare ve Google'ın İKİSİ birden
// kaydı görmeden doğrulama geçmez. Yayılma sırasında biri henüz görmüyorsa
// kullanıcı "henüz yayılmamış" cevabı alır ve tekrar dener — yanlış REDDETMEK,
// yanlış ONAYLAMAKTAN iyidir.
//
// İKİ KONUM: kayıt kök alan adına ya da _qrtim alt alanına yazılabilir. Bazı
// sağlayıcılarda kökte başka TXT kayıtları olduğu için alt alan daha kolay.

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

const COZUMLEYICILER = [
  { ad: "cloudflare", url: "https://cloudflare-dns.com/dns-query" },
  { ad: "google", url: "https://dns.google/resolve" },
];

// Alan adı veritabanından geliyor ve orada doğrulanmış durumda; yine de
// URL'e konmadan önce biçimi burada da kontrol edilir.
const ALAN_ADI_BICIMI = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

type TxtSonuc = { bulundu: boolean; kayitlar: string[] };

async function txtKayitlariniAl(cozumleyici: string, ad: string): Promise<string[]> {
  const url = `${cozumleyici}?name=${encodeURIComponent(ad)}&type=TXT`;
  const res = await fetch(url, {
    headers: { accept: "application/dns-json" },
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error("dns_hatasi");
  const veri = await res.json();
  if (!Array.isArray(veri?.Answer)) return [];
  return veri.Answer
    .filter((a: { type?: number }) => a?.type === 16)
    .map((a: { data?: string }) => String(a?.data ?? ""))
    // TXT verisi tırnaklı gelir ve uzun değerler parçalara bölünebilir.
    .map((d: string) => d.replace(/"\s+"/g, "").replace(/^"|"$/g, "").trim());
}

async function cozumleyiciKontrol(
  cozumleyici: string,
  alanAdi: string,
  beklenen: string,
): Promise<TxtSonuc> {
  const kayitlar: string[] = [];
  for (const ad of [alanAdi, `_qrtim.${alanAdi}`]) {
    try {
      kayitlar.push(...(await txtKayitlariniAl(cozumleyici, ad)));
    } catch {
      // Tek bir ad çözümlenemediyse diğerine bakmaya devam et.
    }
  }
  return { bulundu: kayitlar.includes(beklenen), kayitlar };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, hata: "yontem" }, 405);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ ok: false, hata: "oturum_yok" }, 401);

    const { id } = await req.json().catch(() => ({ id: null }));
    if (!id || typeof id !== "string") {
      return json({ ok: false, hata: "kayit_yok" }, 400);
    }

    // Kullanıcının kendi oturumuyla okuyoruz: satır ona ait değilse RLS
    // yüzünden hiç gelmez. Sahiplik kontrolünü burada elle yazmıyoruz ki
    // kural tek yerde (politikada) kalsın.
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
    );

    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ ok: false, hata: "oturum_yok" }, 401);

    const { data: kayit } = await userClient
      .from("identity_verifications")
      .select("id, tur, konu, durum, meydan_okuma, iptal_at, deneme_sayisi")
      .eq("id", id)
      .maybeSingle();

    if (!kayit || kayit.iptal_at || kayit.tur !== "alan_adi" || !kayit.meydan_okuma) {
      return json({ ok: false, hata: "kayit_yok" }, 404);
    }
    if (!ALAN_ADI_BICIMI.test(kayit.konu)) {
      return json({ ok: false, hata: "gecersiz_alan_adi" }, 400);
    }
    if (kayit.deneme_sayisi >= 50) {
      return json({ ok: false, hata: "deneme_siniri" }, 429);
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    // HIZ SINIRI — DNS sorgularından ÖNCE.
    //
    // Tek koruma "deneme_sayisi >= 50" idi; o değer istekten önce okunuyor,
    // sayaç ise sonradan artıyor, yani eşzamanlı istekler hepsi aynı değeri
    // görüyordu. Her istek 4 dış DNS sorgusu üretiyor: Cloudflare ya da
    // Google bizi kısıtlarsa BAŞKA kullanıcıların doğrulamaları da bozulur.
    // Paylaşılan kaynağı tek kişinin yakmasını burada engelliyoruz.
    const { data: izin } = await admin.rpc("verification_attempt_allowed", { p_id: id });
    if (izin !== true) {
      return json({ ok: false, hata: "cok_fazla_deneme" }, 429);
    }

    const sonuclar = await Promise.all(
      COZUMLEYICILER.map(async (c) => ({
        ad: c.ad,
        ...(await cozumleyiciKontrol(c.url, kayit.konu, kayit.meydan_okuma!).catch(
          () => ({ bulundu: false, kayitlar: [] as string[] }),
        )),
      })),
    );

    const onaylayan = sonuclar.filter((s) => s.bulundu).map((s) => s.ad);
    const hepsiOnayladi = onaylayan.length === COZUMLEYICILER.length;
    // Hiç TXT kaydı görülmediyse "kayıt yok", bazıları gördüyse "yayılıyor".
    const hicKayitYok = sonuclar.every((s) => s.kayitlar.length === 0);

    // Kanıt olarak yalnızca hangi çözümleyicinin ne dediğini saklıyoruz;
    // alan adının bütün TXT kayıtlarını saklamak gereksiz veri toplamak olur.
    await admin.rpc("verification_mark", {
      p_id: id,
      p_ok: hepsiOnayladi,
      p_kanit: {
        onaylayan,
        kontrol_edilen: COZUMLEYICILER.map((c) => c.ad),
        kontrol_zamani: new Date().toISOString(),
      },
    });

    if (hepsiOnayladi) return json({ ok: true, durum: "dogrulandi" });

    return json({
      ok: false,
      durum: "beklemede",
      hata: hicKayitYok ? "kayit_bulunamadi" : "yayiliyor",
      onaylayan,
    });
  } catch {
    return json({ ok: false, hata: "islem_tamamlanamadi" }, 500);
  }
});
