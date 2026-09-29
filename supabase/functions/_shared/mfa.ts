// TAZE İKİ ADIMLI DOĞRULAMA KONTROLÜ (Edge Function'lar için)
//
// NEDEN: QRtım, Arku / İlgezdi / Tınga'nın kimlik sağlayıcısı. Bir QRtım
// oturumu ele geçirilirse partner belirteci ve QR cihaz onayı üzerinden
// diğer uygulamalara da girilebiliyordu. Kullanıcı doğrulama uygulaması
// (TOTP) kurmuşsa bu işlemler artık o OTURUMDA yakın zamanda iki adımlı
// doğrulama yapılmış olmasını ister.
//
// Kaynak: shieldauth Edge Function'ı her başarılı doğrulamada o anki Supabase
// oturumuna (JWT'deki session_id) bir kayıt yazar
// (bkz. migrations/20260929090000_shieldauth_mfa.sql). Burada yalnızca okunur.
//
// AŞAMALI GEÇİŞ: TOTP kurmamış kullanıcı için zorunluluk YOK — aksi halde
// özellik yayına girdiği an herkes partner uygulamalardan kilitlenirdi.
//
// HATA DURUMU: Bir güvenlik kapısı hata verdiğinde GEÇİRMEMELİ. Tek istisna
// tablonun henüz hiç olmaması (fonksiyon migration'dan önce yayınlanırsa):
// o zaman özellik daha yayında değildir, kimseyi kilitlemeyiz. Başka her hata
// (bağlantı kopması, şema önbelleği, hız sınırı) "doğrulama yok" sayılır —
// aksi halde çalınmış bir oturum, sorguyu hata verdirerek kapıyı açabilirdi.

// deno-lint-ignore no-explicit-any
type Admin = any;

/** Supabase erişim belirtecindeki oturum kimliği (imzayı getUser zaten doğruladı). */
export function oturumKimligi(authHeader: string | null): string | null {
  const jwt = (authHeader ?? "").replace(/^Bearer\s+/i, "");
  try {
    const parca = jwt.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const govde = JSON.parse(atob(parca + "=".repeat((4 - (parca.length % 4)) % 4)));
    return typeof govde.session_id === "string" ? govde.session_id : null;
  } catch {
    return null;
  }
}

/**
 * true → kullanıcı TOTP kurmuş ama bu oturumda son `sureSn` saniyede doğrulama yok.
 * Çağıran bu durumda 403 { code: "mfa_required" } döner; istemci doğrulatıp tekrar dener.
 */
export async function tazeMfaEksik(admin: Admin, userId: string, sessionId: string | null, sureSn: number): Promise<boolean> {
  const { data: kayit, error } = await admin
    .from("shieldauth_mfa_users")
    .select("totp_enrolled")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    // 42P01 / PGRST205 = tablo yok → özellik henüz yayında değil, geçir.
    const kod = String((error as { code?: string }).code ?? "");
    if (kod === "42P01" || kod === "PGRST205") return false;
    return true; // başka her hata: kapıyı kapalı tut.
  }
  if (!kayit?.totp_enrolled) return false;
  if (!sessionId) return true;

  const sinir = new Date(Date.now() - sureSn * 1000).toISOString();
  const { data: onay } = await admin
    .from("shieldauth_mfa_assertions")
    .select("user_id")
    .eq("user_id", userId)
    .eq("session_id", sessionId)
    .gte("verified_at", sinir)
    .maybeSingle();
  return !onay;
}
