# Değişiklik Günlüğü

Bu dosya sürüm notlarının **tek kaynağıdır**. Sürüm numarasının kaynağı
`package.json`; bu iki değer daima aynı olmak zorundadır.

Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) ·
Sürümleme: [Semantic Versioning](https://semver.org/lang/tr/)

Anlatı ve faz planı Obsidian'da: `01 - Aktif Projeler/QRtım/`

---

## [1.4.0] — 2026-09-10

Veritabanı tarafı **canlıya alındı.** 1.2.0 ve 1.3.0'da hazırlanan sekiz
veritabanı adımının tamamı uygulandı ve her biri canlı ortamda doğrulandı.
Arayüz değişiklikleri henüz dağıtılmadı; bu yüzden herkese açık okuma
yetkisini kaldıran son adım bilinçli olarak beklemede.

### Güvenlik

- **Yönetici olma açığı kapatıldı — açık gerçekti.** Erişim kuralları
  incelendiğinde, giriş yapmış herhangi bir kullanıcının kendi kaydındaki
  yetki alanını değiştirebildiği görüldü: kurallar yalnızca "bu senin kaydın
  mı?" diye soruyor, "hangi alanı değiştiriyorsun?" diye sormuyordu. Yani
  ücretsiz kayıt olan herkes tek bir istekle yönetici olabilir, ardından tüm
  kullanıcıları silebilir, rol atayabilir ve abonelik değiştirebilirdi.
  Koruma uygulandı ve iki yönlü doğrulandı: yetki yükseltme denemesi
  reddediliyor, normal profil güncellemesi çalışmaya devam ediyor.
- **Analitik özet tablosu herkese açıktı.** `analytics_summary`, herkese açık
  anahtarla okunabiliyordu ve kullanıcı bazında kaç görüntülenme, kaç QR
  taraması, kaç kişi kaydı ve son etkileşim zamanı bilgisini veriyordu.
  Erişim kaldırıldı. Bu bulgu ilk denetim turunda değil, sonradan
  yapılan tarama sırasında çıktı.
  > Uygulama bu tabloyu hiç kullanmıyor; paneldeki grafikler ayrı bir
  > kaynaktan hesaplanıyor, dolayısıyla panel etkilenmedi.
- **Depolama klasörü listelemesi kapandı, görseller etkilenmedi.** Üç klasör
  için de doğrulandı: listeleme boş dönüyor, görseller açılmaya devam ediyor.
- **Gizlilik ayarı ilk kez gerçekten çalışıyor.** Canlı ortamda doğrulandı:
  e-posta paylaşımını kapatmış bir kullanıcının adresi artık sunucudan hiç
  gönderilmiyor. Önceden ayar kapalıyken bile veri gidiyordu.

### Düzeltildi

- **Kurum üyeleri tablosu her sorguda hata veriyordu.** Erişim kuralı kendi
  tablosunu sorguluyor, sonsuz döngüye giriyor ve tablo tamamen
  kullanılamaz hale geliyordu. Kural, anlamı korunarak yeniden yazıldı.
  > Tablo şu an boş ve uygulama başka bir tabloyu kullanıyor, bu yüzden
  > kullanıcıya yansıyan bir arıza yaşanmamıştı.
- **Üye dizini artık dernekleri de tanıyor.** Kurum türü kontrolü yalnızca
  İngilizce yazımları tanıdığı için `dernek` türündeki kurumlar üye dizini
  ve başvuru sayfası açamıyordu. Türkçe yazımlar da eklendi.

- **Partner giriş uçları yayına alındı ve tek tek denendi.** Beş uç güncellendi;
  hepsi artık doğrulanmamış e-posta ile bağlantı kurulmasını reddediyor ve
  partner'a **doğruladıkları e-postanın aynısını** gönderiyor. Önceden bazı
  uçlar doğrulamayı bir adres üzerinden yapıp başka bir adresi
  gönderebiliyordu; kullanıcı adresini değiştirdiğinde denetim anlamsız
  hale geliyordu.
  > Etkilenen kullanıcı yok: doğrulanmamış 5 hesabın hiçbiri bugüne kadar
  > giriş yapmamış.
- **Unutulmuş bir yan kapı kapatıldı.** Eski bir partner doğrulama ucu
  (`partner-verify-token`) hâlâ yayındaydı, depoda kaydı yoktu ve e-posta
  doğrulaması yapmıyordu — yani yeni korumayı atlatan bir yol bırakıyordu.
  Sertleştirildi ve kaynağı depoya alındı.
  > Ölçüm bu akışın hiç kullanılmadığını gösteriyor (ilgili tablolar boş),
  > ancak yayında olan bir uç yayında olmayan bir uçtan daha az korumalı
  > olamaz.

### Yapılması gerekenler

- **Arayüzü dağıtın, sonra son veritabanı adımını uygulayın.** Herkese açık
  okuma yetkisini kaldıran adım (`…_cutover_lock_anon_reads.sql`) henüz
  uygulanmadı; yayındaki eski arayüz hâlâ tabloları doğrudan okuduğu için
  şimdi uygulanırsa kartvizit, üye dizini ve başvuru sayfaları anında
  çalışmaz hale gelir.
- **Supabase panelinden "sızmış şifre koruması" açılmalı** ve giriş/kayıt
  hız sınırları gözden geçirilmeli. Bunlar panel ayarıdır, kodla yapılamaz.

---

## [1.3.0] — 2026-09-09

Faz 2 — sertleştirme. Bu sürüm yeni özellik getirmiyor; mevcut yüzeyleri
kötüye kullanıma karşı kapatıyor.

### Güvenlik

- **Hız sınırlama artık sunucuda.** Önceki sınırlayıcı tarayıcı belleğinde
  tutuluyordu: sayfa yenilenince sıfırlanıyor, gizli sekmede hiç çalışmıyor
  ve doğrudan istek göndererek tamamen atlanabiliyordu. Yani fiilen koruma
  yoktu. Artık veritabanında, atlanamayan bir sayaç var:
  - Kart görüntüleme: aynı ziyaretçi aynı kartı saatte en fazla 10 kez
    sayabiliyor (görüntülenme şişirme ve analitik kirliliği engellendi).
  - Kart okuma: aynı ziyaretçi 10 dakikada en fazla 120 kart açabiliyor —
    normal gezinme bu sınıra yaklaşmaz, toplu kazıma durur.
  - Sinyal yazımı: uygulama başına 5 dakikada 60 istek.
  > Giriş ve kayıt denemeleri Supabase Auth'un kendi uçlarına gittiği için
  > oradaki sınırlar panelden ayarlanmalıdır (Authentication → Rate Limits).
- **Depolama klasörleri artık listelenemiyor.** Herkese açık anahtarla
  `avatars`, `backgrounds` ve `logos` klasörlerinin tam dosya listesi
  alınabiliyordu — yüklenmiş her profil fotoğrafının adı, boyutu ve tarihi,
  silinmiş profillerinkiler dahil. Listeleme kapatıldı; görsellerin
  görüntülenmesi etkilenmiyor (üç klasörün de herkese açık servis yolundan
  yayınlandığı ölçülerek doğrulandı).
- **Şifre asgari uzunluğu 8 karakter.** Önceki sınır 6'ydı.
  > Giriş ekranında bu sınır uygulanmıyor: mevcut kullanıcıların daha kısa
  > şifreleri var ve onları hesaplarından kilitlemek doğru olmazdı. Sınır
  > yeni kayıtlarda geçerli. Supabase panelinden de aynı değere çekilmeli,
  > ayrıca "sızmış şifre koruması" açılmalıdır.
- **Hata mesajları artık teknik ayrıntı sızdırmıyor.** Giriş ekranı ham
  sunucu hatasını olduğu gibi gösteriyordu. Bilinen durumlar anlaşılır
  Türkçeye çevrildi, gerisi genel bir mesaja düşüyor.
- **Veritabanı fonksiyonlarında şema arama yolu sabitlendi.** Ayarı olmayan
  tüm fonksiyonlar için sabitlendi; davranış değişmiyor, arama yolu ele
  geçirme yüzeyi kapanıyor.

### Değiştirildi

- Giriş ekranı ve kartvizit sayfasındaki tarayıcı uyarı kutuları (`alert`)
  uygulamanın kendi bildirim bileşenine taşındı. Kopyalama işlemleri artık
  başarısız olduğunda da geri bildirim veriyor — eskiden sessizce
  başarısız olabiliyordu.
- Şifre alanına doğru otomatik tamamlama ipuçları eklendi; parola
  yöneticileri kayıt ve giriş ayrımını artık doğru yapıyor.

### Bilinen sorunlar

- `organization_members` erişim kuralında sonsuz döngü var; tablo her
  sorguda hata veriyor. Düzeltmek için mevcut kural metninin görülmesi
  gerekiyor, tahminle yazılmadı.
- Panelin diğer bölümlerinde tarayıcı uyarı kutuları duruyor (yaklaşık 80
  yer). Güvenlik etkisi yok, ayrı bir arayüz turunda ele alınacak.
- Dışa aktarma öncesi şifre doğrulaması şifreyi tarayıcının kendi giriş
  kutusuyla, **düz metin olarak** istiyor. Maskeli bir alana taşınmalı.
- Partner bağlantı uçlarında `CORS: *` duruyor. Bu uçların güvenlik sınırı
  taşıdıkları tek kullanımlık jetondur, CORS değil; jetonu olmayan bir site
  çağrıyı yapsa da sonuç alamaz. Yine de hijyen gereği daraltılacak —
  partner tarafıyla birlikte planlanacak.

---

## [1.2.0] — 2026-09-09

Faz 1 — dijital kimliğin veri modeli. Bu sürüm hem denetimin en ağır
bulgularını kapatıyor hem de "her bilgimi tek tek paylaş/gizle" özelliğinin
altyapısını kuruyor. İkisi aynı işin iki yüzü: gizlilik ancak sunucuda
uygulanırsa gerçektir.

> Bu sürüm iki veritabanı adımı içerir. Ayrıntılar ve uygulama sırası
> `supabase/migrations/` içindeki dosya başlıklarındadır.

### Eklendi

- **Alan bazlı paylaşım ayarları.** Panelde yeni bir *Paylaşım Ayarları*
  bölümü var: e-posta, telefon, ünvan, şirket, hakkımda, Google yorum
  bağlantısı, katalog ve hizmetler için tek tek "herkese açık / gizli".
  Gizli işaretlenen bilgi kartı açan kişiye **hiç gönderilmez** — ağ
  trafiğinde de görünmez.
- **`profile_fields` tablosu.** Her alan kendi görünürlüğünü, doğrulanma
  durumunu ve bağlam profilini (persona) taşır. Dört görünürlük seviyesi
  tanımlı; bu sürümde `herkese açık` ve `gizli` çalışıyor, kalan ikisi
  karşılıklı bağlantı özelliğiyle birlikte devreye girecek.
- **Doğrulanmış alan altyapısı.** Bir alanın değerini paylaşmadan
  "doğrulanmış" bilgisini paylaşabilmek için gereken alanlar eklendi
  (seçici ifşa). Doğrulama akışları sonraki sürümde.

### Güvenlik

- **Profil, kurum ve üyelik verisi artık herkese açık anahtarla okunamıyor.**
  Denetimde 21 kullanıcının e-posta ve telefonunun, 33 kurumun iletişim
  bilgisinin ve tüm üyelik ilişkilerinin toplu olarak indirilebildiği
  doğrulanmıştı; yönetici hesabı da rol alanından tespit edilebiliyordu.
  Kartvizit sayfası, üye dizini ve başvuru sayfası artık tabloları doğrudan
  okumuyor; yalnızca ne göstermeleri gerekiyorsa onu döndüren sunucu
  fonksiyonlarını çağırıyorlar.
- **Gizlilik ayarı ilk kez gerçekten uygulanıyor.** Eski `show_email` anahtarı
  yalnızca arayüzde çalışıyordu; e-posta kapalıyken bile sunucudan
  gönderiliyordu. Taşıma sırasında her kullanıcının mevcut tercihi korundu.
- **Yetki yükseltmeye karşı veritabanı koruması.** Yönetici rolü ve
  abonelik/bakiye alanları artık veritabanı seviyesinde korunuyor: bir
  kullanıcı kendi rolünü değiştiremez, plan veya kazanç alanlarını
  yükseltemez. Bu koruma erişim politikalarından bağımsız çalışır.
- **Kimlik sağlayıcı artık doğrulanmamış e-posta paylaşmıyor.** Partner
  uygulamalar (Arku, Tınga, İlgezdi) QRtım'in döndürdüğü e-postayı
  doğrulanmış kabul edip hesabı ona bağlıyordu. QRtım bunu dayatmadığı için
  saldırgan başkasının e-postasıyla QRtım hesabı açıp partner tarafındaki
  hesabı devralabilirdi. Bağlantı uçları artık doğrulanmamış hesaplara jeton
  vermiyor ve **doğruladığı e-posta ile döndürdüğü e-postanın aynı olduğunu**
  garanti ediyor.
  > Arku entegrasyonu bu nedenle askıya alınmıştı; ancak bu sürüm
  > dağıtıldıktan sonra yeniden açılmalıdır.
- **Üye dizininde iletişim bilgisi varsayılan olarak gizli.** Üye listesi her
  üyenin adını, e-postasını ve telefonunu yayımlıyordu; kurumun kendi
  "üye görünürlüğü" tercihi hiç uygulanmıyordu. Artık kurum tercihleri
  sunucuda uygulanıyor ve iletişim bilgisi yalnızca kurum açıkça izin
  verirse gösteriliyor.
- **Bağlantı adreslerinde protokol denetimi.** Kullanıcıların girdiği adresler
  kartta bağlantı olarak gösterilmeden önce hem sunucuda hem arayüzde
  süzülüyor; yalnızca `http` ve `https` geçiyor.

### Düzeltildi

- **Kartvizit görüntülenme sayacı çalışmıyordu.** Sayaç tarayıcıdan
  artırılmaya çalışılıyor, veritabanı kuralına takılıyor ve **hata bile
  vermeden** başarısız oluyordu — yani giriş yapmamış ziyaretçiler hiç
  sayılmamıştı. Sayaç sunucuya taşındı. Panelde göreceğiniz rakamlar bundan
  sonra gerçeği yansıtacak (geçmiş veri telafi edilemiyor).
- **Üye dizini boş görünüyordu.** Bazı kayıtlarda değerler tırnak işaretiyle
  saklandığı için (`'active'`) durum filtresi hiçbir satırı tutmuyordu.
  Ayrıca kurum tipi kontrolü yalnızca İngilizce yazımları tanıyordu, bu
  yüzden `dernek` tipindeki kurumlar dizin açamıyordu. İkisine de tolerans
  eklendi.

---

## [1.1.0] — 2026-09-09

Kapsamlı güvenlik denetiminin ardından gelen ilk sürüm (Faz 0 — acil
kapatmalar). Denetimde 24 bulgu çıktı; bu sürüm dışarıdan doğrudan
sömürülebilen ve veri modeline dokunmayan üçünü kapatıyor.

### Güvenlik

- **Partner giriş yönlendirmesinde hesap ele geçirme açığı kapatıldı.**
  Kullanıcı QRtım hesabıyla Arku, Tınga veya İlgezdi'ye giriş yaparken dönüş
  adresi "şu adresle başlıyor mu?" diye kontrol ediliyordu. Bu kontrol
  aldatılabilir: `https://arku-remote.vercel.app@saldirgan.com` adresi testi
  geçiyor ama tarayıcıyı **saldırganın sitesine** götürüyor. Saldırgan bu
  yolla kurbanın giriş jetonunu, adını ve e-postasını alıp diğer
  uygulamalarda kurbanın hesabını açabilirdi. Kullanıcı zaten girişliyse tek
  bir tık bile gerekmiyordu.
  Artık adresin **origin'i tam eşitlikle** karşılaştırılıyor; alan adı ve
  kullanıcı-bilgisi (`@`) hileleri eleniyor.
- **Yerel geliştirme adresleri üretimden çıkarıldı.** `localhost:3000`,
  `localhost:5173` ve `localhost:4000` güvenilir dönüş adresleri arasındaydı.
  Artık yalnızca geliştirme derlemesinde tanımlılar ve üretim paketine hiç
  girmiyorlar.
  > Tınga'nın `127.0.0.1:17605` adresi bilinçli olarak kaldı: masaüstü
  > uygulamaları için standart geri döngü akışıdır (RFC 8252) ve üretimde de
  > gereklidir.
- **Ödeme sağlayıcı sırları istemciden tamamen kaldırıldı.** PayTR merchant
  key/salt ve iyzico secret key `VITE_` ön ekiyle tanımlıydı. Bu ön eke sahip
  her değişken derleme sırasında JavaScript paketine **düz metin olarak**
  yazılır ve siteyi açan herkes okuyabilir. Değerler henüz yer tutucu olduğu
  için sır sızmadı; ancak canlı anahtarlar girildiği an merchant hesabı ele
  geçirilebilir hale gelecekti. Ödeme imzası da tarayıcıda üretiliyordu, yani
  tutar imzalanmadan önce kullanıcının kontrolündeydi.
  `.env.local` dosyasına, sırların neden buraya yazılmaması gerektiğini
  anlatan kalıcı bir uyarı eklendi.
- **Web dağıtımına güvenlik başlıkları eklendi.** Hiçbiri tanımlı değildi.
  Eklenenler: içerik güvenlik politikası (`default-src 'self'`,
  `object-src 'none'`, `frame-ancestors 'none'`, daraltılmış `connect-src` ve
  `frame-src`), `Strict-Transport-Security`, `X-Content-Type-Options`,
  `X-Frame-Options`, `Referrer-Policy` ve `Permissions-Policy`.
  Site artık iframe'e alınamıyor (tıklama hırsızlığı) ve dış adreslere
  giderken tam URL yerine yalnızca origin sızıyor.
  > `Strict-Transport-Security`'ye `preload` bilinçli olarak eklenmedi:
  > geri alınması çok zordur, sonraki bir sürümde ayrıca değerlendirilecek.

### Kaldırıldı

- **`src/services/paymentService.js`** silindi. Hiçbir yerden çağrılmıyordu
  (ölü kod) ama yukarıdaki ödeme sırlarını istemciye taşıyan tek yerdi.
  Gerçek ödeme entegrasyonu yazıldığında bir Supabase Edge Function içinde
  olacak. Geri almak için: `git show 9f6c89f:src/services/paymentService.js`
- **`crypto-js`** bağımlılığı kaldırıldı; yalnızca silinen dosya kullanıyordu.

### Bilinen sorunlar

- Ödeme ekranındaki onay düğmesi henüz gerçek bir tahsilat yapmıyor
  (`PaymentModal` içinde geliştirme amaçlı bir yer tutucu var) ve buna rağmen
  işlemi başarılı sayıyor. Ödeme entegrasyonu tamamlanana kadar bu düğme
  devre dışı bırakılmalıdır.
- Kartvizit görüntülenme sayacı, giriş yapmamış ziyaretçilerde artmıyor.
  Sayaç veritabanı kuralına takılıp sessizce başarısız oluyor; panelde
  görünen rakamlar gerçeğin altında. Faz 2'de düzeltilecek.
- Profil, kurum, üyelik ve bağlantı tabloları herkese açık anahtarla
  okunabiliyor. Faz 1'in tamamı bu konuya ayrıldı; alan bazlı gizlilik
  modeliyle birlikte kapatılacak.

---

## [1.0.0] — 2026-01-29

İlk sürüm. Dijital kartvizit platformu: profil yönetimi, QR kod, NFC kart
tasarımı, sosyal bağlantılar, organizasyonlar, abonelik planları, referans
sistemi ve partner uygulamalar için kimlik sağlayıcı (SSO) rolü.
