import { AlertTriangle } from 'lucide-react'
import YasalSayfa, { Kutu } from '../site/sayfalar/YasalSayfa'

// Metin olduğu gibi korunur; okuma düzeni ve tipografi YasalSayfa'dan gelir.
export default function CerezPolitikasi() {
  return (
    <YasalSayfa
      baslik="Çerez (Cookie) Politikası"
      guncelleme="Mart 2026"
    >
      <section>
        <h2>1. Çerez Nedir?</h2>
        <p>
          Çerezler, ziyaret ettiğiniz web sitesi tarafından tarayıcınıza yerleştirilen küçük metin
          dosyalarıdır. Oturum yönetimi, kullanıcı tercihleri ve platform güvenliği gibi amaçlarla
          kullanılırlar.
        </p>
      </section>

      <section>
        <h2>2. Kullandığımız Çerezler</h2>
        <div className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                <th>Tür</th>
                <th>Amaç</th>
                <th>Süre</th>
                <th>Zorunlu mu?</th>
              </tr>
            </thead>
            <tbody>
              {[
                ['Zorunlu', 'Oturum yönetimi, kimlik doğrulama, güvenlik', 'Oturum süresi', 'Evet'],
                ['İşlevsel', 'Tema tercihi (açık/koyu mod), dil ayarı', '1 yıl', 'Hayır'],
                ['Analitik', 'Anonim platform kullanım istatistikleri', '90 gün', 'Hayır'],
                ['Tercih', 'Dashboard mod tercihi (bireysel/kurumsal)', '1 yıl', 'Hayır'],
              ].map(([type, purpose, duration, required], i) => (
                <tr key={i}>
                  <td className="font-medium text-metin">{type}</td>
                  <td>{purpose}</td>
                  <td>{duration}</td>
                  <td>
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      required === 'Evet'
                        ? 'bg-aksan-acik text-aksan-koyu dark:text-aksan'
                        : 'bg-yuzey-2 text-metin-2'
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
        <h2>3. Üçüncü Taraf Çerezleri</h2>
        <p>Platform altyapısı kapsamında aşağıdaki üçüncü taraf hizmetleri çerez kullanabilir:</p>
        <ul>
          <li><strong>Supabase:</strong> Kimlik doğrulama oturumu için zorunlu çerez/local storage kullanır</li>
          <li><strong>Vercel:</strong> Performans ve güvenlik çerezleri</li>
        </ul>
        <p className="text-sm text-metin-2">
          Bu hizmetlerin çerez politikaları kendi web sitelerinde yayımlanmaktadır.
        </p>
      </section>

      <section>
        <h2>4. Çerez Tercihleriniz</h2>
        <p>Çerezleri aşağıdaki yollarla yönetebilirsiniz:</p>
        <ul>
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
        <Kutu ton="uyari" ikon={AlertTriangle}>
          <p>
            Zorunlu çerezler, platformun temel işlevleri (giriş yapma, oturum tutma) için gereklidir
            ve devre dışı bırakılamazlar.
          </p>
        </Kutu>
      </section>

      <section>
        <h2>5. Politika Güncellemeleri</h2>
        <p>
          Bu politika zaman zaman güncellenebilir. Önemli değişiklikler e-posta veya platform
          bildirimi aracılığıyla duyurulur. Güncel politikayı düzenli olarak incelemenizi öneririz.
        </p>
      </section>

      <section>
        <h2>6. İletişim</h2>
        <p>
          Çerez politikamıza ilişkin sorularınız için{' '}
          <a href="mailto:info@qartim.com">info@qartim.com</a>{' '}
          adresinden bize ulaşabilirsiniz.
        </p>
      </section>
    </YasalSayfa>
  )
}
