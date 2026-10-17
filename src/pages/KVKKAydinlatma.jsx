import YasalSayfa, { Kutu } from '../site/sayfalar/YasalSayfa'

// Metin olduğu gibi korunur; okuma düzeni ve tipografi YasalSayfa'dan gelir.
export default function KVKKAydinlatma() {
  return (
    <YasalSayfa
      baslik="KVKK Aydınlatma Metni"
      alt="6698 Sayılı Kişisel Verilerin Korunması Kanunu Kapsamında"
      guncelleme="Eylül 2026"
    >
      <section>
        <h2>1. Veri Sorumlusu</h2>
        <p>
          6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz;
          veri sorumlusu sıfatıyla <strong>Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.</strong> tarafından
          aşağıda açıklanan amaçlar doğrultusunda işlenecektir.
        </p>
        <Kutu>
          <p><strong>Şirket:</strong> Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.</p>
          <p><strong>Adres:</strong> Cevizli Mahallesi Saraylar Caddesi No:6/85 Maltepe/İstanbul</p>
          <p><strong>Vergi Dairesi / No:</strong> Kartal / 7721298766</p>
          <p><strong>E-posta:</strong> info@qartim.com</p>
          <p><strong>Telefon:</strong> 0 216 998 08 89</p>
        </Kutu>
      </section>

      <section>
        <h2>2. İşlenen Kişisel Veriler</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Veri Kategorisi</th>
                <th>Veriler</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Kimlik', 'Ad, soyad'],
                ['İletişim', 'E-posta adresi, telefon numarası'],
                ['Mesleki', 'Ünvan, şirket adı, biyografi'],
                ['Görsel', 'Profil fotoğrafı (kullanıcı tarafından yüklenen)'],
                ['İşlem Güvenliği', 'IP adresi, oturum bilgileri, şifrelenmiş parola'],
                ['Kullanım', 'QR tarama, profil görüntülenme, bağlantı tıklama istatistikleri'],
                ['Finansal', 'Abonelik planı, ödeme durumu (kart bilgisi saklanmaz)'],
                ['Güvenlik Özeti', 'Hesap silindiğinde e-posta adresi ve telefon numarasından üretilen, geri çevrilemeyen tek yönlü özet (ad, profil ve içerik saklanmaz)'],
              ].map(([cat, data], i) => (
                <tr key={i}>
                  <td className="font-medium text-metin">{cat}</td>
                  <td>{data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>3. İşleme Amaçları ve Hukuki Sebepler</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Amaç</th>
                <th>Hukuki Dayanak (KVKK m.5)</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Hesap oluşturma ve kimlik doğrulama', 'Sözleşmenin kurulması ve ifası'],
                ['Dijital kartvizit hizmetinin sunulması', 'Sözleşmenin ifası'],
                ['Abonelik ve ödeme yönetimi', 'Sözleşmenin ifası / Kanuni yükümlülük'],
                ['Müşteri desteği', 'Meşru menfaat'],
                ['Platform güvenliği ve hata tespiti', 'Meşru menfaat'],
                ['Silinmiş hesapların kötüye kullanım amacıyla yeniden açılmasının tespiti', 'Meşru menfaat'],
                ['Silme ve imha işlemlerinin kayıt altına alınması', 'Kanuni yükümlülük'],
                ['Yasal bildirim yükümlülükleri', 'Kanuni yükümlülük'],
                ['Hizmet kalitesinin ölçülmesi (anonimleştirilmiş)', 'Meşru menfaat'],
              ].map(([purpose, basis], i) => (
                <tr key={i}>
                  <td>{purpose}</td>
                  <td className="text-aksan font-medium">{basis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2>4. Verilerin Aktarılması</h2>
        <p>Kişisel verileriniz aşağıdaki alıcı gruplarına aktarılabilir:</p>
        <ul>
          <li><strong>Altyapı sağlayıcıları:</strong> Supabase (veritabanı ve kimlik doğrulama), Vercel (sunucu barındırma) — yurt dışı aktarım KVKK m.9 kapsamında gerçekleştirilmektedir</li>
          <li><strong>E-posta hizmeti:</strong> Microsoft 365 (bildirim e-postaları)</li>
          <li><strong>Ödeme sağlayıcısı:</strong> Lisanslı ödeme kuruluşları (kart bilgileri doğrudan bu kuruluşlara iletilir)</li>
          <li><strong>Yetkili kamu kuruluşları:</strong> Yasal zorunluluk halinde</li>
        </ul>
      </section>

      <section>
        <h2>5. Saklama Süreleri ve İmha</h2>
        <p>
          Kişisel verileriniz, işlendikleri amaç için gerekli olan süre ve ilgili mevzuatta öngörülen
          süreler boyunca saklanır; bu sürelerin sonunda Kişisel Verilerin Silinmesi, Yok Edilmesi veya
          Anonim Hale Getirilmesi Hakkında Yönetmelik uyarınca silinir, yok edilir veya anonim hâle getirilir.
        </p>
        <ul>
          <li><strong>Hesap ve profil verileri:</strong> Hesabınız açık olduğu sürece saklanır. Hesabınız silindiğinde profiliniz, iletişim bilgileriniz, içerikleriniz ve kullanım verileriniz silinir.</li>
          <li><strong>Kanuni saklama yükümlülüğü bulunan kayıtlar:</strong> Fatura, ödeme ve ticari kayıtlar vergi ve ticaret mevzuatında öngörülen süreler boyunca, erişimi kısıtlanarak saklanır. Bu kayıtların hesabınızla bağı silme anında koparılır.</li>
          <li><strong>İşlem güvenliği kayıtları:</strong> İlgili mevzuatta öngörülen süreler boyunca saklanır.</li>
          <li><strong>Silme ve imha kayıtları:</strong> Silme işleminin ne zaman ve hangi gerekçeyle yapıldığını gösteren kayıt, imha yönetmeliğinin öngördüğü şekilde saklanır. Bu kayıtta e-posta adresiniz yalnızca maskelenmiş olarak yer alır.</li>
          <li>
            <strong>Güvenlik özeti:</strong> Hesabınız silindiğinde e-posta adresiniz ve telefon numaranızdan,
            gizli bir anahtar kullanılarak tek yönlü bir özet üretilir. Bu özetten e-posta adresiniz veya telefon
            numaranız elde edilemez; adınız, profiliniz ve içerikleriniz saklanmaz. Özet yalnızca aynı bilgilerle
            yeniden hesap açıldığında bunu tespit etmek ve kötüye kullanımı önlemek amacıyla kullanılır, yeni
            kaydı engellemez ve başka hiçbir amaçla işlenmez.
          </li>
        </ul>
      </section>

      <section>
        <h2>6. KVKK Kapsamındaki Haklarınız</h2>
        <p>KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
        <ul>
          <li>Kişisel verilerinizin işlenip işlenmediğini öğrenme</li>
          <li>İşlenmişse buna ilişkin bilgi talep etme</li>
          <li>İşlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme</li>
          <li>Yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme</li>
          <li>Eksik veya yanlış işlenmişse düzeltilmesini isteme</li>
          <li>KVKK'nın 7. maddesinde öngörülen şartlar çerçevesinde silinmesini isteme</li>
          <li>Aktarılan üçüncü kişilere yukarıdaki işlemlerin bildirilmesini isteme</li>
          <li>Münhasıran otomatik sistemler vasıtasıyla işlenmesi sonucunda aleyhinize bir sonucun ortaya çıkmasına itiraz etme</li>
          <li>Kanuna aykırı işleme nedeniyle zarara uğramanız hâlinde zararın giderilmesini talep etme</li>
        </ul>
        <Kutu ton="bilgi">
          <p>
            <strong>Başvuru:</strong> Haklarınızı kullanmak için{' '}
            <a href="mailto:info@qartim.com">info@qartim.com</a>{' '}
            adresine kimliğinizi doğrulayan bilgilerle yazılı başvuruda bulunabilirsiniz.
            Başvurular 30 gün içinde yanıtlanır.
          </p>
        </Kutu>
      </section>
    </YasalSayfa>
  )
}
