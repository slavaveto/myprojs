'use client';
import React, { useMemo } from 'react';
import { Button, Chip } from '@heroui/react';
import { AlertTriangle, EyeOff } from 'lucide-react';
import { useLoggerContext } from '@/utils/logger/LogsManager/LoggerContext';
import { ROOT_TABS } from '@/utils/logger/types';
import { buildFileTree } from '@/utils/logger/LogsManager/FileTreeUtils';
import { TreeNodeComponent } from '@/utils/logger/LogsManager/FileTree';

export function LoggerNavigation() {
   const {
      selectedRootTab,
      setSelectedRootTab,
      filteredLoggers,
      getLoggerCallsCount,
      currentTabPath,
      loggerConfigs,
      loggerCalls,
      loggers,
      lastViewedTimestamp,
      componentLastViewed,
      getLoggerCallConfigKey,
      hiddenFolders,
      getLoggerKey,
   } = useLoggerContext();

   // Helper to check if file belongs to tab
   const isFileInTab = (filePath: string, tab: typeof ROOT_TABS[0]) => {
      const cleanPath = filePath.startsWith('/') ? filePath.substring(1) : filePath;
      if (!cleanPath.startsWith(tab.path)) return false;
      
      if (tab.exclude) {
         for (const exclude of tab.exclude) {
             if (cleanPath.startsWith(exclude + '/') || cleanPath === exclude) return false;
         }
      }
      return true;
   };

   // 1. Identify Duplicate Components (Collision Risk: Name + FileName)
   const duplicateComponentCollisions = useMemo(() => {
       const counts: Record<string, number> = {};
       loggers.forEach(l => { 
           const fileName = l.file.split('/').pop();
           const key = `${l.name}:${fileName}`;
           counts[key] = (counts[key] || 0) + 1; 
       });
       // Store collision keys (Name:FileName)
       return new Set(Object.keys(counts).filter(key => counts[key] > 1));
   }, [loggers]);

   // 2. Identify Duplicate Logs (Global)
   const duplicateLogKeys = useMemo(() => {
       const counts: Record<string, number> = {};
       loggerCalls.forEach(call => {
           const key = getLoggerCallConfigKey(call);
           counts[key] = (counts[key] || 0) + 1;
       });
       return new Set(Object.keys(counts).filter(key => counts[key] > 1));
   }, [loggerCalls, getLoggerCallConfigKey]);

   // 3. Count per Tab
   const tabIssues = useMemo(() => {
      const issues: Record<string, { components: number, logs: number }> = {};

      ROOT_TABS.forEach((tab) => {
         let compIssues = 0;
         let logIssues = 0;

         // Filter loggers for this tab
         const tabLoggers = loggers.filter(l => isFileInTab(l.file, tab));

         // Count duplicate components in this tab
         tabLoggers.forEach(l => {
             const fileName = l.file.split('/').pop();
             const key = `${l.name}:${fileName}`;
             if (duplicateComponentCollisions.has(key)) compIssues++;
         });

         // Filter logs for this tab
         const tabCalls = loggerCalls.filter(call => isFileInTab(call.file, tab));

         // Count duplicate logs in this tab (unique keys that have duplicates)
         const seenKeys = new Set<string>();
         tabCalls.forEach(call => {
             const key = getLoggerCallConfigKey(call);
             if (duplicateLogKeys.has(key) && !seenKeys.has(key)) {
                 logIssues++;
                 seenKeys.add(key);
             }
         });

         issues[tab.id] = { components: compIssues, logs: logIssues };
      });
      return issues;
   }, [loggers, loggerCalls, duplicateComponentCollisions, duplicateLogKeys, getLoggerCallConfigKey]);

   // Подсчет новых логов для каждого таба
   const newLogsCounts = useMemo(() => {
      const counts: Record<string, number> = {};

      ROOT_TABS.forEach((tab) => {
         // Получаем все логи, относящиеся к этому табу
         const tabCalls = loggerCalls.filter(call => isFileInTab(call.file, tab));

         // Считаем новые
         const newCount = tabCalls.filter((call) => {
            const configKey = getLoggerCallConfigKey(call);
            const config = loggerConfigs[configKey];
            
            // Получаем timestamp последнего просмотра для компонента этого лога
            const componentKey = `${call.componentName}:${call.file}`;
            const componentTimestamp = componentLastViewed[componentKey] || lastViewedTimestamp;
            
            const createdAt = config?.createdAt || 0;
            return createdAt > componentTimestamp;
         }).length;

         counts[tab.id] = newCount;
      });

      return counts;
   }, [loggerCalls, loggerConfigs, lastViewedTimestamp, componentLastViewed, getLoggerCallConfigKey]);

   // 4. Count Hidden Components per Tab
   const hiddenCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      ROOT_TABS.forEach(tab => {
         const tabLoggers = loggers.filter(l => isFileInTab(l.file, tab));
         
         let hidden = 0;
         tabLoggers.forEach(l => {
             const key = getLoggerKey(l);
             const config = loggerConfigs[key];
             const isComponentHidden = config?.isHidden;
             
             let isFolderHidden = false;
             const filePath = l.file.startsWith('/') ? l.file.substring(1) : l.file;
             for (const hiddenFolder of hiddenFolders) {
                 if (filePath.startsWith(hiddenFolder + '/') || filePath === hiddenFolder) {
                     isFolderHidden = true;
                     break;
                 }
             }
             
             if (isComponentHidden || isFolderHidden) {
                 hidden++;
             }
         });
         counts[tab.id] = hidden;
      });
      return counts;
   }, [loggers, loggerConfigs, hiddenFolders, getLoggerKey]);

   return (
      <div className="flex flex-1 min-h-0">
         {/* Левая колонка с вертикальными табами */}
         <div className="w-[200px] border-r border-default-200 flex flex-col gap-1 p-2 pl-0  overflow-y-auto shrink-0">
            {ROOT_TABS.map((tab) => {
               const newCount = newLogsCounts[tab.id] || 0;
               const hiddenCount = hiddenCounts[tab.id] || 0;
               const issues = tabIssues[tab.id];
               const hasIssues = issues && (issues.components > 0 || issues.logs > 0);
               
               return (
                  <Button
                     key={tab.id}
                     size="sm"
                     variant={selectedRootTab === tab.id ? 'solid' : 'light'}
                     color={selectedRootTab === tab.id ? 'primary' : 'default'}
                     className="justify-start relative h-10" // Увеличим высоту для бейджика если нужно
                     onPress={() => setSelectedRootTab(tab.id)}
                  >
                     <div className="flex items-center justify-between w-full gap-2">
                        <span className="truncate text-[15px] font-medium">{tab.label}</span>
                        
                        <div className="flex items-center gap-1">
                            {hiddenCount > 0 && (
                                <div className="flex items-center text-default-400 text-[10px] gap-0.5 mr-1" title={`${hiddenCount} скрыто`}>
                                    <EyeOff size={12} />
                                    <span>{hiddenCount}</span>
                                </div>
                            )}

                            {hasIssues && (
                                <div className="text-warning-500" title={`${issues.components} дубл. компонентов, ${issues.logs} дубл. логов`}>
                                    <AlertTriangle size={14} />
                                </div>
                            )}

                            {newCount > 0 && (
                               <Chip
                                  size="sm"
                                  className="shrink-0 h-5 min-w-5 px-1 bg-warning-100 text-warning-700 dark:bg-warning-900/30 dark:text-warning-400 text-[10px]"
                               >
                                  {newCount > 99 ? '99+' : newCount}
                               </Chip>
                            )}
                        </div>
                     </div>
                  </Button>
               );
            })}
         </div>

         {/* Правая часть с деревом файлов */}
         <div className="flex-1 overflow-auto pl-2 pr-3 pt-3 pb-6">
            {buildFileTree(filteredLoggers, getLoggerCallsCount, currentTabPath).length === 0 ? (
               <div className="flex flex-col items-center justify-center h-full text-default-400">
                  <p>Нет логгеров в этой категории</p>
               </div>
            ) : (
               buildFileTree(filteredLoggers, getLoggerCallsCount, currentTabPath).map((node) => (
                  <TreeNodeComponent
                     key={node.path}
                     node={node}
                     level={0}
                     parentBlocked={false}
                     parentSwitchDisabled={false}
                  />
               ))
            )}
         </div>
      </div>
   );
}
