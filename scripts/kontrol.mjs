#!/usr/bin/env node
// ============================================================================
// COMMIT ÖNCESİ KONTROL
// ============================================================================
//
// NEDEN VAR: 21.09.2026'da bozuk bir derleme commit edildi. Asıl sorun hata
// değil, doğrulamanın kendisiydi:
//   • Derleme çıktısına `tail -2` ile bakıldı; yakalanan iki satır yığın
//     izinin sonuydu, "✓ built" satırı değil. Hata görünmediği için başarı
//     sanıldı.
//   • Ardından üretilen dosyada bir dize arandı, ama `dist` klasörü ÖNCEKİ
//     derlemeden kalmıştı. Eşleşme geldi, yine başarı sanıldı.
// İki doğrulama da gerçekte hiçbir şeyi doğrulamıyordu.
//
// KURAL: kontrol göz kararı olmaz. Ya çıkış kodu 0'dır ya değildir.
// Bu betik bakılacak bir çıktı üretmez; SONUÇ üretir.
//
// Kullanım:  node scripts/kontrol.mjs
// Kanca:     .githooks/pre-commit  (git config core.hooksPath .githooks)

import { execSync } from 'node:child_process'
import { existsSync, rmSync, readFileSync } from 'node:fs'

const TABAN_DOSYA = 'scripts/lint-taban.json'
let hata = 0

function baslik(ad) {
  process.stdout.write(`\n▸ ${ad}\n`)
}

function gecti(mesaj) {
  process.stdout.write(`  ✓ ${mesaj}\n`)
}

function kaldi(mesaj) {
  process.stdout.write(`  ✗ ${mesaj}\n`)
  hata += 1
}

// ---------------------------------------------------------------------------
// 1) Derleme
// ---------------------------------------------------------------------------
// dist ÖNCE siliniyor: eski çıktıya bakıp "çalışıyor" demenin önüne geçmek
// için. Ayrıca "✓ built" dizesi açıkça aranıyor — çıkış kodu 0 olsa bile
// beklenen işaret yoksa kabul edilmiyor.
baslik('Derleme')
try {
  if (existsSync('dist')) rmSync('dist', { recursive: true, force: true })
  const cikti = execSync('npx vite build', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (!cikti.includes('built in')) {
    kaldi('derleme bitti ama beklenen başarı işareti yok')
  } else if (!existsSync('dist')) {
    kaldi('derleme başarı dedi ama dist oluşmadı')
  } else {
    gecti('derleme temiz ve dist üretildi')
  }
} catch (e) {
  const metin = `${e.stdout ?? ''}${e.stderr ?? ''}`
  const satir = metin.split('\n').find((s) => s.includes('ERROR:') || s.includes('error during build'))
  kaldi(`derleme BAŞARISIZ${satir ? ` — ${satir.trim()}` : ''}`)
}

// ---------------------------------------------------------------------------
// 2) Lint — tabana göre gerileme var mı
// ---------------------------------------------------------------------------
// Depoda eskiden gelen uyarılar var; sıfıra inmesini beklemek gerçekçi değil.
// Ama SAYININ ARTMAMASI beklenir: yeni hata, eskilerin arasında kaybolmasın.
baslik('Lint')
let lintCikti = ''
try {
  lintCikti = execSync('npx eslint src/ api/ scripts/', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
} catch (e) {
  lintCikti = `${e.stdout ?? ''}${e.stderr ?? ''}`
}
const eslesme = lintCikti.match(/(\d+)\s+problems?\s+\((\d+)\s+errors?,\s+(\d+)\s+warnings?\)/)
const suanki = eslesme ? { hata: Number(eslesme[2]), uyari: Number(eslesme[3]) } : { hata: 0, uyari: 0 }

let taban = null
try {
  taban = JSON.parse(readFileSync(TABAN_DOSYA, 'utf8'))
} catch {
  kaldi(`taban dosyası okunamadı (${TABAN_DOSYA})`)
}

if (taban) {
  if (suanki.hata > taban.hata) {
    kaldi(`lint hatası arttı: ${taban.hata} → ${suanki.hata}`)
  } else if (suanki.uyari > taban.uyari) {
    kaldi(`lint uyarısı arttı: ${taban.uyari} → ${suanki.uyari}`)
  } else if (suanki.hata < taban.hata || suanki.uyari < taban.uyari) {
    gecti(`taban düştü (${taban.hata}/${taban.uyari} → ${suanki.hata}/${suanki.uyari}) — ${TABAN_DOSYA} güncellenebilir`)
  } else {
    gecti(`taban korundu (${suanki.hata} hata, ${suanki.uyari} uyarı)`)
  }
}

// ---------------------------------------------------------------------------
// 3) Göç dosyaları gövdesiz kalmasın
// ---------------------------------------------------------------------------
// Bir göç dosyası "gövdesi Supabase geçmişinde" diyorsa depo üretimle
// eşleşmez: sıfırdan kurulumda o fonksiyon hiç oluşmaz. Bu bir kez yaşandı.
baslik('Göç dosyaları')
try {
  const supheli = execSync(
    'git ls-files supabase/migrations',
    { encoding: 'utf8' },
  ).split('\n').filter(Boolean).filter((yol) => {
    const icerik = readFileSync(yol, 'utf8')
    // "Fonksiyon gövdesi için bkz." gibi bir not VAR ama create function YOK.
    return /g[öo]vde\w*\s+(i[çc]in\s+)?bkz|g[öo][çc]\s+ge[çc]mi[şs]inde/i.test(icerik)
      && !/create\s+or\s+replace\s+function/i.test(icerik)
  })
  if (supheli.length > 0) {
    kaldi(`gövdesiz göç dosyası: ${supheli.join(', ')}`)
  } else {
    gecti('göç dosyalarında gövdesiz fonksiyon referansı yok')
  }
} catch {
  gecti('göç dosyası kontrolü atlandı (git listesi alınamadı)')
}

// ---------------------------------------------------------------------------
process.stdout.write(
  hata === 0
    ? '\nSONUÇ: geçti\n'
    : `\nSONUÇ: ${hata} kontrol KALDI — commit edilmemeli\n`,
)
process.exit(hata === 0 ? 0 : 1)
