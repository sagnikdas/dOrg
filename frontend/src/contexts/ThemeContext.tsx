/** Theme context for dark/light mode. */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: {
    background: string;
    surface: string;
    surfaceElevated: string;
    text: string;
    textSecondary: string;
    border: string;
    borderHover: string;
    primary: string;
    primaryHover: string;
    primaryText: string;
    error: string;
    errorBackground: string;
    divider: string;
    hover: string;
    active: string;
    shadow: string;
    shadowHover: string;
  };
}

const lightColors = {
  background: '#f5f5f5',
  surface: '#ffffff',
  surfaceElevated: '#ffffff',
  text: '#212121',
  textSecondary: '#757575',
  border: '#e0e0e0',
  borderHover: '#bdbdbd',
  primary: '#1976d2',
  primaryHover: '#1565c0',
  primaryText: '#ffffff',
  error: '#d32f2f',
  errorBackground: '#ffebee',
  divider: '#e0e0e0',
  hover: '#f5f5f5',
  active: '#bbdefb', // More visible blue for drag-over in light mode
  shadow: 'rgba(0, 0, 0, 0.1)',
  shadowHover: 'rgba(0, 0, 0, 0.15)',
};

const darkColors = {
  background: '#121212',
  surface: '#1e1e1e',
  surfaceElevated: '#2d2d2d',
  text: '#e0e0e0',
  textSecondary: '#b0b0b0',
  border: '#333333',
  borderHover: '#404040',
  primary: '#64b5f6',
  primaryHover: '#90caf9',
  primaryText: '#121212',
  error: '#ef5350',
  errorBackground: '#3d1f1f',
  divider: '#333333',
  hover: '#2d2d2d',
  active: '#1e3a5f',
  shadow: 'rgba(0, 0, 0, 0.3)',
  shadowHover: 'rgba(0, 0, 0, 0.4)',
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    // Check localStorage first
    const saved = localStorage.getItem('theme');
    if (saved === 'dark' || saved === 'light') {
      return saved;
    }
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light';
  });

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const colors = theme === 'dark' ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}

