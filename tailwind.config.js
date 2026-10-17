// QRtım tasarım dili — mevcut logo kimliğinden (lacivert #162349, logo mavisi #0354A6)
//
// NEDEN RENK ÖLÇEKLERİNİ EZİYORUZ: Bileşenler yıllardır ham `blue-600`, `gray-500`,
// `purple-600` sınıflarıyla yazıldı. Ölçekleri kurumsal kimliğe çekmek, 2.500+ sınıfı
// tek tek değiştirmeden bütün paneli aynı dile getirir:
//   gray            → soğuk nötr (lacivert alt tonlu)
//   blue            → aksan mavisi (600 = #0A52B0, düğme/bağlantı; beyaz üstünde 6:1)
//   indigo/purple/violet/fuchsia → lacivert ölçeği (eski mor degradeler kimliğe döner)
// Yeni kod anlamlı adları kullanır: bg-aksan, text-metin-2, bg-zemin, border-cizgi…
// (değerler src/index.css'teki --renk-* değişkenlerinde; koyu tema orada).
const lacivert = {
  50: '#EEF1F8', 100: '#E1E6F2', 200: '#C5CEE3', 300: '#9DABCB', 400: '#7083B0',
  500: '#4A5E92', 600: '#2C407A', 700: '#223468', 800: '#1B2B58', 900: '#162349', 950: '#0E1733',
}
const v = (ad) => `rgb(var(--renk-${ad}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#F4F6FA', 100: '#EDF0F5', 200: '#D9DEE8', 300: '#C2C9D6', 400: '#8E98AA',
          500: '#5E6A7E', 600: '#475369', 700: '#333E54', 800: '#1C2539', 900: '#121A2E', 950: '#0B1120',
        },
        blue: {
          50: '#EEF4FD', 100: '#E3ECFA', 200: '#C3D6F5', 300: '#93B6EC', 400: '#5B9BFF',
          500: '#2B6FD6', 600: '#0A52B0', 700: '#0A4594', 800: '#0B3A7A', 900: '#162349', 950: '#0E1733',
        },
        indigo: lacivert, purple: lacivert, violet: lacivert, fuchsia: lacivert, lacivert,
        zemin: v('zemin'),
        yuzey: { DEFAULT: v('yuzey'), 2: v('yuzey-2') },
        cizgi: v('cizgi'),
        metin: { DEFAULT: v('metin'), 2: v('metin-2') },
        aksan: { DEFAULT: v('aksan'), koyu: v('aksan-koyu'), acik: v('aksan-acik') },
        murekkep: v('murekkep'),
        vurgu: { DEFAULT: v('vurgu'), acik: v('vurgu-acik') },
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        baslik: ['"Manrope Variable"', 'Manrope', 'system-ui', 'sans-serif'],
      },
      // Kartlar ağır gölge yerine ince çizgiyle ayrılır; mevcut shadow-* sınıfları da
      // bu yüzden hafifletildi.
      boxShadow: {
        sm: '0 1px 2px rgb(18 26 46 / 0.06)',
        DEFAULT: '0 0 0 1px rgb(18 26 46 / 0.06), 0 1px 3px rgb(18 26 46 / 0.06)',
        md: '0 0 0 1px rgb(18 26 46 / 0.06), 0 2px 6px rgb(18 26 46 / 0.06)',
        lg: '0 0 0 1px rgb(18 26 46 / 0.07), 0 4px 12px rgb(18 26 46 / 0.06)',
        xl: '0 0 0 1px rgb(18 26 46 / 0.07), 0 10px 24px rgb(18 26 46 / 0.08)',
        '2xl': '0 24px 48px rgb(18 26 46 / 0.18)',
      },
    },
  },
  plugins: [],
}
