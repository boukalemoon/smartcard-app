// ShieldAuth — iki adımlı doğrulama uç noktaları (TOTP, e-posta kodu, yedek kodlar)
//
// Tarayıcıdaki <ShieldAuthProvider> buraya konuşur; ShieldAuth API anahtarı
// yalnızca burada, sunucuda durur. Kullanıcı kimliği istemcinin gönderdiği
// bir alandan DEĞİL, Supabase erişim belirtecinden (getUser) alınır —
// başkası adına doğrulama yapılamaz.
//
// Her başarılı doğrulamada o anki oturuma (JWT session_id) service_role ile
// kayıt yazılır; veritabanı IBAN/fatura ve yönetici işlemlerinde bu kaydı
// arar (bkz. migrations/20260929090000_shieldauth_mfa.sql). Arayüz atlanırsa
// bile kural veritabanında işler.
//
// Kodlar yalnızca DOĞRULANMIŞ e-postaya gider. profiles.phone doğrulanmadığı
// için SMS/WhatsApp kapalı: saldırgan kendi numarasını yazıp kod alamasın.
//
// verify_jwt = true (varsayılan) kalmalı. Anonim oturumlar reddedilir.
//
// Secret'lar: SHIELDAUTH_API_KEY, SHIELDAUTH_APP_ID, SHIELDAUTH_BASE_URL,
//             SHIELDAUTH_ALLOWED_ORIGINS (virgülle; ör. https://www.qrtim.com.tr,https://qrtim.com.tr)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createSupabaseShieldAuth } from "../_shared/shieldauth/supabase.js";

const handler = createSupabaseShieldAuth({
  supabaseUrl: Deno.env.get("SUPABASE_URL")!,
  anonKey: Deno.env.get("SUPABASE_ANON_KEY")!,
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  apiKey: Deno.env.get("SHIELDAUTH_API_KEY")!,
  appId: Deno.env.get("SHIELDAUTH_APP_ID") ?? "qartim",
  baseUrl: Deno.env.get("SHIELDAUTH_BASE_URL"),
  allowedOrigins: (Deno.env.get("SHIELDAUTH_ALLOWED_ORIGINS") ?? "")
    .split(",").map((o) => o.trim()).filter(Boolean),
  channels: ["email"],
  locale: "tr",
});

Deno.serve(handler);
