'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button, ScrollShadow, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { Bug, X, Trash2, Maximize2, Minimize2, Copy, Check, Info, Rocket, CheckCircle, AlertCircle, AlertTriangle, FileJson, ChevronUp, Eye, EyeOff } from 'lucide-react';
import { subscribeToDebugLogs, DebugLogItem, LogLevel } from './PageLogger';
import { COLOR_MAP, convertTailwindToCSS } from './services/loggerColors';
import { globalStorage } from '@/utils/storage';
import { usePermission } from '@/app/admin/_services/usePermission';
import { PERMISSIONS } from '@/app/admin/_services/acl';
import { usePathname } from 'next/navigation';
import MobDtToggle from '@/utils/providers/mobDtToggle';

const MAX_LOGS = 200;

interface WindowState {
   x: number;
   y: number;
   width: number;
   height: number;
   isMinimized: boolean;
   isOpen: boolean;
}

const DEFAULT_STATE: WindowState = {
   x: 100,
   y: 100,
   width: 600,
   height: 400,
   isMinimized: false,
   isOpen: false,
};

export function DebugConsole({ isLocal = false }: { isLocal?: boolean }) {
   const [logs, setLogs] = useState<DebugLogItem[]>([]);
   const logsTopRef = useRef<HTMLDivElement>(null);
   const [isAtTop, setIsAtTop] = useState(true);
   const [isMounted, setIsMounted] = useState(false);
   
   // Состояние окна (позиция, размер и видимость)
   const [windowState, setWindowState] = useState<WindowState>(DEFAULT_STATE);
   
   // Рефы для драга и ресайза
   const draggingRef = useRef(false);
   const resizingRef = useRef(false);
   const resizeDirectionRef = useRef<'right' | 'bottom' | 'bottom-right' | null>(null);
   const dragOffsetRef = useRef({ x: 0, y: 0 });
   const startResizeRef = useRef({ w: 0, h: 0, x: 0, y: 0 });

   // Состояние видимости кнопки
   const permission = usePermission();
   const isSuperAdmin = permission?.roleData?.isSuperAdmin ?? false;
   
   const pathname = usePathname();
   const [showDevInfo, setShowDevInfo] = useState(false);
   
   // State for Device Toggle Popover
   const [isPopoverOpen, setIsPopoverOpen] = useState(false);

   useEffect(() => {
      setIsMounted(true);
      
      // Восстанавливаем позицию из local Storage
      try {
         const saved = globalStorage.getItem('debug-console-state');
         if (saved) {
            setWindowState({ ...DEFAULT_STATE, ...JSON.parse(saved) });
         }
      } catch (e) {
         // ignore
      }
   }, []);

   // Сохраняем состояние при изменении (с дебаунсом 500мс)
   useEffect(() => {
      if (!isMounted) return;
      const timer = setTimeout(() => {
         globalStorage.setItem('debug-console-state', JSON.stringify(windowState));
      }, 500);
      return () => clearTimeout(timer);
   }, [windowState, isMounted]);

   // Слушаем настройки из localS torage (от SettingsProvider)
   useEffect(() => {
      const checkDevInfo = () => {
         try {
            const saved = globalStorage.getItem('global-show-dev-info');
            setShowDevInfo(saved ? JSON.parse(saved) : false);
         } catch {
            setShowDevInfo(false);
         }
      };

      checkDevInfo();

      const handleStorage = (e: StorageEvent | Event) => {
         if (e instanceof StorageEvent && e.key !== 'global-show-dev-info' && e.key !== null) return;
         checkDevInfo();
      };

      window.addEventListener('storage', handleStorage);
      return () => window.removeEventListener('storage', handleStorage);
   }, []);

   const showDebugPanel = isLocal || permission.can(PERMISSIONS.SHOW_DEBUG_PANEL);

   useEffect(() => {
      if (!showDebugPanel) return;
      const unsubscribe = subscribeToDebugLogs((log) => {
         setLogs((prev) => {
            const newLogs = [log, ...prev]; // Новые сверху
            if (newLogs.length > MAX_LOGS) {
               return newLogs.slice(0, MAX_LOGS);
            }
            return newLogs;
         });
      });
      return () => unsubscribe();
   }, [showDebugPanel]);

   const { x, y, width, height, isMinimized, isOpen } = windowState;

   const [showData, setShowData] = useState(false);
   const [isCopiedAll, setIsCopiedAll] = useState(false);

   useEffect(() => {
      if (isOpen && isAtTop && logsTopRef.current && !isMinimized) {
         logsTopRef.current.scrollIntoView({ behavior: 'smooth' });
      }
   }, [logs, isOpen, isAtTop, isMinimized, showData]); // Added showData dependency

   const clearLogs = () => setLogs([]);
   const toggleOpen = () => setWindowState(prev => ({ ...prev, isOpen: !prev.isOpen }));

   // --- Логика перемещения (Drag) ---
   const handleMouseDown = (e: React.MouseEvent) => {
      if (e.target instanceof Element && e.target.closest('button')) return; // Не драгаем за кнопки
      
      draggingRef.current = true;
      dragOffsetRef.current = {
         x: e.clientX - windowState.x,
         y: e.clientY - windowState.y,
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
   };

   // --- Логика изменения размера (Resize) ---
   const handleResizeMouseDown = (e: React.MouseEvent, direction: 'right' | 'bottom' | 'bottom-right') => {
      e.stopPropagation();
      resizingRef.current = true;
      resizeDirectionRef.current = direction;
      startResizeRef.current = {
         w: windowState.width,
         h: windowState.height,
         x: e.clientX,
         y: e.clientY,
      };
      
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
   };

   const handleMouseMove = useCallback((e: MouseEvent) => {
      if (draggingRef.current) {
         setWindowState(prev => ({
            ...prev,
            x: e.clientX - dragOffsetRef.current.x,
            y: e.clientY - dragOffsetRef.current.y,
         }));
      } else if (resizingRef.current) {
         const deltaX = e.clientX - startResizeRef.current.x;
         const deltaY = e.clientY - startResizeRef.current.y;
         
         setWindowState(prev => {
            let newWidth = prev.width;
            let newHeight = prev.height;

            if (resizeDirectionRef.current === 'right' || resizeDirectionRef.current === 'bottom-right') {
                newWidth = Math.max(300, startResizeRef.current.w + deltaX);
            }
            if (resizeDirectionRef.current === 'bottom' || resizeDirectionRef.current === 'bottom-right') {
                newHeight = Math.max(100, startResizeRef.current.h + deltaY);
            }
            
            return {
                ...prev,
                width: newWidth,
                height: newHeight
            };
         });
      }
   }, []);

   const handleMouseUp = useCallback(() => {
      draggingRef.current = false;
      resizingRef.current = false;
      resizeDirectionRef.current = null;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
   }, [handleMouseMove]);


   if (!isMounted) return null;
   if (!showDebugPanel) return null;

   return (
      <>
          {/* Main Floating Button Group */}
          <div 
             className="fixed bottom-[70px] left-[6px] z-[9999] flex items-center shadow-lg rounded-full bg-content1 border border-default-200 opacity-50 hover:opacity-100 transition-opacity"
          >
             {/* 1. Main Toggle Button */}
          <Button
            isIconOnly
               className={`bg-transparent min-w-0 w-[32px] h-[32px]`}
            onPress={toggleOpen}
            size="sm"
         >
            <Bug size={18} className="text-foreground" />
         </Button>

      
                  <div className="w-[1px] h-[20px] bg-default-200" /> {/* Divider */}
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

         {/* Window is rendered if isOpen is true */}
         {isOpen && (
            <div 
               className="fixed z-[9999] bg-content1 border border-default-200 shadow-2xl rounded-lg flex flex-col font-mono overflow-hidden"
               style={{
                  left: x,
                  top: y,
                  width: width,
                  height: isMinimized ? 40 : height,
                  transition: draggingRef.current || resizingRef.current ? 'none' : 'height 0.2s ease', // Анимация только для сворачивания
               }}
            >
               {/* Header (Draggable) */}
               <div 
                  className="flex items-center justify-between px-2 py-1 bg-content2 border-b border-default-200 rounded-t-lg cursor-grab active:cursor-grabbing select-none"
                  onMouseDown={handleMouseDown}
                  onDoubleClick={() => setWindowState(prev => ({ ...prev, isMinimized: !prev.isMinimized }))}
               >
                  <div className="flex items-center gap-2 pointer-events-none">
                     <Bug size={14} className="text-primary" />
                     <span className="text font-medium text-foreground">Logs ({logs.length})</span>
                  </div>

                  <div className="flex items-center gap-1">
                     <button 
                        onClick={() => setShowData(!showData)} 
                        className={`p-1 hover:bg-default-200 rounded transition-colors cursor-pointer ${showData ? 'text-primary' : 'text-default-400'}`}
                        title={showData ? "Hide Data" : "Show Data"}
                     >
                        {showData ? <Eye size={14} /> : <EyeOff size={14} />}
                     </button>
                     <button 
                        onClick={() => {
                           const text = logs.map(log => {
                              const time = new Date(log.timestamp).toLocaleTimeString('ru-RU', {
                                 hour: '2-digit',
                                 minute: '2-digit',
                                 second: '2-digit',
                                 fractionalSecondDigits: 3,
                              });
                              const countStr = log.count > 1 ? ` (x${log.count})` : '';
                              return `[${time}] [${log.componentName}] ${log.message}${countStr} ${log.data ? JSON.stringify(log.data) : ''}`;
                           }).join('\n');
                           navigator.clipboard.writeText(text);
                           setIsCopiedAll(true);
                           setTimeout(() => setIsCopiedAll(false), 1500);
                        }}
                        className="p-1 hover:bg-default-200 rounded text-default-400 hover:text-foreground transition-colors cursor-pointer"
                        title="Copy All"
                     >
                        {isCopiedAll ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                     </button>
                     <button 
                        onClick={() => clearLogs()} 
                        className="p-1 hover:bg-default-200 rounded text-default-400 hover:text-foreground transition-colors cursor-pointer"
                        title="Clear"
                     >
                        <Trash2 size={14} />
                     </button>
                     <button 
                        onClick={() => setWindowState(prev => ({ ...prev, isMinimized: !prev.isMinimized }))} 
                        className="hidden p-1 hover:bg-default-200 rounded text-default-400 hover:text-foreground transition-colors cursor-pointer"
                     >
                        {isMinimized ? <Maximize2 size={14} /> : <Minimize2 size={12} />}
                     </button>
                     <button 
                        onClick={toggleOpen} 
                        className="p-1 hover:bg-default-200 rounded text-default-400 hover:text-danger transition-colors cursor-pointer"
                     >
                        <X size={16} />
                     </button>
                  </div>
               </div>

               {/* Content */}
               {!isMinimized && (
                  <>
                     <ScrollShadow 
                        className="flex-1 overflow-y-auto p-[5px] space-y-1 bg-content1"
                        onScroll={(e) => {
                           const target = e.target as HTMLDivElement;
                           const isTop = target.scrollTop < 20;
                           setIsAtTop(isTop);
                        }}
                     >
                        <div ref={logsTopRef} />
                        {logs.length === 0 && (
                           <div className="text-center text-default-400 text-xs py-10 italic">
                              No logs yet...
                           </div>
                        )}
                        {logs.map((log, idx) => (
                           <ConsoleLogItem key={`${log.timestamp}-${idx}`} log={log} showData={showData} />
                        ))}
                     </ScrollShadow>

                     {/* Resize Handle (Right) */}
                     <div
                        className="absolute top-0 right-0 w-[6px] h-full cursor-e-resize z-20 hover:bg-default-200/50"
                        onMouseDown={(e) => handleResizeMouseDown(e, 'right')}
                     />

                     {/* Resize Handle (Bottom) */}
                     <div
                        className="absolute bottom-0 left-0 w-full h-[6px] cursor-s-resize z-20 hover:bg-default-200/50"
                        onMouseDown={(e) => handleResizeMouseDown(e, 'bottom')}
                     />

                     {/* Resize Handle (Bottom Right) */}
                     <div
                        className="absolute bottom-0 right-0 w-[20px] h-[20px] cursor-nwse-resize z-30 group/bottom-right"
                        onMouseDown={(e) => handleResizeMouseDown(e, 'bottom-right')}
                     >
                         <div 
                           className="absolute bottom-0 right-0 w-[20px] h-[20px] bg-transparent group-hover/bottom-right:bg-default-400/20 transition-colors"
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

function ConsoleLogItem({ log, showData }: { log: DebugLogItem, showData: boolean }) {
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

   // Цвета
   const logColorHex = log.logColor ? (COLOR_MAP[log.logColor] || '#ccc') : '#444';
   const componentColorHex = log.componentColor ? (COLOR_MAP[log.componentColor] || '#ccc') : '#888';

   const copyLog = (e: React.MouseEvent) => {
      e.stopPropagation();
      const countStr = log.count > 1 ? ` (x${log.count})` : '';
      const text = `[${time}] [${log.componentName}] ${log.message}${countStr} ${log.data ? JSON.stringify(log.data) : ''}`;
      navigator.clipboard.writeText(text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 1500);
   };

   // Основной контент лога (Compact View)
   const logContent = (
      <div 
         className={`relative rounded-lg p-1 transition-colors text-left group bg-content2 ${
            !log.logColor || log.logColor === 'black' ? 'border border-default-200' : ''
         } ${log.data ? 'cursor-pointer hover:bg-default-100' : ''}`}
         onClick={() => log.data && setLocalShowData(!localShowData)}
         style={{ 
            fontSize: '12px',
            borderLeftWidth: log.logColor && log.logColor !== 'black' ? '2px' : '1px',
            borderLeftColor: logColorHex,
            borderTopWidth: log.logColor && log.logColor !== 'black' ? '1px' : '1px',
            borderRightWidth: log.logColor && log.logColor !== 'black' ? '1px' : '1px',
            borderBottomWidth: log.logColor && log.logColor !== 'black' ? '1px' : '1px',
            borderColor: log.logColor && log.logColor !== 'black' ? logColorHex : undefined,
         }}
      >
         {/* Copy Button (on hover) */}
         <button 
            onClick={copyLog}
            className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity p-1 bg-default-200/50 hover:bg-default-300 rounded text-default-500 hover:text-foreground z-10 cursor-pointer"
         >
            {isCopied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
         </button>

         {/* Первая строка: [Component] Icon (line) (count) [data icon] */}
         <div className="flex items-center gap-1">
            <span 
               className="font-medium" 
               style={{ color: componentColorHex }}
            >
               [{log.componentName}]
            </span>
            <Icon size={14} className={iconColor} style={{ marginTop: '0px' }} />
            {/* line removed */}
            {log.count > 1 && (
               <span className="bg-default-100 text-default-600 px-1 rounded text-[9px] font-bold">x{log.count}</span>
            )}
            {log.data && !shouldShowData && (
               <FileJson size={14} className="text-default-400 ml-1" />
            )}
         </div>

         {/* Вторая строка: Message */}
         <div className="text-default-700">
            {log.message}
         </div>

         {/* Третья строка: Data (если включено или развернуто) */}
         {shouldShowData && log.data && (
            <div className="mt-1 font-mono text-[10px] whitespace-pre-wrap overflow-x-auto text-default-500" onClick={(e) => e.stopPropagation()}>
               {JSON.stringify(log.data, null, 2)
                  .replace(/^\{\n/, '') // Remove opening brace + newline
                  .replace(/\n\}$/, '') // Remove closing brace + newline
                  .replace(/^  /gm, '') // Remove first level of indentation
               }
            </div>
         )}
      </div>
   );

   return logContent;
}
