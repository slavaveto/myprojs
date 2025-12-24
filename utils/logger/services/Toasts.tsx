// utils/logger/ToastLogger.tsx
import React from 'react';
import { toast } from 'react-hot-toast';
import { AlertCircle, AlertTriangle, CheckCircle, Info, Rocket } from 'lucide-react';
import { globalStorage } from '@/utils/storage';

type LogLevel = 'info' | 'start' | 'end' | 'success' | 'error' | 'warning';

// Цвета для уровней логирования
const TOASTS_ICON_COLORS = {
   info: 'text-default-500',
   start: 'text-orange-400',
   end: 'text-green-600',
   success: 'text-green-600',
   error: 'text-red-500',
   warning: 'text-yellow-500',
} as const;

// Функция для проверки включены ли тосты глобально
export function getGlobalToastsEnabled(): boolean {
   if (typeof window === 'undefined') return false;

   // Тосты работают ТОЛЬКО на localhost!
   const isLocalhost = 
      typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

   if (!isLocalhost) return false;

   try {
      const saved = globalStorage.getItem('logger-show-toasts');
      return saved ? JSON.parse(saved) : false;
   } catch {
      return false;
   }
}

// Глобальные события для тостов
const toastEventListeners: Set<() => void> = new Set();

export function onToastChange(callback: () => void): () => void {
   toastEventListeners.add(callback);
   return () => toastEventListeners.delete(callback);
}

function notifyToastChange(): void {
   toastEventListeners.forEach((callback) => callback());
}

export class ToastLogger {
   private pageName: string;
   private pageColor?: string;
   private toastsEnabled: boolean = false;
   private hasLocalToastSetting: boolean = false;
   private activeToasts: Map<string, { id: string; count: number; timeout: NodeJS.Timeout }> = new Map();
   private pendingToasts: Map<string, { level: LogLevel; message: string; count: number; timeout: NodeJS.Timeout; data?: any }> = new Map();
   private toastBatch: Map<string, { level: LogLevel; message: string; count: number; data?: any; logColor?: string }> = new Map();
   private batchTimeout: NodeJS.Timeout | null = null;

   constructor(pageName: string, pageColor?: string) {
      this.pageName = pageName;
      this.pageColor = pageColor;
   }

   setToasts(enabled: boolean): void {
      this.toastsEnabled = enabled;
      this.hasLocalToastSetting = true;
   }

   updateColor(color: string): void {
      this.pageColor = color;
      // Очищаем старые тосты чтобы новые показывались с новым цветом
      this.clearToasts();
   }

   clearToasts(): void {
      // Используем queueMicrotask чтобы избежать setState во время рендера
      queueMicrotask(() => {
         toast.dismiss();
      });
      this.activeToasts.clear();
      this.pendingToasts.clear();
   }

   hasActiveToasts(): boolean {
      return this.activeToasts.size > 0;
   }

   private getToastIcon(level: LogLevel) {
      const icons = {
         info: Info,
         start: Rocket,
         end: CheckCircle,
         success: CheckCircle,
         error: AlertCircle,
         warning: AlertTriangle,
      };
      return icons[level];
   }

   private createToastComponent(
      pageName: string,
      message: string,
      // line removed
      count?: number,
      level?: LogLevel,
      data?: any
   ): any {
      const pageColorClass = this.pageColor
         ? `text-${this.pageColor}-500 dark:text-${this.pageColor}-400`
         : 'text-foreground';

      const LogIcon = level ? this.getToastIcon(level) : null;
      const logIconColor = level ? TOASTS_ICON_COLORS[level] : '';

      const formatDataForToast = (data: any): string => {
         if (data === null) return 'null';
         if (data === undefined) return 'undefined';

         if (typeof data === 'object') {
            if (Array.isArray(data)) {
               return `Array(${data.length})`;
            } else {
               const keys = Object.keys(data);
               if (keys.length === 0) return '{}';
               if (keys.length <= 2) {
                  return JSON.stringify(data);
               } else {
                  return `{${keys.slice(0, 2).join(', ')}...}`;
               }
            }
         }

         return String(data);
      };

      return (
         <div style={{ fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <span className={`font-medium ${pageColorClass}`}>[{pageName}]</span>
               {LogIcon && (
                  <LogIcon size={15} className={logIconColor} style={{ marginTop: '1px' }} />
               )}
               {/* line removed */}
               {count && count > 1 && <span style={{ fontSize: '12px' }}>({count})</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
               <span>{message}</span>
            </div>
            {data !== undefined && (
               <div style={{ fontSize: '11px', opacity: 0.7, marginTop: '2px' }}>
                  <span>{formatDataForToast(data)}</span>
               </div>
            )}
         </div>
      );
   }

   showToast(level: LogLevel, message: string, data?: any, logColor?: string): void {
      // Если глобально выключены - не показываем НИКОГДА
      if (!getGlobalToastsEnabled()) return;

      // Если глобально включены - проверяем локальную настройку (по умолчанию ВЫКЛЮЧЕНЫ)
      const shouldShowToast = this.hasLocalToastSetting ? this.toastsEnabled : true;

      if (!shouldShowToast) return;

      const key = `${level}:${message}`;

      // Накапливаем в батче
      if (this.toastBatch.has(key)) {
         this.toastBatch.get(key)!.count++;
         this.toastBatch.get(key)!.data = data;
         this.toastBatch.get(key)!.logColor = logColor; // Update color just in case
      } else {
         this.toastBatch.set(key, {
            level,
            message,
            // line removed
            count: 1,
            data,
            logColor,
         });
      }

      if (!this.batchTimeout) {
         this.batchTimeout = setTimeout(() => {
            this.processToastBatch();
         }, 500);
      }
   }

   private processToastBatch(): void {
      // Проверяем глобальную настройку перед отправкой батча
      if (!getGlobalToastsEnabled()) {
         // Если выключили глобально - просто очищаем батч
         this.toastBatch.clear();
         return;
      }

      for (const [key, batchItem] of this.toastBatch.entries()) {
         const { level, message, count, data, logColor } = batchItem;

         const toastComponent = this.createToastComponent(
            this.pageName,
            message,
            // line removed
            count > 1 ? count : undefined,
            level,
            data
         );

         // Determine border color class
         let borderClass = 'border-divider';
         if (logColor && logColor !== 'black') {
             borderClass = `border-${logColor}-500`;
         }

         const options = {
            duration: Infinity,
            position: 'bottom-left' as const,
            className: `!p-0 !px-2 border ${borderClass} !bg-content2 !text-foreground`,
            style: {
               fontSize: '12px',
               maxWidth: '400px',
            },
         };

         const toastId = toast(toastComponent, options);
         const timeout = setTimeout(() => this.activeToasts.delete(key), 3000);

         this.activeToasts.set(key, { id: toastId, count, timeout });
      }

      this.toastBatch.clear();
      this.batchTimeout = null;

      notifyToastChange();
   }
}
