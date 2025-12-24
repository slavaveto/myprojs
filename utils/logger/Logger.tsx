// utils/logger.ts
import { globalStorage, storage } from '@/utils/storage';
import { PageLogger, type LoggerFunction } from './PageLogger';
import { 
   isMasterLoggerEnabled, 
   isComponentPinned, 
   isPinnedSwitcherEnabled 
} from './services/loggerUtils';

// Инициализируем кеш
const loggerCache = new Map<string, LoggerFunction>();

// Фабричная функция для создания логгера
export function createLogger(pageName: string): LoggerFunction {
   // Получаем настройки из globalStorage
   const getLoggerConfig = (method?: string, message?: string) => {
      try {
         // НОВАЯ ЛОГИКА: Проверяем закреплён ли компонент (ПРИОРИТЕТ 2)
         if (!isComponentPinned(pageName)) {
            return { enabled: false, color: '', componentColor: 'black', logColor: undefined };
         }
         
         // ПРИОРИТЕТ 3: Проверяем включен ли switcher у pinned компонента
         if (!isPinnedSwitcherEnabled(pageName)) {
            return { enabled: false, color: '', componentColor: 'black', logColor: undefined };
         }

         const configs = JSON.parse(globalStorage.getItem('logger-configs') || '{}');

         // 1. Находим цвет компонента (всегда нужен для Ably)
         let componentColor = 'black';
         for (const key in configs) {
            if (key.startsWith(pageName + ':') && key.endsWith(':component')) {
               componentColor = configs[key].color || 'black';
               break;
            }
         }

         // 2. Ищем конфиг конкретного лога
         let logConfig = null;
         if (method && message) {
            const suffix = `:${method}:${message}`;
            for (const key in configs) {
               if (key.startsWith(pageName + ':') && key.endsWith(suffix)) {
                  logConfig = configs[key];
                  break;
               }
            }
         }

         if (logConfig) {
            // Если нашли конфиг лога - используем его
            return { 
               enabled: true, // Pinned компоненты всегда включены, если лог найден - он тоже включен (пока не реализовано индивидуальное выключение в pinned)
               color: logConfig.color || componentColor, // Для локального логгера (effecitve color)
               componentColor,
               logColor: logConfig.color // Цвет конкретного лога
            };
         }

         // Если не нашли конфиг лога - используем дефолты компонента
         return { 
            enabled: true, 
            color: componentColor,
            componentColor,
            logColor: undefined 
         };

      } catch {
         return { enabled: false, color: '', componentColor: 'black', logColor: undefined };
      }
   };

   const config = getLoggerConfig();
   const cacheKey = `${pageName}:${config.color}`;

   // Проверяем кеш
   if (loggerCache.has(cacheKey)) {
      return loggerCache.get(cacheKey)!;
   }

   const loggerInstance = new PageLogger({
      pageName,
      pageColor: config.color,
   });

   // Создаем объект логгера БЕЗ прямого вызова logger()
   const logger: LoggerFunction = {
      info: (message: string, data?: any) => {
         if (!isMasterLoggerEnabled()) return;
         const cfg = getLoggerConfig('info', message);
         if (!cfg.enabled) return;
         
         const result = loggerInstance.log(message, data, cfg.logColor); // Передаем logColor для локального логгера
         return result;
      },
      start: (message: string, data?: any) => {
         if (!isMasterLoggerEnabled()) return;
         const cfg = getLoggerConfig('start', message);
         if (!cfg.enabled) return;
         
         const result = loggerInstance.start(message, data, cfg.logColor);
         return result;
      },
      end: (message: string, data?: any) => {
         if (!isMasterLoggerEnabled()) return;
         const cfg = getLoggerConfig('end', message);
         if (!cfg.enabled) return;
         
         const result = loggerInstance.end(message, data, cfg.logColor);
         return result;
      },
      success: (message: string, data?: any) => {
         if (!isMasterLoggerEnabled()) return;
         const cfg = getLoggerConfig('success', message);
         if (!cfg.enabled) return;
         
         const result = loggerInstance.success(message, data, cfg.logColor);
         return result;
      },
      error: (message: string | Error, data?: any) => {
         if (!isMasterLoggerEnabled()) return;
         const messageStr = typeof message === 'string' ? message : message.message;
         const cfg = getLoggerConfig('error', messageStr);
         if (!cfg.enabled) return;
         
         const result = loggerInstance.error(message, data, cfg.logColor);
         return result;
      },
      warning: (message: string, data?: any) => {
         if (!isMasterLoggerEnabled()) return;
         const cfg = getLoggerConfig('warning', message);
         if (!cfg.enabled) return;
         
         const result = loggerInstance.warning(message, data, cfg.logColor);
         return result;
      },
      group: loggerInstance.group.bind(loggerInstance),
      child: loggerInstance.child.bind(loggerInstance),
      setToasts: loggerInstance.setToasts.bind(loggerInstance),
      clearToasts: loggerInstance.clearToasts.bind(loggerInstance),
      hasActiveToasts: loggerInstance.hasActiveToasts.bind(loggerInstance),
   };

   // Сохраняем в кеш
   loggerCache.set(cacheKey, logger);

   return logger;
}

export function clearAllToasts(): void {
   // Очищаем все активные тосты во всех логгерах
   for (const logger of loggerCache.values()) {
      if (logger.clearToasts) {
         logger.clearToasts();
      }
   }
}

export type { LogLevel, LoggerConfig, LoggerFunction } from './PageLogger';

