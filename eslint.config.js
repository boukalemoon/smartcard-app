import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // src/vendor: dışarıdan kopyalanan paketler (ShieldAuth), kendi reposunda denetleniyor.
  globalIgnores(['dist', 'src/vendor']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // api/ altı tarayıcıda değil SUNUCUDA çalışıyor (Vercel işlevleri).
    // Tarayıcı global'leriyle denetlenince process ve Buffer "tanımsız"
    // görünüyordu; dosya baştan beri lint dışında kalmıştı.
    files: ['api/**/*.js'],
    languageOptions: {
      globals: globals.node,
      sourceType: 'module',
    },
  },
  {
    // ICS üretimi kontrol karakterlerini BİLEREK hedefliyor: takvim
    // standardı bunları yasaklıyor ve temizlenmezlerse yalın CR sahte
    // takvim satırı enjekte etmeye yarıyor. Kuralın uyarmak istediği
    // "yanlışlıkla kontrol karakteri" durumu bu değil.
    files: ['api/takvim.ics.js', 'src/utils/takvim.js'],
    rules: {
      'no-control-regex': 'off',
    },
  },
])
