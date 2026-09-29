"use client";
// Vendored from ShieldAuth sdk/react/src/index.js @ 0166784. Do not edit: re-run scripts/vendor-kit.mjs.
/**
 * ShieldAuth React components. They talk to YOUR backend (the @shieldauth/node or
 * shieldauth[fastapi|django] integration mounted at `endpoint`), never to ShieldAuth directly.
 *
 *   import { ShieldAuthProvider, TotpSetup, MfaChallenge } from "@shieldauth/react";
 *   import "@shieldauth/react/styles.css";
 *
 * Written without JSX so it works in Next.js, Vite and CRA without extra build config.
 */
import { createContext, createElement as h, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// i18n
// ---------------------------------------------------------------------------

const STRINGS = {
  tr: {
    loading: "Yükleniyor…", error: "Bir hata oluştu. Lütfen tekrar deneyin.", retry: "Tekrar dene",
    setupTitle: "Kimlik doğrulama uygulamasını bağlayın",
    setupScan: "Google Authenticator, Microsoft Authenticator veya benzeri bir uygulama ile QR kodu okutun.",
    setupManual: "QR okutamıyor musunuz? Bu anahtarı elle girin:", copy: "Kopyala", copied: "Kopyalandı",
    enterCode: "Uygulamadaki 6 haneli kodu girin", verify: "Doğrula", verifying: "Doğrulanıyor…",
    codesTitle: "Yedek kodlarınızı saklayın",
    codesHelp: "Telefonunuza erişemezseniz bu kodlarla giriş yapabilirsiniz. Her kod yalnızca bir kez kullanılabilir.",
    download: "İndir (.txt)", copyAll: "Tümünü kopyala", saved: "Kodlarımı güvenli bir yere kaydettim", continue: "Devam et",
    done: "İki adımlı doğrulama etkin.", challengeTitle: "Kimliğinizi doğrulayın",
    method_totp: "Doğrulama uygulaması", method_sms: "SMS", method_email: "E-posta", method_whatsapp: "WhatsApp",
    method_telegram: "Telegram", method_backup: "Yedek kod",
    sendCode: "Kod gönder", resend: "Tekrar gönder ({s} sn)", resendNow: "Kodu tekrar gönder",
    sentTo: "{channel} ile {dest} adresine kod gönderildi.", backupPlaceholder: "XXXX-XXXX",
    blocked: "Güvenlik nedeniyle bu işlem geçici olarak engellendi.", locked: "Hesabınız geçici olarak kilitlendi.",
    attempts: "{n} deneme hakkınız kaldı.", codeLabel: "Doğrulama kodu", success: "Doğrulandı",
    tooMany: "Çok fazla deneme yaptınız. Lütfen biraz bekleyin.",
  },
  en: {
    loading: "Loading…", error: "Something went wrong. Please try again.", retry: "Try again",
    setupTitle: "Connect your authenticator app",
    setupScan: "Scan the QR code with Google Authenticator, Microsoft Authenticator or a similar app.",
    setupManual: "Can't scan? Enter this key manually:", copy: "Copy", copied: "Copied",
    enterCode: "Enter the 6-digit code from the app", verify: "Verify", verifying: "Verifying…",
    codesTitle: "Save your backup codes",
    codesHelp: "Use these codes to sign in if you lose access to your phone. Each code works once.",
    download: "Download (.txt)", copyAll: "Copy all", saved: "I have stored my codes somewhere safe", continue: "Continue",
    done: "Two-step verification is on.", challengeTitle: "Verify it's you",
    method_totp: "Authenticator app", method_sms: "SMS", method_email: "Email", method_whatsapp: "WhatsApp",
    method_telegram: "Telegram", method_backup: "Backup code",
    sendCode: "Send code", resend: "Resend ({s}s)", resendNow: "Resend code",
    sentTo: "Code sent via {channel} to {dest}.", backupPlaceholder: "XXXX-XXXX",
    blocked: "This action is temporarily blocked for security reasons.", locked: "Your account is temporarily locked.",
    attempts: "{n} attempt(s) left.", codeLabel: "Verification code", success: "Verified",
    tooMany: "Too many attempts. Please wait a moment.",
  },
};

function translate(locale, key, vars) {
  const s = (STRINGS[locale] ?? STRINGS.en)[key] ?? STRINGS.en[key] ?? key;
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? "")) : s;
}

// ---------------------------------------------------------------------------
// client + provider
// ---------------------------------------------------------------------------

export class ShieldAuthClientError extends Error {
  constructor(status, data) {
    super(data?.message ?? data?.error ?? `HTTP ${status}`);
    this.status = status;
    this.data = data;
  }
}

/**
 * @param {string} endpoint
 * @param {{ headers?: object | (() => object | Promise<object>) }} [options]
 *   headers: extra request headers, e.g. `async () => ({ Authorization: \`Bearer ${session.access_token}\` })`
 *   for apps that keep their session in localStorage (Supabase) instead of cookies.
 */
export function createClient(endpoint = "/api/shieldauth", options = {}) {
  const base = endpoint.replace(/\/+$/, "");
  async function req(method, path, body) {
    const extra = typeof options.headers === "function" ? await options.headers() : (options.headers ?? {});
    const init = { method, credentials: "same-origin", headers: { Accept: "application/json", ...extra } };
    if (method !== "GET") {
      init.headers["Content-Type"] = "application/json";
      init.headers["X-ShieldAuth-Request"] = "1"; // CSRF guard checked by the server integration
      init.body = JSON.stringify(body ?? {});
    }
    const res = await fetch(`${base}/${path}`, init);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ShieldAuthClientError(res.status, data);
    return data;
  }
  return {
    status: () => req("GET", "status"),
    enrollTotp: () => req("POST", "totp/enroll"),
    confirmTotp: (code) => req("POST", "totp/confirm", { code }),
    verifyTotp: (code) => req("POST", "totp/verify", { code }),
    sendOtp: (channel, fallbackChannels = [], locale) => req("POST", "otp/send", { channel, fallbackChannels, locale }),
    verifyOtp: (code) => req("POST", "otp/verify", { code }),
    verifyBackup: (code) => req("POST", "backup/verify", { code }),
    regenerateBackup: () => req("POST", "backup/regenerate"),
    disableTotp: () => req("POST", "totp/disable"),
    linkTelegram: () => req("POST", "telegram/link"),
    clearSession: () => req("POST", "session/clear"),
  };
}

const Ctx = createContext(null);

/** theme: "light" (default) | "dark" | "auto" (follows the OS setting) */
export function ShieldAuthProvider({ endpoint = "/api/shieldauth", locale = "tr", theme = "light", headers, children }) {
  // keep the latest headers getter without recreating the client on every render
  const headersRef = useRef(headers);
  headersRef.current = headers;
  const value = useMemo(() => ({
    client: createClient(endpoint, {
      headers: () => (typeof headersRef.current === "function" ? headersRef.current() : (headersRef.current ?? {})),
    }),
    locale, theme, t: (k, v) => translate(locale, k, v),
  }), [endpoint, locale, theme]);
  return h(Ctx.Provider, { value }, children);
}

export function useShieldAuth() {
  const ctx = useContext(Ctx);
  if (ctx) return ctx;
  // Works without a provider too (defaults)
  return { client: createClient(), locale: "tr", theme: "light", t: (k, v) => translate("tr", k, v) };
}

/** Current MFA status of the signed-in user: { data, error, loading, reload } */
export function useMfaStatus() {
  const { client } = useShieldAuth();
  const [state, setState] = useState({ data: null, error: null, loading: true });
  const reload = useCallback(() => {
    setState((s) => ({ ...s, loading: true }));
    client.status().then((data) => setState({ data, error: null, loading: false }))
      .catch((error) => setState({ data: null, error, loading: false }));
  }, [client]);
  useEffect(() => { reload(); }, [reload]);
  return { ...state, reload };
}

function errorMessage(err, t) {
  if (!err) return null;
  if (err.status === 429) return t("tooMany");
  if (err.status === 423) return t("locked");
  return err.data?.message ?? t("error");
}

function resultMessage(res, t) {
  if (res?.risk?.decision === "block") return res.locked ? t("locked") : t("blocked");
  const base = res?.message ?? t("error");
  return res?.attemptsRemaining !== null && res?.attemptsRemaining !== undefined
    ? `${base} ${t("attempts", { n: res.attemptsRemaining })}` : base;
}

// ---------------------------------------------------------------------------
// primitives
// ---------------------------------------------------------------------------

export function CodeInput({ length = 6, value, onChange, onComplete, disabled, autoFocus, label }) {
  const refs = useRef([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");
  const set = (next) => {
    const clean = next.replace(/\D/g, "").slice(0, length);
    onChange(clean);
    if (clean.length === length) onComplete?.(clean);
    return clean;
  };
  useEffect(() => { if (autoFocus) refs.current[0]?.focus(); }, [autoFocus]);
  return h("div", { className: "sa-code", role: "group", "aria-label": label },
    digits.map((d, i) => h("input", {
      key: i, ref: (el) => { refs.current[i] = el; }, className: "sa-code__box", value: d, disabled,
      inputMode: "numeric", autoComplete: i === 0 ? "one-time-code" : "off", maxLength: length,
      "aria-label": `${label ?? "code"} ${i + 1}`,
      onChange: (e) => {
        const typed = e.target.value.replace(/\D/g, "");
        if (!typed) return;
        const next = set((value.slice(0, i) + typed + value.slice(i + typed.length)));
        refs.current[Math.min(next.length, length - 1)]?.focus();
      },
      onKeyDown: (e) => {
        if (e.key === "Backspace") {
          e.preventDefault();
          set(value.slice(0, Math.max(0, d ? i : i - 1)) + value.slice(i + 1));
          refs.current[Math.max(0, d ? i : i - 1)]?.focus();
        } else if (e.key === "ArrowLeft") refs.current[i - 1]?.focus();
        else if (e.key === "ArrowRight") refs.current[i + 1]?.focus();
      },
      onPaste: (e) => {
        e.preventDefault();
        const next = set(e.clipboardData.getData("text"));
        refs.current[Math.min(next.length, length - 1)]?.focus();
      },
    })));
}

function CopyButton({ text, t }) {
  const [done, setDone] = useState(false);
  return h("button", {
    type: "button", className: "sa-btn sa-btn--ghost",
    onClick: async () => { try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* ignore */ } },
  }, done ? t("copied") : t("copy"));
}

function Alert({ kind = "error", children }) {
  if (!children) return null;
  return h("div", { className: `sa-alert sa-alert--${kind}`, role: kind === "error" ? "alert" : "status" }, children);
}

export function BackupCodes({ codes, onConfirm }) {
  const { t } = useShieldAuth();
  const [saved, setSaved] = useState(false);
  const text = codes.join("\n");
  const download = () => {
    const url = URL.createObjectURL(new Blob([text + "\n"], { type: "text/plain" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: "backup-codes.txt" });
    a.click();
    URL.revokeObjectURL(url);
  };
  return h("div", { className: "sa-stack" },
    h("h3", { className: "sa-title" }, t("codesTitle")),
    h("p", { className: "sa-muted" }, t("codesHelp")),
    h("ul", { className: "sa-codes" }, codes.map((c) => h("li", { key: c }, h("code", null, c)))),
    h("div", { className: "sa-row" },
      h(CopyButton, { text, t }),
      h("button", { type: "button", className: "sa-btn sa-btn--ghost", onClick: download }, t("download"))),
    onConfirm && h("label", { className: "sa-check" },
      h("input", { type: "checkbox", checked: saved, onChange: (e) => setSaved(e.target.checked) }), t("saved")),
    onConfirm && h("button", { type: "button", className: "sa-btn sa-btn--primary", disabled: !saved, onClick: onConfirm },
      t("continue")));
}

// ---------------------------------------------------------------------------
// TotpSetup
// ---------------------------------------------------------------------------

export function TotpSetup({ onComplete, className }) {
  const { client, t, theme } = useShieldAuth();
  const [step, setStep] = useState("loading");
  const [enroll, setEnroll] = useState(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [codes, setCodes] = useState([]);

  const start = useCallback(() => {
    setStep("loading");
    setError(null);
    client.enrollTotp().then((r) => { setEnroll(r); setStep("scan"); })
      .catch((e) => { setError(errorMessage(e, t)); setStep("error"); });
  }, [client, t]);
  useEffect(() => { start(); }, [start]);

  const confirm = async (value = code) => {
    if (value.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = await client.confirmTotp(value);
      if (r.verified) { setCodes(r.backupCodes ?? []); setStep("codes"); }
      else { setError(resultMessage(r, t)); setCode(""); }
    } catch (e) { setError(errorMessage(e, t)); setCode(""); }
    setBusy(false);
  };

  let body;
  if (step === "loading") body = h("p", { className: "sa-muted" }, t("loading"));
  else if (step === "error") body = h("div", { className: "sa-stack" }, h(Alert, null, error),
    h("button", { type: "button", className: "sa-btn", onClick: start }, t("retry")));
  else if (step === "scan") body = h("div", { className: "sa-stack" },
    h("h3", { className: "sa-title" }, t("setupTitle")),
    h("p", { className: "sa-muted" }, t("setupScan")),
    h("img", { className: "sa-qr", src: enroll.qrCode, alt: "QR", width: 192, height: 192 }),
    h("p", { className: "sa-muted sa-small" }, t("setupManual")),
    h("div", { className: "sa-row" }, h("code", { className: "sa-secret" }, enroll.secret), h(CopyButton, { text: enroll.secret, t })),
    h("label", { className: "sa-label" }, t("enterCode")),
    h(CodeInput, { value: code, onChange: setCode, onComplete: confirm, disabled: busy, autoFocus: true, label: t("codeLabel") }),
    h(Alert, null, error),
    h("button", { type: "button", className: "sa-btn sa-btn--primary", disabled: busy || code.length !== 6, onClick: () => confirm() },
      busy ? t("verifying") : t("verify")));
  else if (step === "codes") body = h(BackupCodes, { codes, onConfirm: () => { setStep("done"); onComplete?.(); } });
  else body = h(Alert, { kind: "success" }, t("done"));

  return h("div", { className: ["sa-card", className].filter(Boolean).join(" "), "data-theme": theme }, body);
}

// ---------------------------------------------------------------------------
// MfaChallenge
// ---------------------------------------------------------------------------

const OTP_METHODS = ["sms", "email", "whatsapp", "telegram"];

export function MfaChallenge({ methods = ["totp", "backup"], defaultMethod, fallbackChannels = [], onVerified, className }) {
  const { client, t, locale, theme } = useShieldAuth();
  const [method, setMethod] = useState(defaultMethod ?? methods[0]);
  const [code, setCode] = useState("");
  const [backup, setBackup] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [info, setInfo] = useState(null);
  const [cooldown, setCooldown] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (!cooldown) return undefined;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  const choose = (m) => { setMethod(m); setCode(""); setBackup(""); setError(null); setInfo(null); };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const r = await client.sendOtp(method, fallbackChannels, locale);
      if (r.sent) {
        setInfo(t("sentTo", { channel: t(`method_${r.channel}`), dest: r.destination }));
        setCooldown(60);
      } else setError(r.risk?.decision === "block" ? t("blocked") : (r.message ?? t("error")));
    } catch (e) { setError(errorMessage(e, t)); }
    setBusy(false);
  };

  const submit = async (value) => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const r = method === "totp" ? await client.verifyTotp(value)
        : method === "backup" ? await client.verifyBackup(value) : await client.verifyOtp(value);
      if (r.verified) { setDone(true); onVerified?.(r); }
      else { setError(resultMessage(r, t)); setCode(""); }
    } catch (e) { setError(errorMessage(e, t)); setCode(""); }
    setBusy(false);
  };

  const cardProps = { className: ["sa-card", className].filter(Boolean).join(" "), "data-theme": theme };
  if (done) return h("div", cardProps, h(Alert, { kind: "success" }, t("success")));

  const isOtp = OTP_METHODS.includes(method);
  return h("div", cardProps,
    h("div", { className: "sa-stack" },
      h("h3", { className: "sa-title" }, t("challengeTitle")),
      methods.length > 1 && h("div", { className: "sa-tabs", role: "tablist" }, methods.map((m) => h("button", {
        key: m, type: "button", role: "tab", "aria-selected": m === method,
        className: `sa-tab${m === method ? " sa-tab--active" : ""}`, onClick: () => choose(m),
      }, t(`method_${m}`)))),
      isOtp && h("div", { className: "sa-row" }, h("button", {
        type: "button", className: "sa-btn", disabled: busy || cooldown > 0, onClick: send,
      }, cooldown > 0 ? t("resend", { s: cooldown }) : info ? t("resendNow") : t("sendCode"))),
      h(Alert, { kind: "info" }, info),
      method === "backup"
        ? h("form", { className: "sa-stack", onSubmit: (e) => { e.preventDefault(); submit(backup); } },
            h("input", { className: "sa-input", value: backup, onChange: (e) => setBackup(e.target.value),
              placeholder: t("backupPlaceholder"), autoComplete: "off", "aria-label": t("method_backup"), maxLength: 12 }),
            h("button", { type: "submit", className: "sa-btn sa-btn--primary", disabled: busy || backup.length < 8 },
              busy ? t("verifying") : t("verify")))
        : (!isOtp || info) && h("div", { className: "sa-stack" },
            h(CodeInput, { value: code, onChange: setCode, onComplete: submit, disabled: busy, autoFocus: true, label: t("codeLabel") }),
            h("button", { type: "button", className: "sa-btn sa-btn--primary", disabled: busy || code.length !== 6,
              onClick: () => submit(code) }, busy ? t("verifying") : t("verify"))),
      h(Alert, null, error)));
}

export { translate as t };
