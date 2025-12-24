import { globalStorage } from '@/utils/storage';
import { ToastLogger } from '@/utils/logger/services/Toasts';
import { convertTailwindToCSS } from '@/utils/logger/services/loggerColors';

export type LogLevel = 'info' | 'start' | 'end' | 'success' | 'error' | 'warning';

export interface LoggerConfig {
   pageName: string;
   pageColor?: string;
}

export interface DebugLogItem {
   level: LogLevel;
   message: string;
   // line удален
   data?: any;
   logColor?: string;
   componentName: string;
   timestamp: number;
   componentColor?: string;
   count: number;
}

export type DebugLogListener = (log: DebugLogItem) => void;

// Глобальные слушатели для Debug Console
const debugListeners: Set<DebugLogListener> = new Set();

export function subscribeToDebugLogs(listener: DebugLogListener): () => void {
   debugListeners.add(listener);
   return () => debugListeners.delete(listener);
}

// Тип для функции-логгера
export type LoggerFunction = {
   info: (message: string, data?: any, logColor?: string) => void;
   start: (message: string, data?: any, logColor?: string) => void;
   end: (message: string, data?: any, logColor?: string) => void;
   success: (message: string, data?: any, logColor?: string) => void;
   error: (message: string | Error, data?: any, logColor?: string) => void;
   warning: (message: string, data?: any, logColor?: string) => void;
   group: (label: string, callback: () => void) => void;
   child: (context: string) => LoggerFunction;
   setToasts: (enabled: boolean) => void;
   clearToasts: () => void;
   hasActiveToasts: () => boolean;
};

// Глобальные переменные
const globalGroupingMs = 500;
const globalshowTimestamp = false;

export class PageLogger {
   private pageName: string;
   private pageColor?: string;
   private showTimestamp: boolean;
   private lastConfigCheck: number = 0; // Для отслеживания изменений
   private toastLogger: ToastLogger; // Экземпляр ToastLogger
   private enabled: boolean = true; // Состояние включен/выключен (по умолчанию ВКЛЮЧЕН для новых компонентов)

   private colors: {
      info: string;
      start: string;
      end: string;
      success: string;
      error: string;
      warning: string;
      pageName: string;
      timestamp: string;
   };

   // Добавляем батчинг для консольных логов
   private consoleBatch: Map<
      string,
      {
         level: LogLevel;
         message: string;
         processName?: string;
         // line удален
         count: number;
         data?: any;
         logColor?: string;
      }
   > = new Map();
   private consoleBatchTimeout: NodeJS.Timeout | null = null;

   constructor(config: LoggerConfig) {
      this.pageName = config.pageName;
      this.pageColor = config.pageColor;
      this.showTimestamp = globalshowTimestamp;

      // Создаём экземпляр ToastLogger
      this.toastLogger = new ToastLogger(config.pageName, config.pageColor);

      // Цвета для консоли (эмодзи не нуждаются в цвете, но оставляем для совместимости)
      this.colors = {
         info: '',
         start: '',
         end: '',
         success: '',
         error: '',
         warning: '',
         pageName: `color: ${convertTailwindToCSS(this.pageColor || 'black')}; font-weight: 500`,
         timestamp: `color: ${convertTailwindToCSS('text-gray-400')};`,
      };

      // Загружаем конфиг из globalStorage при создании
      this.updateConfigFromStorage();
      
      // Подписываемся на изменения в globalStorage (синхронизация между вкладками)
      this.setupStorageListener();
   }

   // Метод для загрузки конфига из globalStorage
   private getConfigFromStorage() {
      if (typeof window === 'undefined') return null;
      
      try {
         const configs = globalStorage.getItem('logger-configs');
         if (!configs) return null;

         const parsed = JSON.parse(configs);
         // Ищем конфиг компонента (ДЛЯ ЦВЕТА ЗАГОЛОВКА)
         // Мы ищем ТОЛЬКО конфиг компонента (с суффиксом :component)
         const matchingConfigs: Array<{ key: string; config: any }> = [];
         for (const key in parsed) {
            if (key.startsWith(this.pageName + ':') && key.endsWith(':component')) {
               matchingConfigs.push({ key, config: parsed[key] });
            }
         }

         if (matchingConfigs.length === 0) return null;

         // Если один конфиг - возвращаем его
         if (matchingConfigs.length === 1) return matchingConfigs[0].config;

         // Если несколько - возвращаем тот что был изменен последним (или первый если lastChanged нет)
         matchingConfigs.sort((a, b) => {
            const timeA = a.config.lastChanged || 0;
            const timeB = b.config.lastChanged || 0;
            return timeB - timeA; // Сортируем по убыванию (новые первые)
         });

         return matchingConfigs[0].config;
      } catch {
         return null;
      }
   }

   // Метод для обновления конфигурации из globalStorage
   private updateConfigFromStorage() {
      const config = this.getConfigFromStorage();

      if (config) {
         // Проверяем изменился ли конфиг
         const configChanged = config.lastChanged && config.lastChanged !== this.lastConfigCheck;

         if (configChanged || this.lastConfigCheck === 0) {
            // Обновляем enabled состояние
            if (typeof config.enabled === 'boolean') {
               this.enabled = config.enabled;
               this.toastLogger.setToasts(config.enabled);
            }

            // Обновляем цвет
            if (config.color) {
               this.pageColor = config.color;
               this.colors.pageName = `color: ${convertTailwindToCSS(config.color)}; font-weight: 500`;
               this.toastLogger.updateColor(config.color);
            }

            // Сохраняем время последнего изменения
            this.lastConfigCheck = config.lastChanged || Date.now();
         }
      } else {
         // Если конфига нет - ВЫКЛЮЧАЕМ логгер (логи только с конфигурацией!)
         if (this.lastConfigCheck === 0) {
            this.enabled = false; // ❌ ВЫКЛЮЧАЕМ если нет конфига!
            this.toastLogger.setToasts(false);
            this.lastConfigCheck = Date.now();
         }
      }
   }

   // Слушатель изменений globalStorage (для синхронизации между вкладками)
   private setupStorageListener() {
      if (typeof window === 'undefined') return;

      // Слушаем изменения из других вкладок
      window.addEventListener('storage', (e) => {
         if (e.key === 'logger-configs') {
            this.updateConfigFromStorage();
         }
      });

      // ДОБАВЛЯЕМ: Периодически проверяем изменения в той же вкладке
      setInterval(() => {
         this.updateConfigFromStorage();
      }, 1000); // Проверяем каждую секунду
   }

   setToasts(enabled: boolean): void {
      this.toastLogger.setToasts(enabled);
   }

   clearToasts(): void {
      this.toastLogger.clearToasts();
   }

   hasActiveToasts(): boolean {
      return this.toastLogger.hasActiveToasts();
   }

   private getIcon(level: LogLevel): string {
      const icons = {
         info: 'ℹ️',
         start: '🚀',
         end: '✅',
         success: '✅',
         error: '❌',
         warning: '⚠️',
      };

      return icons[level] + ' ';
   }

   private getTimestamp(): string {
      if (!this.showTimestamp) return '';

      const now = new Date();
      const time = now.toLocaleTimeString('ru-RU' , {
         hour12: false,
         hour: '2-digit',
         minute: '2-digit',
         second: '2-digit',
         fractionalSecondDigits: 3,

      });

      return `[${time}]`;
   }

   private formatPageDisplay(): { pageName: string } {
      return {
         pageName: this.pageName,
      };
   }

   private formatMessage(level: LogLevel, message: string, data?: any, logColor?: string): void {
      // Если логгер выключен - не выводим ничего
      if (!this.enabled) {
         return;
      }

      // Группируем БЕЗ data (чтобы видеть изменения)
      const consoleKey = `${level}:${message}`;

      // Группируем консольные логи
      if (this.consoleBatch.has(consoleKey)) {
         this.consoleBatch.get(consoleKey)!.count++;
         // Обновляем данные последними (чтобы видеть что изменилось!)
         this.consoleBatch.get(consoleKey)!.data = data;
         // Обновляем цвет (если вдруг изменился)
         this.consoleBatch.get(consoleKey)!.logColor = logColor;
      } else {
         this.consoleBatch.set(consoleKey, {
            level,
            message,
            processName: undefined, // Убрали processName
            count: 1,
            data,
            logColor,
         });
      }

      // ПРАВИЛЬНОЕ ФИКСИРОВАННОЕ ОКНО
      if (!this.consoleBatchTimeout) {
         this.consoleBatchTimeout = setTimeout(() => {
            this.processConsoleBatch();
         }, globalGroupingMs); // 300ms
      }
      // НЕ сбрасываем таймер - это и есть фиксированное окно!

      // Тосты обрабатываем через ToastLogger, передавая logColor
      this.toastLogger.showToast(level, message, data, logColor);
   }

   private processConsoleBatch(): void {
      if (this.consoleBatch.size === 0) {
         this.consoleBatchTimeout = null;
         return;
      }

      for (const [key, batchItem] of this.consoleBatch.entries()) {
         const { level, message, processName, count, data, logColor } = batchItem;

         // Отправляем в Debug Console (если есть подписчики)
         if (debugListeners.size > 0) {
            const debugLog: DebugLogItem = {
               level,
               message,
               // line удален
               data,
               logColor,
               componentName: this.pageName,
               timestamp: Date.now(),
               componentColor: this.pageColor,
               count,
            };
            debugListeners.forEach(listener => listener(debugLog));
         }

         const timestamp = this.getTimestamp();
         const icon = this.getIcon(level);
         const { pageName } = this.formatPageDisplay();

         // Добавляем счетчик сразу за иконку
         const iconWithCount = count > 1 ? `${icon}(${count})` : icon;

         // Формат: [pageName] иконка
         const prefix = `%c[${pageName}] ${iconWithCount}${timestamp}`;

         const styles = [this.colors.pageName];

         // Используем logColor для сообщения, если он есть, иначе дефолтный серый
         const messageStyle = logColor 
            ? `color: ${convertTailwindToCSS(logColor)}; font-weight: 500;` 
            : 'color: #666'; // gray-400

         if (data !== undefined) {
            // Проверяем, является ли data объектом
            if (typeof data === 'object' && data !== null) {
               console.log(`${prefix}\n %c${message}\n %o`, ...styles, messageStyle, data);
            } else {
               console.log(`${prefix}\n %c${message}\n %o`, ...styles, messageStyle, data);
            }
         } else {
            console.log(`${prefix}\n %c${message}`, ...styles, messageStyle);
         }
      }

      // Очищаем батч консоли
      this.consoleBatch.clear();
      this.consoleBatchTimeout = null;
   }

   // Основная функция логирования
   log(message: string, data?: any, logColor?: string): void {
      this.formatMessage('info', message, data, logColor);
   }

   // Методы для разных типов логов
   start(message: string, data?: any, logColor?: string): void {
      this.formatMessage('start', message, data, logColor);
   }

   end(message: string, data?: any, logColor?: string): void {
      this.formatMessage('end', message, data, logColor);
   }

   success(message: string, data?: any, logColor?: string): void {
      this.formatMessage('success', message, data, logColor);
   }

   error(message: string | Error, data?: any, logColor?: string): void {
      const errorMessage = message instanceof Error ? message.message : message;
      this.formatMessage('error', errorMessage, data, logColor);

      if (message instanceof Error && message.stack) {
         console.error('Stack trace:', message.stack);
      }
   }

   warning(message: string, data?: any, logColor?: string): void {
      this.formatMessage('warning', message, data, logColor);
   }

   // Метод для группировки логов
   group(label: string, callback: () => void): void {
      console.group(`[${this.pageName}] ${label}`);
      callback();
      console.groupEnd();
   }

   // Метод для создания дочернего логгера
   child(context: string): any {
      // Здесь нужна циклическая зависимость createLogger, 
      // но чтобы избежать её, будем импортировать динамически или передавать фабрику?
      // Проще использовать require или импорт из _Logger, но это создаст цикл.
      // Лучшее решение: передать фабрику createLogger в конструктор или использовать отдельный модуль.
      // Временное решение: импорт createLogger через require
      const { createLogger } = require('@/utils/logger/Logger');
      return createLogger(`${this.pageName}:${context}`);
   }
}
