import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mail, Phone, MapPin, Send, Check } from 'lucide-react'

export default function Iletisim() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' })
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

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
    } catch (err) {
      setError('Mesaj gönderilemedi. Lütfen tekrar deneyin.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <a href="/"><img src="/qrtım-logo.png" alt="QRtım" className="h-12 w-auto cursor-pointer" /></a>
          <button onClick={() => navigate('/')} className="text-sm text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">← Anasayfaya Dön</button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-16">
        <div className="text-center mb-14">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-3">Bize Ulaşın</h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 max-w-xl mx-auto">
            Sorularınız, önerileriniz veya iş birliği talepleriniz için aşağıdaki formu kullanabilir ya da doğrudan iletişim bilgilerimizden bize ulaşabilirsiniz.
          </p>
        </div>

        <div className="grid lg:grid-cols-5 gap-10">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6 space-y-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">İletişim Bilgileri</h2>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Mail size={18} className="text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-0.5">E-posta</p>
                  <a href="mailto:info@qartim.com" className="text-blue-600 dark:text-blue-400 hover:underline text-sm">info@qartim.com</a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Phone size={18} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Telefon</p>
                  <a href="tel:+902169980889" className="text-green-600 dark:text-green-400 hover:underline text-sm">0 216 998 08 89</a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
                  <MapPin size={18} className="text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-0.5">Adres</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">Cevizli Mahallesi Saraylar Caddesi<br />No:6/85 Maltepe / İstanbul</p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Şirket Bilgileri</h2>
              <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                <p><span className="font-semibold text-gray-700 dark:text-gray-300">Ünvan:</span> Sognare Organizasyon ve Dan. Hiz. Ltd. Şti.</p>
                <p><span className="font-semibold text-gray-700 dark:text-gray-300">Vergi Dairesi:</span> Kartal</p>
                <p><span className="font-semibold text-gray-700 dark:text-gray-300">Vergi No:</span> 7721298766</p>
              </div>
            </div>

            <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-2xl shadow p-6 text-white">
              <h2 className="text-lg font-bold mb-4">Destek Saatleri</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-blue-100">Pazartesi – Cuma</span><span className="font-semibold">09:00 – 18:00</span></div>
                <div className="flex justify-between"><span className="text-blue-100">Cumartesi</span><span className="font-semibold">10:00 – 14:00</span></div>
                <div className="flex justify-between"><span className="text-blue-100">Pazar</span><span className="font-semibold text-blue-200">Kapalı</span></div>
              </div>
              <div className="mt-4 pt-4 border-t border-white/20 text-xs text-blue-100">E-posta yanıt süresi: en geç 1 iş günü</div>
            </div>
          </div>

          <div className="lg:col-span-3">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow p-8">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">Mesaj Gönderin</h2>
              {sent ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                    <Check size={32} className="text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Mesajınız İletildi!</h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-6">En kısa sürede size dönüş yapacağız.</p>
                  <button onClick={() => { setSent(false); setForm({ name: '', email: '', subject: '', message: '' }) }} className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all text-sm font-semibold">Yeni Mesaj Gönder</button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Ad Soyad <span className="text-red-500">*</span></label>
                      <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ahmet Yılmaz" className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none transition-colors" />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">E-posta <span className="text-red-500">*</span></label>
                      <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="ornek@email.com" className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none transition-colors" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Konu</label>
                    <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none transition-colors">
                      <option value="">Konu seçin...</option>
                      <option value="Genel Soru">Genel Soru</option>
                      <option value="Teknik Destek">Teknik Destek</option>
                      <option value="Faturalama / Ödeme">Faturalama / Ödeme</option>
                      <option value="Kurumsal / STK Teklif">Kurumsal / STK Teklif</option>
                      <option value="NFC Kart Siparişi">NFC Kart Siparişi</option>
                      <option value="İş Birliği">İş Birliği</option>
                      <option value="Diğer">Diğer</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Mesajınız <span className="text-red-500">*</span></label>
                    <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} rows={6} placeholder="Mesajınızı buraya yazın..." className="w-full px-4 py-3 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-xl focus:border-blue-500 outline-none transition-colors resize-none" />
                  </div>
                  {error && (
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-700 dark:text-red-300">{error}</div>
                  )}
                  <button type="submit" disabled={sending} className="w-full py-4 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold text-base transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                    {sending ? (<><div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />Gönderiliyor...</>) : (<><Send size={18} />Mesaj Gönder</>)}
                  </button>
                  <p className="text-xs text-center text-gray-500 dark:text-gray-400">Mesajınız info@qartim.com adresine iletilecektir.</p>
                </form>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-gray-900 text-gray-400 py-6 mt-12">
        <div className="max-w-6xl mx-auto px-4 text-center text-sm">
          <p>&copy; 2026 QRtım — Sognare Organizasyon ve Dan. Hiz. Ltd. Şti. Tüm hakları saklıdır.</p>
        </div>
      </footer>
    </div>
  )
}