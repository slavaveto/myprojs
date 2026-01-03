'use client';
import { createContext, ReactNode, useContext, useState, Fragment } from 'react';
import type { Language } from './types';
import { useUIElements } from './useUIElements';
import { storage, globalStorage } from '@/utils/storage';

interface LocalizationContextType {
   language: Language;
   setLanguage: (lang: Language) => void;
   getUI: (item_id: string) => string;
   getRichUI: (item_id: string) => ReactNode;
   isUILoaded: boolean;
}

const LocalizationContext = createContext<LocalizationContextType | undefined>(undefined);

export function LocalizationProvider({ children }: { children: ReactNode }) {
   // Определяем начальный язык
   const getInitialLanguage = (): Language => {
      if (typeof window === 'undefined') return 'en';

      // 1. Проверяем  (выбор пользователя)
      const savedLanguage = globalStorage.getItem('user-language');
      if (
         savedLanguage &&
         (savedLanguage === 'ru' || savedLanguage === 'uk' || savedLanguage === 'en')
      ) {
         return savedLanguage as Language;
      }

      // 2. Определяем язык устройства
      const deviceLanguage = navigator.language.toLowerCase();
      if (deviceLanguage.startsWith('uk')) return 'uk';
      if (deviceLanguage.startsWith('ru')) return 'ru';
      return 'en'; // Английский по умолчанию для всех остальных
   };

   const [language, setLanguageState] = useState<Language>(getInitialLanguage);

   const { getUI: getUIElement, isUILoaded } = useUIElements();

   // При смене языка - сохраняем в 
   const setLanguage = (newLanguage: Language) => {
      setLanguageState(newLanguage);
      if (typeof window !== 'undefined') {
         globalStorage.setItem('user-language', newLanguage);
      }
   };

   const getUI = (item_id: string): string => {
      const text = getUIElement(item_id, language);
      // Удаляем <br/> и <br> (заменяем на пробел) для использования в атрибутах
      return text.replace(/<br\s*\/?>/gi, ' ');
   };

   const getRichUI = (item_id: string): ReactNode => {
      const text = getUIElement(item_id, language);
      if (!text.includes('<br')) return text;

      return text.split(/<br\s*\/?>/gi).map((part, index, array) => (
         <Fragment key={index}>
            {part}
            {index < array.length - 1 && <br />}
         </Fragment>
      ));
   };

   return (
      <LocalizationContext.Provider
         value={{
            language,
            setLanguage,
            getUI,
            getRichUI,
            isUILoaded,
         }}
      >
         {children}
      </LocalizationContext.Provider>
   );
}

export function useLocalization() {
   const context = useContext(LocalizationContext);
   if (!context) {
      throw new Error('useLocalization должен использоваться внутри LocalizationProvider');
   }
   return context;
}
