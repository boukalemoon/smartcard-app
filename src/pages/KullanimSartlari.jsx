import YasalSayfa from '../site/sayfalar/YasalSayfa'

// Metin olduğu gibi korunur; okuma düzeni ve tipografi YasalSayfa'dan gelir.
export default function KullanimSartlari() {
  return (
    <YasalSayfa
      baslik="Kullanım Şartları"
      guncelleme="Mart 2026"
    >
      <section>
        <h2>1. Taraflar ve Kapsam</h2>
        <p>
          Bu Kullanım Şartları, <strong>Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.</strong> tarafından
          işletilen <strong>QRtım</strong> platformunu (qrtim.com.tr) kullanan bireyler ve kurumlar ile
          Şirket arasındaki ilişkiyi düzenler. Platforma kayıt olarak veya platformu kullanarak bu
          şartları kabul etmiş sayılırsınız.
        </p>
      </section>

      <section>
        <h2>2. Hizmet Tanımı</h2>
        <p>
          QRtım; dijital kartvizit oluşturma, QR kod üretme, NFC kart yönetimi, sosyal medya
          bağlantısı toplama ve organizasyon yönetimi hizmetleri sunan bir SaaS platformudur.
          Hizmetler abonelik planlarına göre farklılaşmaktadır.
        </p>
      </section>

      <section>
        <h2>3. Hesap Oluşturma ve Güvenlik</h2>
        <ul>
          <li>Kayıt sırasında doğru ve güncel bilgi vermekle yükümlüsünüz.</li>
          <li>Hesap güvenliğinizden siz sorumlusunuz; şifrenizi kimseyle paylaşmayınız.</li>
          <li>Yetkisiz erişim tespit etmeniz halinde derhal info@qartim.com adresine bildirin.</li>
          <li>18 yaşından küçük bireyler ebeveyn/vasi onayı olmaksızın kayıt olamaz.</li>
        </ul>
      </section>

      <section>
        <h2>4. Abonelik ve Ödeme</h2>
        <ul>
          <li>Ücretli planlar aylık veya yıllık olarak faturalandırılır.</li>
          <li>Yıllık planlarda ödeme peşin alınır ve iade yapılmaz.</li>
          <li>Aylık planlarda iptal bir sonraki dönem başında geçerli olur.</li>
          <li>Fiyatlar değişebilir; değişiklikler en az 30 gün önceden bildirilir.</li>
          <li>Ödeme bilgileri üçüncü taraf ödeme sağlayıcısı üzerinden işlenir; kart bilgileri sistemimizde saklanmaz.</li>
        </ul>
      </section>

      <section>
        <h2>5. Kullanım Kuralları</h2>
        <p>Aşağıdaki kullanımlar kesinlikle yasaktır:</p>
        <ul>
          <li>Yanıltıcı, sahte veya başkasına ait kimlik bilgisi kullanmak</li>
          <li>Platformu yasadışı faaliyetler için kullanmak</li>
          <li>Spam, zararlı yazılım veya kötü amaçlı içerik yaymak</li>
          <li>Platformun altyapısına zarar vermeye çalışmak</li>
          <li>Başkalarının kişisel verilerini izinsiz toplamak</li>
          <li>Fikri mülkiyet haklarını ihlal etmek</li>
        </ul>
      </section>

      <section>
        <h2>6. İçerik Sorumluluğu</h2>
        <p>
          Profilinizde paylaştığınız içeriklerden tamamen siz sorumlusunuz. QRtım, kullanıcı
          içeriklerini önceden denetlemez; ancak şartlara aykırı içerikleri kaldırma ve ilgili
          hesabı askıya alma hakkını saklı tutar.
        </p>
      </section>

      <section>
        <h2>7. Fikri Mülkiyet</h2>
        <p>
          QRtım markası, logosu, tasarımı ve yazılımı Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.'ye
          aittir. Kullanıcılar kendi profillerine yükledikleri içeriklerin haklarını saklı tutar;
          bu içerikler için platforma sınırlı bir kullanım lisansı verilmiş sayılır.
        </p>
      </section>

      <section>
        <h2>8. Hizmet Kesintileri</h2>
        <p>
          Planlı bakım ve teknik aksaklıklar nedeniyle hizmette kesinti yaşanabilir. Olası kesintiler
          önceden duyurulacaktır. Kesintilerden kaynaklanan dolaylı zararlardan Şirket sorumlu tutulamaz.
        </p>
      </section>

      <section>
        <h2>9. Hesap Sonlandırma</h2>
        <p>
          Şartlara aykırı davranış tespit edilmesi halinde hesabınız önceden bildirim yapılmaksızın
          askıya alınabilir veya silinebilir. Hesabınızı istediğiniz zaman kapatabilirsiniz; kapatma
          talebinizi info@qartim.com adresine iletebilirsiniz.
        </p>
      </section>

      <section>
        <h2>10. Uygulanacak Hukuk</h2>
        <p>
          Bu şartlar Türk hukukuna tabidir. Uyuşmazlıklarda İstanbul Mahkemeleri ve İcra Daireleri
          yetkilidir.
        </p>
      </section>

      <section>
        <h2>11. İletişim</h2>
        <p>
          Kullanım şartlarına ilişkin sorularınız için{' '}
          <a href="mailto:info@qartim.com">info@qartim.com</a>{' '}
          adresinden bize ulaşabilirsiniz.
        </p>
      </section>
    </YasalSayfa>
  )
}
