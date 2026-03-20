import { useNavigate } from 'react-router-dom'

export default function KVKKAydinlatma() {
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">KVKK Aydınlatma Metni</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
          6698 Sayılı Kişisel Verilerin Korunması Kanunu Kapsamında
        </p>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Son güncelleme: Mart 2026</p>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">1. Veri Sorumlusu</h2>
            <p className="mb-3">
              6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca kişisel verileriniz;
              veri sorumlusu sıfatıyla <strong>Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.</strong> tarafından
              aşağıda açıklanan amaçlar doğrultusunda işlenecektir.
            </p>
            <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg text-sm space-y-1">
              <p><strong>Şirket:</strong> Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.</p>
              <p><strong>Adres:</strong> Cevizli Mahallesi Saraylar Caddesi No:6/85 Maltepe/İstanbul</p>
              <p><strong>Vergi Dairesi / No:</strong> Kartal / 7721298766</p>
              <p><strong>E-posta:</strong> info@qartim.com</p>
              <p><strong>Telefon:</strong> 0 216 998 08 89</p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">2. İşlenen Kişisel Veriler</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-600">Veri Kategorisi</th>
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-600">Veriler</th>
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
                  ].map(([cat, data], i) => (
                    <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="p-3 border border-gray-200 dark:border-gray-600 font-medium">{cat}</td>
                      <td className="p-3 border border-gray-200 dark:border-gray-600">{data}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">3. İşleme Amaçları ve Hukuki Sebepler</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-600">Amaç</th>
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-600">Hukuki Dayanak (KVKK m.5)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Hesap oluşturma ve kimlik doğrulama', 'Sözleşmenin kurulması ve ifası'],
                    ['Dijital kartvizit hizmetinin sunulması', 'Sözleşmenin ifası'],
                    ['Abonelik ve ödeme yönetimi', 'Sözleşmenin ifası / Kanuni yükümlülük'],
                    ['Müşteri desteği', 'Meşru menfaat'],
                    ['Platform güvenliği ve hata tespiti', 'Meşru menfaat'],
                    ['Yasal bildirim yükümlülükleri', 'Kanuni yükümlülük'],
                    ['Hizmet kalitesinin ölçülmesi (anonimleştirilmiş)', 'Meşru menfaat'],
                  ].map(([purpose, basis], i) => (
                    <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="p-3 border border-gray-200 dark:border-gray-600">{purpose}</td>
                      <td className="p-3 border border-gray-200 dark:border-gray-600 text-blue-700 dark:text-blue-300">{basis}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">4. Verilerin Aktarılması</h2>
            <p className="mb-3">Kişisel verileriniz aşağıdaki alıcı gruplarına aktarılabilir:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Altyapı sağlayıcıları:</strong> Supabase (veritabanı ve kimlik doğrulama), Vercel (sunucu barındırma) — yurt dışı aktarım KVKK m.9 kapsamında gerçekleştirilmektedir</li>
              <li><strong>E-posta hizmeti:</strong> Microsoft 365 (bildirim e-postaları)</li>
              <li><strong>Ödeme sağlayıcısı:</strong> Lisanslı ödeme kuruluşları (kart bilgileri doğrudan bu kuruluşlara iletilir)</li>
              <li><strong>Yetkili kamu kuruluşları:</strong> Yasal zorunluluk halinde</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">5. Saklama Süreleri</h2>
            <ul className="list-disc pl-6 space-y-2">
              <li>Aktif hesap verileri: Hesap aktif olduğu sürece</li>
              <li>Hesap kapatma sonrası: 30 gün içinde silme/anonimleştirme</li>
              <li>Fatura ve ödeme kayıtları: Vergi mevzuatı gereği 10 yıl</li>
              <li>Güvenlik logları: 2 yıl</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">6. KVKK Kapsamındaki Haklarınız</h2>
            <p className="mb-3">KVKK'nın 11. maddesi uyarınca aşağıdaki haklara sahipsiniz:</p>
            <ul className="list-disc pl-6 space-y-2">
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
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <p className="text-sm">
                <strong>Başvuru:</strong> Haklarınızı kullanmak için{' '}
                <a href="mailto:info@qartim.com" className="text-blue-600 hover:underline">info@qartim.com</a>{' '}
                adresine kimliğinizi doğrulayan bilgilerle yazılı başvuruda bulunabilirsiniz.
                Başvurular 30 gün içinde yanıtlanır.
              </p>
            </div>
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