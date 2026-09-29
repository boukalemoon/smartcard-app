// Vendored from ShieldAuth sdk/supabase/src/index.js @ 0166784. Do not edit: re-run scripts/vendor-kit.mjs.
/**
 * ShieldAuth for Supabase apps (Edge Functions on Deno, Vercel/Node functions, any fetch runtime).
 *
 *   import { createSupabaseShieldAuth } from "@shieldauth/supabase";
 *   Deno.serve(createSupabaseShieldAuth({
 *     supabaseUrl: Deno.env.get("SUPABASE_URL"), anonKey: Deno.env.get("SUPABASE_ANON_KEY"),
 *     serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"),
 *     apiKey: Deno.env.get("SHIELDAUTH_API_KEY"), appId: "qartim",
 *     allowedOrigins: ["https://qartim.com"], allowNullOrigin: true,   // Electron sends Origin: null
 *   }));
 *
 * - The user comes from the Supabase access token (Authorization: Bearer), validated with GoTrue.
 *   Anonymous users are refused; email/phone are passed only when confirmed.
 * - After every successful verification the current Supabase session gets an MFA assertion
 *   (see sql/shieldauth_mfa.sql) so RLS can enforce `shieldauth_mfa_fresh(...)` server-side.
 */
import { createNextHandler } from "./next.js";

function bearer(headers) {
  const auth = typeof headers?.get === "function" ? headers.get("authorization") : headers?.authorization;
  const m = /^Bearer\s+(.+)$/i.exec(auth ?? "");
  return m ? m[1].trim() : null;
}

function jwtClaims(token) {
  try {
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(part + "=".repeat((4 - (part.length % 4)) % 4)));
  } catch {
    return {};
  }
}

/** getUser for ShieldAuth kits: validates the caller's Supabase session. */
export function supabaseSession({ url, anonKey, fetch: f = globalThis.fetch }) {
  const base = url.replace(/\/+$/, "");
  return async (req) => {
    const token = bearer(req?.headers);
    if (!token) return null;
    const res = await f(`${base}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const user = await res.json();
    if (!user?.id || user.is_anonymous) return null;
    return {
      id: user.id,
      email: user.email_confirmed_at ? user.email : undefined,
      phone: user.phone_confirmed_at && user.phone ? `+${String(user.phone).replace(/^\+/, "")}` : undefined,
      sessionId: jwtClaims(token).session_id,
      raw: user,
    };
  };
}

function serviceUpsert(base, serviceRoleKey, f, table, conflict, row) {
  return f(`${base}/rest/v1/${table}?on_conflict=${conflict}`, {
    method: "POST",
    headers: {
      apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json",
      Prefer: "resolution=merge-duplicates,return=minimal",
    },
    body: JSON.stringify(row),
  });
}

/**
 * onVerified hook: records an MFA assertion for the current Supabase session (service role) and,
 * for authenticator (TOTP) verifications, marks the user as enrolled so RLS can require MFA for them.
 */
export function recordMfaAssertion({ url, serviceRoleKey, fetch: f = globalThis.fetch }) {
  const base = url.replace(/\/+$/, "");
  return async ({ user, method }) => {
    if (!user?.sessionId) throw new Error("Supabase session_id missing: cannot record MFA assertion");
    const now = new Date().toISOString();
    const res = await serviceUpsert(base, serviceRoleKey, f, "shieldauth_mfa_assertions", "user_id,session_id",
      { user_id: user.id, session_id: user.sessionId, method, verified_at: now });
    if (!res.ok) throw new Error(`Recording MFA assertion failed: HTTP ${res.status}`);
    if (method === "totp") {
      const enr = await serviceUpsert(base, serviceRoleKey, f, "shieldauth_mfa_users", "user_id",
        { user_id: user.id, totp_enrolled: true, updated_at: now });
      if (!enr.ok) throw new Error(`Recording TOTP enrollment failed: HTTP ${enr.status}`);
    }
  };
}

/** isFresh hook: did the CURRENT Supabase session verify MFA within maxAgeSeconds? (service role read) */
export function sessionMfaFresh({ url, serviceRoleKey, fetch: f = globalThis.fetch }) {
  const base = url.replace(/\/+$/, "");
  return async ({ user, maxAgeSeconds }) => {
    if (!user?.sessionId) return false;
    const since = new Date(Date.now() - maxAgeSeconds * 1000).toISOString();
    const q = new URLSearchParams({
      select: "user_id", user_id: `eq.${user.id}`, session_id: `eq.${user.sessionId}`, verified_at: `gte.${since}`,
    });
    const res = await f(`${base}/rest/v1/shieldauth_mfa_assertions?${q}`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (!res.ok) return false;
    const rows = await res.json();
    return Array.isArray(rows) && rows.length > 0;
  };
}

/** onTotpDisabled hook: clears the enrollment flag. */
export function recordTotpDisabled({ url, serviceRoleKey, fetch: f = globalThis.fetch }) {
  const base = url.replace(/\/+$/, "");
  return async ({ user }) => {
    const res = await serviceUpsert(base, serviceRoleKey, f, "shieldauth_mfa_users", "user_id",
      { user_id: user.id, totp_enrolled: false, updated_at: new Date().toISOString() });
    if (!res.ok) throw new Error(`Recording TOTP disable failed: HTTP ${res.status}`);
  };
}

const CORS_HEADERS = "authorization, apikey, content-type, x-client-info, x-shieldauth-request";

/**
 * Fetch handler (Request -> Response) serving the ShieldAuth MFA endpoints for a Supabase app.
 * @param {{
 *   supabaseUrl: string, anonKey: string, serviceRoleKey: string,
 *   apiKey: string, appId?: string, baseUrl?: string, basePath?: string,
 *   allowedOrigins?: string[], allowNullOrigin?: boolean, channels?: string[], locale?: string,
 *   onVerified?: Function, fetch?: typeof fetch,
 * }} options
 */
export function createSupabaseShieldAuth(options) {
  const f = options.fetch ?? globalThis.fetch;
  const record = recordMfaAssertion({ url: options.supabaseUrl, serviceRoleKey: options.serviceRoleKey, fetch: f });
  const disabled = recordTotpDisabled({ url: options.supabaseUrl, serviceRoleKey: options.serviceRoleKey, fetch: f });
  const { POST } = createNextHandler({
    apiKey: options.apiKey,
    appId: options.appId,
    baseUrl: options.baseUrl,
    basePath: options.basePath ?? "/shieldauth",
    channels: options.channels,
    locale: options.locale,
    fetch: f,
    trustProxy: true,
    cookieSecure: true,
    getUser: supabaseSession({ url: options.supabaseUrl, anonKey: options.anonKey, fetch: f }),
    onVerified: async (info) => {
      await record(info);
      await options.onVerified?.(info);
    },
    onTotpDisabled: disabled,
    // Cross-origin (app on its own domain, function on supabase.co): no MFA cookie arrives,
    // so "fresh MFA" for sensitive actions comes from the per-session record instead.
    isFresh: sessionMfaFresh({ url: options.supabaseUrl, serviceRoleKey: options.serviceRoleKey, fetch: f }),
  });
  const allowed = new Set(options.allowedOrigins ?? []);

  function corsFor(origin) {
    const ok = origin && (allowed.has(origin) || (origin === "null" && options.allowNullOrigin));
    return ok ? {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers": CORS_HEADERS,
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Max-Age": "600",
      Vary: "Origin",
    } : { Vary: "Origin" };
  }

  return async function handler(request) {
    const origin = request.headers.get("origin");
    const cors = corsFor(origin);
    if (request.method === "OPTIONS") {
      return new Response(null, { status: cors["Access-Control-Allow-Origin"] ? 204 : 403, headers: cors });
    }
    if (origin && !cors["Access-Control-Allow-Origin"]) {
      return Response.json({ error: "origin_not_allowed" }, { status: 403, headers: cors });
    }
    const res = await POST(request);
    const headers = new Headers(res.headers);
    for (const [k, v] of Object.entries(cors)) headers.set(k, v);
    return new Response(res.body, { status: res.status, headers });
  };
}
