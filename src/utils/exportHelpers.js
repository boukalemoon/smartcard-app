// CSV dışa aktarma
//
// FORMÜL ENJEKSİYONU: Excel ve LibreOffice, hücre '=', '+', '-', '@' veya
// tab/satır başı ile başlıyorsa içeriği FORMÜL olarak çalıştırır. Başvuru
// formundaki ad alanı giriş yapmamış ziyaretçiden gelir; oraya
// =HYPERLINK(...) yazan biri, dosyayı açan yöneticinin bilgisayarında
// istediğini tetikleyebilirdi. Bu yüzden riskli başlangıç karakterleri
// tek tırnakla etkisizleştirilir.
const guvenliHucre = (deger) => {
  if (deger === null || deger === undefined) return ''
  let metin = String(deger)
  if (/^[=+\-@\t\r]/.test(metin)) metin = "'" + metin
  if (/[",\n\r]/.test(metin)) metin = '"' + metin.replace(/"/g, '""') + '"'
  return metin
}

export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert('Export edilecek veri yok!')
    return
  }

  // CSV headers (ilk objenin key'leri)
  const headers = Object.keys(data[0])
  
  // CSV rows
  const csvRows = [
    headers.map(guvenliHucre).join(','),
    ...data.map(row => 
      headers.map(header => guvenliHucre(row[header])).join(',')
    )
  ]

  // CSV blob oluştur
  const csvContent = csvRows.join('\n')
  const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }) // UTF-8 BOM ekle (Türkçe karakterler için)
  
  // Download link oluştur
  const link = document.createElement('a')
  const url = URL.createObjectURL(blob)
  link.setAttribute('href', url)
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
  link.style.visibility = 'hidden'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}
