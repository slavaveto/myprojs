'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { useGlobalPersistentState, globalStorage } from '@/utils/storage';
import { useAuth } from '@clerk/nextjs';
import {
   buildFileTree,
   type LoggerInfo,
   type LoggerCallInfo,
   type LoggerConfig,
   type TreeNode,
} from '@/utils/logger/LogsManager/FileTreeUtils';
import { useLoggerAPI } from '@/utils/logger/LogsManager/useLoggerAPI';
import { ROOT_TABS } from '@/utils/logger/types';

interface LoggerContextType {
   // State
   loggers: LoggerInfo[];
   loggerCalls: LoggerCallInfo[];
   loggerConfigs: Record<string, LoggerConfig>;
   masterEnabled: boolean;
   pinnedComponents: string[];
   pinnedComponentsSwitchers: Record<string, boolean>;
   pinnedLogs: string[];
   pinnedComponentsOrder: string[];
   selectedTab: string;
   selectedRootTab: string;
   collapsedFolders: Set<string>;
   hiddenFolders: Set<string>; // Added hiddenFolders
   folderFilters: Set<string>;
   selectedComponent: { name: string; file: string } | null;
   selectedFolder: string | null;
   lastViewedTimestamp: number;
   componentLastViewed: Record<string, number>;
   openPopover: string | null;
   showToasts: boolean;
   showHidden: boolean; // Added showHidden
   validationResults: any;
   selectedFilter: 'correct' | 'incorrect' | 'console';
   showValidationResults: boolean;
   newLogsCount: number;
   loading: boolean;
   validationLoading: boolean;
   tabSelectionHistory: Record<string, { component: { name: string; file: string } | null, folder: string | null }>; // Added tabSelectionHistory
   highlightedLogKey: string | null; // Added highlightedLogKey
   scanDiff: any | null; // Exposed diff state

   // Derived
   filteredLoggers: LoggerInfo[];
   currentTabPath: string | undefined;
   
   // Setters & Actions
   setMasterEnabled: (value: boolean) => void;
   setShowToasts: (value: boolean) => void;
   setShowHidden: (value: boolean) => void; // Added setShowHidden
   scanLoggers: () => Promise<void>;
   fixSelectedLoggerLines: () => Promise<void>;
   fixConsoleLogLines: () => Promise<void>;
   deleteConsoleLog: (file: string, line: number) => Promise<void>; // Added
   cleanupOldConfigs: () => void; // Added cleanup action
   setShowValidationResults: (value: boolean) => void;
   validateLoggerLines: () => Promise<void>;
   setSelectedRootTab: (value: string) => void;
   setSelectedTab: (value: string) => void;
   setPinnedComponentsSwitchers: (value: Record<string, boolean> | ((prev: Record<string, boolean>) => Record<string, boolean>)) => void;
   setPinnedComponentsOrder: (value: string[] | ((prev: string[]) => string[])) => void;
   setComponentLastViewed: (value: Record<string, number> | ((prev: Record<string, number>) => Record<string, number>)) => void;
   setOpenPopover: (value: string | null) => void;
   setPinnedLogs: (value: string[] | ((prev: string[]) => string[])) => void;
   setSelectedFilter: (value: 'correct' | 'incorrect' | 'console') => void;
   getFilteredResults: () => any[];
   confirmScan: () => void; // Apply changes
   smartApply: () => Promise<void>; // Smart Apply
   cancelScan: () => void; // Discard changes
   clearStaleConfigs: () => void; // Added clearStaleConfigs
   restoreFromBackup: () => void; // Added restoreFromBackup
   handleHardReset: () => void; // Added handleHardReset
   setHighlightedLogKey: (value: string | null) => void; // Added setHighlightedLogKey
   handleNavigateToLog: (call: LoggerCallInfo, rootTabId: string) => void; // Added handleNavigateToLog
   handleNavigateToComponent: (component: {name: string, file: string}, rootTabId: string) => void; // Added handleNavigateToComponent
   toggleHidden: (loggerKey: string) => void; // Added toggleHidden

   // Methods
   toggleFolder: (folderPath: string) => void;
   toggleFolderHidden: (folderPath: string) => void; // Added toggleFolderHidden
   toggleFolderFilter: (folderPath: string) => void;
   handleSelectFolder: (folderPath: string) => void;
   handleSelectComponent: (component: { name: string; file: string }) => void;
   togglePin: (loggerKey: string) => void;
   updateLoggerConfig: (logger: LoggerInfo, config: Partial<LoggerConfig>) => void;
   updateLoggerCallConfig: (loggerCall: LoggerCallInfo, config: Partial<LoggerConfig>) => void;
   handleDeleteLog: (file: string, line: number) => Promise<void>;
   handleEditLog: (file: string, line: number, newMessage: string, newMethod: string) => Promise<void>;
   handleRenameLogger: (file: string, oldName: string, newName: string) => Promise<void>;
   
   // Helpers
   getLoggerKey: (logger: LoggerInfo) => string;
   getLoggerCallKey: (loggerCall: LoggerCallInfo) => string;
   getLoggerCallConfigKey: (loggerCall: LoggerCallInfo) => string;
   getLoggerCallsCount: (componentName: string, file: string) => number;
}

const LoggerContext = createContext<LoggerContextType | null>(null);

export const useLoggerContext = () => {
   const context = useContext(LoggerContext);
   if (!context) {
      throw new Error('useLoggerContext must be used within a LoggerProvider');
   }
   return context;
};

export function LoggerProvider({ children }: { children: React.ReactNode }) {
   const logger = createLogger('LoggerProvider');
   const { isSignedIn } = useAuth();

   // --- State Definitions ---
   const [loggers, setLoggers] = useGlobalPersistentState<LoggerInfo[]>('logger-list', []);
   const [loggerCalls, setLoggerCalls] = useGlobalPersistentState<LoggerCallInfo[]>('logger-calls-list', []);
   const [loggerConfigs, setLoggerConfigs] = useGlobalPersistentState<Record<string, LoggerConfig>>('logger-configs', {});
   const [masterEnabled, setMasterEnabled] = useGlobalPersistentState('logger-master-enabled', true);
   const [selectedRootTab, setSelectedRootTab] = useGlobalPersistentState<string>('logger-root-tab', 'app');
   const [folderFiltersArray, setFolderFiltersArray] = useGlobalPersistentState<string[]>('logger-folder-filters', []);
   const [pinnedComponents, setPinnedComponents] = useGlobalPersistentState<string[]>('logger-pinned-components', []);
   const [pinnedComponentsSwitchers, setPinnedComponentsSwitchers] = useGlobalPersistentState<Record<string, boolean>>('logger-pinned-switchers', {});
   const [pinnedLogs, setPinnedLogs] = useGlobalPersistentState<string[]>('logger-pinned-logs', []);
   const [pinnedComponentsOrder, setPinnedComponentsOrder] = useGlobalPersistentState<string[]>('logger-pinned-components-order', []);
   const [selectedTab, setSelectedTab] = useGlobalPersistentState<string>('logger-selected-tab', 'filetree');
   const [selectedComponent, setSelectedComponent] = useGlobalPersistentState<{ name: string; file: string } | null>('logger-selected-component', null);
   const [selectedFolder, setSelectedFolder] = useGlobalPersistentState<string | null>('logger-selected-folder', null);
   const [lastViewedTimestamp, setLastViewedTimestamp] = useGlobalPersistentState<number>('logger-last-viewed', 0);
   const [componentLastViewed, setComponentLastViewed] = useGlobalPersistentState<Record<string, number>>('logger-component-last-viewed', {});
   const [collapsedFoldersArray, setCollapsedFoldersArray] = useGlobalPersistentState<string[]>('logger-collapsed-folders', []);
   const [hiddenFoldersArray, setHiddenFoldersArray] = useGlobalPersistentState<string[]>('logger-hidden-folders', []); // Added hiddenFolders
   const [showToasts, setShowToasts] = useGlobalPersistentState('logger-show-toasts', false);
   const [showHidden, setShowHidden] = useGlobalPersistentState('logger-show-hidden', false);
   const [validationResults, setValidationResults] = useGlobalPersistentState<any>('logger-validation-results', null);
   const [newLogsCount, setNewLogsCount] = useGlobalPersistentState('logger-new-logs-count', 0);
   // History of selected components per root tab
   const [tabSelectionHistory, setTabSelectionHistory] = useGlobalPersistentState<Record<string, { component: { name: string; file: string } | null, folder: string | null }>>('logger-tab-selection-history', {});
   
   // --- Scan Confirmation State ---
   // Moved inside useLoggerAPI or kept here?
   // Actually, useLoggerAPI manages the scan logic, so it should own the state and exposed it.
   // So I remove the useState here to avoid duplication if useLoggerAPI handles it.
   // But wait, useLoggerAPI is a hook used inside the component.
   
   // Highlighted Log (for Search)
   const [highlightedLogKey, setHighlightedLogKey] = useState<string | null>(null);

   // Local State
   const [openPopover, setOpenPopover] = useState<string | null>(null);
   const [selectedFilter, setSelectedFilter] = useState<'correct' | 'incorrect' | 'console'>('incorrect');
   const [showValidationResults, setShowValidationResults] = useState(false);
   const [pendingRename, setPendingRename] = useState<{ file: string; newName: string } | null>(null);

   // --- Helpers ---
   const getFileName = (path: string) => path.split('/').pop() || path;

   const getLoggerKey = useCallback((logger: LoggerInfo) => {
      const fileName = getFileName(logger.file);
      return `${logger.name}:${fileName}:component`;
   }, []);
   
   const getLoggerCallKey = useCallback((loggerCall: LoggerCallInfo) => 
      `${loggerCall.file}:${loggerCall.componentName}:${loggerCall.method}:${loggerCall.message}:${loggerCall.line}`, []);
   
   const getLoggerCallConfigKey = useCallback((loggerCall: LoggerCallInfo) => {
      const fileName = getFileName(loggerCall.file);
      return `${loggerCall.componentName}:${fileName}:${loggerCall.method}:${loggerCall.message}`;
   }, []);

   const getLoggerCallsCount = useCallback((componentName: string, file: string) => {
      return loggerCalls.filter(
         (call) => call.componentName === componentName && call.file === file
      ).length;
   }, [loggerCalls]);

   // --- Folder Logic ---
   const collapsedFolders = new Set(
      Array.isArray(collapsedFoldersArray) ? collapsedFoldersArray : []
   );
   const setCollapsedFolders = (newSet: Set<string>) => {
      setCollapsedFoldersArray(Array.from(newSet));
   };

   // Hidden Folders
   const hiddenFolders = new Set(
      Array.isArray(hiddenFoldersArray) ? hiddenFoldersArray : []
   );
   const toggleFolderHidden = (folderPath: string) => {
       const newHidden = new Set(hiddenFolders);
       if (newHidden.has(folderPath)) {
           newHidden.delete(folderPath);
       } else {
           newHidden.add(folderPath);
       }
       setHiddenFoldersArray(Array.from(newHidden));
   };

   // Folder Filters (Stubbed always true)
   const folderFilters = new Set<string>();
   // @ts-ignore
   folderFilters.has = () => true;

   const toggleFolder = (folderPath: string) => {
      const newCollapsed = new Set(collapsedFolders);
      if (newCollapsed.has(folderPath)) {
         newCollapsed.delete(folderPath); // Развернуть (удалить из скрытых)
      } else {
         newCollapsed.add(folderPath); // Свернуть (добавить в скрытые)
      }
      setCollapsedFolders(newCollapsed);
   };

   const toggleFolderFilter = (folderPath: string) => {
       // Legacy
   };

   // --- Filtering ---
   const getFilteredLoggers = useCallback(() => {
      const currentTab = ROOT_TABS.find(t => t.id === selectedRootTab);
      if (!currentTab) return loggers;

      return loggers.filter(logger => {
         const filePath = logger.file.startsWith('/') ? logger.file.substring(1) : logger.file;
         
         if (!filePath.startsWith(currentTab.path)) return false;

         // Filter Excluded Paths (e.g. app/admin from app)
         if (currentTab.exclude) {
             for (const excludePath of currentTab.exclude) {
                 if (filePath.startsWith(excludePath + '/') || filePath === excludePath) {
                     return false;
                 }
             }
         }

         // Filter Hidden Folders
         if (!showHidden) {
             for (const hiddenFolder of hiddenFolders) {
                 if (filePath.startsWith(hiddenFolder + '/') || filePath === hiddenFolder) {
                     return false;
                 }
             }
         }

         // Filter Hidden
         const loggerKey = getLoggerKey(logger);
         const config = loggerConfigs[loggerKey];
         if (config?.isHidden && !showHidden) {
             return false;
         }

         return true;
      });
   }, [loggers, selectedRootTab, loggerConfigs, showHidden, getLoggerKey, hiddenFolders]);

   const filteredLoggers = getFilteredLoggers();
   const currentTabPath = ROOT_TABS.find(t => t.id === selectedRootTab)?.path;

   // --- API Hook ---
   const {
      loading,
      validationLoading,
      scanLoggers,
      validateLoggerLines,
      fixSelectedLoggerLines,
      fixConsoleLogLines,
      deleteConsoleLog, // Added
      getFilteredResults,
      confirmScan,
      smartApply,
      cancelScan,
      clearStaleConfigs,
      scanDiff,
      restoreFromBackup // Added restoreFromBackup
   } = useLoggerAPI({
      loggerConfigs,
      validationResults,
      selectedFilter,
      setLoggers,
      setLoggerCalls,
      setLoggerConfigs,
      setNewLogsCount,
      setValidationResults,
      setShowValidationResults,
      getLoggerCallConfigKey,
   });

   // --- Effects ---
   
   // Restore selection when switching tabs
   useEffect(() => {
      const history = tabSelectionHistory[selectedRootTab];
      if (history) {
         // Check if component/folder still exists
         if (history.component) {
             const exists = loggers.some(l => l.name === history.component?.name && l.file === history.component?.file);
             if (exists) {
                setSelectedComponent(history.component);
                setSelectedFolder(null);
             } else {
                setSelectedComponent(null);
                setSelectedFolder(null); 
             }
         } else if (history.folder) {
             // For folders we could check if any logger starts with path, but let's just trust history for now
             // or check against filteredLoggers
             setSelectedComponent(null);
             setSelectedFolder(history.folder);
         } else {
             setSelectedComponent(null);
             setSelectedFolder(null);
         }
      } else {
         // No history for this tab
         setSelectedComponent(null);
         setSelectedFolder(null);
      }
   }, [selectedRootTab]); // Only on tab change

   // Auto-expand logic removed (all folders expanded by default now)

   // Restore selection after rename
   useEffect(() => {
      if (pendingRename && loggers.length > 0) {
         const renamedLogger = loggers.find(
            (l) => l.name === pendingRename.newName && l.file === pendingRename.file
         );

         if (renamedLogger) {
            setSelectedComponent({
               name: renamedLogger.name,
               file: renamedLogger.file,
            });
            setPendingRename(null);
         }
      }
   }, [loggers, pendingRename, setSelectedComponent]);

   // Reload handling
   useEffect(() => {
      const wasTabSwitch = sessionStorage.getItem('logger-tab-switched');

      if (wasTabSwitch) {
         sessionStorage.removeItem('logger-tab-switched');
      } else {
         scanLoggers();
         validateLoggerLines();
      }
   }, []);

   useEffect(() => {
      return () => {
         sessionStorage.setItem('logger-tab-switched', 'true');
      };
   }, []);

   // Clear invalid selection
   useEffect(() => {
      if (selectedComponent && loggers.length > 0 && !pendingRename) {
         const exists = loggers.some(
            (l) => l.name === selectedComponent.name && l.file === selectedComponent.file
         );
         if (!exists) {
            setSelectedComponent(null);
         }
      }
   }, [loggers, selectedComponent, pendingRename]);

   // --- Actions ---

   const updateLoggerConfig = (logger: LoggerInfo, config: Partial<LoggerConfig>) => {
      const loggerKey = getLoggerKey(logger);
      const fileName = getFileName(logger.file);
      const componentPrefix = `${logger.name}:${fileName}:`;

      setLoggerConfigs((prev) => {
         const updated = { ...prev };
         
         // Удалена логика каскадного обновления дочерних логов
         // Теперь обновляем только конфиг самого компонента
         
         const loggerKey = getLoggerKey(logger);
         const componentKey = `${logger.name}:${fileName}:component`;

         const existingComponentConfig = prev[componentKey];
         updated[componentKey] = {
            enabled: existingComponentConfig?.enabled ?? true,
            color: existingComponentConfig?.color ?? 'black',
            filePath: existingComponentConfig?.filePath,
            createdAt: existingComponentConfig?.createdAt,
            ...config,
            lastChanged: config.enabled !== undefined ? Date.now() : existingComponentConfig?.lastChanged,
         };

         // Также обновляем ключ компонента в списке (если он использовался как ключ логгера, что в новой системе редкость, но для совместимости оставим)
         if (prev[loggerKey]) {
             const existingConfig = prev[loggerKey];
             updated[loggerKey] = {
                enabled: existingConfig?.enabled ?? true,
                color: existingConfig?.color ?? 'black',
                filePath: existingConfig?.filePath,
                createdAt: existingConfig?.createdAt,
                ...config,
                lastChanged: config.enabled !== undefined ? Date.now() : existingConfig?.lastChanged,
             };
         }
         
         return updated;
      });

      if (config.color) {
         setOpenPopover(null);
      }
   };

   const updateLoggerCallConfig = (loggerCall: LoggerCallInfo, config: Partial<LoggerConfig>) => {
      const loggerCallConfigKey = getLoggerCallConfigKey(loggerCall);

      setLoggerConfigs((prev) => {
         const existingConfig = prev[loggerCallConfigKey];
         const newConfig = {
            enabled: existingConfig?.enabled ?? true,
            color: existingConfig?.color ?? 'black',
            filePath: existingConfig?.filePath,
            createdAt: existingConfig?.createdAt,
            ...config,
            lastChanged: config.enabled !== undefined ? Date.now() : existingConfig?.lastChanged,
         };

         return {
            ...prev,
            [loggerCallConfigKey]: newConfig,
         };
      });
   };

   const handleSelectFolder = (folderPath: string) => {
      setSelectedFolder(folderPath);
      setSelectedComponent(null);
      
      // Save to history
      setTabSelectionHistory(prev => ({
         ...prev,
         [selectedRootTab]: { component: null, folder: folderPath }
      }));
   };

   const handleSelectComponent = (component: { name: string; file: string }) => {
      setSelectedComponent(component);
      setSelectedFolder(null);
      setHighlightedLogKey(null); // Сбрасываем подсветку при ручном выборе

      // Save to history
      setTabSelectionHistory(prev => ({
         ...prev,
         [selectedRootTab]: { component, folder: null }
      }));
   };

   const togglePin = (loggerKey: string) => {
      setPinnedComponents((prev) => {
         const isPinned = prev.includes(loggerKey);
         
         if (isPinned) {
            setPinnedComponentsSwitchers((sw) => {
               const updated = { ...sw };
               delete updated[loggerKey];
               return updated;
            });
            setPinnedComponentsOrder((order) => order.filter((k) => k !== loggerKey));
            return prev.filter((k) => k !== loggerKey);
         } else {
            setPinnedComponentsSwitchers((sw) => ({
               ...sw,
               [loggerKey]: true,
            }));
            setPinnedComponentsOrder((order) => [...order, loggerKey]);
            if (prev.length === 0) {
               setSelectedTab('pinned');
            }
            return [...prev, loggerKey];
         }
      });
   };

   const handleDeleteLog = async (file: string, line: number) => {
      try {
         const response = await fetch('/api/logger/delete-log-line', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file, line }),
         });

         if (response.ok) {
            logger.success('✅ Log line deleted successfully', { file, line });
            
            // 1. Find the log call being deleted
            const deletedCall = loggerCalls.find(c => c.file === file && c.line === line);
            
            let updatedConfigs = { ...loggerConfigs };
            let deletionSuccess = false;

            if (deletedCall) {
                const configKey = getLoggerCallConfigKey(deletedCall);
                
                // 2. Remove config if exists
                if (updatedConfigs[configKey]) {
                    delete updatedConfigs[configKey];
                    deletionSuccess = true;
                    logger.info('Deleted config for removed log', { configKey });
                }
            }
            
            if (deletionSuccess) {
                setLoggerConfigs(updatedConfigs);
                // 3. Scan with new configs to prevent "Stale Config" detection
                await scanLoggers(false, updatedConfigs);
            } else {
                await scanLoggers();
            }
         } else {
            const data = await response.json();
            logger.error('Failed to delete log line', { error: data.error });
         }
      } catch (error) {
         logger.error('Error deleting log line', error);
      }
   };

   const handleEditLog = async (file: string, line: number, newMessage: string, newMethod: string) => {
      try {
         const response = await fetch('/api/logger/edit-log-line', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file, line, newMessage, newMethod }),
         });

         if (response.ok) {
            logger.success('✅ Log line edited successfully', { file, line });
            
            // 1. Find the old log call using file and line (before re-scan)
            const oldCall = loggerCalls.find(c => c.file === file && c.line === line);
            
            let updatedConfigs = { ...loggerConfigs };
            let migrationSuccess = false;

            if (oldCall) {
                const oldKey = getLoggerCallConfigKey(oldCall);
                
                // 2. Create a temporary object for the new call to generate the new key
                const newCall = { 
                    ...oldCall, 
                    message: newMessage, 
                    method: newMethod 
                };
                const newKey = getLoggerCallConfigKey(newCall);
                
                // 3. Migrate config if it exists
                if (updatedConfigs[oldKey]) {
                    updatedConfigs[newKey] = { ...updatedConfigs[oldKey], lastChanged: Date.now() };
                    delete updatedConfigs[oldKey];
                    migrationSuccess = true;
                    logger.info('Migrated config for edited log', { oldKey, newKey });
                }
            }
            
            if (migrationSuccess) {
                setLoggerConfigs(updatedConfigs);
                // 4. Scan with new configs to avoid "New Log" detection
                await scanLoggers(false, updatedConfigs);
            } else {
                // Fallback to normal scan
                await scanLoggers();
            }
         } else {
            const data = await response.json();
            logger.error('Failed to edit log line', { error: data.error });
         }
      } catch (error) {
         logger.error('Error editing log line', error);
      }
   };

   const handleRenameLogger = async (file: string, oldName: string, newName: string) => {
      try {
         const response = await fetch('/api/logger/rename-logger', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file, oldName, newName }),
         });

         const data = await response.json();

         if (response.ok) {
            logger.info('Logger renamed successfully', { file, oldName, newName });

            setPendingRename({ file, newName });

            const fileName = getFileName(file);
            
            const oldKeyBase = `${oldName}:${fileName}`;
            const newKeyBase = `${newName}:${fileName}`;
            
            setPinnedComponents(prev => {
               const updated = prev.map(key => {
                  if (key.includes(`:${fileName}:`)) {
                     const parts = key.split(':');
                     const suffix = parts[parts.length - 1];
                     return `${newKeyBase}:${suffix}`;
                  }
                  return key;
               });
               return Array.from(new Set(updated));
            });
            
            setPinnedComponentsOrder(prev => {
               const updated = prev.map(key => {
                  if (key.includes(`:${fileName}:`)) {
                     const parts = key.split(':');
                     const suffix = parts[parts.length - 1];
                     return `${newKeyBase}:${suffix}`;
                  }
                  return key;
               });
               return Array.from(new Set(updated));
            });

            setPinnedComponentsSwitchers(prev => {
               const updated = { ...prev };
               Object.keys(updated).forEach(key => {
                  if (key.includes(`:${fileName}`)) {
                     const parts = key.split(':');
                     const suffix = parts.length > 2 ? parts[parts.length - 1] : '';
                     const newKey = suffix ? `${newKeyBase}:${suffix}` : newKeyBase;
                     updated[newKey] = updated[key];
                     delete updated[key];
                  }
               });
               return updated;
            });

            // Calculate new configs synchronously to pass to scanner
            const updatedConfigs = { ...loggerConfigs };
            const keysToRename = Object.keys(updatedConfigs).filter(key => key.startsWith(`${oldName}:${fileName}:`));
            
            keysToRename.forEach(key => {
               const newConfigKey = key.replace(`${oldName}:${fileName}:`, `${newName}:${fileName}:`);
               updatedConfigs[newConfigKey] = updatedConfigs[key];
               delete updatedConfigs[key];
            });
            
            setLoggerConfigs(updatedConfigs);

            await scanLoggers(false, updatedConfigs);
         } else {
            logger.error('Failed to rename logger', { error: data.error });
         }
      } catch (error) {
         logger.error('Error renaming logger', error);
      }
   };

   const handleHardReset = useCallback(() => {
      // Clear all logger-related keys from local Storage
      const keysToRemove = [
         'logger-list',
         'logger-calls-list',
         'logger-configs',
         'logger-master-enabled',
         'logger-root-tab',
         'logger-folder-filters',
         'logger-pinned-components',
         'logger-pinned-switchers',
         'logger-pinned-logs',
         'logger-pinned-components-order',
         'logger-selected-tab',
         'logger-selected-component',
         'logger-selected-folder',
         'logger-last-viewed',
         'logger-component-last-viewed',
         'logger-collapsed-folders', // Clear collapsed folders
         'logger-validation-results',
         'logger-new-logs-count',
         'logger-tab-selection-history', // Clear tab history
         'logger-sort-field', // Clear sort field
         'logger-sort-direction', // Clear sort direction
         'logger-display-filter', // Clear display filter
      ];

      keysToRemove.forEach((key) => {
         globalStorage.removeItem(key);
      });

      // Reload the page to re-initialize everything
      window.location.reload();
   }, []);

   const cleanupOldConfigs = useCallback(() => {
       setLoggerConfigs((prev) => {
           const activeKeys = new Set<string>();
           
           // Collect active calls keys
           loggerCalls.forEach(call => {
               activeKeys.add(getLoggerCallConfigKey(call));
           });
           
           // Collect active components keys
           loggers.forEach(logger => {
               const fileName = getFileName(logger.file);
               activeKeys.add(`${logger.name}:${fileName}:component`);
           });

           const updated = { ...prev };
           let removedCount = 0;

           Object.keys(updated).forEach(key => {
               if (!activeKeys.has(key)) {
                   delete updated[key];
                   removedCount++;
               }
           });

           if (removedCount > 0) {
               logger.success('Cleaned up old configs', { removedCount });
           } else {
               logger.info('No old configs to clean');
           }
           
           return updated;
       });
   }, [loggerCalls, loggers, getLoggerCallConfigKey, getFileName]);

   const handleNavigateToLog = useCallback((call: LoggerCallInfo, rootTabId: string) => {
      const component = { name: call.componentName, file: call.file };
      const configKey = getLoggerCallConfigKey(call);

      // 1. Update history for the target tab so restoration logic picks it up
      setTabSelectionHistory(prev => ({
         ...prev,
         [rootTabId]: { component, folder: null }
      }));

      // 2. Set the active component directly (for immediate feedback and same-tab navigation)
      setSelectedComponent(component);
      setSelectedFolder(null);
      setHighlightedLogKey(configKey);

      // 3. Switch tab (this will trigger useEffect, but history is already updated)
      setSelectedRootTab(rootTabId);
   }, [getLoggerCallConfigKey, setTabSelectionHistory, setSelectedComponent, setSelectedFolder, setHighlightedLogKey, setSelectedRootTab]);

   const handleNavigateToComponent = useCallback((component: {name: string, file: string}, rootTabId: string) => {
      // 1. Update history for the target tab so restoration logic picks it up
      setTabSelectionHistory(prev => ({
         ...prev,
         [rootTabId]: { component, folder: null }
      }));

      // 2. Set the active component directly (for immediate feedback and same-tab navigation)
      setSelectedComponent(component);
      setSelectedFolder(null);
      setHighlightedLogKey(null); // Clear highlight

      // 3. Switch tab (this will trigger useEffect, but history is already updated)
      setSelectedRootTab(rootTabId);
   }, [setTabSelectionHistory, setSelectedComponent, setSelectedFolder, setHighlightedLogKey, setSelectedRootTab]);

   const toggleHidden = useCallback((loggerKey: string) => {
      setLoggerConfigs((prev) => {
         const existingConfig = prev[loggerKey];
         const isHidden = existingConfig?.isHidden ?? false;
         
         return {
            ...prev,
            [loggerKey]: {
               ...existingConfig,
               enabled: existingConfig?.enabled ?? true,
               color: existingConfig?.color ?? 'black',
               isHidden: !isHidden,
               lastChanged: Date.now(),
            },
         };
      });
      // Если мы скрываем текущий выбранный компонент - сбрасываем выбор
      if (selectedComponent) {
          const fileName = getFileName(selectedComponent.file);
          const key = `${selectedComponent.name}:${fileName}:component`;
          if (key === loggerKey) {
              setSelectedComponent(null);
          }
      }
   }, [setLoggerConfigs, selectedComponent]); // getFileName is stable helper but inside scope? No, defined in component.

   return (
      <LoggerContext.Provider
         value={{
            loggers,
            loggerCalls,
            loggerConfigs,
            masterEnabled,
            pinnedComponents,
            pinnedComponentsSwitchers,
            pinnedLogs,
            pinnedComponentsOrder,
            selectedTab,
            selectedRootTab,
            collapsedFolders,
            hiddenFolders, // Added hiddenFolders
            folderFilters,
            selectedComponent,
            selectedFolder,
            lastViewedTimestamp,
            componentLastViewed,
            openPopover,
            showToasts,
            showHidden, // Added
            validationResults,
            selectedFilter,
            showValidationResults,
            newLogsCount,
            loading,
            validationLoading,
            filteredLoggers,
            currentTabPath,
            tabSelectionHistory, // Provided tabSelectionHistory
            highlightedLogKey, // Added highlightedLogKey
            scanDiff, // Exposed scanDiff
            setMasterEnabled,
            setShowToasts,
            setShowHidden, // Added
            scanLoggers,
            confirmScan, // Exposed confirmScan
            smartApply, // Exposed smartApply
            cancelScan, // Exposed cancelScan
            clearStaleConfigs, // Exposed clearStaleConfigs
            restoreFromBackup, // Exposed restoreFromBackup
            fixSelectedLoggerLines,
            fixConsoleLogLines,
            deleteConsoleLog, // Added
            cleanupOldConfigs, // Added cleanup action
            setShowValidationResults,
            validateLoggerLines,
            setSelectedRootTab,
            setSelectedTab,
            setPinnedComponentsSwitchers,
            setPinnedComponentsOrder,
            setComponentLastViewed,
            setOpenPopover,
            setPinnedLogs,
            setSelectedFilter,
            getFilteredResults,
            handleHardReset, // Added handleHardReset
            toggleFolder,
            toggleFolderHidden, // Added toggleFolderHidden
            toggleFolderFilter,
            handleSelectFolder,
            handleSelectComponent,
            togglePin,
            toggleHidden, // Added
            updateLoggerConfig,
            updateLoggerCallConfig,
            handleDeleteLog,
            handleEditLog,
            handleRenameLogger,
            setHighlightedLogKey, // Added setHighlightedLogKey
            handleNavigateToLog, // Added handleNavigateToLog
            handleNavigateToComponent, // Added handleNavigateToComponent
            getLoggerKey,
            getLoggerCallKey,
            getLoggerCallConfigKey,
            getLoggerCallsCount,
         }}
      >
         {children}
      </LoggerContext.Provider>
   );
}
