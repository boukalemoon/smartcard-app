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
- **Edge Function'lar:** canlıda 13 fonksiyon var, `shieldauth` YOK. JWT ayarı: `arku-link` açık; `tinga-link`, `signal-ingest`, `payment-callback` kapalı; `ilgezdi-qr` kontrol edilecek (kapalı olmalı).
- **Secret'lar:** yalnızca `ARKU_API_KEY` ve `VERCEL_TOKEN` özel; `SHIELDAUTH_*` ve ödeme anahtarları yok (ödeme kapalı kalır).
- **Alan adı:** `www.qrtim.com.tr` Vercel projesine bağlı ve doğrulanmış. `qartim.com` hâlâ ayrı çalışıyor.
- **Veritabanı:** personalar, randevu, özel alan adı ve partner planı canlıda. 09.10.2026'da iki Faz 0 paketi de uygulandı (B1).
- **Migration geçmişi uyuşmuyor:** depodaki birçok dosya (0510, 0713–0718, 0909–0922 arası) canlıya panelden/başka sürüm numarasıyla uygulanmış. Bu yüzden **`supabase db push` KULLANILMAZ** — eski dosyaları yeniden çalıştırmaya kalkar. Veritabanı değişiklikleri `docs/yayin/` altındaki iki hazır dosyayla SQL Editor'den yapılır.
- **CLI:** `supabase` komutu PATH'te değil; her komut `npx supabase ...` şeklinde yazılır.

## B. Yayın — sırayla

**Karar (09.10.2026):** İki adımlı doğrulama servisi (ShieldAuth, yeni adıyla **Korgard**) henüz geliştiriliyor. Faz 0 yayını ona BAĞLANMADAN çıkar: web'de doğrulama ekranları `VITE_MFA_AKTIF` anahtarıyla kapalı, `shieldauth` fonksiyonu yayınlanmaz, IBAN kuralı veritabanında geçici olarak kapalı. Kimse TOTP kuramadığı için diğer veritabanı kapıları kimseyi durdurmaz; servis açıldığı gün tek tek devreye girer (bkz. E).

**1. ✅ Veritabanı paketleri (09.10.2026 ikisi de çalıştırıldı)** — `docs/yayin/1_shieldauth_altyapi.sql` ve `docs/yayin/2_kurallari_ac.sql`.

**1b. IBAN kuralını geçici kapat** (SQL Editor) — doğrulama servisi olmadan kimse IBAN/fatura bilgisi değiştiremez, bu yüzden:
   ```sql
   drop trigger if exists trg_guard_profile_payment_mfa on public.profile_payment;
   ```

**2. ✅ Supabase Auth ayarları** — Authentication → URL Configuration (Site URL ve Redirect URLs yeni alan adıyla). Kontrol: Providers → Email → *Secure email change* açık; Email Templates içinde `qartim.com` geçmiyor.

**3. Secret'lar** — Edge Functions → **Secrets** → *Add new secret* (Name / Value), kaydet:
   - `PUBLIC_SITE_URL` = `https://www.qrtim.com.tr`
   - `ALLOWED_ORIGINS` = `https://www.qrtim.com.tr,https://qrtim.com.tr`
   - `SHIELDAUTH_*` şimdilik EKLENMEZ (E bölümü).

**4. Edge Function'lar** (PowerShell, `networqr` klasöründe). Paneldeki JWT ayarı korunur:
   ```powershell
   npx supabase functions deploy arku-link
   npx supabase functions deploy tinga-link --no-verify-jwt
   npx supabase functions deploy partner-issue-token
   npx supabase functions deploy payment-callback --no-verify-jwt
   npx supabase functions deploy signal-ingest --no-verify-jwt
   npx supabase functions deploy payment-start
   npx supabase functions deploy partner-verify-token
   npx supabase functions deploy ilgezdi-qr --no-verify-jwt   # panelde JWT kapalıysa
   ```

**5. Vercel ortam değişkenleri:** Settings → Environment Variables (Production ve Preview):
   - `VITE_PUBLIC_URL` = `https://www.qrtim.com.tr`
   - `VITE_MFA_AKTIF` EKLENMEZ (yokken doğrulama ekranları kapalı).

**6. Web — önce önizleme:**
   ```powershell
   git push -u origin guvenlik/denetim-faz0
   ```
   Vercel bu dal için önizleme adresi üretir; giriş, kart düzenleme, görsel yükleme, IBAN kaydetme, parola sıfırlama orada denenir. Sorun yoksa `main`'e birleştirilir:
   ```powershell
   git checkout main
   git merge --ff-only guvenlik/denetim-faz0
   git push origin main
   ```

**7. Eski alan adı:** Vercel → Settings → Domains → `qartim.com` ve `www.qartim.com` → *Redirect to* `www.qrtim.com.tr` (308). Basılı kartlardaki `qartim.com/card/...` ve `/k/...` adresleri yolu korunarak yeni adrese gider. **Eski alan adı süresiz yenilenmeli.**

**İsteğe bağlı — geçmişi düzeltme:** CLI geçmişini dosyalarla eşitlemek (ileride `db push` kullanabilmek için) ayrı ve dikkat isteyen bir iş; canlıdaki her sürüm tek tek karşılaştırılarak `npx supabase migration repair` ile yapılır. Faz 0 yayını için gerekmez.

## E. Doğrulama servisini açma (Korgard hazır olduğunda)

Sırayla:
1. Secret'lar: `SHIELDAUTH_API_KEY`, `SHIELDAUTH_APP_ID`, `SHIELDAUTH_BASE_URL`, `SHIELDAUTH_ALLOWED_ORIGINS=https://www.qrtim.com.tr,https://qrtim.com.tr` (Korgard'a geçişte adlar değişirse fonksiyon kodu da birlikte güncellenir).
2. `npx supabase functions deploy shieldauth` → önizlemede e-posta kodu ve TOTP kurulumu denenir.
3. Vercel: `VITE_MFA_AKTIF=true` → yeniden yayın.
4. IBAN kuralını geri aç (SQL Editor):
   ```sql
   create trigger trg_guard_profile_payment_mfa
     before insert or update on public.profile_payment
     for each row execute function public.guard_profile_payment_mfa();
   ```
5. Sonra İlgezdi v2 (D) ve `ILGEZDI_QR_STRICT=true`.

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
