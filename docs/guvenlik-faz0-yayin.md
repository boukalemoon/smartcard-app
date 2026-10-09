# Güvenlik Faz 0 — yayın adımları

**Tarih:** 08.10.2026 · **Kaynak:** QRtım Dijital Kimlik denetim raporu (G-01…G-05, O-06, O-10, O-11, D-13…D-16)

Bu belge, kodu yazılmış ve yerelde doğrulanmış düzeltmelerin **canlıya hangi sırayla** alınacağını anlatır. Sıra önemli: yanlış sırada TOTP kullanıcıları doğrulama ekranında döngüye girebilir ya da partner girişleri birkaç dakika kırılabilir.

## Ne değişti

| Bulgu | Değişiklik | Dosya |
| --- | --- | --- |
| G-02 | TOTP kurmuş kişide e-posta kodu iki adımlı doğrulama sayılmaz; taze TOTP kaydı zayıf yöntemle ezilmez | `20261008100000_…sql`, `_shared/mfa.ts`, `MfaKapisi.jsx`, `ShieldAuthContext.jsx` |
| G-01 | TOTP kurmuş kişinin kimlik tablolarına ve görsel kovalarına yazması 12 saatlik doğrulama ister (veritabanında); IBAN tetikleyicisi definer fonksiyonlarda da çalışır | `20261008100000_…sql` |
| G-03 | Partner girişinde onay ekranı; reddedince `qrtim_error=access_denied` | `Auth.jsx`, `App.jsx` |
| G-04 | Sayı eşleştirme (v2 İlgezdi), "aynı ağ mı" uyarısı, cihaz adı "kendi beyanı" diye etiketli, IP `cf-connecting-ip`'ten | `ilgezdi-qr`, `BrowserLogin.jsx`, `20261008103000_…sql` |
| G-05 | Kurtarma fonksiyonları istemciye kapalı; "Şifremi unuttum" + `/sifre-yenile` | `20261008101000_…sql`, `Auth.jsx`, `SifreYenile.jsx`, `AuthConfirm.jsx` |
| O-06 | Partner belirteci veritabanında SHA-256 özeti olarak durur | `partner-issue-token`, `arku-link`, `tinga-link`, `_shared/belirtec.ts` |
| O-10 | Görsel kovalarında MIME (jpeg/png/webp/gif) ve 5 MB sınırı; SVG kapalı | `20261008102000_…sql`, `ImageUpload.jsx` |
| O-11 | react-router 7.18.4, ws 8.22 — üretim bağımlılıklarında açık yok | `package.json`, `package-lock.json` |
| D-13…D-16 | Kayıt seli sınırı, JSON tavanları, eski uç 410, panelde güvenli bağlantı | ilgili dosyalar |

Testler: `npm run test:sql` — 23 durum, gerçek migration dosyalarıyla bellek içi PostgreSQL'de.

## Durum tespiti (09.10.2026)

- **Canlı web sitesi** GitHub `main` dalından otomatik yayınlanıyor; son yayın `aaf50d7` (11.09.2026). Bu dal `main`'in 50'den fazla commit önünde: ShieldAuth, personalar, randevu, özel alan adı ve bu güvenlik paketi dahil.
- **Edge Function'lar:** canlıda 13 fonksiyon var, `shieldauth` YOK.
- **Alan adı:** `www.qrtim.com.tr` Vercel projesine bağlı ve doğrulanmış (`qrtim.com.tr` → `www` yönlendiriyor). `qartim.com` hâlâ ayrı çalışıyor.
- **Veritabanı:** hangi migration'ların uygulandığı bilinmiyor; A adımı bunu ortaya çıkarır.

## A. Ön kontrol — hiçbir şeyi değiştirmez

### A1. Supabase SQL Editor'de çalıştırın, sonucu paylaşın
```sql
select
  to_regclass('public.personas')                  is not null as personas_0917,
  to_regclass('public.appointments')              is not null as randevu_0921,
  to_regclass('public.custom_domains')            is not null as ozel_alan_0921,
  exists (select 1 from pg_proc where proname = 'partner_effective_plan') as partner_plan_0922,
  to_regclass('public.shieldauth_mfa_assertions') is not null as shieldauth_0929,
  exists (select 1 from pg_trigger where tgname = 'trg_guard_profile_payment_mfa') as iban_kurali_0929,
  exists (select 1 from pg_trigger where tgname = 'zz_mfa_kimlik_yazma_trg')      as faz0_1008,
  to_regclass('supabase_migrations.schema_migrations') is not null as cli_gecmisi_var;
```
Son sütun `true` ise ikinci sorgu:
```sql
select version, name from supabase_migrations.schema_migrations order by version desc limit 20;
```
Not: `supabase migration list` bir SQL komutu değil, PowerShell komutudur; SQL Editor'de çalışmaz.

### A2. Supabase CLI (PowerShell)
```powershell
supabase --version
```
- *"supabase is not recognized"* → CLI kurulu değil. Kurmadan her komutun başına `npx` yazın: `npx supabase --version`.
- Sonra:
```powershell
npx supabase login                                   # tarayıcı açılır, onaylayın
npx supabase link --project-ref kfpnsxoxfrxepxezatsr  # veritabanı şifresini sorar
npx supabase migration list
npx supabase secrets list
```
Hata alırsanız hata metninin tamamını kopyalayın.

### A3. Fonksiyonların JWT ayarı (Dashboard)
Edge Functions listesinde **fonksiyonun adına tıklayın** → açılan sayfada **Details** sekmesi → *Enforce JWT Verification*. Şu dördüne bakmak yeter: `arku-link`, `tinga-link`, `signal-ingest`, `payment-callback`. Hangisi açık, hangisi kapalı not edin.

### A4. Secret'lar (CLI çalışmazsa Dashboard'dan)
Dashboard → Edge Functions → **Secrets** (sol menüde Edge Functions altında). Var olan adları not edin; değerleri paylaşmayın.

## B. Yayın (A'nın sonuçlarına göre birlikte netleştirilecek)

1. **Supabase Auth ayarları** — Authentication → URL Configuration:
   - Site URL: `https://www.qrtim.com.tr`
   - Redirect URLs: `https://www.qrtim.com.tr/**` (eski `qartim.com` satırları geçiş süresince kalsın)
   - Providers → Email: *Secure email change* açık.
   - Email Templates: içinde `qartim.com` geçen şablon varsa `www.qrtim.com.tr` yapın.
2. **Secret'lar:**
   - `SHIELDAUTH_API_KEY`, `SHIELDAUTH_APP_ID=qartim`, `SHIELDAUTH_BASE_URL`
   - `SHIELDAUTH_ALLOWED_ORIGINS=https://www.qrtim.com.tr,https://qrtim.com.tr`
   - `PUBLIC_SITE_URL=https://www.qrtim.com.tr`
   - `ALLOWED_ORIGINS=https://www.qrtim.com.tr,https://qrtim.com.tr`
   - ShieldAuth panelinde QRtım uygulamasının izinli adreslerine de yeni alan adı eklenir.
3. **Edge Function'lar** — A3'teki ayara göre (kapalı olana `--no-verify-jwt`):
   ```powershell
   npx supabase functions deploy shieldauth
   npx supabase functions deploy arku-link tinga-link
   npx supabase functions deploy partner-issue-token
   npx supabase functions deploy payment-callback --no-verify-jwt
   npx supabase functions deploy payment-start signal-ingest partner-verify-token
   ```
4. **Vercel ortam değişkeni:** Settings → Environment Variables → `VITE_PUBLIC_URL = https://www.qrtim.com.tr` (Production ve Preview).
5. **Web — önce önizleme:**
   ```powershell
   git push -u origin guvenlik/denetim-faz0
   ```
   Vercel bu dal için bir önizleme adresi üretir; giriş, kart, parola sıfırlama orada denenir. Sorun yoksa `main`'e birleştirilir:
   ```powershell
   git checkout main
   git merge --ff-only guvenlik/denetim-faz0
   git push origin main
   ```
6. **Veritabanı, sonra QR fonksiyonu** (A1'in sonucuna göre `db push` ya da SQL Editor):
   ```powershell
   npx supabase db push
   npx supabase functions deploy ilgezdi-qr
   ```
   Web yayını bitmeden veritabanı güncellenirse TOTP kullanıcıları doğrulama ekranında döngüye girer.
7. **Eski alan adı:** Vercel → Settings → Domains → `qartim.com` ve `www.qartim.com` → *Redirect to* `www.qrtim.com.tr` (308). `smartcard-app.vercel.app` da aynı yere. Basılı kartlardaki `qartim.com/card/...` ve `/k/...` adresleri yolu korunarak yeni adrese gider. **Eski alan adı süresiz yenilenmeli.**

## C. Kontroller (yayından sonra, SQL Editor)
```sql
select tgrelid::regclass as tablo from pg_trigger where tgname = 'zz_mfa_kimlik_yazma_trg';
select tgname from pg_trigger where tgname = 'trg_guard_profile_payment_mfa';
select id, allowed_mime_types, file_size_limit from storage.buckets where id in ('avatars','backgrounds','logos');
select proname, has_function_privilege('anon', oid, 'execute') anon, has_function_privilege('authenticated', oid, 'execute') auth
from pg_proc where proname like 'recovery_%';
```
**IP başlığı testi** (PowerShell):
```powershell
curl.exe -X POST https://kfpnsxoxfrxepxezatsr.supabase.co/functions/v1/ilgezdi-qr -H "apikey: <anon anahtarı>" -H "Content-Type: application/json" -H "cf-connecting-ip: 203.0.113.7" -d "{\"action\":\"create\"}"
```
```sql
select bucket_key from rate_limit_hits where bucket_key like 'qr-create:%' order by window_start desc limit 5;
```
`qr-create:203.0.113.7` görünürse başlık istemciden geliyor: `istemciIp()` geri alınır.

**Elle deneme:** şifremi unuttum akışı; TOTP hesabıyla girişte yalnızca uygulama/yedek kod; Arku girişinde onay ekranı; eski İlgezdi ile QR girişi.

## D. İlgezdi
`docs/ilgezdi-qr-v2.patch` İlgezdi deposunda uygulanır (`git apply`): sır + sayı eşleştirme + QR adresi `www.qrtim.com.tr`. Yeni sürüm kullanıcılara ulaştıktan sonra `ILGEZDI_QR_STRICT=true`.

## Acil geri alma
```sql
do $$ declare t text; begin
  foreach t in array array['profiles','personas','persona_social_links','social_links','profile_fields','custom_domains','organizations','members','appointment_settings']
  loop execute format('drop trigger if exists zz_mfa_kimlik_yazma_trg on public.%I', t); end loop;
end $$;
drop trigger if exists trg_guard_profile_payment_mfa on public.profile_payment;
```
Web: Vercel → Deployments → önceki üretim yayını → *Promote to Production*.

## Canlıda ayrıca bakılacaklar (depodan görülemiyor)
- Çekirdek tabloların politikaları (denetim raporundaki sorgu).
- `auth.users` üzerindeki tetikleyiciler: kullanıcı meta verisini `profiles`'a kopyalayan varsa `updateUser({data})` kapıyı atlar.
- `backgrounds` kovasının UPDATE/DELETE politikaları (S2 düzeltmesi yalnızca avatars ve logos'u kapsamıştı).

## Bilinen sınırlar (Faz 2'ye)
- Parola sıfırlama bağlantısı tam oturum açar; parola değişimi arayüzde TOTP ister ama API'den doğrudan da çağrılabilir. Kalıcı çözüm Supabase yerleşik MFA (aal2).
- Okuma işlemleri MFA istemez (yalnızca yazma).
- `link_secret` hâlâ düz metin: tek kullanıcıda birden çok Tınga cihazı olduğu için döndürmek mevcut cihazları koparır; OIDC geçişinde ele alınacak.
- SSO standart değil (PKCE, `state`, istemci kimlik doğrulaması yok); onay ekranı ilk adım.
