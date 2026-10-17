import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { Send, CheckCircle2, XCircle } from 'lucide-react'
import { birlestir } from '../panel/bicim'

// Site form ölçüleri (src/site/sayfalar/siniflar.js ile aynı dil).
const GIRDI = 'w-full h-12 rounded-xl border border-cizgi bg-yuzey px-4 text-[15px] text-metin placeholder:text-metin-2/70 focus:outline-none focus:ring-2 focus:ring-aksan/40 focus:border-aksan transition-colors'
const ETIKET = 'block text-[13px] font-semibold text-metin mb-1.5'
const DUGME = 'inline-flex items-center justify-center gap-2 h-12 px-[22px] rounded-xl text-[15px] font-semibold border whitespace-nowrap transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aksan disabled:opacity-45 disabled:cursor-not-allowed'

export default function PublicApplicationForm({ organizationId, organizationName }) {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: ''
  })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (!formData.name || !formData.email) {
      setError('Ad Soyad ve Email zorunludur')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { error: submitError } = await supabase
        .from('applications')
        .insert({
          organization_id: organizationId,
          applicant_name: formData.name,
          applicant_email: formData.email,
          applicant_phone: formData.phone,
          applicant_message: formData.message,
          status: 'pending'
        })

      if (submitError) throw submitError

      setSubmitted(true)
      setFormData({ name: '', email: '', phone: '', message: '' })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <section className="rounded-2xl border border-cizgi bg-yuzey px-6 py-12 sm:px-10 flex flex-col items-center text-center gap-4" role="status">
        <span className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-300 inline-flex items-center justify-center">
          <CheckCircle2 size={28} aria-hidden="true" />
        </span>
        <h2 className="font-baslik text-[24px] font-extrabold text-metin">
          Başvurunuz alındı
        </h2>
        <p className="text-[15px] leading-relaxed text-metin-2 max-w-md">
          {organizationName} yöneticileri başvurunuzu inceleyecek ve en kısa sürede size geri dönüş yapacaktır.
        </p>
        <button
          type="button"
          onClick={() => setSubmitted(false)}
          className={birlestir(DUGME, 'mt-2 bg-yuzey text-metin border-cizgi hover:bg-yuzey-2')}
        >
          Yeni başvuru yap
        </button>
      </section>
    )
  }

  const alan = (ad) => ({ value: formData[ad], onChange: (e) => setFormData({ ...formData, [ad]: e.target.value }) })

  return (
    <section aria-labelledby="basvuru-baslik" className="rounded-2xl border border-cizgi bg-yuzey p-6 sm:p-10">
      <h2 id="basvuru-baslik" className="font-baslik text-[26px] leading-tight font-extrabold tracking-[-0.01em] text-metin">
        Üyelik başvurusu
      </h2>
      <p className="mt-2 text-[15px] leading-relaxed text-metin-2">
        Lütfen aşağıdaki formu doldurun. Başvurunuz organizasyon yöneticisine iletilir;
        onaylandığında üyeliğiniz QRtım hesabınıza tanımlanır.
      </p>

      {error && (
        <div role="alert" className="mt-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 dark:border-red-500/30 dark:bg-red-500/10">
          <XCircle size={18} className="shrink-0 mt-px text-red-600 dark:text-red-400" aria-hidden="true" />
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-5">
        <div className="grid sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="bs-ad" className={ETIKET}>
              Ad Soyad<span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>
            </label>
            <input id="bs-ad" type="text" autoComplete="name" {...alan('name')} className={GIRDI} placeholder="Ahmet Yılmaz" required />
          </div>

          <div>
            <label htmlFor="bs-eposta" className={ETIKET}>
              E-posta<span className="text-red-600 dark:text-red-400" aria-hidden="true"> *</span>
            </label>
            <input id="bs-eposta" type="email" autoComplete="email" {...alan('email')} className={GIRDI} placeholder="ahmet@email.com" required />
          </div>
        </div>

        <div>
          <label htmlFor="bs-telefon" className={ETIKET}>Telefon</label>
          <input id="bs-telefon" type="tel" autoComplete="tel" {...alan('phone')} className={GIRDI} placeholder="+90 555 123 4567" />
        </div>

        <div>
          <label htmlFor="bs-mesaj" className={ETIKET}>
            Mesajınız <span className="font-normal text-metin-2">(isteğe bağlı)</span>
          </label>
          <textarea id="bs-mesaj" {...alan('message')} rows={4} className={birlestir(GIRDI, 'h-auto py-3 leading-relaxed')} placeholder="Neden üye olmak istiyorsunuz?" />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={birlestir(DUGME, 'w-full bg-aksan text-white dark:text-zemin border-transparent hover:bg-aksan-koyu')}
        >
          <Send size={18} aria-hidden="true" />
          {loading ? 'Gönderiliyor...' : 'Başvuru yap'}
        </button>
      </form>
    </section>
  )
}
