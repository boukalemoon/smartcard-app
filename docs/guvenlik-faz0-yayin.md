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

## Başlamadan önce bilinmesi gereken

- Bu değişiklikler `guvenlik/denetim-faz0` dalında; dal `feat/shieldauth-mfa`'nın üzerine kurulu. O dal da `main`'in 44 commit önünde ve **ShieldAuth henüz canlıya alınmadı** (bkz. `docs/shieldauth-entegrasyonu.md`). Yani bu yayın ShieldAuth'u da canlıya alır.
- Canlı veritabanında hangi migration'ların uygulandığını depodan bilemiyoruz. 2. adım bunu gösterir; orada beklenmedik bir liste çıkarsa durun.
- **verify_jwt:** depoda `supabase/config.toml` yok. `supabase functions deploy` her fonksiyonu JWT zorunlu yayınlar. Panelde (Edge Functions → fonksiyon → Details → *Enforce JWT Verification*) kapalı olanları yayınlarken komuta `--no-verify-jwt` ekleyin. `payment-callback` kesinlikle kapalı olmalı.

## Adım adım (Windows, PowerShell)

### 0. Yerel hazırlık
```powershell
cd $HOME\Desktop\networqr
git checkout guvenlik/denetim-faz0
npm install
npm run test:sql          # "23 gecti, 0 kaldi" görmelisiniz
node scripts/kontrol.mjs  # "SONUÇ: geçti"
```

### 1. Panel ayarları (Supabase Dashboard, tarayıcıdan)
1. **Authentication → URL Configuration → Redirect URLs:** `https://www.qartim.com/sifre-yenile` ve `https://qartim.com/sifre-yenile` ekleyin.
2. **Authentication → Providers → Email:** *Secure email change* açık olsun.
3. ShieldAuth panelinden (Uygulamalar) QRtım uygulamasının API anahtarını alın; 3. adımda lazım.

### 2. Canlıdaki durum
```powershell
supabase migration list        # "Remote" sütunu boş olanlar henüz uygulanmamış
supabase db push --dry-run     # uygulanacak dosyaların listesi; hiçbir şey değiştirmez
```
Listede en az şunlar olmalı: `20260929090000`, `20260929091000`, `20261008100000`, `20261008101000`, `20261008102000`, `20261008103000`. Daha eski dosyalar da çıkarsa onlar da uygulanacak demektir; listeyi bana iletin, birlikte bakalım.

### 3. Secret'lar
```powershell
supabase secrets list
# SHIELDAUTH_* yoksa:
supabase secrets set SHIELDAUTH_API_KEY=sa_... SHIELDAUTH_APP_ID=qartim SHIELDAUTH_BASE_URL=https://<shieldauth-api> SHIELDAUTH_ALLOWED_ORIGINS=https://qartim.com,https://www.qartim.com
```

### 4. Edge Function'lar (ilgezdi-qr HARİÇ)
```powershell
supabase functions deploy shieldauth
supabase functions deploy arku-link tinga-link       # panelde JWT kapalıysa: --no-verify-jwt
supabase functions deploy partner-issue-token
supabase functions deploy payment-callback --no-verify-jwt
supabase functions deploy payment-start signal-ingest partner-verify-token   # signal-ingest için panele bakın
```
`arku-link` ve `tinga-link` önce çıkar: hem yeni (özet) hem eski (düz metin) belirteci kabul ederler. `ilgezdi-qr` en sona kalır çünkü yeni sütunlara yazar (6. adım).

### 5. Web uygulaması
```powershell
vercel --prod
```
(Her zamanki yönteminiz farklıysa onu kullanın.) Bu sürüm TOTP kullanıcısına e-posta kodu sunmaz ve parola sıfırlama sayfasını içerir.

### 6. Veritabanı, sonra ilgezdi-qr
```powershell
supabase db push
supabase functions deploy ilgezdi-qr
```
Migration'lar web uygulamasından ÖNCE uygulanırsa eski panel TOTP kullanıcısına e-posta kodu sunar, veritabanı onu saymaz ve kişi kapıda döngüye girer. Bu yüzden sıra 5 → 6.

### 7. Kontroller (Supabase SQL Editor)
```sql
-- Kapı tetikleyicileri yerinde mi? profiles, personas, social_links, organizations, members (+ varsa diğerleri)
select tgrelid::regclass as tablo from pg_trigger where tgname = 'zz_mfa_kimlik_yazma_trg';

-- IBAN kuralı bağlı mı?
select tgname from pg_trigger where tgname = 'trg_guard_profile_payment_mfa';

-- Görsel kovaları sınırlı mı?
select id, allowed_mime_types, file_size_limit from storage.buckets where id in ('avatars','backgrounds','logos');

-- Kurtarma fonksiyonları istemciye kapalı mı? (hepsi false olmalı)
select proname, has_function_privilege('anon', oid, 'execute') anon, has_function_privilege('authenticated', oid, 'execute') auth
from pg_proc where proname like 'recovery_%';
```

**IP başlığı taklit edilebiliyor mu?** (PowerShell'de `curl.exe`)
```powershell
curl.exe -X POST https://kfpnsxoxfrxepxezatsr.supabase.co/functions/v1/ilgezdi-qr -H "apikey: <anon anahtarı>" -H "Content-Type: application/json" -H "cf-connecting-ip: 203.0.113.7" -d "{\"action\":\"create\"}"
```
```sql
select bucket_key from rate_limit_hits where bucket_key like 'qr-create:%' order by window_start desc limit 5;
```
`qr-create:203.0.113.7` görünüyorsa başlık istemciden geliyor demektir; bana söyleyin, `istemciIp()` geri alınır.

**Elle deneme:**
1. Parolasız kullanıcı: giriş ekranında "Şifremi unuttum" → e-posta → bağlantı → yeni parola.
2. TOTP kurmuş hesap: giriş → panel kapısında yalnızca "doğrulama uygulaması / yedek kod" seçenekleri görünmeli.
3. Arku girişi: onay ekranı ("Arku Remote QRtım hesabınızla giriş yapmak istiyor") → İzin ver → Arku'da oturum.
4. İlgezdi QR girişi (eski sürüm): onay ekranında "Cihazın kendi bildirdiği ad" ve ağ bilgisi; giriş çalışmalı.

### 8. İlgezdi
`docs/ilgezdi-qr-v2.patch` İlgezdi deposunda uygulanır (`git apply …\networqr\docs\ilgezdi-qr-v2.patch`), yeni sürüm yayınlanır. QR'ın yanında 2 haneli sayı çıkar, telefonda aynı sayı seçilir. Kullanıcıların çoğu güncelledikten sonra:
```powershell
supabase secrets set ILGEZDI_QR_STRICT=true
```

### Acil geri alma
```sql
-- Kimlik yazma kapısı
do $$ declare t text; begin
  foreach t in array array['profiles','personas','persona_social_links','social_links','profile_fields','custom_domains','organizations','members','appointment_settings']
  loop execute format('drop trigger if exists zz_mfa_kimlik_yazma_trg on public.%I', t); end loop;
end $$;
-- IBAN kuralı
drop trigger if exists trg_guard_profile_payment_mfa on public.profile_payment;
```
Edge Function'lar için: önceki commit'e dönüp aynı `supabase functions deploy` komutu.

## Canlıda ayrıca bakılacaklar (depodan görülemiyor)
- Çekirdek tabloların politikaları (denetim raporundaki sorgu).
- `auth.users` üzerindeki tetikleyiciler: kullanıcı meta verisini `profiles`'a kopyalayan varsa `updateUser({data})` kapıyı atlar.
- `backgrounds` kovasının UPDATE/DELETE politikaları (S2 düzeltmesi yalnızca avatars ve logos'u kapsamıştı).

## Bilinen sınırlar (Faz 2'ye)
- Parola sıfırlama bağlantısı tam oturum açar; parola değişimi arayüzde TOTP ister ama API'den doğrudan da çağrılabilir. Kalıcı çözüm Supabase yerleşik MFA (aal2).
- Okuma işlemleri MFA istemez (yalnızca yazma).
- `link_secret` hâlâ düz metin: tek kullanıcıda birden çok Tınga cihazı olduğu için döndürmek mevcut cihazları koparır; OIDC geçişinde ele alınacak.
- SSO standart değil (PKCE, `state`, istemci kimlik doğrulaması yok); onay ekranı ilk adım.
