'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { storage, globalStorage } from '@/utils/storage';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextProps {
   theme: Theme;
   setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextProps | undefined>(undefined);

const getSystemTheme = (): Theme => {
   if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
   }
   return 'light';
};

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
   const [theme, setTheme] = useState<Theme>('system');

   const applyTheme = (selectedTheme: Theme) => {
      const root = document.documentElement;
      root.classList.remove('light', 'dark');

      if (selectedTheme === 'system') {
         const systemTheme = getSystemTheme();
         root.classList.add(systemTheme);
         setTheme('system');
         //logger(`Системная тема установлена: ${systemTheme}`, 34);
      } else {
         root.classList.add(selectedTheme);
         setTheme(selectedTheme);
         //logger(`Пользователь переключился на: ${selectedTheme}`, 38);
      }
   };

   useEffect(() => {
      const savedTheme = globalStorage.getItem('theme') as Theme | null;
      if (savedTheme) {
         applyTheme(savedTheme);
      } else {
         applyTheme('system');
      }
   }, []);

   useEffect(() => {
      if (theme === 'system') {
         const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
         const handleChange = () => {
            applyTheme('system');
         };

         mediaQuery.addEventListener('change', handleChange);
         return () => mediaQuery.removeEventListener('change', handleChange);
      }
   }, [theme]);

   const handleSetTheme = useCallback((newTheme: Theme) => {
      globalStorage.setItem('theme', newTheme);
      applyTheme(newTheme);
   }, []);

   const contextValue = useMemo(() => ({ theme, setTheme: handleSetTheme }), [theme, handleSetTheme]);

   return (
      <ThemeContext.Provider value={contextValue}>
         {children}
      </ThemeContext.Provider>
   );
};

export const useTheme = (): ThemeContextProps => {
   const context = useContext(ThemeContext);
   if (!context) {
      throw new Error('useTheme must be used within a ThemeProvider');
   }
   return context;
};
