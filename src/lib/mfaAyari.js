// İKİ ADIMLI DOĞRULAMA AÇMA/KAPAMA ANAHTARI
//
// Doğrulama servisi (ShieldAuth → Korgard) henüz yayında değil. Kapalıyken:
// - doğrulama ekranları açılmaz, "adım atlama" isteyen işlemler doğrudan geçer,
// - hesap sayfasındaki "İki adımlı doğrulama" kartı gizlenir,
// - giriş kapısı (MfaKapisi) devre dışıdır.
// Veritabanı kapıları kimse TOTP kurmadığı sürece zaten kimseyi durdurmaz;
// yalnızca IBAN kuralı (trg_guard_profile_payment_mfa) servis açılana kadar
// veritabanında KAPALI tutulur (bkz. docs/guvenlik-faz0-yayin.md).
//
// Açmak için: Vercel'de VITE_MFA_AKTIF=true + servis yayında + IBAN kuralı geri.
export const MFA_AKTIF = import.meta.env.VITE_MFA_AKTIF === 'true'
