'use client';

import React, { useState } from 'react';
import { Chip, Popover, PopoverTrigger, PopoverContent, Switch } from '@heroui/react';
import { X, Pin, File, GripVertical } from 'lucide-react';
import clsx from 'clsx';
import type { LoggerInfo, LoggerConfig, LoggerCallInfo } from './FileTreeUtils';
import { AVAILABLE_COLORS } from '@/utils/logger/services/loggerColors';
import { createLogger } from '@/utils/logger/Logger';
import { useLoggerContext } from '@/utils/logger/LogsManager/LoggerContext';

const logger = createLogger('PinnedComponentsBar');
import {
   DndContext,
   closestCenter,
   KeyboardSensor,
   PointerSensor,
   useSensor,
   useSensors,
   DragEndEvent,
   DragStartEvent,
   DragOverlay,
   defaultDropAnimationSideEffects,
} from '@dnd-kit/core';
import {
   arrayMove,
   SortableContext,
   sortableKeyboardCoordinates,
   useSortable,
   verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// Sortable Item Component для pinned компонентов
function SortablePinnedItem({
   id,
   children,
}: {
   id: string;
   children: (listeners: any) => React.ReactNode;
}) {
   const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id,
   });

   const style = {
      transform: CSS.Transform.toString(transform),
      transition,
      opacity: isDragging ? 0.5 : 1,
   };

   return (
      <div ref={setNodeRef} style={style} {...attributes}>
         {children(listeners)}
      </div>
   );
}

export function PinnedComponentsBar() {
   const {
      pinnedComponents: pinnedKeys,
   loggers,
   loggerCalls,
   loggerConfigs,
   selectedComponent,
      handleSelectComponent: onSelectComponent,
      togglePin: onUnpin,
   updateLoggerConfig,
   getLoggerKey,
   getLoggerCallConfigKey,
   getLoggerCallsCount,
   pinnedComponentsSwitchers,
   setPinnedComponentsSwitchers,
   lastViewedTimestamp,
   componentLastViewed,
   setComponentLastViewed,
   pinnedComponentsOrder,
   setPinnedComponentsOrder,
      handleRenameLogger: onRenameLogger,
   } = useLoggerContext();

   // ❗ ВАЖНО: Все хуки должны быть вызваны ПЕРЕД любым условным return
   // Это правило React Hooks - количество хуков должно быть одинаковым при каждом рендере
   const [openPopover, setOpenPopover] = useState<string | null>(null);
   const [activeId, setActiveId] = useState<string | null>(null);
   const [renamingKey, setRenamingKey] = useState<string | null>(null);
   const [newName, setNewName] = useState('');
   
   // Sensors для drag and drop - ДОЛЖНЫ быть вызваны перед return null
   const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, {
         coordinateGetter: sortableKeyboardCoordinates,
      })
   );
   
   // Если нет закрепленных компонентов, не показываем панель
   // ❗ Early return ПОСЛЕ всех хуков
   if (pinnedKeys.length === 0) {
      return null;
   }

   // Получаем данные о закрепленных компонентах
   const pinnedLoggers = pinnedKeys
      .map(key => {
         const foundLogger = loggers.find(l => getLoggerKey(l) === key);
         const found = foundLogger ? { key, logger: foundLogger } : null;
         
         if (!found) {
            logger.error('🔴 Key NOT FOUND in loggers', {
               key,
               availableKeys: loggers.map(l => getLoggerKey(l))
            });
         } else {
            logger.info('🟢 Key found', { key });
         }
         
         return found;
      })
      .filter((item): item is { key: string; logger: LoggerInfo } => item !== null);
   
   logger.info('🔵 Final pinnedLoggers', {
      pinnedKeys,
      pinnedLoggersCount: pinnedLoggers.length,
      loggersCount: loggers.length,
      allAvailableLoggers: loggers.map(l => getLoggerKey(l))
   });
   
   // Синхронизируем порядок: добавляем недостающие ключи в конец
   const actualOrder = [...pinnedComponentsOrder];
   pinnedLoggers.forEach(({ key }) => {
      if (!actualOrder.includes(key)) {
         actualOrder.push(key);
      }
   });
   // Удаляем ключи которых больше нет в pinnedKeys
   const syncedOrder = actualOrder.filter(key => pinnedKeys.includes(key));
   
   // Сортируем по синхронизированному порядку
   const sortedPinnedLoggers = [...pinnedLoggers].sort((a, b) => {
      const indexA = syncedOrder.indexOf(a.key);
      const indexB = syncedOrder.indexOf(b.key);
      return indexA - indexB;
   });

   // Обработчик начала drag
   const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
   };

   // Обработчик завершения drag
   const handleDragEnd = (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
         // Используем текущий список ключей для поиска индексов
         const currentKeys = sortedPinnedLoggers.map(item => item.key);
         const oldIndex = currentKeys.indexOf(active.id as string);
         const newIndex = currentKeys.indexOf(over.id as string);

         if (oldIndex !== -1 && newIndex !== -1) {
            const newOrder = arrayMove(currentKeys, oldIndex, newIndex);
            setPinnedComponentsOrder(newOrder);
         }
      }

      setActiveId(null);
   };

   return (
      <div>
         <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
         >
            <SortableContext
               items={sortedPinnedLoggers.map(({ key }) => key)}
               strategy={verticalListSortingStrategy}
            >
               <div className="flex flex-col gap-1.5">
                  {sortedPinnedLoggers.map(({ key, logger }) => {
               const config = loggerConfigs[key] || { enabled: true, color: 'blue' };
               
               // Считаем включенные логи для этого компонента (ТОЧНО ТАК ЖЕ КАК В ДЕРЕВЕ)
               const componentCalls = loggerCalls.filter(
                  call => call.componentName === logger.name && 
                          call.file === logger.file
               );
               const enabledCount = componentCalls.filter(call => {
                  const configKey = getLoggerCallConfigKey(call);
                  return loggerConfigs[configKey]?.enabled;
               }).length;
               const totalCount = componentCalls.length;
               
               // Проверяем есть ли новые (непрочитанные) логи
               // Используем componentLastViewed для этого компонента или fallback на lastViewedTimestamp
               const componentKey = `${logger.name}:${logger.file}`;
               const componentTimestamp = componentLastViewed[componentKey] || lastViewedTimestamp;
               
               const newLogs = componentCalls.filter((call) => {
                  const configKey = getLoggerCallConfigKey(call);
                  const config = loggerConfigs[configKey];
                  const createdAt = config?.createdAt || 0;
                  return createdAt > componentTimestamp;
               });
               const newCount = newLogs.length;
               const hasNewLogs = newCount > 0;
               
               const isSelected = selectedComponent?.name === logger.name && 
                                 selectedComponent?.file === logger.file;
               
               // Chip кликабельный только если компонент выделен И есть новые логи
               const isChipClickable = isSelected && hasNewLogs;
               
               // Проверяем есть ли дубликаты (логи с одинаковым configKey)
               const configKeysCount = new Map<string, number>();
               componentCalls.forEach((call) => {
                  const configKey = getLoggerCallConfigKey(call);
                  configKeysCount.set(configKey, (configKeysCount.get(configKey) || 0) + 1);
               });
               const hasDuplicates = Array.from(configKeysCount.values()).some(count => count > 1);
               
               // Определяем цвет чипа: новые - желтый, все включены - зеленый, часть - синий, все выкл - серый
               let chipClass = 'bg-default-100 text-default-600';
               if (hasNewLogs) {
                  chipClass = 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400';
               } else if (enabledCount === totalCount && totalCount > 0) {
                  chipClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
               } else if (enabledCount > 0) {
                  chipClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
               }

               return (
                  <SortablePinnedItem key={key} id={key}>
                     {(listeners: any) => (
                        <div
                           className={clsx(
                              'flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer transition-all border',
                              isSelected 
                                 ? 'bg-default-100 border-primary-500 dark:border-primary-400 dark:bg-default-200' 
                                 : 'bg-default-100 border-transparent dark:bg-default-200 hover:bg-default-200 dark:hover:bg-default-300'
                           )}
                           onClick={() => onSelectComponent({ name: logger.name, file: logger.file })}
                        >
                           {/* Drag handle */}
                           <div {...listeners} className="cursor-grab active:cursor-grabbing">
                              <GripVertical size={14} className="text-default-400" />
                           </div>

                           {/* Иконка файла с цветом компонента + Popover для выбора цвета */}
                     <Popover
                        placement="bottom"
                        isOpen={openPopover === key}
                        onOpenChange={(open) => setOpenPopover(open ? key : null)}
                     >
                        <PopoverTrigger>
                           <div
                              className="cursor-pointer hover:scale-110 transition-transform"
                              onClick={(e) => e.stopPropagation()}
                           >
                              <File
                                 size={16}
                                 className={`shrink-0 ${
                                    AVAILABLE_COLORS.find((c) => c.key === config.color)?.iconClass ||
                                    'text-default-400'
                                 }`}
                                 fill="currentColor"
                                 fillOpacity={0.2}
                              />
                           </div>
                        </PopoverTrigger>
                        <PopoverContent className="p-2">
                           <div className="grid grid-cols-5 gap-2">
                              {AVAILABLE_COLORS.map((color) => (
                                 <button
                                    key={color.key}
                                    onClick={() => {
                                       updateLoggerConfig(logger, { color: color.key });
                                       setOpenPopover(null);
                                    }}
                                    className={`w-6 h-6 rounded-full ${color.class} hover:scale-110 cursor-pointer transition-transform ${
                                       config.color === color.key
                                          ? 'ring-2 ring-offset-2 ring-primary'
                                          : ''
                                    }`}
                                    title={color.label}
                                 />
                              ))}
                           </div>
                        </PopoverContent>
                     </Popover>
                     
                     {/* Имя компонента + путь */}
                     <div className="flex items-center gap-2 flex-1 min-w-0">
                        {renamingKey === key ? (
                           <input
                              type="text"
                              value={newName}
                              onChange={(e) => setNewName(e.target.value)}
                              onBlur={async () => {
                                 if (newName && newName !== logger.name) {
                                    await onRenameLogger(logger.file, logger.name, newName);
                                 }
                                 setRenamingKey(null);
                                 setNewName('');
                              }}
                              onKeyDown={async (e) => {
                                 if (e.key === 'Enter' && newName && newName !== logger.name) {
                                    await onRenameLogger(logger.file, logger.name, newName);
                                    setRenamingKey(null);
                                    setNewName('');
                                 } else if (e.key === 'Escape') {
                                    setRenamingKey(null);
                                    setNewName('');
                                 }
                              }}
                              autoFocus
                              className="font-medium text-foreground px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary flex-1 min-w-0"
                              onClick={(e) => e.stopPropagation()}
                           />
                        ) : (
                           <span 
                              className="font-medium text-foreground truncate"
                              onDoubleClick={(e) => {
                                 e.stopPropagation();
                                 onSelectComponent({ name: logger.name, file: logger.file });
                                 setNewName(logger.name);
                                 setRenamingKey(key);
                              }}
                              title="Двойной клик для переименования"
                           >
                              {logger.name}
                           </span>
                        )}
                        {/* <span className="text-[14px] text-default-400 truncate">
                           {logger.file.replace(/^\/app\//, '').replace(/^app\//, '')}
                        </span> */}
                     </div>
                     
                     {/* Счетчик логов */}
                     <Chip 
                        size="sm" 
                        className={clsx(
                           chipClass,
                           'shrink-0',
                           isChipClickable && 'cursor-pointer hover:opacity-80 transition-opacity',
                           hasDuplicates && 'ring-2 ring-warning-500'
                        )}
                        onClick={
                           isChipClickable
                              ? (e) => {
                                    e.stopPropagation();
                                    // Помечаем логи этого компонента как прочитанные
                                    setComponentLastViewed((prev) => ({
                                       ...prev,
                                       [componentKey]: Date.now(),
                                    }));
                                 }
                              : undefined
                        }
                     >
                        {enabledCount}/{totalCount}
                        {newCount > 0 && <span className="font-semibold"> (+{newCount})</span>}
                     </Chip>
                     
                     {/* Switch для pinned компонента */}
                     <Switch
                        size="sm"
                        color={pinnedComponentsSwitchers[key] !== false ? 'success' : 'default'}
                        className="scale-60"
                        classNames={{
                           wrapper: pinnedComponentsSwitchers[key] !== false ? undefined : 'bg-danger-200',
                        }}
                        isSelected={pinnedComponentsSwitchers[key] !== false}
                        onValueChange={(checked) => {
                           setPinnedComponentsSwitchers((prev) => ({
                              ...prev,
                              [key]: checked,
                           }));
                        }}
                        onClick={(e) => e.stopPropagation()}
                     />
                     
                     {/* Кнопка открепить */}
                     <button
                        onClick={(e) => {
                           e.stopPropagation();
                           onUnpin(key);
                        }}
                        className="p-1 hover:bg-danger-100 dark:hover:bg-danger-900/30 cursor-pointer rounded transition-colors"
                        title="Открепить"
                     >
                        <X size={18} className="text-danger" />
                     </button>
                  </div>
                     )}
                  </SortablePinnedItem>
               );
            })}
               </div>
            </SortableContext>
            
            {/* DragOverlay для визуального отображения перетаскиваемого элемента */}
            <DragOverlay
               dropAnimation={{
                  duration: 200,
                  easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
                  sideEffects: defaultDropAnimationSideEffects({
                     styles: {
                        active: {
                           opacity: '0.5',
                        },
                     },
                  }),
               }}
            >
               {activeId ? (() => {
                  const activeItem = sortedPinnedLoggers.find(item => item.key === activeId);
                  if (!activeItem) return null;
                  
                  const { key, logger } = activeItem;
                  const config = loggerConfigs[key] || { enabled: true, color: 'blue' };
                  
                  // Проверяем выделен ли компонент
                  const isSelected = selectedComponent?.name === logger.name && 
                                    selectedComponent?.file === logger.file;
                  
                  // Считаем данные для отображения (как в основном списке)
                  const componentCalls = loggerCalls.filter(
                     call => call.componentName === logger.name && 
                             call.file === logger.file
                  );
                  const enabledCount = componentCalls.filter(call => {
                     const configKey = getLoggerCallConfigKey(call);
                     return loggerConfigs[configKey]?.enabled;
                  }).length;
                  const totalCount = componentCalls.length;
                  
                  const componentKey = `${logger.name}:${logger.file}`;
                  const componentTimestamp = componentLastViewed[componentKey] || lastViewedTimestamp;
                  
                  const newLogs = componentCalls.filter((call) => {
                     const configKey = getLoggerCallConfigKey(call);
                     const config = loggerConfigs[configKey];
                     const createdAt = config?.createdAt || 0;
                     return createdAt > componentTimestamp;
                  });
                  const newCount = newLogs.length;
                  const hasNewLogs = newCount > 0;
                  
                  const configKeysCount = new Map<string, number>();
                  componentCalls.forEach((call) => {
                     const configKey = getLoggerCallConfigKey(call);
                     configKeysCount.set(configKey, (configKeysCount.get(configKey) || 0) + 1);
                  });
                  const hasDuplicates = Array.from(configKeysCount.values()).some(count => count > 1);
                  
                  let chipClass = 'bg-default-100 text-default-600';
                  if (hasNewLogs) {
                     chipClass = 'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400';
                  } else if (enabledCount === totalCount && totalCount > 0) {
                     chipClass = 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                  } else if (enabledCount > 0) {
                     chipClass = 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                  }
                  
                  return (
                     <div
                        className={clsx(
                           'flex items-center gap-2 px-2 py-1 rounded-md cursor-grabbing transition-all border',
                           'shadow-lg',
                           isSelected 
                              ? 'bg-default-100 border-primary-500 dark:border-primary-400 dark:bg-default-200' 
                              : 'bg-default-100 border-transparent dark:bg-default-200'
                        )}
                     >
                        <div className="cursor-grabbing">
                           <GripVertical size={14} className="text-default-400" />
                        </div>
                        
                        <File
                           size={16}
                           className={`shrink-0 ${
                              AVAILABLE_COLORS.find((c) => c.key === config.color)?.iconClass ||
                              'text-green-400'
                           }`}
                           fill="currentColor"
                           fillOpacity={0.2}
                        />
                        
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                           <span className="font-medium text-foreground truncate">
                              {logger.name}
                           </span>
                           {/* <span className="text-[14px] text-default-400 truncate">
                              {logger.file.replace(/^\/app\//, '').replace(/^app\//, '')}
                           </span> */}
                        </div>
                        
                        <Chip 
                           size="sm" 
                           className={clsx(
                              chipClass,
                              'shrink-0',
                              hasDuplicates && 'ring-2 ring-warning-500'
                           )}
                        >
                           {enabledCount}/{totalCount}
                           {newCount > 0 && <span className="font-semibold"> (+{newCount})</span>}
                        </Chip>
                        
                        <Switch
                           size="sm"
                           color={pinnedComponentsSwitchers[key] !== false ? 'success' : 'default'}
                           className="scale-60"
                           classNames={{
                              wrapper: pinnedComponentsSwitchers[key] !== false ? undefined : 'bg-danger-200',
                           }}
                           isSelected={pinnedComponentsSwitchers[key] !== false}
                        />
                        
                        <button
                           className="p-1 hover:bg-danger-100 dark:hover:bg-danger-900/30 cursor-pointer rounded transition-colors"
                        >
                           <X size={18} className="text-danger" />
                        </button>
                     </div>
                  );
               })() : null}
            </DragOverlay>
         </DndContext>
      </div>
   );
}
