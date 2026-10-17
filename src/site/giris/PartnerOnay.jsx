// BAĞLI UYGULAMA ONAYI — görünüm (tasarım panosu: PartnerOnay)
//
// Mantık Auth.jsx'te kalır (callback doğrulaması, belirteç üretimi, geri
// dönüş). Bu bileşen yalnızca kişiye NE olacağını gösterir ve kararını
// yukarı iletir.
import { useEffect, useState } from 'react'
import { ArrowRight, Check, Lock, X } from 'lucide-react'
import { supabase } from '../../lib/supabaseClient'
import { MFA_AKTIF } from '../../lib/mfaAyari'
import { Avatar } from '../../panel/ui'
import { tarih } from '../../panel/bicim'
import { BilgiKutusu, Dugme, METIN_BAGLANTI, QrtimIsaret } from './parcalar'

// Paylaşılan alan listesinin DIŞINDA kalanlar. Partner belirteci yalnızca
// kimlik alanlarını taşır; aşağıdakiler hiçbir partner yanıtında yok.
const GITMEYECEK = [
  'Şifreniz',
  'Kart blokları, gelen kişiler ve ölçüm verisi',
  'IBAN, ödeme ve partner hak edişleri',
]

// Geri dönüş adresi sorgu parametreleri olmadan gösterilir: kişi alan adını
// ve yolu görsün, uzun durum dizgileri kalabalık etmesin.
function adresGosterimi(cb) {
  try {
    const u = new URL(cb)
    return `${u.origin}${u.pathname === '/' ? '' : u.pathname}`
  } catch {
    return cb
  }
}

export default function PartnerOnay({ partnerAnahtari, bilgi, cb, kullanici, alanlar, mesgul, onIzin, onReddet, onHesapDegistir }) {
  // Bu uygulamaya daha önce bağlanıldı mı? (app_connections; RLS yalnızca
  // kişinin kendi satırlarını döndürür.) Bilinmiyorsa genel uyarı gösterilir;
  // "ilk kez" iddiasında bulunulmaz.
  const [onceki, setOnceki] = useState(null)
  useEffect(() => {
    let iptal = false
    supabase
      .from('app_connections')
      .select('connected_at, revoked_at')
      .eq('app_key', partnerAnahtari)
      .maybeSingle()
      .then(({ data }) => {
        if (!iptal && data && !data.revoked_at) setOnceki(data)
      }, () => {})
    return () => { iptal = true }
  }, [partnerAnahtari])

  const ad = kullanici?.user_metadata?.name || kullanici?.email?.split('@')[0] || 'Hesabınız'

  return (
    <div className="min-h-screen bg-zemin text-metin flex flex-col items-center justify-center px-4 sm:px-6 py-8 sm:py-10 gap-5">
      <main className="w-full max-w-[560px] bg-yuzey border border-cizgi rounded-[20px] overflow-hidden flex flex-col" aria-labelledby="onay-baslik">
        <div className="px-5 sm:px-8 pt-7 pb-6 flex flex-col items-center gap-[18px] text-center border-b border-cizgi">
          <div className="flex items-center gap-3.5">
            <span
              role="img"
              aria-label={bilgi.ad}
              className="w-14 h-14 rounded-2xl bg-lacivert-900 dark:bg-lacivert-700 text-white inline-flex items-center justify-center font-baslik font-extrabold text-[15px]"
            >
              {bilgi.kisa}
            </span>
            <ArrowRight size={28} strokeWidth={1.75} aria-hidden="true" className="text-metin-2/60" />
            <QrtimIsaret boyut={56} />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold tracking-[0.08em] uppercase text-metin-2">Bağlı uygulama isteği</span>
            <h1 id="onay-baslik" className="font-baslik text-[22px] sm:text-2xl font-extrabold leading-tight tracking-[-0.015em]">
              <span className="text-aksan">{bilgi.ad}</span> QRtım hesabınızla giriş yapmak istiyor
            </h1>
            <p className="text-sm text-metin-2">
              Karar ne olursa olsun şu adrese geri dönersiniz:
              <span className="block mt-0.5 text-[13px] font-medium text-metin [overflow-wrap:anywhere]">{adresGosterimi(cb)}</span>
            </p>
          </div>
        </div>

        <div className="px-5 sm:px-8 py-5 flex flex-col gap-[18px]">
          <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-cizgi bg-zemin">
            <Avatar ad={ad} url={kullanici?.user_metadata?.avatar_url} boyut={40} ton="bg-aksan-acik text-aksan-koyu dark:text-aksan" />
            <div className="flex-1 min-w-0">
              <b className="block text-sm truncate">{ad}</b>
              <span className="block text-[13px] text-metin-2 truncate">{kullanici?.email}</span>
            </div>
            <button type="button" onClick={onHesapDegistir} disabled={mesgul} className={`${METIN_BAGLANTI} whitespace-nowrap disabled:opacity-50`}>
              Hesap değiştir
            </button>
          </div>

          <div className="grid gap-5 sm:gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2.5">
              <h2 className="font-sans text-xs font-bold tracking-[0.08em] uppercase text-aksan-koyu dark:text-aksan">Uygulamaya gidecek</h2>
              <ul className="flex flex-col gap-2.5">
                {alanlar.map((a) => (
                  <li key={a} className="flex gap-3 items-start text-sm">
                    <Check size={18} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-0.5 text-aksan" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex flex-col gap-2.5">
              <h2 className="font-sans text-xs font-bold tracking-[0.08em] uppercase text-metin-2">Gitmeyecek</h2>
              <ul className="flex flex-col gap-2.5">
                {GITMEYECEK.map((a) => (
                  <li key={a} className="flex gap-3 items-start text-sm text-metin-2">
                    <X size={18} strokeWidth={2.5} aria-hidden="true" className="shrink-0 mt-0.5 text-metin-2/60" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {onceki ? (
            <BilgiKutusu>
              <b className="text-metin">Bu uygulamaya {tarih(onceki.connected_at)} tarihinde bağlandınız.</b>{' '}
              Bağlantıyı istediğiniz zaman Hesap › Bağlı uygulamalar bölümünden kaldırabilirsiniz.
            </BilgiKutusu>
          ) : (
            <BilgiKutusu ton="dikkat">
              <b>Bu isteği siz başlattınız mı?</b> {bilgi.ad}, QRtım ile aynı ekosistemin tanınan bir uygulamasıdır.
              Bu ekranı kendiniz açmadıysanız Reddet'e basın.
            </BilgiKutusu>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-2.5">
            <Dugme tur="ikincil" onClick={onReddet} disabled={mesgul}>Reddet</Dugme>
            <Dugme onClick={onIzin} disabled={mesgul}>
              {mesgul ? 'Yönlendiriliyor…' : `İzin ver ve ${bilgi.donus} dön`}
            </Dugme>
          </div>
          <p className="text-xs text-metin-2 text-center">
            {MFA_AKTIF && 'İki adımlı doğrulama açıksa izin öncesi kod istenir. '}
            Belirteç tek kullanımlıktır, kısa süre geçerlidir ve yalnızca yukarıdaki adrese gönderilir.
          </p>
        </div>
      </main>

      <div className="w-full max-w-[560px] grid gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 px-4 py-3.5 rounded-xl bg-yuzey border border-cizgi text-[13px] min-w-0">
          <b className="flex items-center gap-2"><Check size={16} strokeWidth={2.5} aria-hidden="true" className="text-aksan" />İzin ver</b>
          <span className="text-metin-2">{bilgi.adaDonus} dönülür, orada oturum açılır.</span>
        </div>
        <div className="flex flex-col gap-1.5 px-4 py-3.5 rounded-xl bg-yuzey border border-cizgi text-[13px] min-w-0">
          <b className="flex items-center gap-2"><X size={16} strokeWidth={2.5} aria-hidden="true" className="text-red-600 dark:text-red-400" />Reddet</b>
          <span className="text-metin-2">Yine {bilgi.adaDonus} dönülür, "iptal edildi" durumuyla; hiçbir bilgi gitmez, QRtım oturumunuz etkilenmez.</span>
        </div>
      </div>
      <p className="text-xs text-metin-2 flex items-start gap-1.5 text-center max-w-[560px]">
        <Lock size={14} aria-hidden="true" className="shrink-0 mt-px" />
        qrtim.com.tr · Bu ekran yalnızca QRtım alan adında gösterilir; adres satırını kontrol edin.
      </p>
    </div>
  )
}
