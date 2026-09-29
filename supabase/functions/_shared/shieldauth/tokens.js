// Vendored from ShieldAuth sdk/node/src/tokens.js @ 0166784. Do not edit: re-run scripts/vendor-kit.mjs.
/**
 * Offline verification of ShieldAuth MFA tokens (ES256, keys from /.well-known/jwks.json).
 * Uses WebCrypto only: no dependencies.
 */
import { webcrypto } from "node:crypto";

// Deno/Edge runtimes may not define `process`
const ENV = typeof process !== "undefined" && process.env ? process.env : {};

const subtle = (globalThis.crypto ?? webcrypto).subtle;
// Runtime-neutral (Node, Deno/Supabase Edge, Bun): no Buffer
export function b64urlToBytes(s) {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
const decodeJson = (s) => JSON.parse(new TextDecoder().decode(b64urlToBytes(s)));

export class TokenVerifier {
  /**
   * @param {{ baseUrl?: string, appId?: string, jwksTtlMs?: number, fetch?: typeof fetch }} [options]
   */
  constructor(options = {}) {
    this.baseUrl = (options.baseUrl ?? ENV.SHIELDAUTH_BASE_URL ?? "http://localhost:8000").replace(/\/+$/, "");
    this.appId = options.appId ?? ENV.SHIELDAUTH_APP_ID;
    this.ttl = options.jwksTtlMs ?? 10 * 60 * 1000;
    this._fetch = options.fetch ?? globalThis.fetch;
    this._keys = new Map();
    this._loadedAt = 0;
  }

  async _key(kid) {
    const fresh = Date.now() - this._loadedAt < this.ttl;
    if (!fresh || !this._keys.has(kid)) {
      const res = await this._fetch(`${this.baseUrl}/.well-known/jwks.json`);
      if (!res.ok) throw new Error(`JWKS fetch failed: HTTP ${res.status}`);
      const { keys } = await res.json();
      this._keys = new Map();
      for (const jwk of keys ?? []) {
        if (jwk.kty !== "EC" || jwk.crv !== "P-256") continue;
        const key = await subtle.importKey("jwk", { kty: jwk.kty, crv: jwk.crv, x: jwk.x, y: jwk.y },
          { name: "ECDSA", namedCurve: "P-256" }, false, ["verify"]);
        this._keys.set(jwk.kid, key);
      }
      this._loadedAt = Date.now();
    }
    return this._keys.get(kid);
  }

  /**
   * Verify signature, issuer, type, expiry and audience. Returns the claims or null.
   * @param {string} token
   * @param {{ userId?: string, maxAgeSeconds?: number }} [expect]
   */
  async verify(token, expect = {}) {
    try {
      const [h, p, s] = String(token).split(".");
      if (!h || !p || !s) return null;
      const header = decodeJson(h);
      if (header.alg !== "ES256" || !header.kid) return null;
      const key = await this._key(header.kid);
      if (!key) return null;
      const ok = await subtle.verify({ name: "ECDSA", hash: "SHA-256" }, key, b64urlToBytes(s),
        new TextEncoder().encode(`${h}.${p}`));
      if (!ok) return null;
      const claims = decodeJson(p);
      const now = Math.floor(Date.now() / 1000);
      if (claims.iss !== "shieldauth" || claims.type !== "mfa_verified") return null;
      if (typeof claims.exp !== "number" || claims.exp < now) return null;
      if (this.appId && claims.aud !== this.appId) return null;
      if (expect.userId !== undefined && String(claims.sub) !== String(expect.userId)) return null;
      if (expect.maxAgeSeconds && (now - (claims.auth_time ?? 0)) > expect.maxAgeSeconds) return null;
      return claims;
    } catch {
      return null;
    }
  }
}
