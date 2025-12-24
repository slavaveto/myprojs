'use client';

import React, { useState, useEffect } from 'react';
import { createLogger } from '@/utils/logger/Logger';

import { PageLoggerPanelProps } from './RightPanel/types';
import { useRightPanel } from './RightPanel/useRightPanel';
import { RightPanelHeader } from './RightPanel/RightPanelHeader';
import { LogItem } from './RightPanel/LogItem';

// Re-export types for consumers
export type { PageLoggerPanelProps } from './RightPanel/types';

const logger = createLogger('PageLoggerPanel');

export function PageLoggerPanel(props: PageLoggerPanelProps) {
   const {
   selectedComponent,
   selectedFolder,
   loggerConfigs,
   updateLoggerCallConfig,
   getLoggerCallConfigKey,
      getLoggerCallKey,
   pinnedLogs,
   setPinnedLogs,
   onDeleteLog,
   onEditLog,
   tabHeight,
   highlightedLogKey, // Added highlightedLogKey prop
   } = props;

   const [isClient, setIsClient] = useState(false);

   useEffect(() => {
      setIsClient(true);
   }, []);

   const {
      masterSwitchState,
      displayFilter,
      setDisplayFilter,
      setLastViewedTimestamp,
      allLoggerCalls,
      displayLoggerCalls,
      enabledCount,
      disabledCount,
      newCount,
      componentTimestamp,
      toggleMasterSwitch,
      isLoggerBlockedByFolders,
      shouldShowContent,
      sortField,
      setSortField,
      sortDirection,
      setSortDirection,
   } = useRightPanel(props);

   return (
      <div
         className="w-[550px] h-[600px] border-l border-divider flex flex-col overflow-auto"
         style={{ height: `calc(100vh - ${tabHeight}px)` }}
      >
         {!shouldShowContent() ? (
            <div className="flex items-center justify-center h-full text-default-400">
               <p className="text-lg">
                  {props.selectedTab === 'pinned' 
                     ? 'Выберите компонент из Pinned' 
                     : 'Выберите компонент из дерева'}
               </p>
            </div>
         ) : (
            <>
               <RightPanelHeader
                  selectedComponent={selectedComponent}
                  selectedFolder={selectedFolder}
                  allLoggerCalls={allLoggerCalls}
                  displayLoggerCalls={displayLoggerCalls}
                  displayFilter={displayFilter}
                  setDisplayFilter={setDisplayFilter}
                  enabledCount={enabledCount}
                  disabledCount={disabledCount}
                  newCount={newCount}
                  setLastViewedTimestamp={setLastViewedTimestamp}
                  masterSwitchState={masterSwitchState}
                  toggleMasterSwitch={toggleMasterSwitch}
                  sortField={sortField}
                  setSortField={setSortField}
                  sortDirection={sortDirection}
                  setSortDirection={setSortDirection}
               />

         <div className="flex-1 overflow-auto">
            {displayLoggerCalls.length === 0 ? (
               <div className="p-4 text-center text-default-500">
                  <p className="text-sm">
                     {selectedComponent
                        ? 'Нет логгеров в этом компоненте'
                        : 'Выберите компонент чтобы увидеть его логи'}
                  </p>
               </div>
            ) : (
                     <div className="p-4 space-y-3 pr-4">
                        {displayLoggerCalls.map((loggerCall) => {
                           const loggerCallKey = getLoggerCallKey(loggerCall);
                           const loggerCallConfigKey = getLoggerCallConfigKey(loggerCall);
                           const config = loggerConfigs[loggerCallConfigKey] || {
                              enabled: false,
                              color: 'black',
                           };

                           const isBlocked = isLoggerBlockedByFolders(loggerCall.file);

                           // Config for component color
                           // Используем точный ключ компонента, чтобы не брать случайно конфиг одного из логов
                           const fileName = loggerCall.file.split('/').pop() || loggerCall.file;
                           const componentConfigKey = `${loggerCall.componentName}:${fileName}:component`;
                           
                           const componentConfig = loggerConfigs[componentConfigKey] || { enabled: false, color: 'black' };
                           const componentColor = componentConfig.color || 'black';

                           const groupCount = displayLoggerCalls.filter(
                              (call) => getLoggerCallConfigKey(call) === loggerCallConfigKey
                           ).length;
                           const isGrouped = groupCount > 1;

                           const createdAt = config.createdAt || 0;
                           const isNewLog = createdAt > componentTimestamp;
                           const isHighlighted = highlightedLogKey === loggerCallConfigKey; // Check highlight

                           return (
                              <LogItem
                                 key={loggerCallKey}
                                 loggerCall={loggerCall}
                                 config={config}
                                 isBlocked={isBlocked}
                                 isGrouped={isGrouped}
                                 isNewLog={isNewLog}
                                 isHighlighted={isHighlighted} // Pass isHighlighted
                                 pinnedLogs={pinnedLogs}
                                 componentColor={componentColor}
                                 loggerCallKey={loggerCallKey}
                                 loggerCallConfigKey={loggerCallConfigKey}
                                 updateLoggerCallConfig={updateLoggerCallConfig}
                                 setPinnedLogs={setPinnedLogs}
                                 onDeleteLog={onDeleteLog}
                                 onEditLog={onEditLog}
                              />
                                                                        );
                                                                     })}
                                                                  </div>
                  )}
                                                                     </div>
            </>
         )}
                                                      </div>
   );
}
