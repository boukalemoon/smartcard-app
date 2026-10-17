// PLANLAR VE FİYATLAR — sitede gösterilen tutarların tek kaynağı.
//
// Fiyatlar burada değişir; sunucu ödeme anında kendi tutarını hesaplar.
// Ödeme tutarını tarayıcı belirlemez: payment_create_intent tutarı
// public.plan_prices tablosundan okur (supabase/migrations/20260913120000_payment_intents.sql).
// PaymentModal ekrandaki tutar sunucununkinden farklıysa kişiye sorar.
// Bu yüzden burada bir tutarı değiştirirken plan_prices satırını da aynı
// migration diliyle güncelleyin; yoksa kişi ödeme anında farklı tutar görür.
//
// Plan anahtarları sunucudakiyle aynıdır (subscriptions.plan, plan_prices.plan,
// plan_features.plan): free, student, professional, stk, business.
// ('corporate' pazarlıkla satılan, sitede listelenmeyen kademedir.)
//
// Sınırlar sunucudaki public.plan_features tablosundan (my_plan_limits) alındı;
// sunucu bu sınırları kendisi uygular. Burada yalnız gösterim için yazılır.

// Ayrı sipariş edilen PVC NFC kart bedeli. PaymentModal ve NFCCardDesigner
// buradan okur; kendi sabitlerini TUTMAZLAR (eskiden PaymentModal'da ayrı bir
// NFC_PRICE ve ayrı bir plan fiyat tablosu vardı, ayrışmaya açıktı).
export const NFC_KART_FIYATI = 249

// Yıllık + kart paketi = yıllık ücret + (pakete dahil kart adedi × kart bedeli).
// ÖNCEKİ HÂLİ: fark her planda sabit 799 ₺'ydi, yani 1 kart ile 10 kart aynı
// parayı ediyordu. Artık adede göre ölçekleniyor.
// Tutarlar plan_prices ile birebir olmalı; biri değişirse diğeri de
// (supabase/migrations/20261017120000_fiyat_guncellemesi.sql deseniyle).
export const PLANLAR = [
  {
    anahtar: 'free',
    ad: 'Başlangıç',
    alt: 'Ücretsiz, sınırlı',
    fiyat: { aylik: 0, yillik: 0, yillikKartli: null },
    // Yıllık abonelikte pakete dahil kart adedi (plan_prices.nfc_included).
    kartHediyesi: null,
    sinir: { profil: 2, sosyal: 3, kurum: 2 },
    dugme: 'Ücretsiz başla',
    maddeler: [
      { metin: '2 profile kadar dijital kart' },
      { metin: '3 sosyal bağlantı · 2 kurum yönetimi' },
      { metin: 'Temel QR' },
      { metin: 'Yalnızca toplam görüntülenme; ayrıntılı veri yok', yok: true },
      { metin: 'Uygulama senkronu tek cihaz, şifreler hariç', yok: true },
    ],
  },
  {
    anahtar: 'student',
    ad: 'Öğrenci',
    alt: '.edu doğrulamalı',
    fiyat: { aylik: 49, yillik: 490, yillikKartli: 739 },
    kartHediyesi: { adet: 1, tur: 'PVC' },
    sinir: { profil: 3, sosyal: null, kurum: 2 },
    dugme: 'Öğrenci planı',
    maddeler: [
      { metin: '3 profil · sınırsız sosyal bağlantı' },
      { metin: 'Ayrıntılı veri (nereden, hangi kanal)' },
      { metin: 'Yıllıkta 1 PVC kart', kart: true },
    ],
  },
  {
    anahtar: 'professional',
    ad: 'Profesyonel',
    alt: 'Bireysel tam paket',
    fiyat: { aylik: 159, yillik: 1590, yillikKartli: 1839 },
    kartHediyesi: { adet: 1, tur: 'PVC' },
    sinir: { profil: 5, sosyal: null, kurum: null },
    onerilen: true,
    dugme: "Profesyonel'e geç",
    maddeler: [
      { metin: '5 profil, sınırsız bağlantı ve kurum' },
      { metin: 'Tam veri erişimi ve CSV dışa aktarım' },
      { metin: 'Bağlı uygulamalarda şifre dahil senkron' },
      { metin: 'Özel QR tasarımı, öncelikli destek' },
      { metin: 'Yıllıkta 1 PVC kart', kart: true },
    ],
  },
  {
    anahtar: 'stk',
    ad: 'STK Özel',
    alt: 'Dernek, sendika, topluluk',
    fiyat: { aylik: 279, yillik: 2790, yillikKartli: 4284 },
    kartHediyesi: { adet: 6, tur: 'PVC' },
    sinir: { profil: 10, sosyal: null, kurum: null },
    dugme: 'STK planına geç',
    maddeler: [
      { metin: 'Sınırsız üye, başvuru sistemi' },
      { metin: 'Kurum ölçümü, üye bazlı veri' },
      { metin: 'Herkese açık üye dizini' },
      { metin: 'Yıllıkta 6 PVC kart', kart: true },
    ],
  },
  {
    anahtar: 'business',
    ad: 'Kurumsal',
    alt: 'Şirketler için',
    fiyat: { aylik: 549, yillik: 5490, yillikKartli: 7980 },
    kartHediyesi: { adet: 10, tur: 'NFC' },
    sinir: { profil: 10, sosyal: null, kurum: null },
    koyu: true,
    // Kurumsal satış görüşmeyle başlar; düğme iletişim sayfasına gider.
    iletisim: true,
    dugme: 'İletişime geç',
    maddeler: [
      { metin: 'Üye analitiği ve dışa aktarım' },
      { metin: 'Dedike destek ve SLA' },
      { metin: 'Özel entegrasyon, kurumsal fatura' },
      { metin: 'Yıllıkta 10 NFC kart', kart: true },
    ],
  },
]

export const planBul = (anahtar) => PLANLAR.find((p) => p.anahtar === anahtar) || null

// Yıllık seçimde "kart hediyeli" ibaresi yalnız en az bir planda yıllık kart
// hediyesi tanımlıysa görünür.
export const yillikKartHediyesiVar = PLANLAR.some((p) => p.kartHediyesi?.adet > 0)
