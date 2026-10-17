import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Arama motoru yapısal verisi (schema.org FAQPage) index.html'in <head>'ine
// DERLEME ANINDA basılır.
//
// NEDEN: Uygulama bir SPA; bileşen içinden basılan JSON-LD yalnız JavaScript
// çalıştıran tarayıcıya görünür. Statik basınca içerik HTML'in kendisinde
// durur ve tek kaynak korunur — veri src/site/acilis/sorularVerisi.js'de,
// tutarlar da src/lib/planlar.js'den geliyor.
function faqYapisalVeri() {
  return {
    name: 'qrtim-faq-jsonld',
    async transformIndexHtml() {
      const { faqJsonLd } = await import('./src/site/acilis/sorularVerisi.js')
      return [
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          children: faqJsonLd(),
          injectTo: 'head',
        },
      ]
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), faqYapisalVeri()],
})
