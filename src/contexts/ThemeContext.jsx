import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    // LocalStorage'dan tema tercihini al
    // Marka yazımı QRtım olarak düzeltildi. Eski anahtar da okunur ki
    // kullanıcıların daha önce seçtiği tema sıfırlanmasın.
    const savedTheme = localStorage.getItem('qrtim-theme') || localStorage.getItem('Qartim-theme');
    return savedTheme || 'light';
  });

  useEffect(() => {
    // Tema değiştiğinde localStorage'a kaydet ve HTML'e class ekle
    localStorage.setItem('qrtim-theme', theme);
    
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}