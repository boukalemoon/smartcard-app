# İlgezdi ↔ QRtım senkronu: veri katmanları ve şifre kasası

Bu belge QRtım tarafındaki **saklama sözleşmesini** tanımlar. İlgezdi tarafı buna
göre yazılır. Karar sahibi: Burak; uygulayacak olan İlgezdi reposu.

Ölçülen durum (18.10.2026, canlı):

| Tablo | Satır | Son yazım | Kim yazıyor |
|---|---|---|---|
| `ilgezdi_sync_data` | 1 | 17.10.2026 | İlgezdi `sync-manager.js` (canlı) |
| `user_sync_data` | 2 | 25.07.2026 | kimse — Temmuz'da tek seferlik kopya |

İlgezdi hâlâ eski tabloya yazıyor. Eski tablo 4 kolon (`user_id, settings,
bookmarks, updated_at`), şifreleme desteği yok. Yeni katman çok uygulamalı ve
şifreleme için hazır (`is_encrypted`, `enc_version`, `size_bytes`, `version`).
Notlar ve şifreler eklenmeden önce yazma yeni katmana geçmeli; yoksa üçüncü bir
yere daha yazmış oluruz.

## 1. Veri katmanları

`user_sync_data` anahtarı: `(user_id, app_key, data_type)`. `app_key='ilgezdi'`.

| `data_type` | İçerik | Şifreli | Abonelik |
|---|---|---|---|
| `settings` | 24 ayar anahtarı (cihaza özgü olanlar hariç) | hayır | gerekmez |
| `bookmarks` | klasörler + ögeler | hayır | gerekmez |
| `notes` | notlar | hayır | gerekmez |
| `passwords` | kasa — **yalnız şifreli blob** | **evet** | **gerekli** |

Cihaza özgü olanlar (indirme klasörü, VPN, oturum) senkronlanmaz — mevcut
`sync-manager.js` kararı korunur.

## 2. Abonelik ayrımı

Burak'ın kararı: ücretsizde yerel kayıt, abonelikte bulut yedeği.

- **Ücretsiz:** şifre kasası bugün olduğu gibi yalnız cihazda (DPAPI / Keychain /
  keyring). Hiçbir şey eksilmez; İlgezdi ücretsiz tarayıcı olarak Chrome'un
  verdiğini vermeye devam eder.
- **Ücretli (öğrenci dahil):** kasa şifreli olarak QRtım'a yedeklenir, çok cihazda
  açılır ve **format sonrası geri gelir.**

`plan_features.sync_passwords` zaten `(plan <> 'free')` — öğrenci planı dahil,
ayrıca bir şey yapılmasına gerek yok.

**Abonelik biterse:** yedek SİLİNMEZ ve indirilebilir kalır; yalnız yeni yükleme
durur. Şifreleri rehin tutmuyoruz. (Aksi kararı Burak verir.)

## 3. Şifre kasası — format sorununun çözümü

### Sorun

Mevcut kasa `safeStorage` ile şifreli: anahtar Windows DPAPI / macOS Keychain
tarafında, **işletim sistemi hesabına bağlı**. Format atılınca o anahtar gider.
Bu yüzden kasanın kendisi senkronlanamaz.

### Çözüm: anahtar cihazda değil, kullanıcının bildiğinde

Üç parçalı anahtar sarmalama. QRtım hiçbir parçanın açık hâlini görmez.

```
DK  = rastgele 256 bit   → kasayı şifreleyen asıl anahtar (hiç dışarı çıkmaz)
Kp  = scrypt(senkron parolası, tuz1)
Kr  = scrypt(kurtarma kodu,    tuz2)

sarmal_parola   = AES-256-GCM(Kp, DK)
sarmal_kurtarma = AES-256-GCM(Kr, DK)
kasa            = AES-256-GCM(DK, JSON(kayıtlar))
```

Sunucuda duran: `kasa`, iki sarmal, tuzlar, IV'ler, GCM etiketleri, scrypt
parametreleri. **Hiçbiri gizli değil** — gizli olan yalnız senkron parolası ve
kurtarma kodu, ikisi de cihazdan çıkmaz.

### Format sonrası akış

1. Kullanıcı İlgezdi'yi kurar, QRtım hesabına girer.
2. İlgezdi `user_sync_data`'da `ilgezdi/passwords` satırını görür.
3. Sorar: *"Bulut yedeğinizde şifre kasanız var. Senkron parolanızı girin."*
4. `Kp = scrypt(parola, tuz1)` → `sarmal_parola` açılır → `DK` elde edilir.
5. `DK` ile `kasa` çözülür → kayıtlar yerel DPAPI kasasına yazılır.
6. Kasa eskisi gibi çalışır.

Cihaza bağlı hiçbir şeye ihtiyaç yok. **Format sorunu burada çözülüyor.**

Parola unutulduysa 3. adımda kurtarma kodu sorulur; `Kr` yolu aynı `DK`'ya çıkar.
İkisi de yoksa kasa açılamaz — bu, sıfır-bilgi mimarisinin kaçınılmaz bedeli ve
kullanıcıya **kurulumda** söylenir. (İlgezdi'nin `vault-gate` modülü zaten
"geri alma yolu yoktur" diyor; bu kararla tutarlı.)

### Senkron parolası QRtım giriş şifresi OLAMAZ

Teknik zorunluluk, tercih değil: QRtım kimlik doğrulaması Supabase Auth
(GoTrue) ile yapılıyor ve giriş şifresi **sunucuya açık gidiyor**. Aynı sırrı
şifreleme anahtarı olarak kullanırsak QRtım kasayı çözebilir hâle gelir ve
"biz okuyamıyoruz" iddiası çöker. Senkron parolası ayrı olmalı.

### Parametreler

| | Değer | Not |
|---|---|---|
| KDF | `scrypt` | Node `crypto` içinde — **yeni bağımlılık yok** |
| N, r, p | 131072, 8, 1 | `maxmem` açıkça verilmeli (~192 MB), yoksa Node 32 MB'ta hata verir |
| Tuz | 32 bayt rastgele, sarmal başına ayrı | gizli değil |
| Şifre | `aes-256-gcm` | Node `crypto` içinde |
| IV | 12 bayt, her yazımda YENİ | aynı IV'yi tekrar kullanmak GCM'i kırar |
| Etiket | 16 bayt | bozulma ve yanlış parola tespiti |

İlgezdi `vault-gate.js`'te scrypt'i, `os-crypto.js`'te şifrelemeyi zaten
kullanıyor; ikisi de Node'un `crypto` modülünde. Yeni paket gerekmiyor.

### Zarf biçimi

`user_sync_data.payload`, `is_encrypted = true`, `enc_version = 1`:

```json
{
  "v": 1,
  "kdf": { "alg": "scrypt", "N": 131072, "r": 8, "p": 1 },
  "sarmal_parola":   { "tuz": "b64", "iv": "b64", "etiket": "b64", "ct": "b64" },
  "sarmal_kurtarma": { "tuz": "b64", "iv": "b64", "etiket": "b64", "ct": "b64" },
  "kasa":            { "iv": "b64", "etiket": "b64", "ct": "b64" }
}
```

`kdf` parametreleri zarfın içinde: ileride N yükseltilirse eski kasalar
açılmaya devam eder.

### Parola değiştirme ucuz

Yalnız `sarmal_parola` yeniden üretilir. `DK` ve `kasa` değişmez, bütün kasayı
yeniden şifrelemek gerekmez.

## 4. QRtım tarafında yapılacaklar

1. `user_sync_data`'ya yazma hakkı: `data_type='passwords'` satırı yalnız
   `sync_passwords` hakkı olan planda kabul edilsin. Sunucuda, RLS ya da RPC
   ile — istemcinin "aboneliğim var" demesine güvenilmez.
2. `is_encrypted = true` zorunluluğu: `passwords` satırı düz metin kabul
   etmesin. Yanlışlıkla açık yüklenmesinin önüne geçer.
3. Boyut tavanı: `size_bytes` üzerinden makul bir sınır (kasa birkaç yüz KB'ı
   aşmamalı). Depolama kötüye kullanılmasın.
4. Abonelik bitince yazma kapanır, okuma açık kalır (madde 2).

## 5. İlgezdi tarafında yapılacaklar

1. `sync-manager.js` yazmayı `ilgezdi_sync_data` → `user_sync_data`'ya taşısın;
   `settings` ve `bookmarks` ayrı `data_type` satırlarına. Eski tablodan tek
   seferlik okuma, sonra yeniye yazma.
2. `notes` senkronu eklensin (düz, şifresiz).
3. Şifre katmanı **varsayılan kapalı**; kullanıcı açıkça açsın. Açarken:
   senkron parolası belirlenir, kurtarma kodu bir kez gösterilir, "ikisi de
   kaybolursa kasa açılamaz" yazılı olarak söylenir.
4. Yerel kasa (DPAPI) olduğu gibi kalır — bulut yedeği onun yerine geçmez,
   üstüne gelir. Çevrimdışıyken her şey eskisi gibi çalışır.

## 6. Ne SÖYLEMİYORUZ

- "Verileriniz Türkiye'de saklanıyor" — Supabase projesi şu an `ap-south-1`
  (AWS Mumbai). AWS'in Türkiye bölgesi yok; barındırılan Supabase ile bu cümle
  kurulamaz. Kendi veri merkezinde barındırma gündemde (Burak, 18.10.2026).
- "Uçtan uca şifreli" ifadesi yalnız `passwords` için doğrudur. `settings`,
  `bookmarks` ve `notes` düz saklanıyor; bunları şifreli diye anlatmayalım.
