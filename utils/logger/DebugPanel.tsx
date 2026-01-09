'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, ScrollShadow, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import {
   Bug,
   X,
   Trash2,
   Maximize2,
   Minimize2,
   Copy,
   Check,
   Info,
   Rocket,
   CheckCircle,
   AlertCircle,
   AlertTriangle,
   FileJson,
   ChevronUp,
   Eye,
   EyeOff,
   ChevronsRight,
   ChevronsLeft,
   Hash,
} from 'lucide-react';
import { storage, globalStorage } from '@/utils/storage';
import { usePermission } from '@/app/admin/_services/usePermission';
import { PERMISSIONS } from '@/app/admin/_services/acl';
import { usePathname } from 'next/navigation';
import MobDtToggle from '@/utils/providers/mobDtToggle';
import { LogItem, LOGGER_NEXT_EVENT } from './Logger';
import { COLOR_MAP } from '@/utils/logger/loggerColors';
import { SettingsPanel } from './SettingsPanel';
import { Settings } from 'lucide-react';

const MAX_LOGS = 200;

interface WindowState {
   x: number;
   y: number;
   width: number;
   height: number;
   isMinimized: boolean;
   isOpen: boolean;
   showSettings: boolean; // Added showSettings
   settingsWidth: number; // Width of settings panel
}

const DEFAULT_STATE: WindowState = {
   x: 30,
   y: 80,
   width: 350,
   height: 450,
   isMinimized: false,
   isOpen: false,
   showSettings: false,
   settingsWidth: 350,
};

export function DebugPanel({ isLocal = false }: { isLocal?: boolean }) {
   const [isMounted, setIsMounted] = useState(false);
   const [isDragging, setIsDragging] = useState(false);

   // Состояние окна (позиция, размер и видимость)
   const [windowState, setWindowState] = useState<WindowState>(DEFAULT_STATE);

   // Рефы для драга и ресайза
   const draggingRef = useRef(false);
   const resizingRef = useRef(false);
   const resizeDirectionRef = useRef<'right' | 'bottom' | 'bottom-right' | null>(null);
   const dragOffsetRef = useRef({ x: 0, y: 0 });
   const startResizeRef = useRef({ w: 0, h: 0, x: 0, y: 0, sw: 0 });

   // Состояние видимости кнопки
   const permission = usePermission();

   // State for Device Toggle Popover
   const [isPopoverOpen, setIsPopoverOpen] = useState(false);
   const [isRefCopied, setIsRefCopied] = useState(false);

   // @ref:f46237 
   // генерация уникального ID для ссылки на комментарий
   const handleCopyRef = () => {
      // Генерируем случайный ID (6 символов hex)
      const randomId = Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0');
      const textToCopy = `// @ref:${randomId} //`;
      
      navigator.clipboard.writeText(textToCopy);
      setIsRefCopied(true);
      setTimeout(() => setIsRefCopied(false), 1500);
   };

   useEffect(() => {
      setIsMounted(true);

      // Восстанавливаем позицию из session Storage
      try {
         const saved = storage.getItem('debug-next-state');
         let parsedState = saved ? JSON.parse(saved) : null;

         // Если сохранения нет ИЛИ оно "пустое" (0,0) -> используем DEFAULT_STATE
         if (!parsedState || (parsedState.y === 0 && parsedState.x === 0)) {
            // Используем DEFAULT_STATE.y как отступ СНИЗУ
            const bottomOffset = DEFAULT_STATE.y; 
            const height = parsedState?.height || DEFAULT_STATE.height;
            
            const calculatedY = typeof window !== 'undefined' 
               ? window.innerHeight - height - bottomOffset 
               : 0;

            setWindowState({ 
               ...DEFAULT_STATE,
               // X берется напрямую из DEFAULT_STATE (или сохраненного, если частичное)
               ...(parsedState || {}),
               // Y вычисляем от низа
               y: calculatedY,
               isMinimized: false
            });
         } else {
            // Обычное восстановление, если есть корректные сохраненные данные
            setWindowState({ ...DEFAULT_STATE, ...parsedState, isMinimized: false });
         }
      } catch (e) {
         // ignore
      }
   }, []);

   // Сохраняем состояние при изменении (с дебаунсом 500мс)
   useEffect(() => {
      if (!isMounted) return;
      const timer = setTimeout(() => {
         storage.setItem('debug-next-state', JSON.stringify(windowState));
      }, 500);
      return () => clearTimeout(timer);
   }, [windowState, isMounted]);

   const showDebugPanel = isLocal || permission.can(PERMISSIONS.SHOW_DEBUG_PANEL);

   const { x, y, width, height, isMinimized, isOpen, showSettings, settingsWidth } = windowState;

   const toggleOpen = () => setWindowState((prev) => ({ ...prev, isOpen: !prev.isOpen }));
   const toggleSettings = useCallback(
      () => setWindowState((prev) => ({ ...prev, showSettings: !prev.showSettings })),
      []
   );
   const onClose = useCallback(
      () => setWindowState((prev) => ({ ...prev, isOpen: false })),
      []
   );

   useEffect(() => {
      // 1. Добавляем стили для body во время драга/ресайза
      if (draggingRef.current) {
         document.body.style.userSelect = 'none';
         document.body.style.cursor = 'grabbing';
      } else if (resizingRef.current) {
         document.body.style.userSelect = 'none';
         // Ставим курсор в зависимости от того, за какую грань тянем
         if (resizeDirectionRef.current === 'right') {
            document.body.style.cursor = 'ew-resize';
         } else if (resizeDirectionRef.current === 'bottom') {
            document.body.style.cursor = 'ns-resize';
         } else {
            document.body.style.cursor = 'nwse-resize';
         }
      } else {
         document.body.style.userSelect = '';
         document.body.style.cursor = '';
      }

      // Cleanup при размонтировании
      return () => {
         document.body.style.userSelect = '';
         document.body.style.cursor = '';
      };
   }, [windowState]); // Перерисовываемся при изменении стейта (он меняется при драге)

   // --- Логика перемещения (Drag) ---
   const handleMouseDown = useCallback((e: React.MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('button')) return;

      draggingRef.current = true;
      setIsDragging(true);
      // Используем ref для актуальных координат, чтобы не зависеть от замыкания,
      // но координаты берем из windowState (который в рендере).
      // Проблема: handleMouseDown мемоизирован? Нет.
      // Лучше брать актуальные координаты из event и offset.
      // Но нам нужно знать текущий X окна.
      // Мы передадим этот handler в Content, но вызывать будем с e.
      
      // ВАЖНО: Мы используем functional update в handleMouseMove, так что start drag offset
      // нужно вычислить правильно.
      // windowState доступен в замыкании (пересоздается при рендере).
      dragOffsetRef.current = {
         x: e.clientX - windowState.x,
         y: e.clientY - windowState.y,
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
   }, [windowState.x, windowState.y]);

   // --- Логика изменения размера (Resize) ---
   const handleResizeMouseDown = (
      e: React.MouseEvent,
      direction: 'right' | 'bottom' | 'bottom-right'
   ) => {
      e.stopPropagation();
      resizingRef.current = true;
      resizeDirectionRef.current = direction;
      startResizeRef.current = {
         w: windowState.width,
         h: windowState.height,
         x: e.clientX,
         y: e.clientY,
         sw: windowState.settingsWidth,
      };

      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
   };

   const handleMouseMove = useCallback((e: MouseEvent) => {
      if (draggingRef.current) {
         setWindowState((prev) => ({
            ...prev,
            x: e.clientX - dragOffsetRef.current.x,
            y: e.clientY - dragOffsetRef.current.y,
         }));
      } else if (resizingRef.current) {
         const deltaX = e.clientX - startResizeRef.current.x;
         const deltaY = e.clientY - startResizeRef.current.y;

         setWindowState((prev) => {
            let newWidth = prev.width;
            let newHeight = prev.height;
            let newSettingsWidth = prev.settingsWidth;

            // Если открыты настройки и тянем вправо - меняем ширину настроек
            if (
               prev.showSettings &&
               (resizeDirectionRef.current === 'right' ||
                  resizeDirectionRef.current === 'bottom-right')
            ) {
               newSettingsWidth = Math.max(250, startResizeRef.current.sw + deltaX);
               // newWidth (Logs) не меняется
            } else {
               // Иначе меняем ширину логов (как раньше)
               if (
                  resizeDirectionRef.current === 'right' ||
                  resizeDirectionRef.current === 'bottom-right'
               ) {
                  newWidth = Math.min(600, Math.max(200, startResizeRef.current.w + deltaX));
               }
            }

            if (
               resizeDirectionRef.current === 'bottom' ||
               resizeDirectionRef.current === 'bottom-right'
            ) {
               newHeight = Math.min(600, Math.max(300, startResizeRef.current.h + deltaY));
            }

            return {
               ...prev,
               width: newWidth,
               height: newHeight,
               settingsWidth: newSettingsWidth,
            };
         });
      }
   }, []);

   const handleMouseUp = useCallback(() => {
      draggingRef.current = false;
      setIsDragging(false);
      resizingRef.current = false;
      resizeDirectionRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);

      // Сбрасываем курсор и выделение принудительно
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
   }, [handleMouseMove]);

   if (!isMounted) return null;
   if (!showDebugPanel) return null;

   return (
      <>
         {/* Main Floating Button Group */}
         <div className="fixed bottom-[60px] left-[20px] z-[9999] flex items-center shadow-lg rounded-full bg-content1 border border-default-200 opacity-50 hover:opacity-100 transition-opacity">
            <Button
               isIconOnly
               className={`bg-transparent min-w-0 w-[32px] h-[32px]`}
               onPress={toggleOpen}
               size="sm"
            >
               <Bug size={18} className="text-secondary" />
            </Button>
            <div className="w-[1px] h-[20px] bg-default-200" />
            <Button
               isIconOnly
               className={`bg-transparent min-w-0 w-[32px] h-[32px]`}
               onPress={handleCopyRef}
               size="sm"
               title="Generate Ref ID"
            >
               {isRefCopied ? (
                  <Check size={18} className="text-success" />
               ) : (
                  <Hash size={18} className="text-default-500" />
               )}
            </Button>
            <div className="w-[1px] h-[20px] bg-default-200" />
            <Popover
               placement="top"
               isOpen={isPopoverOpen}
               onOpenChange={(open) => setIsPopoverOpen(open)}
               shouldCloseOnInteractOutside={() => false}
            >
               <PopoverTrigger>
                  <Button
                     isIconOnly
                     className="bg-transparent min-w-0 w-[32px] h-[32px] rounded-r-full rounded-l-none pl-0 pr-0"
                     size="sm"
                  >
                     <ChevronUp
                        size={18}
                        className={`text-default-500 transition-transform duration-200 ${isPopoverOpen ? 'rotate-180' : ''}`}
                     />
                  </Button>
               </PopoverTrigger>
               <PopoverContent className="p-1">
                  <MobDtToggle />
               </PopoverContent>
            </Popover>
         </div>

         {/* Window Container */}
         {isOpen && (
            <div
               className="fixed z-[9999] bg-content1 border border-default-200 shadow-2xl rounded-lg flex flex-col font-mono overflow-hidden"
               style={{
                  left: x,
                  top: y,
                  width: showSettings ? width + settingsWidth : width,
                  height: isMinimized ? 40 : height,
                  transition:
                     draggingRef.current || resizingRef.current ? 'none' : 'width 0.2s ease, height 0.2s ease',
               }}
            >
               <DebugContent 
                  width={width}
                  isMinimized={isMinimized}
                  showSettings={showSettings}
                  settingsWidth={settingsWidth}
                  onClose={onClose}
                  onToggleSettings={toggleSettings}
                  onHeaderMouseDown={handleMouseDown}
                  isDragging={isDragging}
               />

               {/* Resizers (Position depends on container size) */}
               {!isMinimized && (
                  <>
                     <div
                        className="absolute top-0 right-0 w-[6px] h-full z-20 bg-transparent hover:bg-primary/50 transition-colors"
                        style={{ cursor: 'ew-resize' }}
                        onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
                     />
                     <div
                        className="absolute bottom-0 left-0 w-full h-[6px] z-20 bg-transparent hover:bg-primary/50 transition-colors"
                        style={{ cursor: 'ns-resize' }}
                        onMouseDown={(e) => handleResizeMouseDown(e, 'bottom')}
                     />
                     <div
                        className="absolute bottom-0 right-0 w-[20px] h-[20px] z-30 group/bottom-right"
                        style={{ cursor: 'nwse-resize' }}
                        onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-right')}
                     >
                        <div
                           className="absolute bottom-0 right-0 w-[20px] h-[20px] bg-transparent group-hover/bottom-right:bg-primary/50 transition-colors"
                           style={{
                              clipPath: 'polygon(100% 100%, 0 100%, 100% 0)',
                              borderBottomRightRadius: '8px',
                           }}
                        />
                     </div>
                  </>
               )}
            </div>
         )}
      </>
   );
}

// --- Inner Content Component (Memoized) ---

interface DebugContentProps {
   width: number;
   isMinimized: boolean;
   showSettings: boolean;
   settingsWidth: number;
   onClose: () => void;
   onToggleSettings: () => void;
   onHeaderMouseDown: (e: React.MouseEvent) => void;
   isDragging: boolean;
}

const DebugContent = React.memo(function DebugContent({
   width,
   isMinimized,
   showSettings,
   settingsWidth,
   onClose,
   onToggleSettings,
   onHeaderMouseDown,
   isDragging
}: DebugContentProps) {
   const [logs, setLogs] = useState<LogItem[]>([]);
   const [showData, setShowData] = useState(false);
   const [isCopiedAll, setIsCopiedAll] = useState(false);
   const [isAtTop, setIsAtTop] = useState(true);
   
   const logsTopRef = useRef<HTMLDivElement>(null);
   const bottomRef = useRef<HTMLDivElement>(null);

   // Подписка на логи
   useEffect(() => {
      const handleLog = (event: Event) => {
         const customEvent = event as CustomEvent<LogItem>;
         const log = customEvent.detail;

         setLogs((prev) => {
            const newLogs = [...prev, log];
            if (newLogs.length > MAX_LOGS) {
               return newLogs.slice(newLogs.length - MAX_LOGS);
            }
            return newLogs;
         });
      };

      window.addEventListener(LOGGER_NEXT_EVENT, handleLog);
      return () => window.removeEventListener(LOGGER_NEXT_EVENT, handleLog);
   }, []);

   // Auto-scroll
   useEffect(() => {
      if (!isMinimized && bottomRef.current) {
         bottomRef.current.scrollIntoView({ behavior: 'smooth' });
      }
   }, [logs, isMinimized, showData]);

   const clearLogs = () => setLogs([]);

   return (
      <div className="flex flex-1 overflow-hidden h-full">
         {/* Logs Area */}
         <div 
            className="flex flex-col overflow-hidden relative border-r border-default-200 bg-content1"
            style={{ width: width, minWidth: width }}
         >
            {/* Header (Draggable) */}
            <div 
               className="flex items-center justify-between h-[36px] px-2 py-1 bg-content2 border-b border-default-200 cursor-grab active:cursor-grabbing select-none shrink-0"
               onMouseDown={onHeaderMouseDown}
               onDoubleClick={onClose}
            >
               <div className="flex items-center gap-2  pointer-events-none">
                  <Bug size={14} className="text-secondary" />
                  <span className="text font-medium text-foreground">
                     NextLogs ({logs.length})
                  </span>
               </div>

               <div className="flex items-center gap-1">
                  <button
                     onClick={() => {
                        const text = logs
                           .map((log) => {
                              const time = new Date(log.timestamp).toLocaleTimeString('ru-RU', {
                                 hour: '2-digit',
                                 minute: '2-digit',
                                 second: '2-digit',
                                 fractionalSecondDigits: 3,
                              });
                              const countStr = log.count > 1 ? ` (x${log.count})` : '';
                              return `[${time}] [${log.componentName}] ${log.message}${countStr} ${log.data ? JSON.stringify(log.data) : ''}`;
                           })
                           .join('\n');
                        navigator.clipboard.writeText(text);
                        setIsCopiedAll(true);
                        setTimeout(() => setIsCopiedAll(false), 1500);
                     }}
                     className="p-1 hover:bg-default-200 rounded text-default-400 hover:text-foreground transition-colors cursor-pointer"
                     title="Copy All"
                  >
                     {isCopiedAll ? (
                        <Check size={14} className="text-success" />
                     ) : (
                        <Copy size={14} />
                     )}
                  </button>
                  <button
                     onClick={clearLogs}
                     className="p-1 hover:bg-red-200 hover:text-red-500 rounded text-default-400 hover:text-foreground transition-colors cursor-pointer"
                     title="Clear"
                  >
                     <Trash2 size={14} />
                  </button>

                  <button 
                     onClick={onToggleSettings} 
                     className={`p-1 hover:bg-default-200 rounded transition-colors cursor-pointer ${showSettings ? 'text-primary' : 'text-default-400'}`}
                     title={showSettings ? "Hide Settings" : "Show Settings"}
                  >
                     {showSettings ? <ChevronsLeft size={18} /> : <ChevronsRight size={18} />}
                  </button>
               </div>
            </div>

            {/* Content */}
            {!isMinimized && (
               <>
                  <div className="w-full h-4 bg-gradient-to-b from-content1 to-transparent gap-1 z-10 pointer-events-none -mb-4 relative shrink-0" />

                  <div 
                     className="flex-1 overflow-y-auto p-[6px] flex flex-col gap-1 bg-content1 relative"
                     onScroll={(e) => {
                        const target = e.target as HTMLDivElement;
                        const isTop = target.scrollTop < 20;
                        setIsAtTop(isTop);
                     }}
                  >
                     <div ref={logsTopRef} />
                     {logs.length === 0 && (
                        <div className="text-center text-default-400 text-xs py-10 italic">
                           No Next logs yet...
                        </div>
                     )}
                     {logs.map((log, idx) => (
                        <ConsoleLogItem
                           key={`${log.timestamp}-${idx}`}
                           log={log}
                           showData={showData}
                        />
                     ))}
                     <div ref={bottomRef} />
                  </div>
               </>
            )}
         </div>

         {/* Settings Panel */}
         {!isMinimized && showSettings && <SettingsPanel width={settingsWidth} isDragging={isDragging} />}
      </div>
   );
});

const ConsoleLogItem = React.memo(function ConsoleLogItem({ log, showData }: { log: LogItem; showData: boolean }) {
   const [isCopied, setIsCopied] = useState(false);
   const [localShowData, setLocalShowData] = useState(false);

   const shouldShowData = showData || localShowData;

   const time = new Date(log.timestamp).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
   });

   const methodIcons = {
      info: Info,
      start: Rocket,
      end: CheckCircle,
      success: CheckCircle,
      error: AlertCircle,
      warning: AlertTriangle,
   };

   const methodColors = {
      info: 'text-default-500',
      start: 'text-orange-400',
      end: 'text-green-600',
      success: 'text-green-600',
      error: 'text-red-500',
      warning: 'text-yellow-500',
   };

   const Icon = methodIcons[log.level] || Info;
   const iconColor = methodColors[log.level] || 'text-default-500';

   const logColorHex = log.logColor ? COLOR_MAP[log.logColor] || '#ccc' : '#444';
   const componentColorHex = log.componentColor ? COLOR_MAP[log.componentColor] || '#ccc' : '#888';

   const copyLog = (e: React.MouseEvent) => {
      e.stopPropagation();
      const countStr = log.count > 1 ? ` (x${log.count})` : '';
      const text = `[${time}] [${log.componentName}] ${log.message}${countStr} ${log.data ? JSON.stringify(log.data) : ''}`;
      navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
   };

   const logContent = (
      <div
         className={`relative rounded-lg p-1 transition-colors text-left group bg-content2 ${
            !log.logColor || log.logColor === 'black' ? '' : ''
         } ${log.data ? 'cursor-pointer hover:bg-default-100' : ''}`}
         onClick={() => log.data && setLocalShowData(!localShowData)}
         style={{
            fontSize: '12px',
            borderStyle: 'solid',
            borderWidth: '1px',
            borderColor: log.logColor && log.logColor !== 'black' ? logColorHex : '#e5e7eb',
            ...(log.logColor && log.logColor !== 'black'
               ? {
                    borderLeftWidth: '1px',
                    borderLeftColor: logColorHex,
                 }
               : {}),
         }}
      >
         <button
            onClick={copyLog}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-default-200/50 hover:bg-default-300 rounded text-default-500 hover:text-foreground z-10 cursor-pointer"
         >
            {isCopied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
         </button>

         <div className="flex items-center gap-1">
            <span className="font-medium" style={{ color: componentColorHex }}>
               [{log.componentName}]
            </span>
            <Icon size={14} className={iconColor} style={{ marginTop: '0px' }} />
            {log.count > 1 && (
               <span className="bg-default-100 text-default-600 px-1 rounded text-[9px] font-bold">
                  x{log.count}
               </span>
            )}
            {log.data && !shouldShowData && (
               <FileJson size={14} className="text-default-400 ml-1" />
            )}
         </div>

         <div className="text-default-700">{log.message}</div>

         {shouldShowData && log.data && (
            <div
               className="mt-1 font-mono text-[10px] whitespace-pre-wrap overflow-x-auto text-default-500"
               onClick={(e) => e.stopPropagation()}
            >
               {JSON.stringify(log.data, null, 2)
                  .replace(/^\{\n/, '')
                  .replace(/\n\}$/, '')
                  .replace(/^  /gm, '')}
            </div>
         )}
      </div>
   );

   return logContent;
});
