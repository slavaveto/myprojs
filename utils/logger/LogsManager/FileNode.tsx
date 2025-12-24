'use client';

import React from 'react';
import { Chip, Switch, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { File, Pin, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import clsx from 'clsx';
import { AVAILABLE_COLORS } from '@/utils/logger/services/loggerColors';
import { createLogger } from '@/utils/logger/Logger';
import { useLoggerContext } from './LoggerContext';
import { TreeNode } from './FileTreeUtils';

interface FileNodeProps {
   node: TreeNode;
   level: number;
   parentBlocked?: boolean;
}

export function FileNode({
   node,
   level,
   parentBlocked = false,
}: FileNodeProps) {
   const logger = createLogger('FileNode');
   const {
      loggerConfigs,
      loggerCalls,
      selectedComponent,
      openPopover,
      lastViewedTimestamp,
      componentLastViewed,
      pinnedComponents,
      handleSelectComponent: onSelectComponent,
      updateLoggerConfig: onUpdateLoggerConfig,
      setOpenPopover: onSetOpenPopover,
      handleRenameLogger: onRenameLogger,
      togglePin: onTogglePin,
      toggleHidden: onToggleHidden,
      setComponentLastViewed,
      getLoggerKey,
      getLoggerCallConfigKey,
      loggers,
   } = useLoggerContext();

   const [isRenaming, setIsRenaming] = React.useState(false);
   const [newName, setNewName] = React.useState('');

   const isDuplicateComponent = React.useMemo(() => {
       if (!node.loggerInfo) return false;
       return loggers.filter(l => l.name === node.loggerInfo?.name).length > 1;
   }, [loggers, node.loggerInfo]);

   const loggerKey = node.loggerInfo ? getLoggerKey(node.loggerInfo) : '';
   const config = loggerConfigs[loggerKey] || {
      enabled: true,
      color: 'black',
   };

   // Файл заблокирован если родитель заблокирован
   const isFileBlocked = parentBlocked;

   // Проверяем состояние Switch компонента (только если родитель не заблокирован)
   const isComponentSwitchDisabled = !config.enabled;
   const shouldApplySwitchOpacity = isComponentSwitchDisabled && !isFileBlocked;

   // Файл полупрозрачный если заблокирован папкой ИЛИ выключен Switch (но не накладывается)
   const shouldFileBeTransparent = isFileBlocked || shouldApplySwitchOpacity;

   const isSelected =
      selectedComponent !== null &&
      node.loggerInfo &&
      selectedComponent.name === node.loggerInfo.name &&
      selectedComponent.file === node.loggerInfo.file;

   return (
      <div className="relative" style={{ opacity: shouldFileBeTransparent ? 0.5 : 1 }}>
         {/* Вертикальная линия для уровня */}
         {level > 0 && (
            <div
               className="absolute top-0 bottom-0 w-px bg-default-200 z-10"
               style={{ left: `${level * 30 - 13}px` }}
            />
         )}

         <div
            className="group flex items-center px-2 py-1 rounded-md cursor-pointer transition-all relative"
            style={{
               paddingLeft: `${level * 30 + 11}px`,
               marginBottom: '4px',
            }}
            onClick={() => {
               if (node.loggerInfo) {
                  onSelectComponent({
                     name: node.loggerInfo.name,
                     file: node.loggerInfo.file,
                  });
                  logger.info('Selected component from tree', {
                     component: node.loggerInfo.name,
                     file: node.loggerInfo.file,
                  });
               }
            }}
         >
            {/* Фон файла - серый или с рамкой (если выбран) - с padding слева (фон начинается левее иконки) */}
            <div
               className={clsx(
                  'absolute top-0 bottom-0 right-0 rounded-md z-0 transition-colors border',
                  isSelected
                     ? 'bg-default-100 border-primary-500 dark:border-primary-400 dark:bg-default-200'
                     : 'bg-default-100 border-transparent dark:bg-default-200 group-hover:bg-default-200 dark:group-hover:bg-default-300'
               )}
               style={{
                  left: `${level * 30 + 11 - 6}px`,
               }}
            />

            <div className="flex items-center justify-between min-w-0 relative z-10 w-full">
               <div className="flex items-center gap-2 min-w-0">
                  <Popover
                     placement="bottom"
                     isOpen={openPopover === loggerKey}
                     onOpenChange={(open) => onSetOpenPopover(open ? loggerKey : null)}
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
                                    if (node.loggerInfo) {
                                       onUpdateLoggerConfig(node.loggerInfo, {
                                          color: color.key,
                                       });
                                    }
                                    onSetOpenPopover(null);
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

                  {isDuplicateComponent && (
                      <div className="text-warning-500 shrink-0" title="Дубликат имени компонента (исправьте, чтобы избежать коллизий)">
                          <AlertTriangle size={14} />
                      </div>
                  )}

                  {isRenaming ? (
                     <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onBlur={async () => {
                           if (newName && newName !== node.name && node.loggerInfo) {
                              await onRenameLogger(node.loggerInfo.file, node.name, newName);
                           }
                           setIsRenaming(false);
                           setNewName('');
                        }}
                        onKeyDown={async (e) => {
                           if (
                              e.key === 'Enter' &&
                              newName &&
                              newName !== node.name &&
                              node.loggerInfo
                           ) {
                              await onRenameLogger(node.loggerInfo.file, node.name, newName);
                              setIsRenaming(false);
                              setNewName('');
                           } else if (e.key === 'Escape') {
                              setIsRenaming(false);
                              setNewName('');
                           }
                        }}
                        autoFocus
                        className="font-medium text-foreground px-2 py-1 border rounded focus:outline-none focus:ring-2 focus:ring-primary"
                        onClick={(e) => e.stopPropagation()}
                     />
                  ) : (
                     <span
                        className="font-medium text-foreground truncate"
                        onDoubleClick={(e) => {
                           e.stopPropagation();
                           // Выделяем компонент при начале переименования
                           if (node.loggerInfo) {
                              onSelectComponent(node.loggerInfo);
                           }
                           setNewName(node.name);
                           setIsRenaming(true);
                        }}
                        title="Двойной клик для переименования"
                     >
                        {node.name}
                     </span>
                  )}
               </div>

               {/* Chip, Pin и Switch - справа */}
               <div className="flex items-center gap-3 shrink-0">
                  {(() => {
                     if (!node.loggerInfo) {
                        return (
                           <Chip size="sm" className="bg-default-100 text-default-600 shrink-0">
                              {node.loggerCount || 0}
                           </Chip>
                        );
                     }
                     // Считаем включенные логи для этого компонента
                     const componentCalls = loggerCalls.filter(
                        (call) =>
                           call.componentName === node.loggerInfo!.name &&
                           call.file === node.loggerInfo!.file
                     );
                     const enabledCount = componentCalls.filter((call) => {
                        const configKey = getLoggerCallConfigKey(call);
                        return loggerConfigs[configKey]?.enabled;
                     }).length;
                     const totalCount = node.loggerCount || 0;

                     // Проверяем есть ли новые (непрочитанные) логи
                     // Используем componentLastViewed для этого компонента или fallback на lastViewedTimestamp
                     const componentKey = `${node.name}:${node.loggerInfo?.file || ''}`;
                     const componentTimestamp =
                        componentLastViewed[componentKey] || lastViewedTimestamp;

                     const hasNewLogs = componentCalls.some((call) => {
                        const configKey = getLoggerCallConfigKey(call);
                        const config = loggerConfigs[configKey];
                        const createdAt = config?.createdAt || 0;
                        return createdAt > componentTimestamp;
                     });

                     const newLogsCount = componentCalls.filter((call) => {
                        const configKey = getLoggerCallConfigKey(call);
                        const config = loggerConfigs[configKey];
                        const createdAt = config?.createdAt || 0;
                        return createdAt > componentTimestamp;
                     }).length;

                     // Проверяем есть ли дубликаты (логи с одинаковым configKey)
                     const configKeysCount = new Map<string, number>();
                     componentCalls.forEach((call) => {
                        const configKey = getLoggerCallConfigKey(call);
                        configKeysCount.set(configKey, (configKeysCount.get(configKey) || 0) + 1);
                     });
                     const hasDuplicates = Array.from(configKeysCount.values()).some(
                        (count) => count > 1
                     );

                     // Определяем цвет: новые - warning, все включены - зеленый, часть - синий, все выкл - серый
                     let chipClass = 'bg-default-100 text-default-600'; // По умолчанию серый
                     if (hasNewLogs) {
                        chipClass =
                           'bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400';
                     } else if (enabledCount === totalCount && totalCount > 0) {
                        chipClass =
                           'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
                     } else if (enabledCount > 0) {
                        chipClass =
                           'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
                     }

                     const loggerKey = node.loggerInfo ? getLoggerKey(node.loggerInfo) : '';
                     const isPinned = pinnedComponents.includes(loggerKey);

                     // Проверяем, выделен ли этот компонент
                     const isSelected =
                        selectedComponent?.name === node.name &&
                        selectedComponent?.file === node.loggerInfo?.file;

                     // Chip кликабельный только если компонент выделен И есть новые логи
                     const isChipClickable = isSelected && hasNewLogs;

                     return (
                        <>
                           {/* Hide Button */}
                           {!isPinned && (
                              <button
                                 onClick={(e) => {
                                    e.stopPropagation();
                                    if (loggerKey) {
                                       onToggleHidden(loggerKey);
                                    }
                                 }}
                              className={clsx(
                                 'p-1 rounded transition-colors cursor-pointer',
                                 config.isHidden
                                    ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                                    : 'hover:bg-default-200 text-default-400 opacity-0 group-hover:opacity-100'
                              )}
                                 title={config.isHidden ? 'Показать (раскрыть)' : 'Скрыть'}
                              >
                                 {config.isHidden ? <Eye size={14} /> : <EyeOff size={14} />}
                              </button>
                           )}

                           <Chip
                              size="sm"
                              className={clsx(
                                 chipClass,
                                 'shrink-0',
                                 isChipClickable &&
                                    'cursor-pointer hover:opacity-80 transition-opacity',
                                 hasDuplicates && 'ring-2 ring-warning-500 z-10'
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
                              {`${enabledCount}/${totalCount}`}
                              {hasNewLogs && <span className="ml-1 font-bold text-orange-600 dark:text-orange-300">(+{newLogsCount})</span>}
                           </Chip>

                           {/* Кнопка Pin/Unpin */}
                           <button
                              onClick={(e) => {
                                 e.stopPropagation();
                                 if (loggerKey) {
                                    onTogglePin(loggerKey);
                                 }
                              }}
                              className={clsx(
                                 'ml-0 p-1 rounded transition-colors cursor-pointer',
                                 isPinned
                                    ? 'bg-primary-100 dark:bg-primary-900/30 hover:bg-primary-200 dark:hover:bg-primary-900/50'
                                    : 'hover:bg-default-200'
                              )}
                              title={isPinned ? 'Открепить' : 'Закрепить'}
                           >
                              <Pin
                                 size={14}
                                 className={clsx(
                                    isPinned ? 'text-primary fill-current' : 'text-default-500'
                                 )}
                              />
                           </button>
                        </>
                     );
                  })()}

                  {/* Свитчер компонента */}
                  <Switch
                     size="sm"
                     color={config.enabled ? 'default' : 'default'}
                     classNames={{
                        wrapper: config.enabled ? undefined : 'bg-danger-100',
                     }}
                     // isDisabled
                     className="scale-60 hidden"
                     isSelected={config.enabled}
                     onValueChange={(enabled) => {
                        if (node.loggerInfo) {
                           onUpdateLoggerConfig(node.loggerInfo, { enabled });
                           // Выбираем этот компонент в правой панели
                           onSelectComponent({
                              name: node.loggerInfo.name,
                              file: node.loggerInfo.file,
                           });
                        }
                     }}
                     onClick={(e) => e.stopPropagation()}
                  />
               </div>
            </div>
         </div>
      </div>
   );
}

