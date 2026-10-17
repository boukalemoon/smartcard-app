// Panel genelinde sayı ve tarih biçimleri — tek yerde, Türkçe.

const sayiBicimci = new Intl.NumberFormat('tr-TR')
export const sayi = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? '—' : sayiBicimci.format(Number(n)))

const tlBicimci = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 2 })
export const tl = (n) => (n === null || n === undefined ? '—' : tlBicimci.format(Number(n)))

export const yuzde = (pay, payda) => {
  if (!payda) return '—'
  return '%' + (Math.round((pay / payda) * 1000) / 10).toLocaleString('tr-TR')
}

export const tarih = (d) => (d ? new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—')
export const tarihKisa = (d) => (d ? new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' }) : '—')
export const saat = (d) => (d ? new Date(d).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '')

// "4 gün önce", "bugün", "dün"
export function goreli(d) {
  if (!d) return ''
  const fark = Date.now() - new Date(d).getTime()
  const dk = Math.round(fark / 60000)
  if (dk < 1) return 'şimdi'
  if (dk < 60) return `${dk} dk önce`
  const sa = Math.round(dk / 60)
  if (sa < 24) return `${sa} sa önce`
  const gun = Math.round(sa / 24)
  if (gun === 1) return 'dün'
  if (gun < 30) return `${gun} gün önce`
  return tarih(d)
}

// Ad soyaddan baş harfler: "Elif Kayaalp" → "EK"
export function basHarf(ad) {
  if (!ad) return '?'
  const p = String(ad).trim().split(/\s+/).filter(Boolean)
  return ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toLocaleUpperCase('tr-TR') || '?'
}

export const bugunUst = () =>
  new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' })

export const birlestir = (...s) => s.filter(Boolean).join(' ')
