// utils/logger/LogsManager/RightPanel/useRightPanel.ts
import { useState, useEffect } from 'react';
import { useGlobalPersistentState } from '@/utils/storage';
import { LoggerCallInfo, LoggerConfig, PageLoggerPanelProps, SortField, SortDirection } from './types';

type UseRightPanelProps = Pick<
   PageLoggerPanelProps,
   | 'selectedComponent'
   | 'selectedFolder'
   | 'loggerCalls'
   | 'loggerConfigs'
   | 'updateLoggerCallConfig'
   | 'getLoggerCallConfigKey'
   | 'getLoggerCallKey'
   | 'pinnedLogs'
   | 'componentLastViewed'
   | 'folderFilters'
   | 'selectedTab'
   | 'pinnedComponents'
>;

export function useRightPanel({
   selectedComponent,
   selectedFolder,
   loggerCalls,
   loggerConfigs,
   updateLoggerCallConfig,
   getLoggerCallConfigKey,
   getLoggerCallKey,
   pinnedLogs,
   componentLastViewed,
   folderFilters,
   selectedTab,
   pinnedComponents,
}: UseRightPanelProps) {
   // State
   const [masterSwitchState, setMasterSwitchState] = useGlobalPersistentState<Record<string, boolean>>(
      'logger-master-switches',
      {}
   );
   const [displayFilter, setDisplayFilter] = useGlobalPersistentState<'all' | 'enabled' | 'disabled' | 'new'>(
      'logger-display-filter',
      'all'
   );
   const [lastViewedTimestamp, setLastViewedTimestamp] = useGlobalPersistentState<number>('logger-last-viewed', 0);
   const [sortField, setSortField] = useGlobalPersistentState<SortField>('logger-sort-field', 'line');
   const [sortDirection, setSortDirection] = useGlobalPersistentState<SortDirection>('logger-sort-direction', 'asc');

   // Component Logger Calls
   const getComponentLoggerCalls = () => {
      if (!selectedComponent) return [];
      return loggerCalls.filter(
         (call) => call.componentName === selectedComponent.name && call.file === selectedComponent.file
      );
   };

   // Folder Logger Calls
   const getFolderLoggerCalls = () => {
      if (!selectedFolder) return [];
      const result = loggerCalls.filter((call) => {
         let cleanPath = call.file.startsWith('/app/') ? call.file.substring(5) : call.file;
         if (cleanPath.startsWith('/')) cleanPath = cleanPath.substring(1);
         return cleanPath.startsWith(selectedFolder + '/') || cleanPath === selectedFolder;
      });

      return result.sort((a, b) => {
         let cleanPathA = a.file.startsWith('/app/') ? a.file.substring(5) : a.file;
         if (cleanPathA.startsWith('/')) cleanPathA = cleanPathA.substring(1);
         let cleanPathB = b.file.startsWith('/app/') ? b.file.substring(5) : b.file;
         if (cleanPathB.startsWith('/')) cleanPathB = cleanPathB.substring(1);

         const depthA = (cleanPathA.replace(selectedFolder + '/', '').match(/\//g) || []).length;
         const depthB = (cleanPathB.replace(selectedFolder + '/', '').match(/\//g) || []).length;

         if (depthA !== depthB) return depthA - depthB;
         return cleanPathA.localeCompare(cleanPathB);
      });
   };

   // All Calls Logic
   const allLoggerCalls = selectedComponent
      ? getComponentLoggerCalls()
      : selectedFolder
        ? getFolderLoggerCalls()
        : [];

   // Counts
   const enabledCount = allLoggerCalls.filter((call) => {
      const config = loggerConfigs[getLoggerCallConfigKey(call)];
      return config?.enabled !== false;
   }).length;
   const disabledCount = allLoggerCalls.length - enabledCount;

   const componentKey = selectedComponent ? `${selectedComponent.name}:${selectedComponent.file}` : '';
   const componentTimestamp = componentKey ? componentLastViewed[componentKey] || lastViewedTimestamp : lastViewedTimestamp;

   const newCount = allLoggerCalls.filter((call) => {
      const config = loggerConfigs[getLoggerCallConfigKey(call)];
      return (config?.createdAt || 0) > componentTimestamp;
   }).length;

   // Filtering
   const filteredLoggerCalls = allLoggerCalls.filter((call) => {
      if (displayFilter === 'all') return true;
      const config = loggerConfigs[getLoggerCallConfigKey(call)];
      const isEnabled = config?.enabled !== false;
      if (displayFilter === 'enabled') return isEnabled;
      if (displayFilter === 'disabled') return !isEnabled;
      if (displayFilter === 'new') return (config?.createdAt || 0) > componentTimestamp;
      return true;
   });

   // Sorting Helper
   const sortCalls = (calls: LoggerCallInfo[]) => {
      return [...calls].sort((a, b) => {
         let comparison = 0;
         const configA = loggerConfigs[getLoggerCallConfigKey(a)];
         const configB = loggerConfigs[getLoggerCallConfigKey(b)];

         switch (sortField) {
            case 'created':
               const createdA = configA?.createdAt || 0;
               const createdB = configB?.createdAt || 0;
               comparison = createdA - createdB;
               break;
            case 'message':
               comparison = a.message.localeCompare(b.message);
               break;
            case 'line':
            default:
               comparison = a.line - b.line;
               break;
         }

         return sortDirection === 'asc' ? comparison : -comparison;
      });
   };

   // Sorting
   const displayLoggerCalls = (() => {
      const pinnedCalls = filteredLoggerCalls.filter((call) =>
         pinnedLogs.includes(getLoggerCallConfigKey(call))
      );
      const otherCalls = filteredLoggerCalls.filter(
         (call) => !pinnedLogs.includes(getLoggerCallConfigKey(call))
      );

      // Сортируем каждую группу отдельно
      const sortedPinned = sortCalls(pinnedCalls);
      const sortedOthers = sortCalls(otherCalls);

      // Если дефолтная сортировка (по линии) - добавляем логику "Новые выше" для незакрепленных
      // Но если выбрана явная сортировка по created или message - не вмешиваемся
      if (sortField === 'line') {
         const othersNew = sortedOthers.filter((call) => {
            const config = loggerConfigs[getLoggerCallConfigKey(call)];
            return (config?.createdAt || 0) > componentTimestamp;
         });
         const othersOld = sortedOthers.filter((call) => {
            const config = loggerConfigs[getLoggerCallConfigKey(call)];
            return (config?.createdAt || 0) <= componentTimestamp;
         });
         // Возвращаем: Pinned -> New -> Others
         return [...sortedPinned, ...othersNew, ...othersOld];
      }

      return [...sortedPinned, ...sortedOthers];
   })();

   // Blocking Logic
   const isLoggerBlockedByFolders = (file: string) => {
      if (!folderFilters || (folderFilters as any).size === 0) return false;
      let cleanPath = file.startsWith('/app/') ? file.substring(5) : file;
      const pathParts = cleanPath.split('/').filter((p) => p !== '');
      const folderParts = pathParts.slice(0, -1);
      
      // @ts-ignore
      for (let i = 0; i < folderParts.length; i++) {
         const partialPath = folderParts.slice(0, i + 1).join('/');
         // @ts-ignore
         if (!folderFilters.has(partialPath)) return true;
      }
      return false;
   };

   // Master Switch Logic
   const getMasterSwitchKey = () => (selectedComponent ? `${selectedComponent.file}:${selectedComponent.name}` : '');
   
   const checkAllLogsState = () => {
      if (allLoggerCalls.length === 0) return null;
      const allEnabled = allLoggerCalls.every((call) => loggerConfigs[getLoggerCallConfigKey(call)]?.enabled !== false);
      const allDisabled = allLoggerCalls.every((call) => loggerConfigs[getLoggerCallConfigKey(call)]?.enabled === false);
      if (allEnabled) return true;
      if (allDisabled) return false;
      return null;
   };

   useEffect(() => {
      const allLogsState = checkAllLogsState();
      if (allLogsState !== null) {
         const key = getMasterSwitchKey();
         if (key) {
            const currentState = masterSwitchState[key] ?? true;
            if (currentState !== allLogsState) {
               setMasterSwitchState((prev) => ({ ...prev, [key]: allLogsState }));
            }
         }
      }
   }, [loggerConfigs, selectedComponent]); // Added selectedComponent dependency

   const toggleMasterSwitch = (enabled: boolean) => {
      const key = getMasterSwitchKey();
      if (!key) return;
      setMasterSwitchState((prev) => ({ ...prev, [key]: enabled }));
      allLoggerCalls.forEach((call) => updateLoggerCallConfig(call, { enabled }));
   };

   const currentMasterSwitchState = getMasterSwitchKey() ? masterSwitchState[getMasterSwitchKey()] ?? true : true;

   // Visibility Logic
   const shouldShowContent = () => {
      // Если выбран компонент или папка - показываем контент всегда
      if (selectedComponent || selectedFolder) return true;
      return false;
   };

   return {
      masterSwitchState: currentMasterSwitchState,
      displayFilter,
      setDisplayFilter,
      lastViewedTimestamp,
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
   };
}
