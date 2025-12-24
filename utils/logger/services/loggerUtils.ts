// utils/logger/services/loggerUtils.ts
import { globalStorage } from '@/utils/storage';

// Функция для проверки главного выключателя логов (САМЫЙ ВЫСШИЙ ПРИОРИТЕТ!)
export const isMasterLoggerEnabled = (): boolean => {
   try {
      const enabled = globalStorage.getItem('logger-master-enabled');
      // Если ключа нет в storage - считаем что логи включены (по умолчанию)
      return enabled === null || enabled === 'true';
   } catch {
      return true; // При ошибке разрешаем логи
   }
};

// Функция для проверки закреплён ли компонент (ПРИОРИТЕТ 2)
export const isComponentPinned = (componentName: string): boolean => {
   try {
      const pinnedStr = globalStorage.getItem('logger-pinned-components');
      if (!pinnedStr) return false; // Нет закреплённых - все выключены
      
      const pinned = JSON.parse(pinnedStr);
      if (!Array.isArray(pinned) || pinned.length === 0) return false;
      
      // Ищем ключ который начинается с componentName:
      // Формат ключа: "ComponentName:/path/to/file:component"
      return pinned.some((key: string) => key.startsWith(componentName + ':'));
   } catch {
      return false; // При ошибке блокируем
   }
};

// Функция для проверки включен ли switcher у pinned компонента (ПРИОРИТЕТ 3)
export const isPinnedSwitcherEnabled = (componentName: string): boolean => {
   try {
      const switchersStr = globalStorage.getItem('logger-pinned-switchers');
      if (!switchersStr) return true; // Если нет данных - включен по умолчанию
      
      const switchers = JSON.parse(switchersStr);
      
      // Ищем switcher для этого компонента
      for (const key in switchers) {
         if (key.startsWith(componentName + ':')) {
            return switchers[key] !== false;
         }
      }
      
      return true; // Если switcher не найден - включен по умолчанию
   } catch {
      return true; // При ошибке разрешаем
   }
};

// Функция для проверки фильтров папок
export const isLoggerAllowedByFolderFilters = (pageName: string, method?: string, message?: string, line?: number) => {
   try {
      // Пытаемся получить filePath из конфига
      const configs = JSON.parse(globalStorage.getItem('logger-configs') || '{}');
      let filePath = null;
      
      // Ищем конфиг компонента
      for (const key in configs) {
         if (key.startsWith(pageName + ':') && configs[key].filePath) {
            filePath = configs[key].filePath;
            break;
         }
      }
      
      // Получаем фильтры папок
      const folderFiltersArray = JSON.parse(globalStorage.getItem('logger-folder-filters') || '[]');
      
      // Если фильтры не настроены - разрешаем все
      if (!Array.isArray(folderFiltersArray) || folderFiltersArray.length === 0) {
         return true;
      }
      
      // Если не нашли filePath в конфиге - разрешаем (не блокируем до сканирования)
      if (!filePath) {
         return true;
      }
      
      const folderFilters = new Set(folderFiltersArray);
      
      // Убираем /app/ из начала пути если есть
      let cleanPath = filePath;
      if (cleanPath.startsWith('/app/')) {
         cleanPath = cleanPath.substring(5);
      }
      if (cleanPath.startsWith('app/')) {
         cleanPath = cleanPath.substring(4);
      }
      
      // Проверяем все части пути (только папки)
      const pathParts = cleanPath.split('/').filter((part: string) => part !== '');
      const folderParts = pathParts.slice(0, -1); // убираем имя файла
      
      for (let i = 0; i < folderParts.length; i++) {
         const partialPath = folderParts.slice(0, i + 1).join('/');
         if (!folderFilters.has(partialPath)) {
            return false;
         }
      }
      return true;
   } catch {
      return true; // При ошибке разрешаем все
   }
};

