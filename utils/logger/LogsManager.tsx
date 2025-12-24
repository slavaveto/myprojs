'use client';

import React from 'react';
import { Button } from '@heroui/react';
import { PageLoggerPanel } from '@/utils/logger/LogsManager/RightPanel';
import { ValidationResultsPanel } from '@/utils/logger/LogsManager/ValidationPanel';
import { PinnedComponentsBar } from '@/utils/logger/LogsManager/PinnedComponentsBar';
import { LoggerHeader } from '@/utils/logger/LogsManager/LoggerHeader';
import { LoggerNavigation } from '@/utils/logger/LogsManager/LoggerNavigation';
import { LoggerProvider, useLoggerContext } from '@/utils/logger/LogsManager/LoggerContext';
import { buildFileTree } from '@/utils/logger/LogsManager/FileTreeUtils';
import { TreeNodeComponent } from '@/utils/logger/LogsManager/FileTree';

export function LoggerManagerPage({ tabHeight, isActive }: { tabHeight: number; isActive?: boolean }) {
   return (
      <LoggerProvider>
         <LoggerManagerLayout tabHeight={tabHeight} isActive={isActive} />
      </LoggerProvider>
   );
}

function LoggerManagerLayout({ tabHeight, isActive }: { tabHeight: number; isActive?: boolean }) {
   const {
      loggers,
      loggerCalls,
      loggerConfigs,
      pinnedComponents,
      pinnedLogs,
      selectedTab,
      folderFilters,
      selectedComponent,
      selectedFolder,
      componentLastViewed,
      showValidationResults,
      validationResults,
      setPinnedLogs,
      handleSelectComponent,
      updateLoggerConfig,
      updateLoggerCallConfig,
      handleDeleteLog,
      handleEditLog,
      getLoggerKey,
      getLoggerCallKey,
      getLoggerCallConfigKey,
      filteredLoggers,
      getLoggerCallsCount,
      currentTabPath,
      highlightedLogKey, // Added highlightedLogKey
      scanLoggers,
   } = useLoggerContext();

   // Auto-scan when active (only once when becoming active)
   const prevActiveRef = React.useRef(false);
   React.useEffect(() => {
      if (isActive && !prevActiveRef.current) {
         scanLoggers();
      }
      prevActiveRef.current = !!isActive;
   }, [isActive, scanLoggers]);

   // Показываем результаты только если пользователь сам открыл
   const hasValidationIssues =
      validationResults &&
      (validationResults.summary.loggerIssues > 0 || validationResults.summary.consoleIssues > 0);

   const shouldShowResults = showValidationResults && hasValidationIssues;

   return (
      <div className="flex flex-col" style={{ height: `calc(100vh - ${tabHeight}px)` }}>
         {/* Основная область */}

         <LoggerHeader />

         <div className="flex flex-1 min-h-0 overflow-hidden">
            <div className="flex-1 flex flex-col min-w-0 border-r border-default-200">
               {/* Результаты валидации */}
               <ValidationResultsPanel />

               {/* Pinned компоненты всегда сверху (если есть) */}
               {(() => {
                  const validPinnedCount = pinnedComponents.filter(key => {
                     if (!key) return false;
                     return loggers.some(l => getLoggerKey(l) === key);
                  }).length;
                  
                  if (validPinnedCount === 0) return null;

                  return (
                     <div className="border-b border-default-200  shrink-0 max-h-[200px] overflow-auto">
                        <div className="pr-2 py-3">
                           <PinnedComponentsBar />
                        </div>
                     </div>
                  );
               })()}

               {/* Основной контент с табами и деревом */}
               <LoggerNavigation />
            </div>

            {/* Правая панель с классом для отслеживания кликов */}
            <div className="logger-right-panel">
               <PageLoggerPanel
                  selectedPage={selectedComponent?.file.split('/')[0] || 'tree'}
                  selectedComponent={selectedComponent}
                  selectedFolder={selectedFolder}
                  loggers={loggers}
                  loggerCalls={loggerCalls}
                  loggerConfigs={loggerConfigs}
                  updateLoggerConfig={updateLoggerConfig}
                  updateLoggerCallConfig={updateLoggerCallConfig}
                  getLoggerKey={getLoggerKey}
                  getLoggerCallKey={getLoggerCallKey}
                  getLoggerCallConfigKey={getLoggerCallConfigKey}
                  folderFilters={folderFilters}
                  tabHeight={tabHeight + 60}
                  pinnedLogs={pinnedLogs}
                  setPinnedLogs={setPinnedLogs}
                  componentLastViewed={componentLastViewed}
                  onDeleteLog={handleDeleteLog}
                  onEditLog={handleEditLog}
                  selectedTab={selectedTab}
                  pinnedComponents={pinnedComponents}
                  highlightedLogKey={highlightedLogKey} // Pass highlightedLogKey
               />
            </div>
         </div>
      </div>
   );
}
