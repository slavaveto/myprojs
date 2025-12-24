'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
   Button,
   ButtonGroup,
   Chip,
   Checkbox,
   Switch,
   Popover,
   PopoverTrigger,
   PopoverContent,
   Input,
   Listbox,
   ListboxItem,
   Card,
   CardBody,
   CardFooter,
   CardHeader,
   Divider,
   Tooltip,
} from '@heroui/react';
import {
   ChevronDown,
   ChevronUp,
   Search,
   FileJson,
   Box,
   AlertTriangle,
   CheckCircle,
   FileDiff,
   Trash2,
   Eye,
   EyeOff,
} from 'lucide-react';
import clsx from 'clsx';
import { useLoggerContext } from '@/utils/logger/LogsManager/LoggerContext';
import { ROOT_TABS } from '@/utils/logger/types';

// Configuration
const SEARCH_CASE_SENSITIVE = false;

export function LoggerHeader() {
   const {
      masterEnabled,
      setMasterEnabled,
      showToasts,
      setShowToasts,
      showHidden,
      setShowHidden,
      loading,
      scanLoggers,
      newLogsCount,
      validationResults,
      fixSelectedLoggerLines,
      fixConsoleLogLines,
      deleteConsoleLog, // Added
      showValidationResults,
      setShowValidationResults,
      validateLoggerLines,
      validationLoading,
      loggerCalls, // Needed for search
      loggers, // Needed for component search
      loggerConfigs, // Needed for config check
      setSelectedRootTab,
      handleSelectComponent,
      setHighlightedLogKey,
      getLoggerCallConfigKey,
      getLoggerKey,
      handleNavigateToLog,
      handleNavigateToComponent,
      scanDiff, // Added scanDiff
      confirmScan, // Added confirmScan
      smartApply, // Added smartApply
      cancelScan, // Added cancelScan
      clearStaleConfigs, // Added clearStaleConfigs
      restoreFromBackup, // Added restoreFromBackup
      handleHardReset, // Added handleHardReset
   } = useLoggerContext();

   // --- Smart Search State ---
   const [searchQuery, setSearchQuery] = useState('');
   const [searchResults, setSearchResults] = useState<any[]>([]);
   const [isSearchOpen, setIsSearchOpen] = useState(false);
   const [isConsoleDetailsOpen, setIsConsoleDetailsOpen] = useState(false);
   const searchRef = useRef<HTMLDivElement>(null);

   // Reset console details when scan diff changes (new scan results)
   useEffect(() => {
      setIsConsoleDetailsOpen(false);
   }, [scanDiff]);

   const updateButtonRef = useRef<HTMLButtonElement>(null);

   // Search logic
   useEffect(() => {
      if (!searchQuery || searchQuery.length < 2) {
         setSearchResults([]);
         setIsSearchOpen(false);
         return;
      }

      // Filter components
      const componentMatches = loggers
         .filter((logger) => {
            if (SEARCH_CASE_SENSITIVE) {
               return logger.name.includes(searchQuery);
            }
            return logger.name.toLowerCase().includes(searchQuery.toLowerCase());
         })
         .slice(0, 3); // Limit components to 3

      // Filter logs by message (max 5)
      const logMatches = loggerCalls
         .filter((call) => {
            if (SEARCH_CASE_SENSITIVE) {
               return call.message.includes(searchQuery);
            }
            return call.message.toLowerCase().includes(searchQuery.toLowerCase());
         })
         .slice(0, 5);

      const combinedResults = [
         ...componentMatches.map((c) => ({ ...c, type: 'component' })),
         ...logMatches.map((l) => ({ ...l, type: 'log' })),
      ];

      setSearchResults(combinedResults);
      setIsSearchOpen(combinedResults.length > 0);
   }, [searchQuery, loggerCalls, loggers]);

   // Handle click outside to close search results
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
            setIsSearchOpen(false);
         }
      };

      document.addEventListener('mousedown', handleClickOutside);
      return () => {
         document.removeEventListener('mousedown', handleClickOutside);
      };
   }, []);

   const handleSearchResultClick = (result: any) => {
      // 1. Find correct Root Tab
      let foundRootTab = 'app'; // Default
      for (const tab of ROOT_TABS) {
         let p = result.file;
         if (p.startsWith('/')) p = p.substring(1);
         
         if (p.startsWith(tab.path)) {
             // Check exclude
             let excluded = false;
             if (tab.exclude) {
                 for (const ex of tab.exclude) {
                     if (p.startsWith(ex + '/') || p === ex) {
                         excluded = true;
                         break;
                     }
                 }
             }
             if (!excluded) {
                 foundRootTab = tab.id;
                 break;
             }
         }
      }

      // 2. Navigate based on type
      if (result.type === 'component') {
         handleNavigateToComponent({ name: result.name, file: result.file }, foundRootTab);
      } else {
         handleNavigateToLog(result, foundRootTab);
      }

      // 3. Close search
      setIsSearchOpen(false);
      setSearchQuery('');
   };

   // Helper for highlighting text
   const getHighlightedText = (text: string, highlight: string) => {
      if (!highlight.trim()) {
         return <span>{text}</span>;
      }
      // Escape special regex characters
      const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(
         new RegExp(`(${escapedHighlight})`, SEARCH_CASE_SENSITIVE ? 'g' : 'gi')
      );
      return (
         <span>
            {parts.map((part, i) => {
               const isMatch = SEARCH_CASE_SENSITIVE
                  ? part === highlight
                  : part.toLowerCase() === highlight.toLowerCase();

               return isMatch ? (
                  <span
                     key={i}
                     className="bg-yellow-200 dark:bg-yellow-800 text-foreground font-semibold"
                  >
                     {part}
                  </span>
               ) : (
                  <span key={i}>{part}</span>
               );
            })}
         </span>
      );
   };


   return (
      <div className="flex items-center pb-4 min-h-[60px] justify-between  border-b border-gray-200 dark:border-gray-700">
         
            <h1 className="tab-title">Loggers Manager</h1>

            {/* Smart Search Input */}
            <div className="relative w-[300px]" ref={searchRef}>
               <Input
                  placeholder="Поиск лога..."
                  value={searchQuery}
                  onValueChange={setSearchQuery}
                  startContent={<Search size={16} className="text-default-400" />}
                  size="sm"
                  // variant="bordered"
                  isClearable
                  onClear={() => setSearchQuery('')}
                  classNames={{
                     inputWrapper: 'h-[32px] min-h-[32px]', // Compact height
                  }}
               />

               {/* Search Results Dropdown */}
               {isSearchOpen && (
                  <div className="absolute top-full left-0 mt-1 w-[500px] bg-content1 rounded-medium shadow-large border border-default-200 z-50 overflow-hidden">
                     <div className="max-h-[400px] overflow-y-auto py-1">
                        {searchResults.map((result, index) => (
                           <button
                              key={`${result.type}:${result.file}:${index}`}
                              className="w-full text-left px-3 py-2 hover:bg-default-100 transition-colors border-b border-default-100 last:border-0 flex flex-col gap-0.5"
                              onClick={() => handleSearchResultClick(result)}
                           >
                              {result.type === 'component' ? (
                                 // Component Result UI
                                 <div className="flex items-center gap-2 text-sm">
                                    <Box size={14} className="text-primary" />
                                    <span className="font-semibold text-foreground">
                                       {getHighlightedText(result.name, searchQuery)}
                                    </span>
                                    <span className="text-xs text-default-400 ml-auto truncate max-w-[200px]">
                                       {result.file}
                                    </span>
                                 </div>
                              ) : (
                                 // Log Result UI
                                 <>
                                    <div className="flex items-center gap-2 text-xs text-default-500">
                                       <FileJson size={12} />
                                       <span className="truncate max-w-[200px] font-semibold">
                                          {result.componentName}
                                       </span>
                                       <span className="text-default-300">•</span>
                                       <span>Line {result.line}</span>
                                       <span className="text-default-300 ml-auto truncate max-w-[200px] opacity-70">
                                          {result.file}
                                       </span>
                                    </div>
                                    <div className="text-sm font-medium w-full text-foreground break-words whitespace-pre-wrap">
                                       {getHighlightedText(result.message, searchQuery)}
                                    </div>
                                 </>
                              )}
                           </button>
                        ))}
                     </div>
                  </div>
               )}
        
         </div>

         <div className="flex gap-1">
            <Switch
               isSelected={masterEnabled}
               onValueChange={setMasterEnabled}
               className="scale-80 mr-[30px]"
               size="sm"
               color={masterEnabled ? 'success' : 'danger'}
               classNames={{
                  wrapper: masterEnabled ? undefined : 'bg-danger-200',
               }}
            >
               <span
                  className={clsx(
                     'font-semibold',
                     masterEnabled
                        ? 'text-success-600 dark:text-success-400'
                        : 'text-danger-600 dark:text-danger-400'
                  )}
               >
                  Логи {masterEnabled ? 'ВКЛ' : 'ВЫКЛ'}
               </span>
            </Switch>

            {/* Show Hidden Button */}
            <Button
               isIconOnly
               size="sm"
               variant="light"
               onPress={() => setShowHidden(!showHidden)}
               className={clsx(
                  'transition-colors min-w-8 w-8 h-8',
                  showHidden
                     ? 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400'
                     : 'text-default-500 hover:bg-default-100'
               )}
               title={showHidden ? 'Скрыть скрытые компоненты' : 'Показать скрытые компоненты'}
            >
               {showHidden ? <Eye size={18} /> : <EyeOff size={18} />}
            </Button>

            <Checkbox
               className="hidden"
               isSelected={showToasts}
               onValueChange={setShowToasts}
               size="sm"
            >
               Show Toasts
            </Checkbox>

            <Button
               isIconOnly
               size="sm"
               color="danger"
               variant="light"
               onPress={() => {
                  if (
                     confirm(
                        'ВЫ УВЕРЕНЫ? Это полностью очистит все настройки логгера и перезагрузит страницу.'
                     )
                  ) {
                     handleHardReset();
                  }
               }}
               title="Полный сброс настроек (Hard Reset)"
            >
               <Trash2 size={18} />
            </Button>

            <Button
               ref={updateButtonRef}
               size="sm"
               onPress={() => scanLoggers()}
               isLoading={loading}
               color="success" // Всегда серый, чтобы не мигал триггер при обновлении данных
               variant="flat"
               className="ml-2"
            >
               {[<span key="1">Обновить</span>, <span key="2" style={{ display: 'none' }} />]}
            </Button>

            {/* @ts-ignore */}
            <Popover
               isOpen={!!scanDiff}
               onOpenChange={(open) => {
                  if (!open) cancelScan();
               }}
               triggerRef={updateButtonRef as any}
               placement="bottom"
               offset={10}
               shouldCloseOnBlur={true}
               isDismissable={true}
            >
               <PopoverContent className="w-auto min-w-[400px] p-0">
                  {scanDiff && (
                     <Card className="w-full border-none shadow-none bg-transparent">
                        <CardHeader className="flex gap-3 px-3 pt-3 pb-1">
                           {(() => {
                              const {
                                 totalExistingConfigs,
                                 deletedConfigCount,
                                 collisionCount,
                                 validationIssuesCount,
                              } = scanDiff;
                              const isTotalReplacement =
                                 totalExistingConfigs > 0 &&
                                 deletedConfigCount >= totalExistingConfigs * 0.9;
                              const isMassiveDeletion =
                                 totalExistingConfigs > 10 &&
                                 deletedConfigCount >= totalExistingConfigs * 0.5;
                              const isDanger = isTotalReplacement || isMassiveDeletion;
                              const isWarning = collisionCount > 0 || validationIssuesCount > 0;

                              return (
                                 <div className="flex flex-col gap-0.5 w-full">
                                    <div className="flex items-center gap-2">
                                       {isDanger ? (
                                          <AlertTriangle className="text-danger" size={18} />
                                       ) : isWarning ? (
                                          <AlertTriangle className="text-warning" size={18} />
                                       ) : (
                                          <FileDiff className="text-primary" size={18} />
                                       )}
                                       <span
                                          className={clsx(
                                             'text-small font-bold',
                                             isDanger
                                                ? 'text-danger'
                                                : isWarning
                                                  ? 'text-warning-600'
                                                  : 'text-foreground'
                                          )}
                                       >
                                          {isDanger
                                             ? 'Критические изменения'
                                             : isWarning
                                               ? 'Найдены проблемы'
                                               : 'Подтверждение'}
                                       </span>
                                    </div>
                                    <p className="text-[10px] text-default-500">
                                       Проверьте изменения перед применением.
                                    </p>
                                 </div>
                              );
                           })()}
                        </CardHeader>
                        <Divider />
                        <CardBody className="px-3 py-1.5 gap-1.5">
                           {(() => {
                              const {
                                 collisionCount,
                                 totalExistingConfigs,
                                 totalNewConfigs,
                                 deletedConfigCount,
                                 stats,
                              } = scanDiff;

                              const isTotalReplacement =
                                 totalExistingConfigs > 0 &&
                                 deletedConfigCount >= totalExistingConfigs * 0.9;

                              return (
                                 <>
                                    {isTotalReplacement && (
                                       <div className="p-1.5 bg-danger-50 border border-danger-200 rounded-small text-danger-700 text-[10px] font-bold flex items-center gap-2 mb-1">
                                          <AlertTriangle size={12} />
                                          <span>
                                             ПОЛНАЯ ЗАМЕНА! ({totalExistingConfigs} →{' '}
                                             {totalNewConfigs})
                                          </span>
                                       </div>
                                    )}

                                    {collisionCount > 0 && (
                                       <div className="p-1.5 bg-warning-50 border border-warning-200 rounded-small text-warning-700 text-[10px] font-bold flex items-center gap-2 mb-1">
                                          <AlertTriangle size={12} />
                                          <span>Коллизии ключей: {collisionCount}</span>
                                       </div>
                                    )}

                                    {/* @ts-ignore */}
                                    {scanDiff.validationIssuesCount > 0 && (
                                       <div className="flex flex-col bg-warning-50 border border-warning-200 rounded-small mb-1 overflow-hidden transition-all">
                                          <div
                                             className="p-1.5 text-warning-700 text-[10px] font-bold flex items-center justify-between gap-2 cursor-pointer hover:bg-warning-100 transition-colors"
                                             onClick={() =>
                                                setIsConsoleDetailsOpen(!isConsoleDetailsOpen)
                                             }
                                          >
                                             <div className="flex items-center gap-2">
                                                <ChevronDown
                                                   size={12}
                                                   className={clsx(
                                                      'transition-transform duration-200',
                                                      isConsoleDetailsOpen ? 'rotate-180' : ''
                                                   )}
                                                />
                                                <AlertTriangle size={12} />
                                                {/* @ts-ignore */}
                                                <span>
                                                   Console logs: {scanDiff.validationIssuesCount}
                                                </span>
                                             </div>
                                             <Button
                                                size="sm"
                                                color="warning"
                                                variant="flat"
                                                className="h-5 min-w-0 px-2 text-[10px]"
                                                onPress={(e) => {
                                                   // @ts-ignore
                                                   e?.stopPropagation?.();
                                                   fixConsoleLogLines();
                                                }}
                                                isLoading={validationLoading}
                                             >
                                                Исправить
                                             </Button>
                                          </div>

                                          {isConsoleDetailsOpen && (
                                             <div className="px-2 py-1 bg-content1 border-t border-warning-200 max-h-[200px] overflow-y-auto">
                                                {/* @ts-ignore */}
                                                {(
                                                   validationResults?.results?.filter(
                                                      (r: any) => r.type === 'console'
                                                   ) || []
                                                ).map((call: any, idx: number) => (
                                                   <div
                                                      key={idx}
                                                      className="text-[10px] py-1.5 border-b border-default-100 last:border-0 flex flex-col gap-0.5"
                                                   >
                                                      <div className="flex justify-between items-center w-full gap-2">
                                                         <div className="flex items-center gap-2 flex-1 overflow-hidden">
                                                            <span
                                                               className="font-semibold text-foreground truncate"
                                                               title={call.file}
                                                            >
                                                               {call.file
                                                                  .split('/')
                                                                  .pop()
                                                                  ?.replace(/\.[^/.]+$/, '')}
                                                            </span>
                                                            <span className="text-warning-600 font-mono bg-warning-50 px-1 rounded text-[9px] whitespace-nowrap">
                                                               :{call.actualLine}
                                                            </span>
                                                         </div>
                                                         <Button
                                                            size="sm"
                                                            isIconOnly
                                                            variant="light"
                                                            color="danger"
                                                            className="h-5 w-5 min-w-5"
                                                            title="Удалить consolelog"
                                                            onPress={() =>
                                                               deleteConsoleLog(
                                                                  call.file,
                                                                  call.actualLine
                                                               )
                                                            }
                                                         >
                                                            <Trash2 size={12} />
                                                         </Button>
                                                      </div>
                                                      <code
                                                         className="font-mono text-default-500 bg-default-50 px-1.5 py-0.5 rounded truncate block w-full border border-default-100"
                                                         title={call.loggerCall}
                                                      >
                                                         {call.loggerCall}
                                                      </code>
                                                   </div>
                                                ))}
                                             </div>
                                          )}
                                       </div>
                                    )}

                                    <div className="grid grid-cols-[1fr_repeat(5,auto)] gap-x-2 gap-y-1 text-[11px] items-center">
                                       {/* Header Row */}
                                       <div className="text-default-500 font-medium">Тип</div>
                                       <div
                                          className="text-default-500 text-center font-medium"
                                          title="Найдено в коде"
                                       >
                                          Найдено
                                       </div>
                                       <div
                                          className="text-default-500 text-center font-medium"
                                          title="Текущие в конфиге"
                                       >
                                          Текущие
                                       </div>
                                       <div
                                          className="text-default-500 text-center text-primary-400 font-medium"
                                          title="В бэкапе"
                                       >
                                          Бэкап
                                       </div>
                                       <div
                                          className="text-default-500 text-center font-medium"
                                          title="Совпало"
                                       >
                                          Совпало
                                       </div>
                                       <div
                                          className="text-default-500 text-center font-medium"
                                          title="Новые (добавятся)"
                                       >
                                          Новые
                                       </div>

                                       {/* Divider */}
                                       <div className="col-span-6 h-px bg-default-200 my-0.5" />

                                       {/* Components Row */}
                                       <div className="truncate">Комп.</div>
                                       <div className="font-mono text-center text-default-400">
                                          {stats?.components.found || 0}
                                       </div>
                                       <div className="font-mono text-center text-default-400">
                                          {stats?.components.existing || 0}
                                       </div>
                                       {/* @ts-ignore */}
                                       <div className="font-mono text-center text-default-400">
                                          {scanDiff.backupStats?.components || 0}
                                       </div>
                                       <div className="font-mono text-center text-success-600">
                                          {(stats?.components.existing || 0) -
                                             (stats?.components.stale || 0)}
                                       </div>
                                       <div className="font-mono text-center text-primary-500 font-bold">
                                          {stats?.components.created > 0
                                             ? `+${stats.components.created}`
                                             : 0}
                                       </div>

                                       {/* Logs Row */}
                                       <div className="truncate">Логи</div>
                                       <div className="font-mono text-center text-default-400">
                                          {stats?.logs.found || 0}
                                       </div>
                                       <div className="font-mono text-center text-default-400">
                                          {stats?.logs.existing || 0}
                                       </div>
                                       {/* @ts-ignore */}
                                       <div className="font-mono text-center text-default-400">
                                          {scanDiff.backupStats?.logs || 0}
                                       </div>
                                       <div className="font-mono text-center text-success-600">
                                          {(stats?.logs.existing || 0) - (stats?.logs.stale || 0)}
                                       </div>
                                       <div className="font-mono text-center text-primary-500 font-bold">
                                          {stats?.logs.created > 0 ? `+${stats.logs.created}` : 0}
                                       </div>

                                       {/* Backup Info Row */}
                                       {/* @ts-ignore */}
                                       {scanDiff.backupConfigCount > 0 && (
                                          <>
                                             <div className="col-span-6 h-px bg-default-100 my-1" />
                                             <div className="text-default-500">Всего</div>
                                             <div className="font-mono text-center text-default-400">
                                                {(stats?.components.found || 0) +
                                                   (stats?.logs.found || 0)}
                                             </div>
                                             <div className="font-mono text-center text-default-400">
                                                {scanDiff.totalExistingConfigs}
                                             </div>
                                             {/* @ts-ignore */}
                                             <div
                                                className={clsx(
                                                   'font-mono text-center ',
                                                   scanDiff.totalExistingConfigs <
                                                      scanDiff.backupConfigCount * 0.5
                                                      ? 'text-danger font-bold'
                                                      : 'text-default-400'
                                                )}
                                             >
                                                {/* @ts-ignore */}
                                                {scanDiff.backupConfigCount}
                                             </div>
                                             <div className="col-span-2 text-[10px] text-default-400 italic pl-2">
                                                {/* @ts-ignore */}
                                                {scanDiff.totalExistingConfigs <
                                                scanDiff.backupConfigCount * 0.5
                                                   ? '⚠️ Подозрительно мало'
                                                   : ''}
                                             </div>
                                          </>
                                       )}
                                    </div>

                                       {/* Summary Footer */}
                                       <div className="mt-1.5 pt-1.5 border-t border-default-200 bg-default-50/50 rounded-b-medium -mx-3 -mb-1.5 px-3 pb-1.5">
                                          <div className="flex justify-around items-center w-full mb-2">
                                             <div className="flex flex-col items-center">
                                                <span className="text-[9px] text-default-500 font-bold uppercase">
                                                   Новых
                                                </span>
                                                <span
                                                   className={clsx(
                                                      'font-mono font-bold text-xs',
                                                      scanDiff.newConfigCount > 0
                                                         ? 'text-success-600'
                                                         : 'text-default-400'
                                                   )}
                                                >
                                                   +{scanDiff.newConfigCount}
                                                </span>
                                             </div>
                                             <div className="flex flex-col items-center">
                                                <span className="text-[9px] text-default-500 font-bold uppercase">
                                                   Удаленных
                                                </span>
                                                {/* @ts-ignore */}
                                                <span
                                                   className={clsx(
                                                      'font-mono font-bold text-xs',
                                                      scanDiff.staleConfigCount > 0
                                                         ? 'text-danger-600'
                                                         : 'text-default-400'
                                                   )}
                                                >
                                                   {/* @ts-ignore */}-{scanDiff.staleConfigCount || 0}
                                                </span>
                                             </div>
                                             <div className="flex flex-col items-center">
                                                <span className="text-[9px] text-default-500 font-bold uppercase">
                                                   Дубликатов
                                                </span>
                                                {/* @ts-ignore */}
                                                <span
                                                   className={clsx(
                                                      'font-mono font-bold text-xs',
                                                      scanDiff.collisionCount > 0
                                                         ? 'text-warning-600'
                                                         : 'text-default-400'
                                                   )}
                                                >
                                                   {/* @ts-ignore */}
                                                   {scanDiff.collisionCount || 0}
                                                </span>
                                             </div>
                                          </div>
                                          
                                          {/* Список удаленных элементов */}
                                          {/* @ts-ignore */}
                                          {scanDiff.staleConfigCount > 0 && scanDiff.staleKeys && (
                                             <div className="border-t border-default-200 pt-1.5 mt-1.5">
                                                <div className="text-[10px] font-bold text-danger-600 mb-1">Будут удалены:</div>
                                                <div className="max-h-[100px] overflow-y-auto flex flex-col gap-1 pr-1">
                                                   {/* @ts-ignore */}
                                                   {scanDiff.staleKeys.map((key: string) => (
                                                      <div key={key} className="text-[9px] font-mono text-default-600 bg-default-100 px-1.5 py-0.5 rounded break-all">
                                                         {key}
                                                      </div>
                                                   ))}
                                                </div>
                                             </div>
                                          )}
                                       </div>
                                 </>
                              );
                           })()}
                        </CardBody>
                        <Divider />
                        <CardFooter className="flex justify-end gap-2 px-3 py-1.5 bg-default-50">
                           {(() => {
                              // @ts-ignore
                              const {
                                 newConfigCount,
                                 staleConfigCount,
                                 updatedConfigCount,
                                 deletedConfigCount,
                                 collisionCount,
                              } = scanDiff;
                              const hasNew = newConfigCount > 0;
                              const hasStale = staleConfigCount > 0;
                              const hasUpdated = updatedConfigCount > 0;
                              const hasDeleted = deletedConfigCount > 0;
                              const hasChanges =
                                 hasNew ||
                                 hasStale ||
                                 hasUpdated ||
                                 hasDeleted ||
                                 collisionCount > 0;

                              let buttonText = 'Применить';
                              let buttonColor: 'primary' | 'success' | 'danger' | 'warning' =
                                 'primary';
                              let ButtonIcon = CheckCircle;

                              if (hasStale && !hasNew && !hasUpdated) {
                                 buttonText = 'Очистить от удаленных';
                                 buttonColor = 'danger';
                                 ButtonIcon = Trash2;
                              } else if (hasNew && !hasStale && !hasUpdated) {
                                 buttonText = 'Добавить новые логи';
                                 buttonColor = 'success';
                              } else if (hasNew && hasStale) {
                                 buttonText = 'Исправить ВСЕ';
                                 buttonColor = 'primary';
                              } else if (hasUpdated) {
                                 buttonText = 'Обновить конфиги';
                              }

                              return (
                                 <>
                                    {/* @ts-ignore */}
                                    {scanDiff.totalExistingConfigs <
                                       scanDiff.backupConfigCount * 0.5 && (
                                       <Button
                                          size="sm"
                                          color="secondary"
                                          variant="flat"
                                          onPress={restoreFromBackup}
                                          className="mr-auto" // Push to the left
                                       >
                                          Восстановить из бэкапа
                                       </Button>
                                    )}

                                    <Button
                                       size="sm"
                                       color="danger"
                                       variant="light"
                                       onPress={cancelScan}
                                    >
                                       Отмена
                                    </Button>
                                    <Button
                                       size="sm"
                                       color={buttonColor}
                                       variant="solid"
                                       onPress={smartApply}
                                       startContent={<ButtonIcon size={14} />}
                                       isDisabled={!hasChanges}
                                    >
                                       {buttonText}
                                    </Button>
                                 </>
                              );
                           })()}
                        </CardFooter>
                     </Card>
                  )}
               </PopoverContent>
            </Popover>

            {/* Группа кнопок проверки (СКРЫТА, перенесена в Popover) */}
            {/* <ButtonGroup size="sm"> ... </ButtonGroup> */}
         </div>
      </div>
   );
}
