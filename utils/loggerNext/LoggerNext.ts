// utils/loggerNext/LoggerNext.ts
import { globalStorage } from '@/utils/storage';

// --- Types ---

export type LogLevel = 'info' | 'start' | 'end' | 'success' | 'error' | 'warning';

export interface LogItem {
   level: LogLevel;
   message: string;
   data?: any;
   logColor?: string;
   componentName: string;
   timestamp: number;
   componentColor?: string;
   count: number;
}

export const LOGGER_NEXT_EVENT = 'logger-next:log';

// --- Logger Class ---

class LoggerNext {
   private componentName: string;
   private componentColor: string;
   private enabled: boolean;

   constructor(name: string) {
      this.componentName = name;
      
      // 1. Инициализация (читаем конфиги)
      const config = this.readConfig();
      this.componentColor = config.color;
      this.enabled = config.enabled;
   }

   // Читаем конфиг (Только для инициализации цвета/статуса)
   private readConfig() {
      try {
         // ПРОВЕРКА 1: Master Switch
         const masterEnabled = globalStorage.getItem('logger-master-enabled');
         if (masterEnabled === 'false') {
            return { enabled: false, color: 'black' };
         }

         // ПРОВЕРКА 2: Pinned Components (Whitelist)
         // Мы пока сохраняем старую логику: если нет в Pinned - молчим.
         // Это безопасно для миграции.
         const pinnedStr = globalStorage.getItem('logger-pinned-components');
         const pinned = pinnedStr ? JSON.parse(pinnedStr) : [];
         const isPinned = Array.isArray(pinned) && pinned.some((key: string) => key.startsWith(this.componentName + ':'));

         if (!isPinned) {
            // !!! ВАЖНО: Для удобства разработки пока ВРЕМЕННО включим всё по умолчанию в DEV режиме?
            // Нет, следуем строгим правилам: сохраняем поведение. Не Pinned -> Выкл.
            // Но мы добавим "авто-пин" если его нет? Нет, это опасно.
            // Оставляем как есть: Выкл если не закреплен.
            return { enabled: false, color: 'black' };
         }

         // ПРОВЕРКА 3: Switcher
         const switchersStr = globalStorage.getItem('logger-pinned-switchers');
         if (switchersStr) {
            const switchers = JSON.parse(switchersStr);
            const key = Object.keys(switchers).find(k => k.startsWith(this.componentName + ':'));
            if (key && switchers[key] === false) {
               return { enabled: false, color: 'black' };
            }
         }

         // ЦВЕТ
         const configsStr = globalStorage.getItem('logger-configs');
         const configs = configsStr ? JSON.parse(configsStr) : {};
         let color = 'black';
         
         // Ищем конфиг цвета
         for (const key in configs) {
            if (key.startsWith(this.componentName + ':') && key.endsWith(':component')) {
               color = configs[key].color || 'black';
               break;
            }
         }

         return { enabled: true, color };

      } catch (e) {
         console.error('LoggerNext init error:', e);
         return { enabled: false, color: 'black' };
      }
   }

   private emit(level: LogLevel, message: string, data?: any, logColor?: string) {
      if (!this.enabled) return;

      const logItem: LogItem = {
         level,
         message: typeof message === 'string' ? message : (message as any)?.message || String(message),
         data,
         logColor,
         componentName: this.componentName,
         componentColor: this.componentColor,
         timestamp: Date.now(),
         count: 1
      };

      // 1. Отправляем событие для DebugNext
      if (typeof window !== 'undefined') {
         window.dispatchEvent(new CustomEvent(LOGGER_NEXT_EVENT, { detail: logItem }));
      }
   }

   // --- Public API ---

   info(message: string, data?: any) { this.emit('info', message, data); }
   success(message: string, data?: any) { this.emit('success', message, data); }
   warning(message: string, data?: any) { this.emit('warning', message, data); }
   error(message: string | Error, data?: any) { 
       const msg = message instanceof Error ? message.message : message;
       this.emit('error', msg, data); 
   }
   start(message: string, data?: any) { this.emit('start', message, data); }
   end(message: string, data?: any) { this.emit('end', message, data); }
}

// --- Factory & Cache ---

const loggerCache = new Map<string, LoggerNext>();

export function createLoggerNext(name: string) {
   if (loggerCache.has(name)) {
      return loggerCache.get(name)!;
   }
   
   const logger = new LoggerNext(name);
   loggerCache.set(name, logger);
   return logger;
}

