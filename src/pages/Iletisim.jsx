import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Mail, Phone, MapPin, Send, Check, Clock, ChevronDown } from 'lucide-react'
import SiteKabugu from '../site/SiteKabugu'
import { SayfaUst, Mesaj } from '../site/sayfalar/ortak'
import { dugme, ETIKET, GIRDI, KAP } from '../site/sayfalar/siniflar'
import { birlestir } from '../panel/bicim'

const BOS_FORM = { name: '', email: '', subject: '', message: '' }

const KONULAR = ['Genel Soru', 'Teknik Destek', 'Faturalama / Ödeme', 'Kurumsal / STK Teklif', 'NFC Kart Siparişi', 'İş Birliği', 'Diğer']

// Adetli kart talebi ve kurumsal/STK paket talepleri buraya yönlendiriliyor:
// platformda çok adetli satın alma YOK, teklifle yürüyor (kurucu kararı).
// Yönlendiren sayfa konuyu ve mesajı ?konu= / ?mesaj= ile doldurur; kişi
// sıfırdan yazmak zorunda kalmasın. Değer listede yoksa yok sayılır —
// adresten gelen metin doğrudan forma basılmaz.
function baslangicFormu(arama) {
  const konu = arama.get('konu')
  const mesaj = arama.get('mesaj')
  return {
    ...BOS_FORM,
    subject: KONULAR.includes(konu) ? konu : '',
    message: typeof mesaj === 'string' ? mesaj.slice(0, 500) : '',
  }
}


const ILETISIM = [
  { ikon: <Mail size={20} aria-hidden="true" />, ad: 'E-posta', deger: 'info@qartim.com', href: 'mailto:info@qartim.com' },
  { ikon: <Phone size={20} aria-hidden="true" />, ad: 'Telefon', deger: '0 216 998 08 89', href: 'tel:+902169980889' },
  { ikon: <MapPin size={20} aria-hidden="true" />, ad: 'Adres', deger: <>Cevizli Mahallesi Saraylar Caddesi<br />No:6/85 Maltepe / İstanbul</> },
]

const SAATLER = [
  ['Pazartesi – Cuma', '09:00 – 18:00'],
  ['Cumartesi', '10:00 – 14:00'],
  ['Pazar', 'Kapalı'],
]

function Zorunlu() {
  return <span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>
}

export default function Iletisim() {
  const [arama] = useSearchParams()
  const [form, setForm] = useState(() => baslangicFormu(arama))
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  // Form bir sunucuya gitmez: kişinin e-posta uygulamasını hazır bir mesajla
  // açar (mailto). Metinler de bunu açıkça söyler.
  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.email || !form.message) {
      setError('Lütfen zorunlu alanları doldurun.')
      return
    }
    setError('')
    setSending(true)
    try {
      const mailtoLink = `mailto:info@qartim.com?subject=${encodeURIComponent(form.subject || 'İletişim Formu')}&body=${encodeURIComponent(`Ad Soyad: ${form.name}\nE-posta: ${form.email}\n\n${form.message}`)}`
      window.location.href = mailtoLink
      setSent(true)
    } catch {
      setError('Mesaj gönderilemedi. Lütfen tekrar deneyin.')
    } finally {
      setSending(false)
    }
  }

  const alan = (ad) => ({ value: form[ad], onChange: (e) => setForm({ ...form, [ad]: e.target.value }) })

  return (
    <SiteKabugu>
      <div className={birlestir(KAP, 'py-12 sm:py-20 flex flex-col gap-10 sm:gap-14')}>
        <SayfaUst
          ust="İletişim"
          baslik="Bize ulaşın"
          alt="Sorularınız, önerileriniz veya iş birliği talepleriniz için aşağıdaki formu kullanabilir ya da doğrudan iletişim bilgilerimizden bize ulaşabilirsiniz."
        />

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-8 items-start">
          {/* İletişim bilgileri: mobilde önce gelir ki kişi tek dokunuşla arayabilsin. */}
          <aside className="flex flex-col gap-6 lg:order-2">
            <section aria-labelledby="iletisim-bilgi" className="rounded-2xl border border-cizgi bg-yuzey p-6">
              <h2 id="iletisim-bilgi" className="font-baslik text-[19px] font-bold text-metin">İletişim bilgileri</h2>
              <ul className="mt-5 flex flex-col gap-5">
                {ILETISIM.map(({ ikon, ad, deger, href }) => (
                  <li key={ad} className="flex items-start gap-4">
                    <span className="w-11 h-11 rounded-xl bg-aksan-acik text-aksan inline-flex items-center justify-center shrink-0">
                      {ikon}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-semibold text-metin-2">{ad}</p>
                      {href ? (
                        <a href={href} className="text-[15px] font-semibold text-metin hover:text-aksan transition-colors break-words">{deger}</a>
                      ) : (
                        <p className="text-[15px] leading-relaxed text-metin">{deger}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="sirket-bilgi" className="rounded-2xl border border-cizgi bg-yuzey p-6">
              <h2 id="sirket-bilgi" className="font-baslik text-[19px] font-bold text-metin">Şirket bilgileri</h2>
              <dl className="mt-4 flex flex-col text-sm">
                {[
                  ['Ünvan', 'Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.'],
                  ['Vergi Dairesi', 'Kartal'],
                  ['Vergi No', '7721298766'],
                ].map(([k, v]) => (
                  <div key={k} className="flex flex-col gap-0.5 py-2.5 border-b border-cizgi last:border-b-0">
                    <dt className="text-metin-2">{k}</dt>
                    <dd className="font-medium text-metin">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>

            {/* Destek saatleri: her iki temada koyu lacivert kart (tasarımdaki koyu blok). */}
            <section aria-labelledby="destek-saat" className="rounded-2xl bg-lacivert-950 dark:bg-lacivert-900 text-white p-6 dark:border dark:border-cizgi">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-lacivert-200" aria-hidden="true" />
                <h2 id="destek-saat" className="font-baslik text-[19px] font-bold text-white">Destek saatleri</h2>
              </div>
              <dl className="mt-4 flex flex-col gap-2.5 text-sm">
                {SAATLER.map(([gun, saat]) => (
                  <div key={gun} className="flex items-center justify-between gap-4">
                    <dt className="text-lacivert-200">{gun}</dt>
                    <dd className={birlestir('font-semibold tabular-nums', saat === 'Kapalı' ? 'text-lacivert-300' : 'text-white')}>{saat}</dd>
                  </div>
                ))}
              </dl>
              <p className="mt-5 pt-4 border-t border-white/10 text-[13px] text-lacivert-200">E-posta yanıt süresi: en geç 1 iş günü</p>
            </section>
          </aside>

          <section aria-labelledby="mesaj-baslik" className="rounded-2xl border border-cizgi bg-yuzey p-6 sm:p-10 lg:order-1">
            {sent ? (
              <div className="flex flex-col items-center text-center gap-4 py-10" role="status">
                <span className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300 inline-flex items-center justify-center">
                  <Check size={28} aria-hidden="true" />
                </span>
                <h2 id="mesaj-baslik" className="font-baslik text-[24px] font-extrabold text-metin">E-posta uygulamanız açıldı</h2>
                <p className="text-[15px] text-metin-2 max-w-sm">
                  Mesajınız e-posta uygulamanızda hazır. Gönderdiğinizde en kısa sürede size dönüş yapacağız.
                </p>
                <button type="button" onClick={() => { setSent(false); setForm(BOS_FORM) }} className={dugme('ikincil', 'mt-2')}>
                  Yeni mesaj yaz
                </button>
              </div>
            ) : (
              <>
                <h2 id="mesaj-baslik" className="font-baslik text-[26px] font-extrabold tracking-[-0.01em] text-metin">Mesaj gönderin</h2>
                <form onSubmit={handleSubmit} noValidate className="mt-6 flex flex-col gap-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="il-ad" className={ETIKET}>Ad Soyad<Zorunlu /></label>
                      <input id="il-ad" type="text" autoComplete="name" required aria-required="true" {...alan('name')} placeholder="Ahmet Yılmaz" className={birlestir(GIRDI, 'h-12')} />
                    </div>
                    <div>
                      <label htmlFor="il-eposta" className={ETIKET}>E-posta<Zorunlu /></label>
                      <input id="il-eposta" type="email" autoComplete="email" required aria-required="true" {...alan('email')} placeholder="ornek@email.com" className={birlestir(GIRDI, 'h-12')} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="il-konu" className={ETIKET}>Konu</label>
                    <div className="relative">
                      <select id="il-konu" {...alan('subject')} className={birlestir(GIRDI, 'h-12 pr-11 appearance-none cursor-pointer')}>
                        <option value="">Konu seçin...</option>
                        {KONULAR.map((k) => <option key={k} value={k}>{k}</option>)}
                      </select>
                      <ChevronDown size={18} aria-hidden="true" className="absolute right-4 top-1/2 -translate-y-1/2 text-metin-2 pointer-events-none" />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="il-mesaj" className={ETIKET}>Mesajınız<Zorunlu /></label>
                    <textarea id="il-mesaj" required aria-required="true" {...alan('message')} rows={6} placeholder="Mesajınızı buraya yazın..." className={birlestir(GIRDI, 'py-3 resize-none leading-relaxed')} />
                  </div>
                  {error && <Mesaj ton="hata" rol="alert">{error}</Mesaj>}
                  <button type="submit" disabled={sending} className={dugme('ana', 'w-full')}>
                    {sending ? (
                      <><span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />Gönderiliyor...</>
                    ) : (
                      <><Send size={18} aria-hidden="true" />Mesaj gönder</>
                    )}
                  </button>
                  <p className="text-[13px] text-center text-metin-2">
                    Gönder'e bastığınızda e-posta uygulamanız açılır; mesajınız info@qartim.com adresine gider.
                  </p>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </SiteKabugu>
  )
}
