// Vendored from ShieldAuth sdk/node/src/next.js @ 0166784. Do not edit: re-run scripts/vendor-kit.mjs.
/**
 * Next.js App Router integration.
 *
 * app/api/shieldauth/[...route]/route.ts
 *   import { createNextHandler } from "@shieldauth/node/next";
 *   export const { GET, POST } = createNextHandler({
 *     apiKey: process.env.SHIELDAUTH_API_KEY,
 *     getUser: async () => { const s = await auth(); return s?.user ? { id: s.user.id, email: s.user.email } : null; },
 *   });
 *
 * Server-side guard (route handlers, server actions, server components):
 *   const mfa = await getMfaSession({ cookies: await cookies(), userId: session.user.id, maxAgeSeconds: 300 });
 */
import { createShieldAuth, MFA_COOKIE, parseCookies, serializeCookie } from "./core.js";
import { TokenVerifier } from "./tokens.js";

export function createNextHandler(options = {}) {
  // Next.js has no socket address: the client IP only comes from proxy headers (Vercel sets them).
  const shield = createShieldAuth({ trustProxy: true, ...options });
  const basePath = (options.basePath ?? "/api/shieldauth").replace(/\/+$/, "");

  async function handler(request) {
    const url = new URL(request.url);
    // basePath may be preceded by a platform prefix (e.g. Supabase's /functions/v1)
    const at = url.pathname.indexOf(basePath);
    const route = at >= 0 ? url.pathname.slice(at + basePath.length) : url.pathname;
    let body;
    if (request.method !== "GET") {
      const text = await request.text();
      if (text.length > 64 * 1024) return Response.json({ error: "body_too_large" }, { status: 413 });
      try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
    }
    const result = await shield.handle({
      method: request.method, route, headers: request.headers, body,
      cookies: parseCookies(request.headers.get("cookie")), raw: request,
    });
    const res = Response.json(result.body, { status: result.status, headers: { "Cache-Control": "no-store" } });
    for (const c of result.cookies) res.headers.append("Set-Cookie", serializeCookie(c.name, c.value, c.options));
    return res;
  }

  return { GET: handler, POST: handler, shield };
}

let verifier = null;

/**
 * Verify the MFA cookie in server code. `cookies` may be Next's cookie store, a plain object
 * or a Cookie header string. Returns the token claims or null.
 */
export async function getMfaSession({ cookies, userId, maxAgeSeconds, baseUrl, appId, cookieName = MFA_COOKIE }) {
  let token;
  if (typeof cookies === "string") token = parseCookies(cookies)[cookieName];
  else if (typeof cookies?.get === "function") token = cookies.get(cookieName)?.value;
  else token = cookies?.[cookieName];
  if (!token || userId === undefined || userId === null) return null;
  verifier ??= new TokenVerifier({ baseUrl, appId });
  return verifier.verify(token, { userId, maxAgeSeconds });
}
