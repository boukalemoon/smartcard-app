import { useNavigate } from 'react-router-dom'

export default function CerezPolitikasi() {
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
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Çerez (Cookie) Politikası</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-8">Son güncelleme: Mart 2026</p>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8 space-y-8 text-gray-700 dark:text-gray-300 leading-relaxed">

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">1. Çerez Nedir?</h2>
            <p>
              Çerezler, ziyaret ettiğiniz web sitesi tarafından tarayıcınıza yerleştirilen küçük metin
              dosyalarıdır. Oturum yönetimi, kullanıcı tercihleri ve platform güvenliği gibi amaçlarla
              kullanılırlar.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">2. Kullandığımız Çerezler</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-700">
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-600">Tür</th>
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-600">Amaç</th>
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-600">Süre</th>
                    <th className="p-3 text-left font-semibold border border-gray-200 dark:border-gray-600">Zorunlu mu?</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['Zorunlu', 'Oturum yönetimi, kimlik doğrulama, güvenlik', 'Oturum süresi', 'Evet'],
                    ['İşlevsel', 'Tema tercihi (açık/koyu mod), dil ayarı', '1 yıl', 'Hayır'],
                    ['Analitik', 'Anonim platform kullanım istatistikleri', '90 gün', 'Hayır'],
                    ['Tercih', 'Dashboard mod tercihi (bireysel/kurumsal)', '1 yıl', 'Hayır'],
                  ].map(([type, purpose, duration, required], i) => (
                    <tr key={i} className="border-b border-gray-200 dark:border-gray-700">
                      <td className="p-3 border border-gray-200 dark:border-gray-600 font-medium">{type}</td>
                      <td className="p-3 border border-gray-200 dark:border-gray-600">{purpose}</td>
                      <td className="p-3 border border-gray-200 dark:border-gray-600">{duration}</td>
                      <td className="p-3 border border-gray-200 dark:border-gray-600">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
                          required === 'Evet'
                            ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300'
                            : 'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
                        }`}>
                          {required}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">3. Üçüncü Taraf Çerezleri</h2>
            <p className="mb-3">Platform altyapısı kapsamında aşağıdaki üçüncü taraf hizmetleri çerez kullanabilir:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Supabase:</strong> Kimlik doğrulama oturumu için zorunlu çerez/local storage kullanır</li>
              <li><strong>Vercel:</strong> Performans ve güvenlik çerezleri</li>
            </ul>
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              Bu hizmetlerin çerez politikaları kendi web sitelerinde yayımlanmaktadır.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">4. Çerez Tercihleriniz</h2>
            <p className="mb-3">Çerezleri aşağıdaki yollarla yönetebilirsiniz:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Tarayıcı ayarları:</strong> Tarayıcınızın ayarlar bölümünden çerezleri
                devre dışı bırakabilir veya silebilirsiniz. Zorunlu çerezlerin engellenmesi
                halinde platform işlevselliği kısmen veya tamamen etkilenebilir.
              </li>
              <li>
                <strong>Platform tercihleri:</strong> Zorunlu olmayan çerezlere ilişkin tercihlerinizi
                platform içindeki ayarlar bölümünden güncelleyebilirsiniz.
              </li>
            </ul>
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg text-sm">
              <p>
                ⚠️ Zorunlu çerezler, platformun temel işlevleri (giriş yapma, oturum tutma) için gereklidir
                ve devre dışı bırakılamazlar.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">5. Politika Güncellemeleri</h2>
            <p>
              Bu politika zaman zaman güncellenebilir. Önemli değişiklikler e-posta veya platform
              bildirimi aracılığıyla duyurulur. Güncel politikayı düzenli olarak incelemenizi öneririz.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-3">6. İletişim</h2>
            <p>
              Çerez politikamıza ilişkin sorularınız için{' '}
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