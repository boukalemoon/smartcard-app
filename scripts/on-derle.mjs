// PAZARLAMA SAYFALARINI ÖN-DERLER (prerender).
//
// Ne yapar: dist/index.html'i kalıp alır, her pazarlama yolunu sunucuda HTML'e
// çevirir, <div id="root"> içine basar ve o yolun kendi .html dosyasını yazar.
// Sayfa başlığı, açıklaması ve canonical adresi de statik olarak yazılır —
// bunlar normalde yalnız tarayıcıda (SayfaMeta.jsx) ayarlanıyordu.
//
// NEDEN: SPA'nın içeriği ancak JavaScript çalıştıktan sonra vardı. Google
// çalıştırıyor ama üretken arama motorları (AI Overviews, Perplexity) çoğu
// zaman çalıştırmıyor; HTML'de ne varsa onu okur. Ön-derlenmiş HTML hem
// aramada hem alıntılanmada sayfayı görünür kılar.
//
// React bu HTML'in üstüne bağlanır (hydrate değil, createRoot ile render).
// Uyuşmazlık riski yok: React kendi ağacını kurarken içeriği değiştirir,
// ziyaretçi arada boş ekran görmez — ilk boyama ön-derlenmiş HTML'den gelir.
//
// Çalıştırma: npm run build (önce istemci, sonra sunucu derlemesi, sonra bu).

import { execSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const KOK = resolve(import.meta.dirname, '..')
const ISTEMCI = resolve(KOK, 'dist')
const SUNUCU = resolve(KOK, 'dist-ssr')

// Sunucuda olmayan tarayıcı API'leri. ThemeProvider render sırasında
// localStorage okuyor; supabase-js de oturum katmanı için bakıyor.
function tarayiciGolgesi() {
  const depo = new Map()
  const sahteDepo = {
    getItem: (k) => (depo.has(k) ? depo.get(k) : null),
    setItem: (k, v) => depo.set(k, String(v)),
    removeItem: (k) => depo.delete(k),
    clear: () => depo.clear(),
    key: () => null,
    get length() { return depo.size },
  }
  if (typeof globalThis.localStorage === 'undefined') globalThis.localStorage = sahteDepo
  if (typeof globalThis.sessionStorage === 'undefined') globalThis.sessionStorage = sahteDepo
}

function kacis(metin) {
  return String(metin)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

async function main() {
  if (!existsSync(resolve(ISTEMCI, 'index.html'))) {
    console.error('✗ dist/index.html yok — önce istemci derlemesi çalışmalı.')
    process.exit(1)
  }

  console.log('▸ Sunucu derlemesi')
  execSync(
    `npx vite build --ssr src/entry-prerender.jsx --outDir dist-ssr --logLevel warn`,
    { cwd: KOK, stdio: ['ignore', 'inherit', 'inherit'], env: { ...process.env, QRTIM_SSR: '1' } },
  )

  tarayiciGolgesi()

  const girisYolu = resolve(SUNUCU, 'entry-prerender.js')
  if (!existsSync(girisYolu)) {
    console.error('✗ dist-ssr/entry-prerender.js üretilmedi.')
    process.exit(1)
  }
  const { render, YOLLAR } = await import(pathToFileURL(girisYolu).href)
  // sayfaMeta.js düz JS, importu yok: Node doğrudan yükler (vite.config.js da
  // aynı dosyayı okuyor — başlıklar tek kaynaktan gelsin).
  const { SAYFALAR, KANONIK_ADRES } = await import(
    pathToFileURL(resolve(KOK, 'src/lib/sayfaMeta.js')).href
  )

  const kalip = readFileSync(resolve(ISTEMCI, 'index.html'), 'utf8')
  if (!kalip.includes('<div id="root"></div>')) {
    console.error('✗ index.html içinde <div id="root"></div> bulunamadı; kalıp değişmiş.')
    process.exit(1)
  }

  console.log('▸ Ön-derleme')
  let sayac = 0
  for (const yol of YOLLAR) {
    const govde = render(yol)
    const meta = SAYFALAR.find((s) => s.yol === yol)
    let html = kalip.replace('<div id="root"></div>', `<div id="root">${govde}</div>`)

    if (meta) {
      const adres = `${KANONIK_ADRES}${meta.yol === '/' ? '/' : meta.yol}`
      html = html
        .replace(/<title>[\s\S]*?<\/title>/, `<title>${kacis(meta.baslik)}</title>`)
        .replace(/(<meta name="description" content=")[^"]*(")/, `$1${kacis(meta.aciklama)}$2`)
        .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${adres}$2`)
        .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${adres}$2`)
        .replace(/(<meta property="og:title" content=")[^"]*(")/, `$1${kacis(meta.baslik)}$2`)
        .replace(/(<meta property="og:description" content=")[^"]*(")/, `$1${kacis(meta.aciklama)}$2`)
    }

    // '/' zaten index.html; diğerleri kendi dosyasına.
    const dosya = yol === '/' ? 'index.html' : `${yol.replace(/^\//, '')}.html`
    writeFileSync(resolve(ISTEMCI, dosya), html, 'utf8')
    console.log(`  ✓ ${dosya}  (${(govde.length / 1024).toFixed(1)} KB içerik)`)
    sayac += 1
  }

  rmSync(SUNUCU, { recursive: true, force: true })
  console.log(`\n✓ ${sayac} sayfa ön-derlendi`)
}

main().catch((hata) => {
  console.error('✗ Ön-derleme başarısız:', hata?.message || hata)
  if (hata?.stack) console.error(hata.stack.split('\n').slice(1, 6).join('\n'))
  process.exit(1)
})
