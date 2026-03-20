import { useNavigate } from 'react-router-dom'

export default function GizlilikPolitikasi() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <img
            src="/qrtım-logo.png"
            alt="QRtım"
            className="h-12 w-auto cursor-pointer"
            onClick={() => navigate('/')}
          />
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Gizlilik Politikası</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Son güncelleme: Mart 2026</p>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">1. Veri Sorumlusu</h2>
            <p>
              Bu Gizlilik Politikası, <strong>Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.</strong> ("Şirket", "biz") tarafından
              işletilen <strong>QRtım</strong> platformuna (qartim.com) ilişkindir.
            </p>
            <div className="mt-3 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm space-y-1">
              <p><strong>Şirket Ünvanı:</strong> Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.</p>
              <p><strong>Adres:</strong> Cevizli Mahallesi Saraylar Caddesi No:6/85 Maltepe/İstanbul</p>
              <p><strong>Vergi Dairesi:</strong> Kartal Vergi Dairesi</p>
              <p><strong>Vergi No:</strong> 7721298766</p>
              <p><strong>E-posta:</strong> info@qartim.com</p>
              <p><strong>Telefon:</strong> 0 216 998 08 89</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">2. Toplanan Veriler</h2>
            <p className="mb-3">Platformumuzu kullanırken aşağıdaki kişisel veriler toplanabilir:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Hesap bilgileri:</strong> Ad, soyad, e-posta adresi, şifre (şifrelenmiş)</li>
              <li><strong>Profil bilgileri:</strong> Ünvan, şirket, telefon, biyografi, profil fotoğrafı</li>
              <li><strong>Kullanım verileri:</strong> QR kod tarama sayısı, profil görüntülenme, bağlantı tıklamaları</li>
              <li><strong>Teknik veriler:</strong> IP adresi, tarayıcı türü, cihaz bilgisi, çerez verileri</li>
              <li><strong>Ödeme bilgileri:</strong> Ödeme işlemleri üçüncü taraf ödeme sağlayıcıları aracılığıyla gerçekleştirilir; kart bilgileri sistemimizde saklanmaz</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">3. Verilerin Kullanım Amaçları</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Hesap oluşturma ve kimlik doğrulama</li>
              <li>Dijital kartvizit hizmetinin sunulması</li>
              <li>Abonelik ve ödeme işlemlerinin yönetimi</li>
              <li>Müşteri desteği sağlanması</li>
              <li>Platform güvenliğinin sağlanması</li>
              <li>Yasal yükümlülüklerin yerine getirilmesi</li>
              <li>Hizmet kalitesinin iyileştirilmesi (anonimleştirilmiş verilerle)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">4. Verilerin Paylaşımı</h2>
            <p className="mb-3">Kişisel verileriniz aşağıdaki durumlar dışında üçüncü taraflarla paylaşılmaz:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Hizmet sağlayıcılar:</strong> Supabase (veritabanı), Vercel (barındırma), Microsoft 365 (e-posta) gibi altyapı sağlayıcıları</li>
              <li><strong>Yasal zorunluluk:</strong> Yetkili kamu kurum ve kuruluşlarının talepleri</li>
              <li><strong>Rıza:</strong> Açık onayınız bulunması halinde</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">5. Veri Güvenliği</h2>
            <p>
              Verileriniz SSL/TLS şifrelemesi, güvenli veritabanı erişim politikaları ve düzenli güvenlik
              denetimleri ile korunmaktadır. Bununla birlikte internet üzerinden hiçbir iletimin %100 güvenli
              olmadığını hatırlatırız.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">6. Veri Saklama Süresi</h2>
            <p>
              Kişisel verileriniz, hesabınız aktif olduğu sürece saklanır. Hesabınızı silmeniz halinde
              verileriniz 30 gün içinde sistemden kaldırılır. Yasal yükümlülükler kapsamında saklanması
              gereken veriler ilgili mevzuatta öngörülen süreler boyunca tutulur.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">7. Haklarınız</h2>
            <p className="mb-3">KVKK kapsamında aşağıdaki haklara sahipsiniz:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
              <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
              <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
              <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
              <li>Silinmesini veya yok edilmesini isteme</li>
              <li>İşlemeye itiraz etme</li>
            </ul>
            <p className="mt-3">Bu haklarınızı kullanmak için <strong>info@qartim.com</strong> adresine yazabilirsiniz.</p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">8. İletişim</h2>
            <p>
              Gizlilik politikamıza ilişkin sorularınız için{' '}
              <a href="mailto:info@qartim.com" className="text-blue-600 hover:underline">info@qartim.com</a>{' '}
              adresinden bize ulaşabilirsiniz.
            </p>
          </section>

        </div>
      </main>

      <footer className="bg-gray-900 text-gray-400 py-6 mt-12">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm">
          <p>&copy; 2026 QRtım — Sognare Organizasyon ve Dan. Hiz. Ltd. Şti. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  )
}