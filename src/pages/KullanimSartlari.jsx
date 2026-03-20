import { useNavigate } from 'react-router-dom'

export default function KullanimSartlari() {
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Kullanım Şartları</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Son güncelleme: Mart 2026</p>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">1. Taraflar ve Kapsam</h2>
            <p>
              Bu Kullanım Şartları, <strong>Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.</strong> tarafından
              işletilen <strong>QRtım</strong> platformunu (qartim.com) kullanan bireyler ve kurumlar ile
              Şirket arasındaki ilişkiyi düzenler. Platforma kayıt olarak veya platformu kullanarak bu
              şartları kabul etmiş sayılırsınız.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">2. Hizmet Tanımı</h2>
            <p className="mb-3">
              QRtım; dijital kartvizit oluşturma, QR kod üretme, NFC kart yönetimi, sosyal medya
              bağlantısı toplama ve organizasyon yönetimi hizmetleri sunan bir SaaS platformudur.
              Hizmetler abonelik planlarına göre farklılaşmaktadır.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">3. Hesap Oluşturma ve Güvenlik</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Kayıt sırasında doğru ve güncel bilgi vermekle yükümlüsünüz.</li>
              <li>Hesap güvenliğinizden siz sorumlusunuz; şifrenizi kimseyle paylaşmayınız.</li>
              <li>Yetkisiz erişim tespit etmeniz halinde derhal info@qartim.com adresine bildirin.</li>
              <li>18 yaşından küçük bireyler ebeveyn/vasi onayı olmaksızın kayıt olamaz.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">4. Abonelik ve Ödeme</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Ücretli planlar aylık veya yıllık olarak faturalandırılır.</li>
              <li>Yıllık planlarda ödeme peşin alınır ve iade yapılmaz.</li>
              <li>Aylık planlarda iptal bir sonraki dönem başında geçerli olur.</li>
              <li>Fiyatlar değişebilir; değişiklikler en az 30 gün önceden bildirilir.</li>
              <li>Ödeme bilgileri üçüncü taraf ödeme sağlayıcısı üzerinden işlenir; kart bilgileri sistemimizde saklanmaz.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">5. Kullanım Kuralları</h2>
            <p className="mb-3">Aşağıdaki kullanımlar kesinlikle yasaktır:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Yanıltıcı, sahte veya başkasına ait kimlik bilgisi kullanmak</li>
              <li>Platformu yasadışı faaliyetler için kullanmak</li>
              <li>Spam, zararlı yazılım veya kötü amaçlı içerik yaymak</li>
              <li>Platformun altyapısına zarar vermeye çalışmak</li>
              <li>Başkalarının kişisel verilerini izinsiz toplamak</li>
              <li>Fikri mülkiyet haklarını ihlal etmek</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">6. İçerik Sorumluluğu</h2>
            <p>
              Profilinizde paylaştığınız içeriklerden tamamen siz sorumlusunuz. QRtım, kullanıcı
              içeriklerini önceden denetlemez; ancak şartlara aykırı içerikleri kaldırma ve ilgili
              hesabı askıya alma hakkını saklı tutar.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">7. Fikri Mülkiyet</h2>
            <p>
              QRtım markası, logosu, tasarımı ve yazılımı Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.'ye
              aittir. Kullanıcılar kendi profillerine yükledikleri içeriklerin haklarını saklı tutar;
              bu içerikler için platforma sınırlı bir kullanım lisansı verilmiş sayılır.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">8. Hizmet Kesintileri</h2>
            <p>
              Planlı bakım ve teknik aksaklıklar nedeniyle hizmette kesinti yaşanabilir. Olası kesintiler
              önceden duyurulacaktır. Kesintilerden kaynaklanan dolaylı zararlardan Şirket sorumlu tutulamaz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">9. Hesap Sonlandırma</h2>
            <p>
              Şartlara aykırı davranış tespit edilmesi halinde hesabınız önceden bildirim yapılmaksızın
              askıya alınabilir veya silinebilir. Hesabınızı istediğiniz zaman kapatabilirsiniz; kapatma
              talebinizi info@qartim.com adresine iletebilirsiniz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">10. Uygulanacak Hukuk</h2>
            <p>
              Bu şartlar Türk hukukuna tabidir. Uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Daireleri
              yetkilidir.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">11. İletişim</h2>
            <p>
              Kullanım şartlarına ilişkin sorularınız için{' '}
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