// CSV Export Helper
export const exportToCSV = (data, filename) => {
  if (!data || data.length === 0) {
    alert('Export edilecek veri yok!')
    return
  }

  // CSV headers (ilk objenin key'leri)
  const headers = Object.keys(data[0])
  
  // CSV rows
  const csvRows = [
    headers.join(','), // Header satırı
    ...data.map(row => 
      headers.map(header => {
        const value = row[header]
        // Virgül ve tırnak içeren değerleri escape et
        if (value && typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`
        }
        return value ?? ''
      }).join(',')
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

// Şifre doğrulama prompt
export const verifyPasswordForExport = async (supabase) => {
  const password = prompt('⚠️ Güvenlik: Export için şifrenizi girin:')
  
  if (!password) {
    alert('Export iptal edildi.')
    return false
  }

  try {
    // Mevcut kullanıcının email'ini al
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      alert('Kullanıcı bulunamadı!')
      return false
    }

    // Şifre doğrulama (signInWithPassword ile test et)
    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: password
    })

    if (error) {
      alert('❌ Yanlış şifre! Export iptal edildi.')
      return false
    }

    return true
  } catch (error) {
    console.error('Password verification error:', error)
    alert('Doğrulama hatası!')
    return false
  }
}