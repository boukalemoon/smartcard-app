# Değişiklik Günlüğü

Bu dosya sürüm notlarının **tek kaynağıdır**. Sürüm numarasının kaynağı
`package.json`; bu iki değer daima aynı olmak zorundadır.

Biçim: [Keep a Changelog](https://keepachangelog.com/tr/1.1.0/) ·
Sürümleme: [Semantic Versioning](https://semver.org/lang/tr/)

Anlatı ve faz planı Obsidian'da: `01 - Aktif Projeler/QRtım/`

---

## [1.10.0] — 2026-09-20

Basılı kartın ömür boyu çalışması, karşılıklı kartvizit değişimi ve panel
verisinin doğruluğu. Bu tur boyunca ölçüt şuydu: **panel, bilmediğimiz bir
şeyi biliyormuş gibi göstermesin.**

### Eklendi — kalıcı kart kodu

- Basılı QR ve NFC kartlar artık **kalıcı bir koda** bakıyor. Önceden adres
  kullanıcı adını taşıyordu: kişi kullanıcı adını değiştirdiğinde elindeki
  bütün basılı kartlar ölü bağlantıya dönüyordu. Kod hesaba bağlı, kullanıcı
  adından bağımsız. Eski kullanıcı adları da geçmişten çözülüyor, böylece
  daha önce basılmış kartlar da çalışmaya devam ediyor.
- Kod kişinin isteğiyle yenilenebiliyor (kart kaybedildiğinde): eski kart o
  anda geçersiz olur.
- QR çıktısı baskıya uygun hâle getirildi: SVG olarak indirilebiliyor,
  boyut seçilebiliyor ve etrafında zorunlu sessiz alan (kenar payı) var —
  kenar payı olmadan basılan kod birçok okuyucuda okunmuyordu.
- NFC kartı yazarken **kalıcı kilit** seçeneği eklendi: kilitlenen kartın
  içeriği bir daha değiştirilemez, böylece kart birinin eline geçtiğinde
  başka adrese yönlendirilemez.

### Eklendi — kişi defteri (karşılıklı kartvizit değişimi)

- Kartı okutan kişi kendi bilgisini bırakabiliyor; kart sahibi bunları
  panelinde görüyor, dışa aktarabiliyor ve silebiliyor. Kağıt kartvizitteki
  karşılıklı değişimin dijital hâli; önceden paylaşım tek yönlüydü.
- Bilgi QRtım'a değil **kart sahibine** veriliyor; form bunu açıkça yazıyor
  ve onay kutusu işaretlenmeden gönderilemiyor. Kimlik numarası gibi alanlar
  bilerek istenmiyor. Sel ve taciz için hız sınırı var.

### Eklendi — davet ve onay

- Yönetici artık kimseyi onayını almadan kuruma ekleyemiyor. Ekleme bir
  **davet** oluşturuyor; kişi panelinden kabul edene kadar üye sayılmıyor,
  kurumun verisini göremiyor. (1.9.0'da bilinen sorun olarak yazılmıştı.)

### Düzeltildi — panel veri doğruluğu

- **Analitik sunucuda toplanıyor.** Panel olay kayıtlarını tarayıcıya çekip
  sayıyordu; bin kayıttan sonra bütün kutular sessizce eksik gösterecekti.
- **Dönem seçimi çalışıyor.** Kişisel panelde tarih filtresi hiç
  uygulanmıyordu: "bu ay" seçmek sayıları değiştirmiyordu.
- **"Doğrudan giriş" yalnızca ölçülmüş girişi sayıyor.** Kaynağı hiç
  işaretlenmemiş eski kayıtlar da doğrudan sayılıyordu; panel aynı kayıtları
  hem "doğrudan ziyaret" hem "kaynağı ölçülmemiş" diye gösteriyordu.
- **Sayaçlar aynı sayıyı söylüyor.** Panel ile profil listesi aynı kart için
  farklı görüntülenme sayısı veriyordu.
- **Plan sınırları tek kaynaktan.** Sosyal medya sınırı arayüzde sabitti ve
  yalnızca ücretsiz plana bakıyordu; artık sunucu ile aynı tablodan okunuyor.
  Profil sınırı panelde görünüyor, sınıra çarpınca öğrenilmiyor.
- **NFC kart tasarımcısı olmayan bir kolonu okuyordu:** "daha önce sipariş
  verdi mi" sorusu hep hayır çıkıyor, her adet ücretsiz görünüyordu.
- **Yönetici panelindeki aylık gelir** koda gömülü fiyat listesinden
  hesaplanıyor ve faturalama dönemini yok sayıyordu (yıllık aboneyi aylık
  fiyattan sayıyordu). Artık fiyat tablosundan, döneme göre.
- Kişisel paneldeki sessiz kayıtlar kapatıldı: kayıt engellendiğinde arayüz
  "kaydedildi" diyordu. (1.9.0'da bilinen sorun olarak yazılmıştı.)

### Güvenlik

- **Davet kaçırma kapatıldı.** Profil e-postası istemciden yazılabiliyordu;
  bir kullanıcı kendi profiline başkasının e-postasını yazıp o kişiye gelen
  kurum davetini üstlenebiliyordu. Kimlik artık yalnızca doğrulanmış
  e-postadan, hesap kayıtlarından çözülüyor.
- **Sosyal medya sınırı sunucuda hiç çalışmıyordu:** koruma her çağrıda
  "sistem kullanıcısı" sanıp erken dönüyordu. Testte yakalandı.
- Partner uygulamalarının (Tınga, İlgezdi, Arku) yazma ve okuma yetkileri
  daraltıldı; eşleştirme kalıcı kimlik numarasıyla yapılıyor, e-postayla
  değil.
- Tetikleyici fonksiyonları API yüzeyinden kaldırıldı.

### Değiştirildi

- Marka adı her yerde **QRtım**. Tarayıcıda saklanan davet kodu yeni adla
  tutuluyor, eski ad okunmaya devam ediyor (kimsenin kodu düşmesin).
- NFC sipariş düğmesi artık dürüstçe devre dışı ve sebebi yazıyor; önceden
  "Sipariş Ver" diyor, basınca uyarı veriyordu.

### Bilinen sorunlar

- Paketler satın alınamıyor; ödeme sağlayıcı (PayNkolay) entegrasyonu ve POS
  başvuru akışı bilinçli olarak en sona bırakıldı.
- Hakediş ödeme akışı yok; aylık hesaplama işi zamanlanmış görevde değil.
- Kuruma başvuru yapana bildirim e-postası gönderilmiyor.
- NFC kart siparişi ödemeye bağlı olduğu için hâlâ kapalı.

---

## [1.9.0] — 2026-09-18

Kurumsal ve STK panellerinin çalışır hâle getirilmesi. Panel analizi 24 bulgu
çıkardı; bu sürüm ölçüm altyapısını, panel erişimini ve veri sızıntılarını
kapsıyor. Fiyat/paket revizyonu ve yeni tasarım sonraki aşamalarda.

### Güvenlik

- **Kritik:** giriş yapmış herhangi bir kullanıcı herhangi bir kuruma kendini
  **yönetici** olarak ekleyebiliyordu; başvuranların kişisel verilerini ve üye
  analitiğini okuyabiliyordu. Sıradan hesapla denenerek doğrulandı, kapatıldı.
  Mevcut 10 yönetici kaydının hepsi kurucu — istismar izi yok.
- **Sahte ölçüm kapatıldı.** Kart hareketleri tarayıcıdan doğrudan yazılıyor ve
  tabloda "herkes her satırı yazabilir" kuralı vardı: giriş yapmamış biri
  istediği kişi adına sınırsız görüntülenme üretebiliyordu. Artık tek yol
  sunucudaki `track_card_event` (hız sınırı ve doğrulama içeride).
- **Kurum bilgileri kapatıldı.** Giriş yapan herkes tüm kurumların e-posta,
  telefon ve adresini okuyabiliyordu; artık yalnızca kendi kurumları.
- **Üye iletişim bilgisi.** Kurumun her üyesi diğerlerinin e-posta ve
  telefonunu ham tablodan okuyabiliyordu. Bu kolonların okuma yetkisi
  kaldırıldı; bilgi yalnızca yöneticiye ve kişinin kendisine RPC ile döner.
- Başvuru formu "onaylanmış" başvuru gönderilmesine izin veriyordu; kapatıldı.
- Dışa aktarılan CSV'de formül enjeksiyonu: başvuru formundan gelen ad alanına
  yazılan formül, dosyayı açan yöneticide çalışabiliyordu. Etkisizleştirildi.

### Eklendi — üyeye özel takip ve performans

- **QR ve NFC artık gerçekten ölçülüyor.** QR koduna ve NFC karta yazılan adres
  kaynağını taşıyor; kart okutarak gelen ziyaretçi, bağlantıya tıklayandan ve
  adresi elle yazandan ayrılıyor. (Bu işaretten önce basılmış kartlar
  "doğrudan" görünür.)
- **Gerçek dönem seçimi.** Aylık, yıllık ve tarih aralığı seçimi sunucuya
  gidiyor. Önceden seçim yapılıyor ama tüm zamanların verisi gösteriliyordu.
- **Kurum bazlı doğru sayım.** Üyelikten önceki hareketler kuruma yazılmıyor;
  kişinin birden fazla kurumda olması sayıları şişirmiyor.
- **Üye detayı:** karta nereden gelindiği, hangi profilin görüntülendiği, en çok
  tıklanan bağlantılar ve günlük hareket grafiği.
- Hesabı olmayan üyeler de raporda görünüyor (önceden listeden düşüyorlardı).
- Paylaşım (WhatsApp/SMS/e-posta/bağlantı kopyalama) artık kaydediliyor;
  veritabanı bu olayları reddettiği için bugüne kadar hiç tutulmamıştı.

### Düzeltildi

- **Kurumsal panele kimse giremiyordu.** Panel kişinin kendi aboneliğine
  bakıyordu (STK/Kurumsal); böyle bir abone olmadığı için panel, üye yönetimi
  ve bekleyen başvurular kimseye açılmıyordu. Ölçü artık kurumda yönetici olmak.
- Kayıtlı modu "kurumsal" kalmış kullanıcı bireysel panele dönemiyordu.
- "Başvuruları Yönet" düğmesi arayüzdeki sabit tür listesi yüzünden `dernek`
  türündeki kurumu tanımıyordu; karar artık sunucuda.
- **Herkese açık üye dizini hep boştu:** görünürlük ayarını değiştirecek ekran
  yoktu. Kurum profiline paylaşım ayarları ve paylaşılabilir bağlantılar
  (başvuru formu, üye dizini) eklendi. Dizindeki "Invalid Date" kaldırıldı.
- Üç ayrı görüntülenme sayacı birbirini tutmuyordu; tek yerden güncelleniyor.
- Kişinin kendi kartına bakması artık görüntülenme sayılmıyor.
- Kurum profili ve üye durumu güncellemeleri, yetki yokken de "güncellendi"
  diyordu; etkilenen satır kontrolü eklendi.
- Kurum başına ayrı ayrı atılan üye ve analiz sorguları tek çağrıya indi.

### Kaldırıldı

- **"10 üyeye ulaştınız, %20 toplu indirim otomatik uygulanacak" vaadi.**
  Ödeme akışında böyle bir indirim yoktu; yalnızca bir bayrak işaretleniyordu.
  Fiyat revizyonunda gerçekten uygulanırsa geri gelecek.
- Başvuru formundaki "size e-posta ile bilgi verilecektir" sözü (e-posta
  gönderimi henüz yok).

### Bilinen sorunlar

- Yönetici, kayıtlı bir kullanıcıyı onayını almadan kuruma ekleyebiliyor;
  davet/onay akışı gerekiyor.
- NFC kart siparişi hâlâ "yakında" diyor.
- Kişisel paneldeki bazı kayıt işlemleri hâlâ etkilenen satırı kontrol etmiyor.
- Paketler satın alınamıyor (ödeme sağlayıcı doğrulaması bekliyor).

---

## [1.8.0] — 2026-09-17

Dijital kimliğin ilk kullanıcıya dönük parçası: **profiller**. Kişi iş,
bireysel, akademik ya da etkinlik için ayrı profiller oluşturuyor; her birinde
neyi paylaşacağını kendisi seçiyor ve her profilin kendi bağlantısı var.
Ayrıca silme kayıtları KVKK imha kaydı gereksinimine göre yeniden kuruldu;
saklama süreleri koddan çıkarılıp hukuki teyide bağlandı.

### Eklendi — profiller (persona)

- **Birden fazla profil.** Her profil kendi alan görünürlüğünü, kendi
  değerlerini (iş e-postası ≠ kişisel e-posta), kendi sosyal bağlantı
  seçimini ve organizasyon / ödeme bilgisi gösterimini taşıyor.
- **Tahmin edilemeyen paylaşım bağlantısı.** Ana profil dışındaki profiller
  `/k/<kod>` ile paylaşılıyor (12 karakter, karıştırılabilen harfler yok).
  Mevcut altyapıda persona **adıyla** çağrılabiliyordu — iş kartını gören biri
  ".../bireysel" deneyerek kişisel profile ulaşabilirdi. Artık adla erişim
  mümkün değil (doğrulandı: `null`).
- **Bağlantıyı yenile.** Kod yenilenince daha önce paylaşılan bağlantı ve QR
  anında çalışmayı durduruyor.
- **Duraklat.** Profil silinmeden geçici olarak paylaşımdan kaldırılabiliyor.
- **Ana profil.** `/card/<kullanıcı-adı>` ve basılı NFC/QR kartlar ana profili
  gösteriyor; ana profil değiştirilebiliyor. Ana profil duraklatılamaz ve
  silinemez.
- **Önce seç, sonra paylaş.** QR ekranı önce hangi profilin paylaşılacağını
  soruyor.
- **Varsayılan gizlilik.** Yeni profilde e-posta, telefon ve WhatsApp hiçbir
  şablonda kendiliğinden açık gelmiyor; ödeme bilgisi hiçbir zaman
  kendiliğinden açılmıyor.
- **Katalog veri olarak.** Profil türleri (Genel, İş, Bireysel, Akademik,
  Etkinlik, Özel) ve alan kataloğu (İletişim, Kariyer, Kişisel, Ticari)
  tabloda; kategoriler migration gerektirmeden değiştirilebiliyor. Yeni
  alanlar: WhatsApp, web sitesi, şehir, departman.
- **Plan sınırı** veri olarak (`plan_features`): ücretsiz 2, öğrenci 3,
  profesyonel 5, STK/kurumsal 10 — fiyat revizyonunda güncellenecek.
- Her profil için görüntülenme sayısı.
- Bütün profil işlemleri denetim kaydına düşüyor.

### Güvenlik

- **Kritik:** giriş yapmış herhangi bir kullanıcı herhangi bir kuruma kendini
  **yönetici** olarak ekleyebiliyordu (1.6.0'daki üye ekleme politikası rol
  ve kurum sınırlamıyordu). Böylece başvuranların kişisel verilerini ve üye
  analitiğini görebiliyordu. Sıradan hesapla denenerek doğrulandı ve
  kapatıldı; doğrudan üye ekleme artık yalnızca kurum yöneticisinde. Mevcut
  10 yönetici kaydının hepsi kurucu, istismar izi yok.
- Başvuru formu başvuruyu "onaylanmış" olarak gönderebiliyordu; artık yalnızca
  bekleyen başvuru yazılabiliyor.
- Başvuru formu giriş yapmamış ziyaretçiler için hiç çalışmıyordu (politika
  ziyaretçinin okuyamadığı kurum tablosuna bakıyordu); düzeltildi.
- Başka bir profilin persona'sına alan eklenemiyor: bileşik yabancı anahtar
  (`persona_id + profile_id`) veritabanı seviyesinde engelliyor. Doğrudan
  satır ekleme denemesiyle doğrulandı.
- Katalog dışı alan anahtarı yazılamıyor; katalog yalnızca izin verilen profil
  kolonlarından beslenebiliyor (rol, kazanç gibi kolonlar kazara
  yayımlanamaz).
- Değer doğrulama: e-posta, telefon, bağlantı biçimi ve uzunluk sınırları
  sunucuda.
- Değer değişince eski doğrulama işareti düşüyor.

### Değiştirildi — silme kayıtları (KVKK)

- **Tek noktadan imha kaydı.** Silme kaydı artık `auth.users` üzerindeki
  tetikleyiciden yazılıyor: Supabase paneli, Auth Admin API, yönetici paneli
  veya SQL — hangi yoldan silinirse silinsin aynı kayıt. Önceden panel
  silmeleri bizim kaydımıza, SQL silmeleri Supabase kaydına düşmüyordu.
- Kayıt silinen ve mevzuat gereği korunan (bağı koparılan) kayıtları sayıyor:
  profil, alanlar, bağlantılar, üyelikler, abonelik, analitik, senkron,
  oturumlar / davet, komisyon, işlem, kalan dosya.
- **Saklama süreleri kodda değil, politika tablosunda.** Her kayıt türünün
  (imha kayıtları, finansal ve yönetici işlemleri, hesap kurtarma, yeniden
  kayıt izi, genel işlemler) hukuki dayanağı `data_retention_policies`
  tablosunda. **Süre alanları boş** ve hukuki teyit gelene kadar boş
  kalacak; süre boşken hiçbir kayıt kendiliğinden imha edilmiyor. Süre
  yalnızca teyit işaretiyle girilebiliyor (veritabanı kısıtı). Önceden
  silme kayıtları da genel kayıtlarla birlikte haftalık işte siliniyordu.
- **Silme kategorisi.** Her silme `kullanici_talebi`, `yonetici`,
  `kotuye_kullanim` veya `test` olarak kaydediliyor. Yönetici paneli silme
  sırasında kötüye kullanım olup olmadığını soruyor.
- Supabase Auth'taki 21 eski silme olayı (Mart 2026) maskelenerek kalıcı
  kayda aktarıldı.

### Eklendi — yeniden kayıt doğrulama izi

Silinen hesabın kopyası **tutulmuyor**. Kullanıcı tüm verilerinin silinmesini
istediğinde kopyasını saklamak KVKK md. 3'e göre işlemeye devam etmek
demek; "silindi" denip saklanması silme yükümlülüğünü ihlal eder. Aynı amaç
(silinip geri gelen kişinin saldırgan mı gerçek kişi mi olduğunu anlamak)
veri minimizasyonuna uygun şekilde karşılandı:

- Hesap silinirken e-posta ve telefonun **HMAC-SHA256 özeti** tutuluyor
  (`account_fingerprints`). Anahtar Supabase Vault'ta; özetten e-posta
  elde edilemiyor. Ad, profil, içerik tutulmuyor; hesap açılışı yalnızca ay
  hassasiyetinde.
- Normalizasyon: e-postada büyük/küçük harf ve `+etiket`, Gmail'de noktalar
  yok sayılıyor; telefonda `0532…`, `+90 532…`, `532…` aynı kabul ediliyor.
- Yeniden kayıtta eşleşme olursa **kayıt engellenmiyor**;
  `account.reregistration_detected` güvenlik kaydı düşüyor. Önceki silme
  kötüye kullanım ise kritik, değilse bildirim seviyesinde.
- Test hesabı silmelerinde iz bırakılmıyor.
- İz tablosu, politika tablosu ve özet fonksiyonu istemci rollerine kapalı
  (tablo yetkisi + RLS). Normal kullanıcı ve anonim erişim denenerek
  doğrulandı.
- KVKK Aydınlatma Metni ve Gizlilik Politikası güncellendi: sabit süreler
  kaldırıldı, mevzuata atıf yapıldı; güvenlik özeti, amacı ve meşru menfaat
  dayanağı açıklandı. **Hukuk danışmanı onayı gerekli.**

### Düzeltildi

- Logolu QR kodların bir kısmı okunamıyordu: logo kodun %20'sini kapatıyor,
  varsayılan hata düzeltme ise ~%15 kaybı tolere ediyordu. Logo varken en
  yüksek seviye (~%30) kullanılıyor.
- Kişi kartına (vCard) yazılan adres paylaşılan profilin adresi; persona
  kartı ana karta yönlendirmiyor.

### Kaldırıldı

- Test hesabının ödemesiz yükseltmesinden doğan 50 TL "paid" komisyon ve ona
  bağlı davet kaydı (kullanıcı talebi).
- Platform sahibinin test hesabı (h\*\*\*@lup.com) ve ona bağlı bekleyen davet
  kaydı; ESİS'teki sahte bekleyen başvuru (kullanıcı talebi, kayıt altında).
- `FieldVisibilityManager` — yerini profil yöneticisi aldı.

### Bilinen sorunlar

- Supabase Auth'un kendi kaydı (`auth.audit_log_entries`) silinen kişilerin
  tam e-posta ve telefonunu tutmaya devam ediyor; bizim politika tablomuzun
  dışında.
- Saklama süreleri hukuki teyit bekliyor; teyide kadar otomatik imha yok.
- Organizasyon üyeliklerinde hangi profilin paylaşılacağı henüz seçilemiyor
  (e-posta görünürlüğü ana profile göre).
- NFC karta yazma ana profil adresini yazıyor; profil seçimi yok.
- Liste türü alanlara (hizmetler, katalog) profile özel değer henüz
  girilemiyor; profil bilgisindeki değer kullanılıyor.

---

## [1.7.0] — 2026-09-17

Güvenlik kapanışı ve veri temizliği. Dijital kimliğin temel sözü — "gizli
tuttuğun bilgi gizli kalır" — ilk kez veritabanı seviyesinde gerçekten
tutuluyor.

Bütün bulgular sıradan bir kullanıcı hesabıyla, geri alınan işlemlerde
denenerek doğrulandı; her düzeltme aynı saldırı tekrar denenerek test edildi.

### Güvenlik

- **"Gizli" işareti kayıtlı herkese karşı işe yaramıyordu (yüksek).**
  Profil tablosunda iki ayrı "herkes okuyabilir" kuralı vardı. E-postasını
  gizli işaretlemiş iki kullanıcının e-postası kartta doğru şekilde
  görünmüyordu, ama giriş yapmış herhangi biri tek sorguyla e-postalarını ve
  telefonlarını okuyabiliyordu (35 profilin tamamı, 9 telefon). Artık kişi
  yalnızca kendi profilini görüyor; başka profile dokunan her özellik
  yalnızca gereken alanı döndüren ve yetkiyi kendisi kontrol eden bir
  fonksiyona taşındı.
- **Herkes herkesin profil fotoğrafını ve şirket logosunu değiştirip
  silebiliyordu (yüksek).** Sıradan kullanıcı 28 dosyanın 28'ini
  değiştirebildi. Artık yalnızca dosyanın sahibi (28 → 0).
- **Davet atfı ele geçirilebiliyordu.** Davet tablosuna herkes kayıt
  ekleyebiliyor, davet eden kendi kayıtlarının komisyon tutarını
  değiştirebiliyordu. Biri kendini başkasının davet edeni yapıp o kişinin
  gerçek ödemesinden komisyon alabilirdi. İstemcinin davet yazma yetkisi
  tamamen kaldırıldı.
- **Komisyon ödemesiz plan değişikliğinden doğuyordu.** Plan ücretsizden
  ücretliye geçtiği anda davet edene "onaylanmış" komisyon yazılıyordu —
  planın nasıl değiştiğine bakılmadan. Kanıt: ödemesi hiç olmayan test
  hesabının yükseltmesi 50 TL "paid" komisyon üretmiş. Artık komisyon
  yalnızca doğrulanmış ödeme bildirimiyle doğuyor; yönetici elle plan
  verdiğinde komisyon oluşmuyor ve bu denetim kaydına düşüyor.
- **Plan sınırı atlatılabiliyordu.** Organizasyonlar doğrudan eklenebiliyordu;
  ücretsiz planda 5 sahipsiz organizasyon açılabildi. Artık yalnızca plan
  sınırını uygulayan fonksiyonla.
- **Faturalama bayrakları istemcideydi.** %20 toplu indirim bayrağını ve
  üye sayısını tarayıcı yazıyordu. Artık sunucuda türetiliyor; istemcinin
  değiştirme denemesi geri alınıyor ve kayda düşüyor.
- **Davet kodları ve kazançları herkese açıktı.** Artık yalnızca sahibine ve
  yöneticiye.
- E-postayla üye ekleme, "bu e-posta QRtım'da kayıtlı mı" taraması için
  kötüye kullanılamasın diye saatte 30 sorguyla sınırlandı.

### Düzeltildi

- **Hesap silinemiyordu — "Database error deleting user".** Davet
  kaydındaki bağlantı "NO ACTION" kuralındaydı: davetle kayıt olan hiç kimse
  (ve davet eden) hesabını silemiyordu. KVKK silinme hakkı açısından ciddi
  engel. Profile bağlı 10 kolonun kuralı değiştirildi; finansal ve davet
  kayıtları mevzuat gereği korunuyor ama silinen kişiye bağı kopuyor.
  Test hesabı `mehmet@ahmet.com` bu düzeltmeyle silindi.
- **Yönetici panelinde "kullanıcı sil" hiç çalışmamıştı.** İstemciden 6 tabloyu
  hata kontrolü olmadan siliyor (erişim kuralları nedeniyle 0 satır), auth
  kaydını hiç silmiyordu. Artık tek denetimli işlem: gerekçe zorunlu,
  yönetici ve kendi hesabı silinemez, organizasyonu yöneticisiz bırakacaksa
  ayrıca uyarıyor, denetim kaydında e-posta maskeli.
- **Yönetici panelinde "rol değiştir" sessizce başarısızdı** (başka
  kullanıcıda 0 satır, ekranda "güncellendi"). Artık gerekçeli; son yönetici
  düşürülemiyor.
- **Yönetici paneli yalnızca kendi satırlarını görüyordu.** Abonelik,
  komisyon ve davet tablolarında yönetici okuma kuralı yoktu.
- **Kurumsal analitik diğer üyeler için hep 0'dı.** Fonksiyon çağıranın
  yetkisiyle çalışıyor, olaylar ise yalnızca sahibine görünüyordu.
- **9 organizasyonun 9 yöneticisi "Üye <email@example.com>" görünüyordu.**
  Sebep sütun varsayılanı; organizasyona katılma ve başvuru onaylama kodu
  ad/e-posta göndermediği için yeni üyelerde de sürüyordu. Ad artık
  profilden geliyor; **e-posta yalnızca kişi kartında paylaşıma açtıysa** —
  e-postasını gizli tutanın e-postası organizasyonun diğer üyelerine de
  açılmıyor.
- **Başvuru onayı yarım kalıyordu.** Durumu "onaylandı" yapıp, başvuranın
  hesabı yoksa üyeyi eklemiyordu. Artık onaylanan her başvuru üye oluyor.
- **Davet programı hiç çalışmıyordu.** Kayıt ekranı davet kodunu saklıyor
  ama kayda göndermiyordu; davetle gelen kimse davet edene bağlanmıyordu.
  Artık davet kaydını sunucu oluşturuyor; yanlış kod kaydı engellemiyor.
- **Mükerrer davet kodları.** "Kod oluştur" her tıklamada yeni kod ekliyordu
  (bir hesapta 8). Profil başına tek kod.
- **Süresi dolan abonelik ücretsize düşmüyordu.** Artık saatlik zamanlanmış
  işle düşüyor; kullanılmış NFC kart hakkı geri alınmıyor, kullanıcıya
  bildirim kuyruğa yazılıyor.
- **Zamanlanmış hiçbir iş yoktu.** Abonelik bitişi, kurtarma talebi süresi,
  ölü oturum temizliği ve denetim kaydı saklama süresi artık `pg_cron` ile
  çalışıyor.
- **Açılış sayfası istatistikleri 0 gösteriyordu** (anonim profil okuması
  kapatıldığından beri). Yalnızca toplamları döndüren fonksiyona taşındı.
- **ESİS mükerrer kayıtları birleştirildi.** Aynı sendika için üç kayıt tek
  kayda indi. 3 başvuru silinmedi, kalan kayda taşındı (başvuranlar
  kullanıcının hesabına bağlı değildi). Eski organizasyon bağlantıları
  yenisine yönlendiriliyor; paylaşılmış başvuru adresleri kırılmadı.

### Değiştirildi

- `burakakmese@gmail.com` planı Kurumsal → Profesyonel (kullanıcı talebi).

### Bilinen sorunlar

- Silinen kullanıcının depolamadaki dosyaları SQL ile silinemiyor (Storage
  API gerekiyor); silme işlemi kalan dosya sayısını raporluyor.
- Analitik olayları anonim olarak herhangi bir profil adına yazılabiliyor
  (sayı şişirme). Kişisel veri sızıntısı değil, veri doğruluğu sorunu.
- Organizasyon bilgileri giriş yapmış herkese açık.
- Toplu indirim bayrağı türetiliyor ama ödeme tutarına uygulanmıyor
  (fiyat revizyonunda ele alınacak).
- Kullanıcının kendi hesabını silebileceği bir ekran yok (KVKK).
- Yöneticisiz iki organizasyon kaldı: "Pega", "Türkiye Gençlik Derneği".
- Kullanılmayan 4 tablo: `organization_members`, `organization_admins`,
  `organization_member_requests`, `invitations`.

---

## [1.6.0] — 2026-09-16

Üç iş: **kurumsal/STK panelinin onarılması**, **kurtarma sistemi** ve
**PayNkolay ödeme altyapısının arka ucu**. Yol boyunca ödeme sistemini
tamamen baypas eden bir açık bulundu ve kapatıldı.

### Güvenlik

- **Kritik — kullanıcı kendi planını yükseltebiliyordu.** Giriş yapmış
  herhangi bir kullanıcı, tarayıcı konsolundan tek istekle kendi aboneliğini
  Kurumsal plana, 10 yıl geçerli, 50 NFC kart hakkıyla yükseltebiliyordu
  (geri alınan işlemde denendi: etkilenen satır 1). Sebep: iki ayrı
  güncelleme kuralı yalnızca "kendi kaydın mı" diye soruyor, "hangi alanı
  değiştiriyorsun" diye sormuyordu. İstemcinin abonelik yazma yetkisi
  tamamen kaldırıldı; abonelik artık yalnızca doğrulanmış ödeme bildirimi,
  kayıt tetikleyicisi veya denetimli yönetici işlemiyle değişiyor.
  Doğrulandı: etkilenen satır 0, kullanıcı kendi aboneliğini okumaya devam
  ediyor.
- **Üye verisi sızıyordu.** Üyelik tablosunun okuma kuralı her şeye açıktı.
  Ölçüldü: giriş yapmış bir kullanıcı 9 üyenin tamamını görüyordu, bunların
  6'sı hiç üyesi olmadığı organizasyonlara aitti ve e-postaları okunabiliyordu.
  Artık yalnızca kendi organizasyonlarının üyeleri görünüyor (6 → 0).
- **NFC siparişleri sahte "ödendi" durumuyla açılabiliyordu.** İstemci
  siparişi kendi fiyatı ve kendi ödeme durumuyla ekleyebiliyordu. Tablo henüz
  boştu; artık istemciden gelen her sipariş zorla `pending` başlıyor.
- **Başvuru spamı sınırsızdı.** Üst üste 5 sahte başvuru geçti. Artık aynı
  e-posta aynı kuruma bekleyen tek başvuru yapabiliyor ve kurum başına saatte
  20 sınırı var.
- **Fiyatlar istemcideydi.** Tarayıcıda değiştirilebilirdi. Artık tek kaynak
  sunucudaki `plan_prices`; ödeme tutarı her zaman sunucuda hesaplanıyor.

### Düzeltildi — kurumsal / STK paneli

Ortak kök sebep: erişim kuralları profil kimliğini doğrudan kullanıcı
kimliğiyle karşılaştırıyordu. 36 profilin 9'unda bu ikisi farklı ve
**organizasyon yöneticilerinin 9'undan 7'si** bu gruba düşüyor. Çözüm tek
yerde toplandı (`my_profile_id`, `is_member_of_org`, `is_admin_of_org`).

- **Yöneticiler başvuruları göremiyordu** (0 → 3). Ayrıca giriş yapmamış
  ziyaretçide bu kural "permission denied" hatasına dönüşüyordu.
- **Üye rolü değiştirilemiyordu.** Tabloda güncelleme kuralı hiç yoktu
  (0 → 1 satır). Arayüz yine de "Üye güncellendi!" diyordu.
- **Üye silinemiyordu.** Silme kuralları hiç kullanılmayan, boş bir tabloya
  (`organization_admins`) bakıyordu (0 → 1 satır). Arayüz "Üye silindi!"
  diyordu.
- Üye ekleme/güncelleme/silme ekranları artık etkilenen satırı kontrol ediyor;
  bu projede dördüncü kez karşılaşılan "sessiz başarı" deseni kapatıldı.
- **Son yönetici koruması.** Bir organizasyonun son yöneticisi ne silinebiliyor
  ne de düşürülebiliyor — sahipsiz organizasyonların oluşma yolu kapandı.
  Organizasyon silme ve hesap kapatma bu korumadan etkilenmiyor (doğrulandı).
- **Yönetici panelinde plan değiştirme sessizce bozuktu.** Başka bir
  kullanıcının planını değiştirmeye çalışınca 0 satır etkiliyor ama ekran
  planı değişmiş gösteriyordu. Artık gerekçe soran, denetim kaydına `critical`
  düşen `admin_set_plan` üzerinden çalışıyor.
- Başvuru işlemleri de denetim kaydına giriyor.

### Eklendi — kurtarma sistemi (şema ve durum makinesi)

Ürün kararı: saf sıfır-bilgi reddedildi — kullanıcının verisini kaybetme
riski itibarı zedeler. Kurulan şey en güvenli **kurtarılabilir** sistem.

- **Çekirdek ilke:** kanalı kullanıcı seçer, bekleme süresini sistem seçer.
  Açık oturumdan onay ve kurtarma kodu anında; kurtarma kişisi 12 saat;
  e-posta + parola 24 saat; parolasız e-posta 72 saat; bilinmeyen cihazda
  süreler iki katı. Doğrulandı: bilinmeyen cihazdan parolasız talep 144 saat.
- **Tek tıkla iptal, giriş gerektirmez.** Parolasını unutan kullanıcı da iptal
  edebilmeli. İptal, hesabı kilitleme seçeneğiyle birlikte geliyor.
- **Kurtarma kişisi.** Güvendiğin bir QRtım kullanıcısı talebini onaylarsa
  bekleme 12 saate iner (sıfırlanmaz: onun hesabı da ele geçirilmiş olabilir).
  QRtım kullanıcısı olmayan biri seçilemez. Kurtarma kişisi kendisinden onay
  bekleyen talepleri uygulama içinde görebiliyor.
- **Kimlik sızdırmaz.** Kayıtlı olmayan e-posta ile açılan talep, geçersiz
  iptal belirteci ile yapılan istek — hepsi aynı cevabı alıyor.
- **Veri asla silinmez.** İptal edilen, reddedilen, süresi dolan hiçbir talep
  veriyi silmez.
- Bildirim kuyruğu (`notification_outbox`): e-posta hazır olmasa bile
  bildirimler kaybolmadan bekliyor.
- Her adım denetim kaydına `critical` olarak düşüyor.
- Anahtar serbest bırakma noktası işaretli bırakıldı; şifreli veri geldiğinde
  anahtar bu veritabanında değil, ayrı bir serviste duracak.

### Eklendi — ödeme altyapısı (PayNkolay arka ucu)

- `PaymentModal` içindeki `paymentSuccess = true` taslağı kaldırıldı. Ödeme
  alınmadan NFC hakkı yazılması sona erdi.
- **Ödeme niyeti** (`payment_intents`): tutar sunucuda, kuruş cinsinden
  tamsayı. Yeni niyet açılınca bekleyen eskisi iptal ediliyor.
- **Hak tanımlama yalnızca doğrulanmış banka bildirimiyle** (`payment_settle`):
  - Tutar zorunlu ve niyetle birebir eşleşmeli; bildirilmezse veya farklıysa
    hak tanımlanmaz, `critical` kayıt düşer.
  - Idempotent: aynı bildirim ikinci kez gelirse hak ikinci kez tanımlanmaz.
  - İptal edilmiş bir niyet ödendiyse hak yine verilir (para çekildiyse
    vermemek olmaz) ama olası çift ödeme olarak işaretlenir.
  - Erken yenilemede süre bugünden değil, mevcut bitişten uzar.
  - İstemci bu fonksiyonu çağıramaz, kendi ödemesini "ödendi" yapamaz
    (etkilenen satır 0).
- **Edge Function'lar** `payment-start` ve `payment-callback` canlıda.
  Sağlayıcıya özgü her şey tek dosyada (`_shared/paynkolay.ts`).
- **Kapalı başarısızlık.** İmza biçimi tahminle yazılmadı. Entegrasyon
  dokümanıyla doğrulanana kadar ödeme başlatılmıyor ve hiçbir banka bildirimi
  işlenmiyor. Canlıda denendi: sahte "ödendi" bildirimi 503 aldı, işlenmedi,
  IP ve parametreleriyle `critical` kayda düştü.
- Kart verisi hiçbir koşulda kalıcı kayda girmiyor.
- **Ödeme sonuç sayfası** (`/odeme/sonuc`) adres çubuğundaki durum bilgisine
  güvenmiyor; başarıyı yalnızca veritabanı onaylarsa gösteriyor.
- Para biçimleme yardımcıları için 20 birim testi; belirsiz tutarı (`1.234`)
  tahmin etmek yerine reddediyor.

### Bilinen sorunlar

- PayNkolay entegrasyon dokümanı bekleniyor; imza alanları doldurulup test
  ortamında doğrulanmadan ödeme açılmayacak.
- Süresi dolan abonelikleri ücretsiz plana düşüren bir işlem yok. İki ücretli
  abonelikte bitiş tarihi hiç tanımlı değil.
- Kurtarma sisteminin arayüzü ve e-posta gönderim işçisi yok (şema hazır).
- `pg_cron` kurulu değil; süresi dolan kurtarma taleplerinin kapatılması
  dışarıdan tetiklenmeli.
- "Espor İşverenleri Sendikası" adıyla iki organizasyon var; 3 başvuru hiç
  yöneticisi olmayanın üzerinde duruyor.
- Panelin "QR Tarama" kutusu her zaman 0: kodda bu olayı kaydeden satır yok.
- Canlıdaki (henüz dağıtılmamış) eski ödeme ekranı hâlâ sahte "Ödeme
  başarılı" mesajı gösteriyor; artık hiçbir hak tanımlayamıyor, ama arayüz
  dağıtılana kadar yanıltıcı.

---

## [1.5.0] — 2026-09-12

QRtım'ın dijital kimlik katmanına dönüşümünün ilk somut adımı. İki büyük
parça: **kayıt hattının tamamen onarılması** ve **uygulamadan bağımsız
kullanıcı senkronizasyonu + denetim kaydı altyapısı**.

Bu sürümün çıkış noktası bir soruydu: "Codlean'de bir kullanıcı var, nasıl
4 kayıt oluyor?" Cevabı aramak beş ay boyunca sessizce çalışan bir hataya
kadar gitti.

### Eklendi

- **Denetim kaydı (`audit_log`).** Projede bugüne kadar "kim, ne zaman, neyi,
  nereden değiştirdi" sorusunu cevaplayabilen tek satır yoktu. Artık var ve
  **salt-ekleme**: bir tetikleyici UPDATE'i tamamen, DELETE'i 90 gün dolmadan
  engelliyor. Servis anahtarımız ele geçse bile izler anında silinemez.
  Doğrulandı: değiştirme denemesinden sonra kayıt aynı, silme denemesinden
  sonra kayıt yerinde.
- **Sekiz kritik tabloda otomatik denetim tetikleyicisi** (profiles,
  profile_fields, social_links, subscriptions, members, organizations,
  nfc_orders, profile_payment). Logu uygulama koduna serpiştirmek yerine
  veritabanına koyduk: hangi istemciden, hangi anahtarla gelirse gelsin
  kayıt düşüyor — İlgezdi/Arku kendi istemcilerinden yazdığında da,
  service_role ile elle müdahale edildiğinde de.
  - Satırın tam kopyası tutulmuyor; yalnızca hangi kolonların değiştiği.
    Denetim kaydı veritabanının ikinci bir kopyası olmamalı.
  - Değeriyle kaydedilenler yalnızca güvenlik kritik kolonlar (e-posta,
    kullanıcı adı, rol, durum, plan). Hesap ele geçirme incelemesinde
    "e-posta ne zaman neye çevrildi" sorusunun cevabı bunlarda.
  - Yalnızca `updated_at` değiştiyse kayıt açılmıyor — gürültü asıl olayları
    görünmez kılar.
- **Hesap Hareketleri paneli.** Kullanıcı kendi hesabında ne olduğunu
  görebiliyor. Hem kimlik ürününün doğal parçası hem de KVKK'nın istediği
  şeffaflık. Başkası tarafından yapılan değişiklikler ayrıca işaretleniyor.
- **Uygulamadan bağımsız senkronizasyon (`user_sync_data`).** Uygulama başına
  ayrı tablo (`ilgezdi_sync_data`) yerine `(kullanıcı, uygulama, veri türü)`
  üçlüsü. Beşinci uygulama için tek satır kayıt yetiyor.
  - **Sürüm numarası:** İlgezdi iki cihazdan senkron olduğunda ikincisi
    birincinin yer imlerini sessizce eziyordu. Artık çakışma hata dönüyor.
  - **Boyut sınırı (5 MB):** önceden sınır yoktu.
  - Mevcut veri taşındı ve doğrulandı: 417 yer imi, 22 klasör, 19 ayar
    anahtarı, orijinal tarihiyle (25.07.2026) birlikte.
- **Kullanıcı tercihleri (`user_preferences`).** Dijital kimliğin asıl
  parçası: `global` kapsamda yazılan tercih tüm uygulamalarda geçerli,
  uygulama kapsamındaki onu eziyor. Uygulama tek çağrıda (`get_preferences`)
  "bu kullanıcı benden ne bekliyor" cevabını alıyor.
- **Uygulama bağlantıları (`app_connections`).** "Hangi uygulamalara QRtım
  hesabımla giriş yaptım, hâlâ açık mı?" Bağlantı kesildiğinde o uygulamanın
  senkron verisi de siliniyor.
- **Ölü oturum temizliği (`cleanup_expired_sessions`).** QR giriş oturumları
  yalnızca sorgulandıklarında süresi dolmuş sayılıyordu; hiç sorgulanmayan
  sonsuza dek beklemede kalıyordu.

### Düzeltildi

- **Basılı kartlar geçici adrese bağlanabiliyordu.** QR kod ve NFC kart,
  adresi üretildiği anda içine basar ve bu sonradan düzeltilemez. Adres
  `window.location.origin` ile üretiliyordu; yani bir Vercel önizleme
  dağıtımından (`…-git-main.vercel.app`) üretilen kart o geçici adrese
  bağlanıyor ve önizleme kapanınca **fiziksel kart ölüyordu**. Aynı sebeple
  domain değişimi de basılmış kartları etkileyecekti.
  Adres artık `VITE_PUBLIC_URL` değişkeninden okunuyor (`src/lib/siteUrl.js`).
  - İki yönlü doğrulandı: değişken tanımlıyken kanonik adres pakete gömülüyor;
    **değişken tanımsız olsa bile** üretim derlemesi önizleme adresine
    düşmüyor, bilinen üretim adresini kullanıp konsola uyarı bırakıyor.
  - Etkilenen yerler: QR kod, NFC kart, kişi kartı (vCard) içindeki adres,
    davet bağlantısı ve kullanıcı adı önizlemesi.
  > Bu, domain `qrtim.com.tr`'ye taşınmadan önce kapatılması gereken bir
  > önkoşuldu. Eski domain kapatılmamalı: bugüne kadar dağıtılmış her kart
  > `qartim.com` diyor; o adres süresiz yenilenip yolu koruyarak kalıcı
  > yönlendirmede tutulmalı.

- **Kayıt hattı — beş aydır sessizce kırıktı.** `handle_new_user` profil
  ekliyor, ardından abonelik eklerken `ON CONFLICT (profile_id)` kullanıyordu;
  ama o kolonda benzersizlik kısıtı yoktu. PostgreSQL satırı atlamıyor,
  `42P10` hatası veriyor. Fonksiyonun sonundaki `EXCEPTION WHEN OTHERS` hatayı
  yutuyor — ama PL/pgSQL'de exception bloğu **blok içindeki tüm değişiklikleri
  geri alır**, profil eklemesi dahil. Sonuç: kullanıcı oluşuyor, profili
  oluşmuyor, hiçbir yerde hata görünmüyor.
  - Ölçüm: 36 auth kullanıcısının 15'inde profil yoktu; 12'si doğrulanmış,
    giriş yapmış gerçek kişilerdi. Profili olanlar kayıt akışı sayesinde
    değil, panelde formu doldurdukları için kurtulmuştu.
  - Benzersizlik kısıtı eklendi, abonelik oluşturma `handle_new_user` içinden
    kaldırıldı (iki tetikleyici birden ekliyordu), eksik profiller geri
    dolduruldu.
- **Kullanıcı adı üretiminde sıra hatası** — kendi testlerimizde yakalandı.
  `lower(regexp_replace(...))` yerine regexp önce çalışıyor ve `[^a-z0-9]`
  büyük harfleri siliyordu: `AHMET@` boş, `Zeynep.Kaya@` → `eynepaya`,
  `BURAK123@` → `123`. Kullanıcı adı olmadan kartvizit sayfası açılamıyor,
  yani sessizce kartsız kullanıcı üretiyordu. Dört uç durumla doğrulandı.
- **Mükerrer abonelikler.** 16 profilde ikişer etkin abonelik vardı (aynı
  saniye, birebir aynı içerik). Arayüz tek satır beklediği için bu
  kullanıcılar sessizce ücretsiz plana düşüyordu — hepsi zaten ücretsiz
  olduğu için zararsızdı, ama biri ücretli plana geçtiği an ödediği hâlde
  düşecekti. 16 satır silindi, bir daha oluşamaz.
- **Sahipsiz organizasyonlar.** Organizasyon oluşturma iki ayrı yazma
  yapıyordu; ikincisi başarısız olunca üyesiz kabuk kalıyordu. 33
  organizasyonun 24'ü sahipsizdi. Oluşturma tek atomik RPC'ye alındı
  (`create_organization`), plan sınırı artık sunucuda uygulanıyor, 20 kabuk
  silindi, gerçek verisi olan 4 tanesi korundu.
- **`organizations.created_by` yoktu.** Sahiplik yalnızca üyelik kaydında
  duruyordu, dolayısıyla üyelik yazımı başarısız olunca sahip bilgisi de
  kayboluyordu. Kolon eklendi, 9 organizasyon için geri dolduruldu.
- **Üç tırnaklı kolon varsayılanları.** `members.status` varsayılanı fazladan
  tırnak taşıyordu; durum sorgusu 0 satır eşleştiriyordu. Varsayılanlar ve
  9 satır düzeltildi.
- **Profil kaydetme.** İki ayrı hata: (1) güncelleme dönen satır sayısını
  kontrol etmiyordu — erişim kuralı engellese bile "Profil kaydedildi"
  yazıyordu. (2) Profil zaten varken ekleme deneniyor, birincil anahtar
  çakışması veriyordu. "Kaydedemiyorum" şikâyetinin sebebi buydu.
- **Kayıt sırasındaki "syntax hatası".** Ham İngilizce sunucu hataları
  kullanıcıya olduğu gibi gösteriliyordu. Asıl sebep bulundu: doğrulama
  e-postası gönderilemediğinde kayıt 500 ile çöküyor (SMTP alıcıyı
  reddediyor). SMTP, e-posta biçimi ve gönderim kotası hataları
  Türkçeleştirildi.
- **`profiles.id` her zaman kullanıcı kimliğine eşit değil.** 36 profilin
  9'unda ayrışıyor (panelden elle açılmış eski kayıtlar). Denetim
  tetikleyicileri profil kimliğini profil üzerinden kişiye çeviriyor; aksi
  halde o 9 kullanıcı kendi hareket geçmişini hiç göremezdi.

### Güvenlik

- Yeni RPC'ler `anon` rolüne kapatıldı. PostgreSQL yeni fonksiyonlara
  varsayılan olarak PUBLIC'e çalıştırma yetkisi verir; yalnızca
  `authenticated` rolüne yetki vermek yetmiyor, PUBLIC'ten geri almak da
  gerekiyor. (Test edildiğinde hepsi oturum yok dönüyordu, yani sızıntı
  yoktu — ama API yüzeyinde görünmeleri gereksizdi.)
- Tetikleyici fonksiyonları REST yüzeyinden çekildi; artık RPC olarak
  çağrılamıyorlar.
- `audit_log_guard` ve `user_sync_data_guard` fonksiyonlarında `search_path`
  sabitlendi.
- `integration_providers` erişim kuralları açıktı ama **tek politikası
  yoktu** — giriş yapmış kullanıcı künyenin hiçbir satırını okuyamıyordu.
  Etkin satırlar okumaya açıldı.
- `log_event` istemciye kapalı: açık olsaydı kullanıcı kendi denetim kaydını
  uydurabilirdi. Yalnızca sunucu tarafı çağırıyor.
- 15 ölü QR giriş oturumu ve 5 süresi geçmiş bağlantı belirteci silindi
  (en eskisi 01.07.2026).
- **Doğrulandı:** çapraz kullanıcı erişimi her yerde 0; `anon` için
  `auth.uid()` boş ve tüm yeni RPC'ler reddediyor; herkese açık kartvizit
  yolu (`get_public_card`) bozulmadan çalışıyor.

### Bilinen sorunlar (bu sürümde kapatılmadı)

- `PaymentModal` ödeme başarısını sabit doğru kabul ediyor; ödeme alınmadan
  NFC hakkı tanımlanıyor.
- QR kod hata düzeltme seviyesi ayarlanmamışken üzerine %20 boyutunda logo
  basılıyor; bazı kodlar okunmayabilir.
- Şifre sızıntısı koruması Supabase Pro özelliği, ertelendi.
- Giriş yapmış kullanıcılar hâlâ tüm profilleri okuyabiliyor.
- İlgezdi istemcisi hâlâ eski `ilgezdi_sync_data` tablosuna yazıyor; yeni
  RPC'lere geçiş ayrı bir adım.
- E-posta gönderim kotası saatte 30; yoğun kayıt anında 31. kişiden sonrası
  doğrulama e-postası alamaz.

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

### Yayına alındı — 12.09.2026

Arayüz dağıtıldı ve son veritabanı adımı uygulandı. **Profil, kurum, üyelik
ve bağlantı verisi artık herkese açık anahtarla okunamıyor.**

Dağıtım sonrası ölçülenler:

- Güvenlik başlıklarının tamamı yayında (CSP, HSTS, X-Frame-Options,
  Referrer-Policy, Permissions-Policy, nosniff).
- Kartvizit, üye dizini ve başvuru sayfaları yalnızca sunucu fonksiyonlarıyla
  çalışıyor; doğrudan tablo erişimi kalmadı.
- Kapatılanlar artık erişilemiyor: profil, bağlantı, üyelik, kurum tabloları
  ve ödeme bilgisi ucu.
- Çalışmaya devam edenler: kartvizit sayfası (iletişim, sosyal bağlantılar,
  kurumlar, banka/fatura bilgisi dahil), kurum sayfaları, görüntülenme
  sayacı ve herkese açık başvuru formu.
- Görüntülenme sayacı ilk kez gerçekten artıyor.

### Kalanlar

- **Sızmış şifre koruması** ücretli planda bulunuyor; ücretsiz planda
  açılamadı. Plan yükseltmesi gündeme gelirse tekrar değerlendirilecek.
- Ödeme ekranındaki onay düğmesi hâlâ tahsilat yapmadan işlemi başarılı
  sayıyor; ödeme entegrasyonu yazılana kadar devre dışı bırakılmalı.

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
