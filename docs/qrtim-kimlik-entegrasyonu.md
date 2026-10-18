# QRtım ile kimlik entegrasyonu

**Kimin için:** QRtım hesabıyla giriş yapılacak uygulamaları geliştirenler
(Arku, İlgezdi, Tınga, The Draw, CRM ve bundan sonra yazılacak her uygulama).
**Son güncelleme:** 20.09.2026 · QRtım Supabase projesi: `kfpnsxoxfrxepxezatsr`

QRtım artık bir kartvizit uygulaması değil, ekosistemin **kimlik sağlayıcısı**.
Bu belge, bir uygulamanın QRtım hesabını doğru şekilde bağlamasının kurallarını
tanımlar. Kurallara uymayan entegrasyon hesap ele geçirmeye açık olur.

---

## 1. Altın kural: eşleştirme `qrtim_uid` ile yapılır

Hesabı **e-postayla eşleştirme.** E-posta değişebilir, devredilebilir, aynı
adres başka birine ait olabilir. QRtım her hesap için bir kez üretilen,
hiç değişmeyen `qrtim_uid` verir. Uygulamanız kullanıcı tablosunda bu alanı
tutmalı ve eşleştirmeyi bununla yapmalıdır.

```
uygulama_kullanicisi.qrtim_uid  ←→  QRtım kimliği   (KALICI, eşleştirme anahtarı)
uygulama_kullanicisi.email      ←→  yalnızca gösterim / iletişim
```

- `qrtim_uid` bir hesapta **bir kez** üretilir, hesap silinene kadar değişmez.
- Aynı `qrtim_uid` ikinci bir yerel hesaba bağlanmamalı. Bağlanmaya
  çalışılıyorsa (benzersizlik hatası) oturum **açılmamalı**, hata
  yutulmamalıdır.
- `qrtim_id` (auth kullanıcı kimliği) geriye uyumluluk için dönüyor; yeni
  entegrasyonlar `qrtim_uid` kullanmalı.

## 2. E-posta doğrulanmamışsa kimlik yoktur

QRtım, e-postası doğrulanmamış hesaba partner belirteci **vermez**
(`403`, `code: email_not_verified`) ve doğrulama uçları da aynı kontrolü
yapar. Dönen `user.email_verified` alanı her zaman `true` olmalıdır.

**Uygulamanız yine de kontrol etmeli:** alan yoksa veya `false` ise hesabı
bağlamayı reddedin. Bu kural olmadan saldırgan `kurban@firma.com` ile QRtım
hesabı açıp sizdeki hesabı devralabilir — şifreyle korunan hesaplar dahil.

## 3. Akış

### 3a. Web yönlendirmeli (kullanıcı QRtım'e girişli değilse)

```
Uygulama  →  https://www.qrtim.com.tr/login?callback=<uygulama adresi>
             (kullanıcı QRtım'de giriş yapar)
QRtım     →  partner-issue-token  →  tek kullanımlık belirteç
QRtım     →  <callback>?qrtim_token=<belirteç>
Uygulama  →  (SUNUCUDAN) arku-link / tinga-link ile belirteci doğrular
```

`callback` adresi QRtım'da **beyaz listededir**; listede olmayan adrese
yönlendirme yapılmaz. Yeni uygulama eklenirken bu liste güncellenmelidir
(`src/components/Auth.jsx`, `TRUSTED_PARTNERS`).

### 3b. Yönlendirmesiz (kullanıcı zaten QRtım'e girişli)

Uygulamanız QRtım oturumunu tutuyorsa (İlgezdi gibi) kullanıcıya ikinci kez
giriş yaptırmayın:

```http
POST /functions/v1/partner-issue-token
Authorization: Bearer <kullanıcının QRtım JWT'si>
{ "partner_name": "arku", "ttl_seconds": 60 }
```

Yanıt: `{ token, expires_at, email, email_verified, name, username }`.
Belirteci uygulamanızın sunucusuna verin, doğrulamayı orada yapın.

### 3c. Doğrulama (yalnızca SUNUCUDAN)

```http
POST /functions/v1/arku-link        (Tınga: /tinga-link, The Draw: /draw-link)
{ "token": "<belirteç>" }
```

Başarılı yanıt:

```json
{ "valid": true,
  "user": { "qrtim_uid": "…", "qrtim_id": "…", "email": "…",
            "email_verified": true, "name": "…", "username": "…",
            "photo_url": null, "title": null, "company": null, "plan": "free" } }
```

Kurallar:
- Doğrulamayı **istemciden çağırmayın.** Belirteç tek kullanımlıktır ve
  yanıt kimlik bilgisi taşır; istemciye inerse araya girilebilir.
- Belirteç **tek kullanımlık ve kısa ömürlüdür**; yakma işlemi atomiktir,
  aynı belirteçle ikinci istek `401` alır.
- `valid: false` dönen her durumda oturum açmayın.

## 4. Plan ve haklar QRtım'da

Kullanıcının planı QRtım aboneliğinden gelir. Uygulamanızın kendi tablosundaki
bir `plan` kolonuna **yetki kararı bağlamayın**; o kolon kullanıcı tarafından
yazılabiliyorsa ücretsiz kullanıcı kendini yükseltir.

- İlgezdi için: `rpc ilgezdi_effective_plan()` — parametre almaz, yalnızca
  çağıranın kendi hesabı. Dönüş: `{ plan, expires_at, max_sync_devices,
  password_sync }`.
- Yeni uygulamalar için aynı desende bir RPC açılır: **parametresiz**,
  `auth.uid()` üzerinden. Parametreyle başka kullanıcının planını sorgulatan
  bir uç asla yazılmaz (Arku'da O3 olarak düzeltilen hata).

## 5. Sık yapılan hatalar (hepsi gerçek olaylardan)

| Hata | Sonuç | Doğrusu |
|---|---|---|
| "Ucu `verify_jwt` açık yaptım, korunuyor" | Projenin herkese açık anon anahtarı da geçerli bir JWT'dir; uç fiilen herkese açıktır | Fonksiyonun içinde `getUser()` ile **gerçek kullanıcı** arayın |
| Hesabı e-postayla eşleştirmek | E-posta değişince/devredilince yanlış hesap bağlanır | `qrtim_uid` |
| Doğrulamayı istemciden çağırmak | Kimlik yanıtı ve belirteç istemcide görünür | Sunucudan sunucuya |
| Kullanıcı tablosuna `upsert` yapıp hatayı yutmak | Aynı kimlik başka hesaba bağlıysa yanlış hesapla oturum açılır | Hata kontrol edilir, oturum açılmaz |
| Partner anahtarını istemci paketine koymak | Anahtar herkese açık olur, uç herkese açılır | Anahtar yalnız sunucu ortamında |
| Sırrı QR koduna/bağlantıya gömmek | Kodu gören oturumu çalar | Sır istemcide kalır, taşınmaz |
| Eşleştirme anahtarıyla oturum açmak | Eşleştirdiğiniz hesapla oturum açtığınız hesap farklı olabilir | Aşağıdaki iki kurala bakın |

### 5a. Eşleştirme anahtarı ≠ oturum açma anahtarı

`qrtim_uid` kiminle eşleştiğinizi söyler; oturumu **o hesabın kendi
kimliğiyle** açın. Oturum açma çağrısının döndürdüğü kullanıcı kimliğini,
eşleştirdiğiniz kimlikle **karşılaştırın**. İkisi tutmuyorsa oturum açmayın.

Neden: araya giren bir e-posta değişikliği ya da hesap devri, eşleştirme ile
oturum arasında sessizce başka bir hesaba kayma yaratabilir. Karşılaştırma bu
kaymayı yakalar. (Arku bu kuralı uyguladı.)

### 5b. Tek seferlik taşıma adımının kuralları

Eski hesapları `qrtim_uid`'e taşırken e-postayla arama yapmak zorunda
kalabilirsiniz. O arama:

- **yalnızca `auth.users` üzerinde** yapılır, uygulama tablolarında değil;
- **yalnızca `email_confirmed_at` dolu** kayıtlarda eşleşir;
- eşleşen kayda `qrtim_uid` yazılır ve **bir daha e-postayla aranmaz**.

Neden: doğrulanmamış bir e-posta kimlik değildir. Taşıma adımı, tam da
e-postayla eşleştirmenin tehlikeli olduğu yerde e-posta kullandığı için
kurallarının yazılı olması gerekir. Taşımadan sonraki her giriş `qrtim_uid`
ile eşleşmelidir; ilk giriş `email-backfill`, ikincisi `uid` demelidir.

## 6. Kayıt ve şeffaflık

Her belirteç üretimi ve kullanımı QRtım denetim kaydına yazılır ve kullanıcı
kendi etkinlik geçmişinde görür ("Arku için giriş belirteci verildi"). Bağlanan
uygulamalar `partner_user_links` tablosunda tutulur.

Kullanıcının hangi verisinin hangi uygulamayla paylaşılacağı, hesap türüne göre
QRtım ayarlarından aç/kapa seçilecektir (yapım aşamasında). Uygulamanız
kullanıcının kapattığı bir veriyi istememeli ve saklamamalıdır.

## 7. Yeni uygulama eklerken

1. Partner adını QRtım'da tanımlayın (`partner-issue-token` içindeki liste).
2. Callback adresini beyaz listeye ekleyin (`Auth.jsx`).
3. Doğrulama ucunu ekleyin (`arku-link` / `tinga-link` deseninde) — e-posta
   doğrulaması, atomik yakma ve denetim kaydı zorunlu.
4. Gerekiyorsa plan RPC'si açın (parametresiz).
5. Uygulama tarafında: `qrtim_uid` kolonu + benzersizlik kısıtı, e-posta
   doğrulama şartı, sunucudan doğrulama.
6. `integration_providers` tablosuna satır ekleyin. `partner_user_links.partner`
   ve `user_sync_data.app_key` bu tabloya yabancı anahtarla bağlı; satır
   olmadan bağlantı kaydı oluşmaz.
7. Onay ekranındaki alan listesini uca göre ayarlayın (`Auth.jsx` →
   `PARTNER_ALANLARI`). Ucunuz plan göndermiyorsa onay ekranı da "Abonelik
   planı" yazmamalı: kişiye paylaşılmayan bir veriyi paylaşılıyor gibi
   göstermeyin.

### Yerel geliştirme adresleri

Üretim listesine localhost KONULMAZ: kurbanın makinesinde o portu dinleyen
herhangi bir uygulama SSO belirtecini alabilirdi. Yerel adresler yalnızca
`import.meta.env.DEV` bloğuna yazılır ve üretim paketine hiç girmez. Yani
partner ekibi callback akışını test etmek için QRtım'ı **yerelde** çalıştırır
(`npm run dev`); canlı qrtim.com.tr üzerinden localhost'a dönüş çalışmaz.

Tek istisna Tınga: masaüstü uygulaması olduğu için OAuth loopback (RFC 8252)
akışı kullanıyor ve sabit yerel portu üretimde de geçerli. Bu istisna
masaüstü akışına özgüdür; web/sunucu uygulamalarına uygulanmaz.

Sorular ve yeni entegrasyonlar için QRtım tarafını güncelleyen oturuma yazın;
bu belge QRtım deposunda `docs/qrtim-kimlik-entegrasyonu.md` altında tutulur.
