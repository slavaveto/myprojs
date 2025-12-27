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
   componentColor?: string; // restored for compatibility
   fileName: string; 
   timestamp: number;
   count: number;
}

export const LOGGER_NEXT_EVENT = 'logger-next:log';
export const LOGGER_NEXT_CONFIG_KEY = 'logger-next-config'; // Exported now

// --- Logger Class ---

class LoggerNext {
   public componentName: string;
   public fileName: string;
   public enabled: boolean = false; // Default disabled

   constructor(name: string) {
      this.componentName = name;
      this.fileName = '';
      
      this.updateConfig();
      
      // Подписываемся на изменения конфига (чтобы переключаться на лету)
      if (typeof window !== 'undefined') {
         window.addEventListener('storage', (e) => {
            if (e.key === LOGGER_NEXT_CONFIG_KEY) {
               this.updateConfig();
            }
         });
         // Для изменений в той же вкладке
         window.addEventListener('logger-next-config-change', () => {
             this.updateConfig();
         });
      }
   }

   private updateConfig() {
      try {
         const configStr = globalStorage.getItem(LOGGER_NEXT_CONFIG_KEY);
         const config = configStr ? JSON.parse(configStr) : {};
         
         // Ключ: "ComponentName" (без файла)
         const key = this.componentName;
         
         if (config[key] === undefined) {
            // Новый компонент! Добавляем выключенным
            config[key] = false; 
            globalStorage.setItem(LOGGER_NEXT_CONFIG_KEY, JSON.stringify(config));
            this.enabled = false;
         } else {
            this.enabled = !!config[key];
         }
      } catch {
         this.enabled = false;
      }
   }

   private emit(level: LogLevel, message: string, data?: any) {
      if (!this.enabled) return;

      const logItem: LogItem = {
         level,
         message: typeof message === 'string' ? message : (message as any)?.message || String(message),
         data,
         componentName: this.componentName,
         componentColor: 'blue', // Default color fixed to 'blue' (exists in COLOR_MAP)
         fileName: this.fileName,
         timestamp: Date.now(),
         count: 1
      };

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

export function getAllLoggers() {
   return Array.from(loggerCache.values()).map(l => ({ 
      name: l.componentName, 
      file: l.fileName, 
      enabled: l.enabled 
   }));
}

export function createLoggerNext(name: string) {
   // Cache Key = name (игнорируем файл)
   const cacheKey = name;

   if (loggerCache.has(cacheKey)) {
      return loggerCache.get(cacheKey)!;
   }
   
   const logger = new LoggerNext(name);
   loggerCache.set(cacheKey, logger);
   return logger;
}
