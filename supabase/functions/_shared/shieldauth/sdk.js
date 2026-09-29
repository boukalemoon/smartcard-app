// Vendored from ShieldAuth sdk/js/src/index.js @ 0166784. Do not edit: re-run scripts/vendor-kit.mjs.
/**
 * ShieldAuth JavaScript SDK (Node 18+, Deno, Bun, edge runtimes — anything with fetch).
 *
 *   import { ShieldAuth } from "@shieldauth/sdk";
 *   const sa = new ShieldAuth({ apiKey: process.env.SHIELDAUTH_API_KEY, baseUrl: "https://auth.example.com" });
 *   await sa.otp.send({ userId: "u_123", channel: "telegram", destination: "+905551234567" });
 *   const r = await sa.otp.verify({ userId: "u_123", code, context: { ip } });
 *   if (r.verified && r.risk?.decision !== "block") { ... }
 *
 * Never use an API key in browser code: call ShieldAuth from your backend.
 */

const DEFAULT_BASE_URL = "http://localhost:8000";
const VERSION = "1.1.0";

export class ShieldAuthError extends Error {
  constructor(status, detail, body, retryAfter) {
    super(`[${status}] ${detail}`);
    this.name = "ShieldAuthError";
    this.status = status;
    this.detail = detail;
    this.body = body;
    this.retryAfter = retryAfter;
  }
}

export class AuthenticationError extends ShieldAuthError { name = "AuthenticationError"; }
export class PermissionDeniedError extends ShieldAuthError { name = "PermissionDeniedError"; }
export class NotFoundError extends ShieldAuthError { name = "NotFoundError"; }
export class ConflictError extends ShieldAuthError { name = "ConflictError"; }
export class ValidationError extends ShieldAuthError { name = "ValidationError"; }
export class RateLimitError extends ShieldAuthError { name = "RateLimitError"; }

const ERROR_BY_STATUS = {
  400: ValidationError, 401: AuthenticationError, 403: PermissionDeniedError, 404: NotFoundError,
  409: ConflictError, 422: ValidationError, 429: RateLimitError,
};

/** camelCase SDK options -> snake_case API fields, dropping undefined/null */
function body(fields) {
  const out = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

const enc = encodeURIComponent;

export class ShieldAuth {
  /**
   * @param {{apiKey?: string, baseUrl?: string, timeoutMs?: number, fetch?: typeof fetch}} [options]
   */
  constructor(options = {}) {
    const env = typeof process !== "undefined" ? process.env : {};
    this.apiKey = options.apiKey ?? env.SHIELDAUTH_API_KEY;
    if (!this.apiKey) throw new Error("apiKey is required (or set SHIELDAUTH_API_KEY)");
    this.baseUrl = (options.baseUrl ?? env.SHIELDAUTH_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeoutMs = options.timeoutMs ?? 15000;
    this._fetch = options.fetch ?? globalThis.fetch;
    if (!this._fetch) throw new Error("No fetch implementation available; pass options.fetch");

    const req = this._request.bind(this);

    this.totp = {
      enroll: ({ userId, label, email, deviceName }) =>
        req("POST", "/api/v1/mfa/totp/enroll", body({ user_id: userId, label, email, device_name: deviceName })),
      verifyEnrollment: ({ userId, code }) =>
        req("POST", "/api/v1/mfa/totp/verify-enrollment", body({ user_id: userId, code })),
      verify: ({ userId, code, context }) =>
        req("POST", "/api/v1/mfa/totp/verify", body({ user_id: userId, code, context })),
      status: ({ userId }) => req("GET", `/api/v1/mfa/totp/status/${enc(userId)}`),
      disable: ({ userId }) => req("POST", "/api/v1/mfa/totp/disable", body({ user_id: userId })),
    };

    this.otp = {
      send: ({ userId, channel, destination, fallbackChannels, fallbackDestination, locale, context }) =>
        req("POST", "/api/v1/mfa/otp/send", body({
          user_id: userId, channel, destination, fallback_channels: fallbackChannels ?? [],
          fallback_destination: fallbackDestination, locale, context,
        })),
      verify: ({ userId, code, method, context }) =>
        req("POST", "/api/v1/mfa/otp/verify", body({ user_id: userId, code, method, context })),
    };

    this.backupCodes = {
      verify: ({ userId, code, context }) =>
        req("POST", "/api/v1/mfa/backup-codes/verify", body({ user_id: userId, code, context })),
      regenerate: ({ userId }) => req("POST", "/api/v1/mfa/backup-codes/regenerate", body({ user_id: userId })),
      status: ({ userId }) => req("GET", `/api/v1/mfa/backup-codes/status/${enc(userId)}`),
    };

    this.telegram = {
      createLink: ({ userId }) => req("POST", "/api/v1/mfa/telegram/link", body({ user_id: userId })),
      linkStatus: ({ userId }) => req("GET", `/api/v1/mfa/telegram/link/status/${enc(userId)}`),
      unlink: ({ userId }) => req("DELETE", `/api/v1/mfa/telegram/link/${enc(userId)}`),
    };

    this.itdr = {
      evaluate: ({ userId, action = "login", context }) =>
        req("POST", "/api/v1/itdr/evaluate", body({ user_id: userId, action, context })),
      report: ({ userId, eventType, success, context, metadata }) =>
        req("POST", "/api/v1/itdr/report", body({ user_id: userId, event_type: eventType, success, context, metadata })),
    };

    this.users = {
      mfaStatus: ({ userId }) => req("GET", `/api/v1/auth/mfa/status/${enc(userId)}`),
      events: ({ userId, limit = 20 }) => req("GET", `/api/v1/auth/events/${enc(userId)}?limit=${limit}`),
    };

    this.tokens = {
      verify: ({ token }) => req("POST", "/api/v1/auth/token/verify", { token }),
    };
  }

  async _request(method, path, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res;
    try {
      res = await this._fetch(`${this.baseUrl}${path}`, {
        method,
        headers: {
          "X-ShieldAuth-Key": this.apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
          "X-ShieldAuth-SDK": `js/${VERSION}`,
        },
        body: payload === undefined ? undefined : JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }

    const text = await res.text();
    let data = {};
    if (text) {
      try { data = JSON.parse(text); } catch { data = { detail: text.slice(0, 200) }; }
    }
    if (!res.ok) {
      const Err = ERROR_BY_STATUS[res.status] ?? ShieldAuthError;
      const retry = Number(res.headers.get("retry-after")) || undefined;
      throw new Err(res.status, typeof data.detail === "string" ? data.detail : "Request failed", data, retry);
    }
    return data;
  }
}

export default ShieldAuth;
