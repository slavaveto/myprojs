import { useState, useEffect } from 'react';

// ============================================
// УНИВЕРСАЛЬНЫЙ STORAGE API
// ============================================

// Заглушка для SSR (когда window нет на сервере)
const dummyStorage: Storage = {
  length: 0,
  clear: () => {},
  getItem: () => null,
  key: () => null,
  removeItem: () => {},
  setItem: () => {},
};

// Выбор storage engine (Всегда session, чтобы разные вкладки = разные пользователи)
const getStorageEngine = (): Storage => {
  if (typeof window === 'undefined') {
    return dummyStorage; // ✅ На сервере - заглушка!
  }
  
  return sessionStorage;
};

// ВСЕГДА local-Storage (для глобальных настроек типа LoggerManager)
const getGlobalStorage = (): Storage => {
  if (typeof window === 'undefined') {
    return dummyStorage; // ✅ На сервере - заглушка!
  }
  return localStorage;
};

// Универсальное API для работы с storage (session/local по окружению)
export const storage = {
  getItem: (key: string): string | null => {
    try {
      return getStorageEngine().getItem(key);
    } catch (err) {
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    try {
      getStorageEngine().setItem(key, value);
    } catch (err) {
    }
  },

  removeItem: (key: string): void => {
    try {
      getStorageEngine().removeItem(key);
    } catch (err) {
    }
  },

  clear: (): void => {
    try {
      getStorageEngine().clear();
    } catch (err) {
    }
  },
};

// НОВЫЙ API для глобальных настроек (ВСЕГДА local-Storage)
export const globalStorage = {
  getItem: (key: string): string | null => {
    try {
      return getGlobalStorage().getItem(key);
    } catch (err) {
      return null;
    }
  },

  setItem: (key: string, value: string): void => {
    try {
      getGlobalStorage().setItem(key, value);
    } catch (err) {
    }
  },

  removeItem: (key: string): void => {
    try {
      getGlobalStorage().removeItem(key);
    } catch (err) {
    }
  },

  clear: (): void => {
    try {
      getGlobalStorage().clear();
    } catch (err) {
    }
  },
};

// ============================================
// ХЕЛПЕРЫ ДЛЯ JSON
// ============================================

export const getStorageItem = <T>(key: string, defaultValue: T): T => {
  try {
    const item = storage.getItem(key);
    if (item === null) return defaultValue;
    return JSON.parse(item) as T;
  } catch (err) {
    return defaultValue;
  }
};

export const setStorageItem = <T>(key: string, value: T): void => {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch (err) {
  }
};

// ============================================
// REACT HOOK - use PersistentState
// ============================================

export function usePersistentState<T>(key: string, defaultValue: T | (() => T)) {
  const getValueForKey = (currentKey: string) => {
    if (typeof window === 'undefined')
      return typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue;

    try {
      const savedValue = storage.getItem(currentKey);
      if (savedValue !== null) {
        return JSON.parse(savedValue);
      }
    } catch (err) {
      storage.removeItem(currentKey);
    }

    return typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue;
  };

  const [state, setState] = useState<T>(() => getValueForKey(key));

  // Обновляем состояние при смене ключа
  useEffect(() => {
    const newValue = getValueForKey(key);
    setState(newValue);
  }, [key]);

  // Сохраняем в storage при изменении состояния или ключа
  useEffect(() => {
    storage.setItem(key, JSON.stringify(state));
  }, [key, state]);

  return [state, setState] as const;
}

// НОВЫЙ хук для глобальных настроек (ВСЕГДА local-Storage)
export function useGlobalPersistentState<T>(key: string, defaultValue: T | (() => T)) {
  // Always initialize with default value to avoid hydration mismatch
  const [state, setState] = useState<T>(defaultValue);
  const [isHydrated, setIsHydrated] = useState(false);

  // Read from storage after mount
  useEffect(() => {
    const getValueForKey = (currentKey: string) => {
      try {
        const savedValue = globalStorage.getItem(currentKey);
        if (savedValue !== null) {
          return JSON.parse(savedValue);
        }
      } catch (err) {
        // ignore
      }
      return typeof defaultValue === 'function' ? (defaultValue as () => T)() : defaultValue;
    };

    setState(getValueForKey(key));
    setIsHydrated(true);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (isHydrated) {
      globalStorage.setItem(key, JSON.stringify(state));
    }
  }, [key, state, isHydrated]);

  // Синхронизация между компонентами через storage event
  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === key && e.newValue !== null) {
        try {
          const newValue = JSON.parse(e.newValue);
          setState(newValue);
        } catch (err) {
        }
      }
    };

    // Также слушаем кастомный event для синхронизации в том же окне
    const handleCustomStorageChange = (e: CustomEvent) => {
      if (e.detail.key === key) {
        // Используем queueMicrotask чтобы избежать setState во время рендера
        queueMicrotask(() => {
          setState(e.detail.value);
        });
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('localStorageChange' as any, handleCustomStorageChange);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('localStorageChange' as any, handleCustomStorageChange);
    };
  }, [key]);

  // Обновленный setter с диспатчем кастомного события
  const setStateWithSync = (value: T | ((prev: T) => T)) => {
    setState((prevState) => {
      const newValue = value instanceof Function ? value(prevState) : value;
      
      // Диспатчим кастомный event для синхронизации в том же окне
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('localStorageChange', {
            detail: { key, value: newValue },
          })
        );
      }
      
      return newValue;
    });
  };

  return [state, setStateWithSync] as const;
}