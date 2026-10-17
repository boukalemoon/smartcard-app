import YasalSayfa, { Kutu } from '../site/sayfalar/YasalSayfa'

// Metin olduğu gibi korunur; okuma düzeni ve tipografi YasalSayfa'dan gelir.
export default function GizlilikPolitikasi() {
  return (
    <YasalSayfa
      baslik="Gizlilik Politikası"
      guncelleme="Eylül 2026"
    >
      <section>
        <h2>1. Veri Sorumlusu</h2>
        <p>
          Bu Gizlilik Politikası, <strong>Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.</strong> ("Şirket", "biz") tarafından
          işletilen <strong>QRtım</strong> platformuna (qrtim.com.tr) ilişkindir.
        </p>
        <Kutu>
          <p><strong>Şirket Ünvanı:</strong> Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.</p>
          <p><strong>Adres:</strong> Cevizli Mahallesi Saraylar Caddesi No:6/85 Maltepe/İstanbul</p>
          <p><strong>Vergi Dairesi:</strong> Kartal Vergi Dairesi</p>
          <p><strong>Vergi No:</strong> 7721298766</p>
          <p><strong>E-posta:</strong> info@qartim.com</p>
          <p><strong>Telefon:</strong> 0 216 998 08 89</p>
        </Kutu>
      </section>

      <section>
        <h2>2. Toplanan Veriler</h2>
        <p>Platformumuzu kullanırken aşağıdaki kişisel veriler toplanabilir:</p>
        <ul>
          <li><strong>Hesap bilgileri:</strong> Ad, soyad, e-posta adresi, şifre (şifrelenmiş)</li>
          <li><strong>Profil bilgileri:</strong> Ünvan, şirket, telefon, biyografi, profil fotoğrafı</li>
          <li><strong>Kullanım verileri:</strong> QR kod tarama sayısı, profil görüntülenme, bağlantı tıklamaları</li>
          <li><strong>Teknik veriler:</strong> IP adresi, tarayıcı türü, cihaz bilgisi, çerez verileri</li>
          <li><strong>Ödeme bilgileri:</strong> Ödeme işlemleri üçüncü taraf ödeme sağlayıcıları aracılığıyla gerçekleştirilir; kart bilgileri sistemimizde saklanmaz</li>
        </ul>
      </section>

      <section>
        <h2>3. Verilerin Kullanım Amaçları</h2>
        <ul>
          <li>Hesap oluşturma ve kimlik doğrulama</li>
          <li>Dijital kartvizit hizmetinin sunulması</li>
          <li>Abonelik ve ödeme işlemlerinin yönetimi</li>
          <li>Müşteri desteği sağlanması</li>
          <li>Platform güvenliğinin sağlanması ve silinmiş hesapların kötüye kullanım amacıyla yeniden açılmasının tespiti</li>
          <li>Yasal yükümlülüklerin yerine getirilmesi</li>
          <li>Hizmet kalitesinin iyileştirilmesi (anonimleştirilmiş verilerle)</li>
        </ul>
      </section>

      <section>
        <h2>4. Verilerin Paylaşımı</h2>
        <p>Kişisel verileriniz aşağıdaki durumlar dışında üçüncü taraflarla paylaşılmaz:</p>
        <ul>
          <li><strong>Hizmet sağlayıcılar:</strong> Supabase (veritabanı), Vercel (barındırma), Microsoft 365 (e-posta) gibi altyapı sağlayıcıları</li>
          <li><strong>Yasal zorunluluk:</strong> Yetkili kamu kurum ve kuruluşlarının talepleri</li>
          <li><strong>Rıza:</strong> Açık onayınız bulunması halinde</li>
        </ul>
      </section>

      <section>
        <h2>5. Veri Güvenliği</h2>
        <p>
          Verileriniz SSL/TLS şifrelemesi, güvenli veritabanı erişim politikaları ve düzenli güvenlik
          denetimleri ile korunmaktadır. Bununla birlikte internet üzerinden hiçbir iletimin %100 güvenli
          olmadığını hatırlatırız.
        </p>
      </section>

      <section>
        <h2>6. Veri Saklama Süresi</h2>
        <p>
          Kişisel verileriniz, hesabınız açık olduğu sürece ve işlendikleri amaç için gerekli olduğu
          müddetçe saklanır. Hesabınızı sildiğinizde profiliniz, iletişim bilgileriniz ve içerikleriniz
          silinir.
        </p>
        <p>
          Fatura ve ödeme kayıtları ile silme işleminin kaydı gibi kanuni saklama yükümlülüğü bulunan
          kayıtlar, ilgili mevzuatta öngörülen süreler boyunca erişimi kısıtlanarak saklanır ve bu
          sürelerin sonunda silinir, yok edilir veya anonim hâle getirilir.
        </p>
        <p>
          Kötüye kullanımı önlemek amacıyla, silinen hesaba ait e-posta adresi ve telefon numarasından
          geri çevrilemeyen bir güvenlik özeti tutulur. Bu özetten iletişim bilgileriniz elde edilemez;
          ayrıntılar KVKK Aydınlatma Metni'nde yer alır.
        </p>
      </section>

      <section>
        <h2>7. Haklarınız</h2>
        <p>KVKK kapsamında aşağıdaki haklara sahipsiniz:</p>
        <ul>
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
          <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
          <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
          <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
          <li>Silinmesini veya yok edilmesini isteme</li>
          <li>İşlemeye itiraz etme</li>
        </ul>
        <p>Bu haklarınızı kullanmak için <strong>info@qartim.com</strong> adresine yazabilirsiniz.</p>
      </section>

      <section>
        <h2>8. İletişim</h2>
        <p>
          Gizlilik politikamıza ilişkin sorularınız için{' '}
          <a href="mailto:info@qartim.com">info@qartim.com</a>{' '}
          adresinden bize ulaşabilirsiniz.
        </p>
      </section>
    </YasalSayfa>
  )
}
