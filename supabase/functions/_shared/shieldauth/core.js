// Vendored from ShieldAuth sdk/node/src/core.js @ 0166784. Do not edit: re-run scripts/vendor-kit.mjs.
/**
 * Framework-agnostic ShieldAuth integration for your backend.
 *
 * Exposes MFA endpoints on YOUR server (e.g. /api/shieldauth/*) so that:
 *   - the API key never reaches the browser,
 *   - the user id always comes from your session (no user_id spoofing),
 *   - codes go only to the email/phone on file (no SMS pumping to arbitrary numbers),
 *   - a successful verification sets an httpOnly cookie holding a ShieldAuth-signed (ES256)
 *     MFA token that `verifySession` / `requireMfa` check offline via JWKS.
 */
import { createHash, randomBytes } from "node:crypto";
import { ShieldAuth, ShieldAuthError } from "./sdk.js";
import { TokenVerifier, b64urlToBytes } from "./tokens.js";

// Deno/Edge runtimes may not define `process`
const ENV = typeof process !== "undefined" && process.env ? process.env : {};

export const MFA_COOKIE = "sa_mfa";
export const DEVICE_COOKIE = "sa_did";
const CHANNELS = ["email", "sms", "whatsapp", "telegram"];
const COUNTRY_RE = /^[A-Z]{2}$/;

// ---------------------------------------------------------------------------
// cookies
// ---------------------------------------------------------------------------

export function parseCookies(header) {
  const out = {};
  for (const part of String(header ?? "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function serializeCookie(name, value, opts = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${opts.path ?? "/"}`;
  if (opts.maxAge !== undefined) c += `; Max-Age=${Math.max(0, Math.floor(opts.maxAge))}`;
  if (opts.domain) c += `; Domain=${opts.domain}`;
  if (opts.httpOnly !== false) c += "; HttpOnly";
  if (opts.secure) c += "; Secure";
  c += `; SameSite=${opts.sameSite ?? "Lax"}`;
  return c;
}

function headerOf(headers, name) {
  if (!headers) return undefined;
  if (typeof headers.get === "function") return headers.get(name) ?? undefined;
  const v = headers[name] ?? headers[name.toLowerCase()];
  return Array.isArray(v) ? v[0] : v;
}

// ---------------------------------------------------------------------------
// factory
// ---------------------------------------------------------------------------

/**
 * @param {{
 *   apiKey?: string, baseUrl?: string, appId?: string,
 *   getUser: (rawRequest: any) => Promise<{id: string, email?: string, phone?: string}|null> | {id: string}|null,
 *   channels?: string[], allowCustomDestination?: boolean, trustProxy?: boolean,
 *   cookieSecure?: boolean, cookieName?: string, cookieDomain?: string, sensitiveMaxAgeSeconds?: number,
 *   getContext?: (rawRequest: any) => object|Promise<object>,
 *   onVerified?: (info: {user: object, method: string, claims: object}) => void|Promise<void>,
 *   onTotpDisabled?: (info: {user: object}) => void|Promise<void>,
 *   isFresh?: (info: {user: object, maxAgeSeconds: number}) => boolean|Promise<boolean>,
 *     (overrides the MFA-cookie freshness check, e.g. server-side session records when the
 *      integration is cross-origin and cookies are not sent)
 *   locale?: "tr"|"en", client?: ShieldAuth, fetch?: typeof fetch,
 * }} options
 */
export function createShieldAuth(options = {}) {
  const cfg = {
    baseUrl: options.baseUrl ?? ENV.SHIELDAUTH_BASE_URL,
    appId: options.appId ?? ENV.SHIELDAUTH_APP_ID,
    channels: (options.channels ?? CHANNELS).filter((c) => CHANNELS.includes(c)),
    allowCustomDestination: options.allowCustomDestination ?? false,
    trustProxy: options.trustProxy ?? false,
    cookieSecure: options.cookieSecure ?? ENV.NODE_ENV === "production",
    cookieName: options.cookieName ?? MFA_COOKIE,
    // e.g. ".example.com" to share the MFA session between app.example.com and example.com
    cookieDomain: options.cookieDomain,
    sensitiveMaxAge: options.sensitiveMaxAgeSeconds ?? 300,
    locale: options.locale ?? "tr",
    getUser: options.getUser ?? ((req) => req?.user ?? null),
  };
  let client = options.client ?? null;
  const sa = () => (client ??= new ShieldAuth({ apiKey: options.apiKey, baseUrl: cfg.baseUrl, fetch: options.fetch }));
  const verifier = new TokenVerifier({ baseUrl: cfg.baseUrl, appId: cfg.appId, fetch: options.fetch });

  const cookieOpts = { httpOnly: true, secure: cfg.cookieSecure, sameSite: "Lax", path: "/", domain: cfg.cookieDomain };

  async function context(req) {
    const h = (n) => headerOf(req.headers, n);
    const ctx = { ip: req.ip, user_agent: h("user-agent")?.slice(0, 512), device_id: req.cookies?.[DEVICE_COOKIE] };
    if (cfg.trustProxy) {
      // Only behind a proxy/CDN you control: these headers are client-spoofable otherwise
      const xff = h("x-forwarded-for");
      if (xff) ctx.ip = xff.split(",")[0].trim();
      const country = (h("cf-ipcountry") ?? h("x-vercel-ip-country") ?? "").toUpperCase();
      if (COUNTRY_RE.test(country)) ctx.country = country;
      const city = h("x-vercel-ip-city");
      if (city) ctx.city = decodeURIComponent(city).slice(0, 128);
      const lat = Number(h("x-vercel-ip-latitude")), lon = Number(h("x-vercel-ip-longitude"));
      if (Number.isFinite(lat) && Number.isFinite(lon) && h("x-vercel-ip-latitude")) Object.assign(ctx, { latitude: lat, longitude: lon });
    }
    Object.assign(ctx, (await options.getContext?.(req.raw)) ?? {});
    for (const k of Object.keys(ctx)) if (ctx[k] === undefined || ctx[k] === null || ctx[k] === "") delete ctx[k];
    return ctx;
  }

  /** Verify the MFA cookie for this user. Returns token claims or null. */
  async function verifySession({ cookies, userId, maxAgeSeconds }) {
    const token = cookies?.[cfg.cookieName];
    if (!token || userId === undefined || userId === null) return null;
    return verifier.verify(token, { userId, maxAgeSeconds });
  }

  function sessionCookie(token) {
    // exp is inside the signed token; cookie lifetime mirrors it
    const payload = JSON.parse(new TextDecoder().decode(b64urlToBytes(token.split(".")[1])));
    return { name: cfg.cookieName, value: token, options: { ...cookieOpts, maxAge: payload.exp - Math.floor(Date.now() / 1000) } };
  }

  function destinationFor(channel, user, body) {
    if (cfg.allowCustomDestination && body?.destination) return String(body.destination);
    if (channel === "email") return user.email;
    return user.phone; // sms, whatsapp, telegram gateway (ignored in bot mode)
  }

  const verified = async (result, user, method, cookies) => {
    if (result.verified && result.token) {
      const claims = await verifier.verify(result.token, { userId: user.id });
      if (!claims) return { status: 502, body: { error: "invalid_token", message: "MFA token could not be verified" } };
      cookies.push(sessionCookie(result.token));
      await options.onVerified?.({ user, method, claims });
    }
    return { status: 200, body: publicResult(result) };
  };

  const routes = {
    "GET status": async ({ user, cookies: jar }) => {
      const [mfa, totp] = await Promise.all([sa().users.mfaStatus({ userId: user.id }), sa().totp.status({ userId: user.id })]);
      const session = await verifySession({ cookies: jar, userId: user.id });
      return { status: 200, body: {
        hasMfa: mfa.has_active_mfa, primaryMethod: mfa.primary_method, methods: mfa.methods,
        totp: { enrolled: totp.enrolled, verified: totp.verified }, backupCodesRemaining: mfa.backup_codes_remaining,
        channels: cfg.channels, hasEmail: Boolean(user.email), hasPhone: Boolean(user.phone),
        session: session ? { method: session.method, authTime: session.auth_time, expiresAt: session.exp } : null,
      } };
    },
    "POST totp/enroll": async ({ user }) => {
      const r = await sa().totp.enroll({ userId: user.id, label: user.label ?? user.email ?? user.username ?? String(user.id) });
      return { status: 200, body: { qrCode: r.qr_code, secret: r.secret, otpauthUrl: r.provisioning_uri } };
    },
    "POST totp/confirm": async ({ user, body, setCookies }) => {
      const r = await sa().totp.verifyEnrollment({ userId: user.id, code: String(body.code ?? "") });
      const out = await verified(r, user, "totp", setCookies);
      if (r.verified) out.body.backupCodes = r.backup_codes;
      return out;
    },
    "POST totp/verify": async ({ user, body, ctx, setCookies }) =>
      verified(await sa().totp.verify({ userId: user.id, code: String(body.code ?? ""), context: ctx }), user, "totp", setCookies),
    "POST otp/send": async ({ user, body, ctx }) => {
      const channel = String(body.channel ?? "");
      if (!cfg.channels.includes(channel)) return { status: 422, body: { error: "channel_not_allowed" } };
      const destination = destinationFor(channel, user, body);
      const fallback = (body.fallbackChannels ?? []).filter((c) => cfg.channels.includes(c) && c !== channel);
      const r = await sa().otp.send({ userId: user.id, channel, destination, fallbackChannels: fallback,
        fallbackDestination: fallback.includes("email") ? user.email : undefined, locale: body.locale ?? cfg.locale, context: ctx });
      return { status: 200, body: { sent: r.sent, channel: r.method, destination: r.destination,
        expiresInSeconds: r.expires_in_seconds, message: r.message, attemptedChannels: r.attempted_channels, risk: publicRisk(r.risk) } };
    },
    "POST otp/verify": async ({ user, body, ctx, setCookies }) => {
      const r = await sa().otp.verify({ userId: user.id, code: String(body.code ?? ""), context: ctx });
      return verified(r, user, r.method ?? "otp", setCookies);
    },
    "POST backup/verify": async ({ user, body, ctx, setCookies }) =>
      verified(await sa().backupCodes.verify({ userId: user.id, code: String(body.code ?? ""), context: ctx }), user, "backup_code", setCookies),
    "POST backup/regenerate": async ({ user, fresh }) => {
      if (!fresh) return { status: 403, body: { error: "mfa_reauth_required", message: "Verify again to continue" } };
      const r = await sa().backupCodes.regenerate({ userId: user.id });
      return { status: 200, body: { backupCodes: r.backup_codes } };
    },
    "POST totp/disable": async ({ user, fresh, setCookies }) => {
      if (!fresh) return { status: 403, body: { error: "mfa_reauth_required", message: "Verify again to continue" } };
      const r = await sa().totp.disable({ userId: user.id });
      await options.onTotpDisabled?.({ user });
      setCookies.push({ name: cfg.cookieName, value: "", options: { ...cookieOpts, maxAge: 0 } });
      return { status: 200, body: { disabled: r.disabled } };
    },
    "POST telegram/link": async ({ user }) => {
      const r = await sa().telegram.createLink({ userId: user.id });
      return { status: 200, body: { linkUrl: r.link_url, expiresInSeconds: r.expires_in_seconds } };
    },
    "POST session/clear": async ({ setCookies }) => {
      setCookies.push({ name: cfg.cookieName, value: "", options: { ...cookieOpts, maxAge: 0 } });
      return { status: 200, body: { cleared: true } };
    },
  };

  /**
   * Handle one request.
   * @param {{method: string, route: string, headers: any, body?: any, cookies?: object, ip?: string, raw?: any}} req
   * @returns {Promise<{status: number, body: object, cookies: {name: string, value: string, options: object}[]}>}
   */
  async function handle(req) {
    const setCookies = [];
    const route = `${req.method.toUpperCase()} ${String(req.route).replace(/^\/+|\/+$/g, "")}`;
    const fn = routes[route];
    if (!fn) return { status: 404, body: { error: "not_found" }, cookies: setCookies };

    if (req.method.toUpperCase() !== "GET") {
      // CSRF: a custom header + JSON body can't be sent cross-site without a CORS preflight
      const ctype = headerOf(req.headers, "content-type") ?? "";
      if (headerOf(req.headers, "x-shieldauth-request") !== "1" || !ctype.includes("application/json")) {
        return { status: 403, body: { error: "csrf_check_failed" }, cookies: setCookies };
      }
    }
    const user = await cfg.getUser(req.raw);
    if (!user || user.id === undefined || user.id === null) {
      return { status: 401, body: { error: "unauthenticated" }, cookies: setCookies };
    }
    const cookies = req.cookies ?? {};
    if (!cookies[DEVICE_COOKIE]) {
      cookies[DEVICE_COOKIE] = randomBytes(16).toString("hex");
      setCookies.push({ name: DEVICE_COOKIE, value: cookies[DEVICE_COOKIE],
        options: { ...cookieOpts, maxAge: 400 * 24 * 3600 } });
    }
    try {
      const ctx = await context({ ...req, cookies });
      const fresh = options.isFresh
        ? Boolean(await options.isFresh({ user, maxAgeSeconds: cfg.sensitiveMaxAge }))
        : Boolean(await verifySession({ cookies, userId: user.id, maxAgeSeconds: cfg.sensitiveMaxAge }));
      const result = await fn({ user, body: req.body ?? {}, ctx, cookies, setCookies, fresh });
      return { ...result, cookies: setCookies };
    } catch (err) {
      if (err instanceof ShieldAuthError) {
        return { status: err.status, body: { error: "shieldauth_error", message: err.detail, retryAfter: err.retryAfter }, cookies: setCookies };
      }
      console.error("[shieldauth]", err);
      return { status: 502, body: { error: "mfa_unavailable", message: "MFA service unavailable" }, cookies: setCookies };
    }
  }

  return {
    handle,
    verifySession,
    context,
    config: cfg,
    get client() { return sa(); },
    /**
     * Score your own password login before deciding on MFA.
     * `req` may be an Express/Node request or `{ headers }` (e.g. Next.js Server Actions: `{ headers: await headers() }`,
     * with `trustProxy: true` so the client IP is read from X-Forwarded-For).
     */
    evaluateLogin: async (req, userId) => sa().itdr.evaluate({ userId, action: "login", context: await context(normalize(req)) }),
    reportLogin: async (req, userId, success) =>
      sa().itdr.report({ userId, eventType: success ? "login_success" : "login_fail", success, context: await context(normalize(req)) }),
    /** Failed login for an unknown/unresolved account: reported under a stable hash of the identifier (email/username). */
    reportLoginFailure: async (req, identifier) =>
      sa().itdr.report({ userId: loginSubject(identifier), eventType: "login_fail", success: false, context: await context(normalize(req)) }),
  };
}

function normalize(req) {
  if (!req) return { headers: {}, cookies: {} };
  const cookies = req.cookies ?? parseCookies(headerOf(req.headers, "cookie"));
  return { ...req, cookies, ip: req.ip ?? req.socket?.remoteAddress };
}

/** Stable, non-reversible ITDR subject for an email/username that did not resolve to a user. */
export function loginSubject(identifier) {
  return "login:" + createHash("sha256").update(String(identifier ?? "").trim().toLowerCase()).digest("hex").slice(0, 32);
}

function publicRisk(risk) {
  if (!risk) return null;
  return { score: risk.score, level: risk.level, decision: risk.decision, lockedUntil: risk.locked_until ?? null };
}

function publicResult(r) {
  return {
    verified: Boolean(r.verified), message: r.message, method: r.method ?? null,
    attemptsRemaining: r.attempts_remaining ?? null, remaining: r.remaining ?? null,
    locked: Boolean(r.locked || r.risk?.locked_until), risk: publicRisk(r.risk),
  };
}
