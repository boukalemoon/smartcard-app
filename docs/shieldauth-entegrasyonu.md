# ShieldAuth — iki adımlı doğrulama (QRtım)

QRtım, Arku / İlgezdi / Tınga'nın kimlik sağlayıcısı. Bir QRtım hesabının ele geçirilmesi bağlı
uygulamalara da yayılıyordu; IBAN'ın herkese açık kartta gösterilmesi de ödeme yönlendirme
dolandırıcılığına açıktı. Bu değişiklik ikisini de ShieldAuth ile kapatır.

## Neler değişti

| Alan | Kural | Nerede uygulanıyor |
|---|---|---|
| Banka hesabı / fatura bilgisi | Herkes için son **10 dk** içinde iki adımlı doğrulama (TOTP yoksa doğrulanmış e-postaya kod) | Veritabanı tetikleyicisi `trg_guard_profile_payment_mfa` |
| Yönetici (`is_admin()`) | TOTP kurmuş yöneticide son **12 saat** içinde doğrulama | `is_admin()` — tüm yönetici RPC'leri |
| Partner belirteci (Arku/İlgezdi/Tınga) | TOTP kurmuş kişide bu oturumda son **12 saat** | `partner-issue-token` |
| QR ile başka cihaza oturum onayı | TOTP kurmuş kişide son **10 dk** | `ilgezdi-qr` (`approve`) |
| Panele giriş | TOTP kurmuş kişi 12 saatte bir doğrular | `MfaKapisi` (arayüz) |
| Yönetici/kurum dışa aktarması | Şifre penceresi yerine iki adımlı doğrulama | `AdminCRM`, `CorporateDashboard` |
| Hesap → İki adımlı doğrulama | TOTP kurma, yedek kodlar, kapatma (kapatma/yenileme taze doğrulama ister) | `GuvenlikKarti` |

Arayüz yalnızca kolaylık: kurallar veritabanında ve Edge Function'larda. Doğrulama kaydı Supabase
**oturumuna** (`session_id`) bağlıdır; çalınan başka bir oturum bu kaydı kullanamaz.

Kodlar yalnızca **doğrulanmış e-postaya** gider. `profiles.phone` doğrulanmadığı için SMS/WhatsApp kapalı.

## Yayın sırası

1. **Migration:** `supabase/migrations/20260929090000_shieldauth_mfa.sql`
2. **Edge Function ve secret'lar:**
   ```bash
   supabase secrets set SHIELDAUTH_API_KEY=sa_... SHIELDAUTH_APP_ID=qartim \
     SHIELDAUTH_BASE_URL=https://<shieldauth-api> \
     SHIELDAUTH_ALLOWED_ORIGINS=https://qartim.com,https://www.qartim.com
   supabase functions deploy shieldauth          # verify_jwt açık kalsın
   supabase functions deploy partner-issue-token ilgezdi-qr
   ```
   API anahtarı ShieldAuth panelinden (Uygulamalar) alınır; tarayıcıya hiç gitmez.
3. **Web uygulaması** (Vercel)

1 uygulanıp 2 yayınlanmazsa IBAN değişikliği "doğrulama gerekli" hatası verir ama kişi doğrulayamaz.
Acil geri alma: `drop trigger trg_guard_profile_payment_mfa on public.profile_payment;`

## Aşamalı yönetici zorunluluğu

Şu an TOTP kurmamış yönetici eskisi gibi çalışır (yayın anında kilitlenme olmasın). Tüm yöneticiler
Hesap → İki adımlı doğrulama'dan kurduktan sonra `supabase/bekleyen/shieldauth_yonetici_zorunlu.sql`
uygulanır (dosyadaki kontrol sorgusuyla doğrulayın).

## Vendor edilen kod

- `supabase/functions/_shared/shieldauth/` ve `src/vendor/shieldauth-react/` ShieldAuth reposundan kopyadır.
  Elle düzenlemeyin; güncellemek için ShieldAuth reposunda:
  `node scripts/vendor-kit.mjs --edge <qrtim>/supabase/functions/_shared/shieldauth --react <qrtim>/src/vendor/shieldauth-react`

## Test edilenler

- Migration, geçici bir Supabase Postgres (aynı imaj) üzerinde 18 senaryo: IBAN/fatura/upsert reddi,
  başka oturumun kaydı, 10 dk bayatlama, service_role muafiyeti, istemcinin tabloları okuyamaması/yazamaması,
  aşamalı ve zorunlu `is_admin()`; iki kez uygulanabilirlik.
- `shieldauth` Edge Function gerçek Deno'da, sahte Supabase + gerçek ShieldAuth API ile 15 senaryo.
- Değişen Edge Function'lar `deno check` ile tip denetiminden geçti.
- Arayüz bileşenleri (adım atlama penceresi, giriş kapısı, güvenlik kartı, IBAN akışı) tarayıcıda 14 senaryo.
- `node scripts/kontrol.mjs`: derleme temiz, lint tabanı korunuyor.

Canlı projede henüz **denenmedi**: migration ve fonksiyonlar canlıya uygulanmadı.

## Sonraki adımlar

- Şifre girişini sunucuya almak (`api/auth/login.js`) → ITDR başarısız girişleri de görsün (kaba kuvvet, credential stuffing).
- Telefon doğrulama akışı → SMS/WhatsApp kanalları.
- Partner belirtecine `amr` / doğrulama zamanı bilgisi → Arku/İlgezdi kendi tarafında da güvenebilsin.
- Kurum silme, özel alan adı, takvim anahtarı gibi orta öncelikli işlemlere `shieldauth_mfa_fresh` eklemek.
