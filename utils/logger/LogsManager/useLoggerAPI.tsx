import { useState, useCallback } from 'react';
import React from 'react';
import toast from 'react-hot-toast';
import { createLogger } from '@/utils/logger/Logger';
import type { LoggerInfo, LoggerCallInfo, LoggerConfig } from '@/utils/logger/LogsManager/FileTreeUtils';

import { globalStorage } from '@/utils/storage';

interface UseLoggerAPIProps {
   loggerConfigs: Record<string, LoggerConfig>;
   validationResults: any;
   selectedFilter: 'correct' | 'incorrect' | 'console';
   setLoggers: (loggers: LoggerInfo[]) => void;
   setLoggerCalls: (calls: LoggerCallInfo[]) => void;
   setLoggerConfigs: (configs: Record<string, LoggerConfig> | ((prev: Record<string, LoggerConfig>) => Record<string, LoggerConfig>)) => void;
   setNewLogsCount: (count: number) => void;
   setValidationResults: (results: any) => void;
   setShowValidationResults: (show: boolean) => void;
   getLoggerCallConfigKey: (loggerCall: LoggerCallInfo) => string;
}

export function useLoggerAPI({
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
}: UseLoggerAPIProps) {
   const logger = createLogger('useLoggerAPI');
   const [loading, setLoading] = useState(false);
   const [validationLoading, setValidationLoading] = useState(false);
   const [scanDiff, setScanDiff] = useState<any | null>(null);
   const [pendingData, setPendingData] = useState<{
       loggers: LoggerInfo[];
       calls: LoggerCallInfo[];
       configs: Record<string, LoggerConfig>;
       newLogsCount: number;
   } | null>(null);

   // Валидация строк логгеров (теперь заглушка, так как строки не валидируются)
   // eslint-disable-next-line react-hooks/exhaustive-deps
   const validateLoggerLines = useCallback(async () => {
      // No-op
   }, []);

   // Сканирование логгеров
   const scanLoggers = useCallback(async (silent = false, overrideConfigs?: Record<string, LoggerConfig>) => {
      if (!silent) setLoading(true);
      setShowValidationResults(false); // Закрываем панель деталей при обновлении
      try {
         const t = Date.now();
         // Сканируем компоненты и вызовы одним запросом (новая система)
         const callsResponse = await fetch(`/api/logger/scan-logger-calls?t=${t}`, { cache: 'no-store' });
         
         if (!callsResponse.ok) {
            logger.error('Failed to scan logger calls', { status: callsResponse.status });
            setLoading(false);
            return;
         }

         const callsData = await callsResponse.json();
         
         if (!callsData.loggerCalls) {
             logger.warning('No logger calls returned from API', callsData);
             // Если API вернул корректный JSON, но без loggerCalls - возможно это ошибка парсинга
             // Безопаснее не продолжать, чтобы не удалить конфиги
             setLoading(false);
             return;
         }

         const scannedCalls = callsData.loggerCalls || [];
         const fetchedLoggers = callsData.loggers || []; // <-- Берем из нового ответа
         const scannedLoggersCount = fetchedLoggers.length;
         
         // Используем overrideConfigs если есть, иначе текущие
         const currentConfigs = overrideConfigs || loggerConfigs;

         // Запускаем поиск console .log
         let consoleIssues = 0;
         try {
             const cResponse = await fetch(`/api/logger/scan-console-logs?t=${t}`, { cache: 'no-store' });
             if (cResponse.ok) {
                 const cData = await cResponse.json();
                 const consoleCalls = cData.consoleCalls || [];
                 consoleIssues = consoleCalls.length;
                 
                 setValidationResults({
                     results: consoleCalls,
                     summary: {
                         correct: 0,
                         loggerIssues: 0,
                         consoleIssues: consoleCalls.length
                     }
                 });
             }
         } catch (e) {
             logger.error('Error scanning console logs', e);
         }

         // --- SAFETY GUARD: Empty Scan Protection ---
         // Если сканер вернул 0 логов, но у нас уже есть конфиги - это ошибка сканера (например, при Hot Reload).
         // Предотвращаем удаление всех конфигов.
         if (scannedCalls.length === 0 && Object.keys(currentConfigs).length > 0) {
             logger.warning('🛡️ Safety Guard: Scan returned 0 logs. Aborting update.', { 
                 existingConfigs: Object.keys(currentConfigs).length 
             });
             
             toast('Empty scan result ignored', {
                 icon: '🛡️',
                 duration: 4000,
                 style: {
                    background: 'hsl(var(--heroui-warning-50))',
                    color: 'hsl(var(--heroui-warning-900))',
                    border: '1px solid hsl(var(--heroui-warning-200))',
                    fontWeight: 500,
                 }
             });
             setLoading(false);
             return;
         }
         // -------------------------------------------

         // setLoggerCalls(scannedCalls); // DEFERRED

         // Проверяем и создаем конфиги для новых логов И компонентов
         let createdCount = 0;
         let updatedCount = 0;
         let collisionCount = 0;
         
         // Раздельные счетчики для таблицы
         let logsFound = 0;
         let componentsFound = 0;
         let logsCreated = 0;
         let componentsCreated = 0;
         let logsUpdated = 0;
         let componentsUpdated = 0;
         let logsStale = 0;
         let componentsStale = 0;
         let logsExisting = 0;
         let componentsExisting = 0;

         const updatedConfigs = { ...currentConfigs };
         const isInitialScan = Object.keys(currentConfigs).length === 0;
         const componentKeys = new Set<string>();

         // 1. Считаем существующие конфиги (раздельно)
         Object.keys(currentConfigs).forEach(key => {
            if (key.endsWith(':component')) {
               componentsExisting++;
            } else {
               logsExisting++;
            }
         });

         // 2. Обрабатываем ЛОГИ (scannedCalls)
         logsFound = scannedCalls.length;
         const seenKeysInScan = new Set<string>();

         logger.info('🔍 Starting scan analysis', { 
            totalCalls: scannedCalls.length,
            currentConfigsCount: Object.keys(updatedConfigs).length
         });

         scannedCalls.forEach((loggerCall: LoggerCallInfo) => {
            const configKey = getLoggerCallConfigKey(loggerCall);

            if (seenKeysInScan.has(configKey)) {
                collisionCount++;
            } else {
                seenKeysInScan.add(configKey);
            }

            // Попытка найти конфиг по точному ключу
            let existingConfig = updatedConfigs[configKey];

            // DEBUG: Логируем анализ каждого лога
            // logger.info('Analyzing log', { 
            //    key: configKey, 
            //    exists: !!existingConfig,
            //    file: loggerCall.file
            // });

            if (!existingConfig) {
               updatedConfigs[configKey] = {
                  enabled: true,
                  color: 'black',
                  lastChanged: Date.now(),
                  filePath: loggerCall.file,
                  createdAt: Date.now(),
               };
               // Removed isInitialScan check - always report new logs
               createdCount++; 
               logsCreated++;
               logger.info('➕ New log detected', { key: configKey });
            } else {
               // Конфиг есть - обновляем filePath
               if (updatedConfigs[configKey].filePath !== loggerCall.file) {
                  updatedConfigs[configKey] = {
                     ...updatedConfigs[configKey],
                     filePath: loggerCall.file,
                  };
                  updatedCount++;
                  logsUpdated++;
               }
            }

            // Собираем уникальные компоненты
            const parts = configKey.split(':');
            const componentKey = `${parts[0]}:${parts[1]}:component`;
            componentKeys.add(componentKey);
         });

         // 3. Обрабатываем КОМПОНЕНТЫ
         componentsFound = componentKeys.size;

         componentKeys.forEach((componentKey) => {
            if (!updatedConfigs[componentKey]) {
               // ... logic to find filePath ...
               const parts = componentKey.split(':');
               const fileName = parts.length > 2 ? parts[1] : ''; 
               const call = scannedCalls.find((c: LoggerCallInfo) => c.componentName === parts[0] && c.file.endsWith(fileName));
               // @ts-ignore
               const existingFilePath = updatedConfigs[componentKey]?.filePath;
               const filePath = call ? call.file : (existingFilePath || fileName);

               updatedConfigs[componentKey] = {
                  enabled: true, 
                  color: 'black',
                  lastChanged: Date.now(),
                  filePath: filePath,
                  createdAt: Date.now(), // Исправлено: всегда Date.now() для новых
               };
               // Removed isInitialScan check - always report new components
               componentsCreated++;
               createdCount++; 
               logger.info('➕ New component detected', { key: componentKey });
            } else {
               // Обновляем filePath
               const parts = componentKey.split(':');
               const fileName = parts.length > 2 ? parts[1] : ''; 
               const call = scannedCalls.find((c: LoggerCallInfo) => c.componentName === parts[0] && c.file.endsWith(fileName));

               if (call && updatedConfigs[componentKey].filePath !== call.file) {
                  updatedConfigs[componentKey] = {
                     ...updatedConfigs[componentKey],
                     filePath: call.file,
                  };
                  // updatedCount++; // Не считаем в общий
                  componentsUpdated++;
               }
            }
         });

         // 4. Считаем МУСОР (Stale)
         const activeKeys = new Set<string>();
         scannedCalls.forEach((loggerCall: LoggerCallInfo) => {
            activeKeys.add(getLoggerCallConfigKey(loggerCall));
         });
         componentKeys.forEach((key) => {
            activeKeys.add(key);
         });

         // Добавляем компоненты, найденные парсером (даже если у них нет вызовов логов)
         fetchedLoggers.forEach((logger: LoggerInfo) => {
            const fileName = logger.file.split('/').pop() || logger.file;
            const componentKey = `${logger.name}:${fileName}:component`;
            activeKeys.add(componentKey);
         });

         const now = Date.now();
         const ONE_MINUTE = 5000; // 5 seconds (was 1 min)
         let removedCount = 0; 
         let staleConfigCount = 0;
         const staleKeys: string[] = [];

         Object.keys(updatedConfigs).forEach((configKey) => {
            const config = updatedConfigs[configKey];
            const isActive = activeKeys.has(configKey);
            const createdAt = config.createdAt || 0;
            const age = now - createdAt;
            
            // Removed 5 second delay for stale configs - detect immediately
            if (!isActive) { // Removed age check
               // Если конфиг старше 5 секунд и не активен - считаем его stale
               // Но для отображения в UI мы хотим видеть ВСЕ потенциально удаленные, или только те, что УЖЕ можно удалить?
               // Раньше тут не было проверки времени для ПОДСЧЕТА, только для УДАЛЕНИЯ.
               // А нет, в scanLoggers была проверка: if (!isActive) { ... } без времени.
               // А удаление (clearStaleConfigs) имело проверку времени.
               
               staleConfigCount++;
               staleKeys.push(configKey);
               if (configKey.endsWith(':component')) {
                   componentsStale++;
               } else {
                   logsStale++;
               }
            }
         });

         // Запускаем валидацию параллельно с расчетом диффа (удалено)
         // let validationIssuesCount = 0;
         /*
         try {
             // ... legacy code ...
         } catch (e) {
             logger.error('Error validating lines during scan', e);
         }
         */

         const totalExisting = Object.keys(currentConfigs).length;
         const totalNew = Object.keys(updatedConfigs).length;

         // Читаем бэкап для статистики
         let backupConfigCount = 0;
         const backupStats = { logs: 0, components: 0 };
         try {
             const backup = JSON.parse(globalStorage.getItem('logger-configs-backup') || '{}');
             backupConfigCount = Object.keys(backup).length;
             
             Object.keys(backup).forEach(key => {
                 if (key.endsWith(':component')) {
                     backupStats.components++;
                 } else {
                     backupStats.logs++;
                 }
             });
         } catch (e) {
             // ignore
         }

         const diff = {
             totalScanned: scannedCalls.length, // Для совместимости
             newConfigCount: createdCount,
             updatedConfigCount: updatedCount,
             deletedConfigCount: removedCount, 
             staleConfigCount,
             staleKeys,
             totalExistingConfigs: totalExisting,
             totalNewConfigs: totalNew,
             backupConfigCount,
             backupStats, // Добавлено детальное поле бэкапа
             totalComponents: componentKeys.size, // Для совместимости
             collisionCount,
             validationIssuesCount: consoleIssues, // Используем локальную переменную
             
             // Детальная статистика для таблицы
             stats: {
                 logs: {
                     found: logsFound,
                     existing: logsExisting,
                     created: logsCreated,
                     updated: logsUpdated,
                     stale: logsStale
                 },
                 components: {
                     found: componentsFound,
                     existing: componentsExisting,
                     created: componentsCreated,
                     updated: componentsUpdated,
                     stale: componentsStale
                 }
             }
         };

         const hasChanges = 
             logsCreated > 0 || 
             componentsCreated > 0 ||
             logsUpdated > 0 || 
             componentsUpdated > 0 ||
             staleConfigCount > 0 || 
             collisionCount > 0;

         // Always update logger calls and definitions immediately to reflect current code state
         if (fetchedLoggers.length > 0) setLoggers(fetchedLoggers);
         setLoggerCalls(scannedCalls);

         if (hasChanges) {
             setScanDiff(diff);
             setPendingData({
                 loggers: fetchedLoggers,
                 calls: scannedCalls,
                 configs: updatedConfigs,
                 newLogsCount: createdCount > 0 ? createdCount : 0
             });
             logger.info('🔍 Scan Complete (Pending Confirmation)', diff);
         } else {
             setScanDiff(null);
             setPendingData(null);
            //  toast.success('Синхронизировано. Изменений нет.', {
            //      position: 'bottom-center',
            //      icon: '✅'
            //  });
         }

         // Validation is also deferred until apply? No, validation runs on existing files.
         // Let's defer validation too or run it on current state? 
         // Usually validation checks if line numbers are correct. This depends on file content.
         // If we don't update calls, validation might be stale.
         // Let's hold validation until confirm.
         
         /*
         const toastMessage = (
             <div className="flex flex-col gap-1 text-xs min-w-[180px]">
                 <div className="font-bold text-sm mb-1 flex items-center gap-2">
                     🔍 Scan Complete
                 </div>
                 <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                     <div className="flex justify-between">
                         <span className="text-gray-500">Total:</span>
                         <span className="font-mono font-medium">{scannedCalls.length}</span>
                     </div>
                     <div className="flex justify-between">
                         <span className="text-gray-500">New:</span>
                         <span className={createdCount > 0 ? "font-mono font-bold text-green-500" : "font-mono text-gray-400"}>
                             {createdCount}
                         </span>
                     </div>
                     <div className="flex justify-between">
                         <span className="text-gray-500">Upd:</span>
                         <span className={updatedCount > 0 ? "font-mono font-bold text-blue-500" : "font-mono text-gray-400"}>
                             {updatedCount}
                         </span>
                     </div>
                     <div className="flex justify-between">
                         <span className="text-gray-500">Del:</span>
                         <span className={removedCount > 0 ? "font-mono font-bold text-orange-500" : "font-mono text-gray-400"}>
                             {removedCount}
                         </span>
                     </div>
                 </div>
                 
                 {collisionCount > 0 && (
                     <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700 text-red-500 font-bold flex items-center gap-1">
                         ⚠️ Collisions: {collisionCount}
                     </div>
                 )}
             </div>
         );

                const toastOptions = {
                    duration: collisionCount > 0 ? 6000 : 3000,
                    position: 'bottom-center' as const,
                    style: {
                        background: 'hsl(var(--heroui-content2))', // Use content2 color
                        color: 'hsl(var(--heroui-foreground))',
                        border: '1px solid hsl(var(--heroui-border))',
                        padding: '12px',
                        borderRadius: '12px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                    },
                };

         if (collisionCount > 0) {
             toast.error(toastMessage, toastOptions);
         } else if (createdCount > 0 || updatedCount > 0 || removedCount > 0) {
             toast.success(toastMessage, toastOptions);
         } else {
             toast(toastMessage, toastOptions);
         }
         */
         
         // Запускаем валидацию после сканирования
         // await validateLoggerLines(); // DEFERRED
      } catch (error) {
         logger.error('Error scanning loggers:', error);
      } finally {
         if (!silent) setLoading(false);
      }
   }, [loggerConfigs, setLoggers, setLoggerCalls, setLoggerConfigs, setNewLogsCount, setShowValidationResults, getLoggerCallConfigKey, validateLoggerLines]);

   // --- Confirmation Actions ---
   const confirmScan = useCallback(async () => {
       if (!pendingData) return;

       const { loggers, calls, configs } = pendingData;

       if (loggers.length > 0) setLoggers(loggers);
       
       setLoggerCalls(calls);
       
       // Force update configs (create new object reference)
       // And update lastChanged timestamp for ALL configs to force synchronization with _Logger
       const syncedConfigs = { ...configs };
       Object.keys(syncedConfigs).forEach(key => {
           syncedConfigs[key] = {
               ...syncedConfigs[key],
               lastChanged: Date.now() // Force update timestamp
           };
       });

       setLoggerConfigs(syncedConfigs);
       
       // === BACKUP ===
       // Сохраняем бэкап при ручном обновлении
       if (Object.keys(syncedConfigs).length > 0) {
          globalStorage.setItem('logger-configs-backup', JSON.stringify(syncedConfigs));
       }
       // === BACKUP ===
       
       // Сбрасываем счетчик новых логов сразу после применения
       setNewLogsCount(0);

       setScanDiff(null);
       setPendingData(null);
       
       toast.success('Settings updated & synced successfully', {
           position: 'bottom-center',
       });

       // Запускаем валидацию после применения изменений
       await validateLoggerLines(); 
   }, [pendingData, setLoggers, setLoggerCalls, setLoggerConfigs, setNewLogsCount, validateLoggerLines]);

   const cancelScan = useCallback(() => {
       setScanDiff(null);
       setPendingData(null);
   }, []);

   // Умное применение изменений (Добавить / Очистить / Всё вместе)
   const smartApply = useCallback(async () => {
       if (!pendingData || !scanDiff) return;

       const { loggers, calls, configs } = pendingData;
       let finalConfigs = { ...configs };

       // Если есть мусор (stale), удаляем его перед сохранением
       if (scanDiff.staleConfigCount > 0) {
           const activeKeys = new Set<string>();
           
           // 1. Keys from calls
           calls.forEach((loggerCall: LoggerCallInfo) => {
               activeKeys.add(getLoggerCallConfigKey(loggerCall));
           });
           
           // 2. Keys from components (loggers list)
           loggers.forEach((logger: LoggerInfo) => {
                const fileName = logger.file.split('/').pop() || logger.file;
                const componentKey = `${logger.name}:${fileName}:component`;
                activeKeys.add(componentKey);
           });

           // Restore time check
           const now = Date.now();
           const ONE_MINUTE = 5000;
           
           Object.keys(finalConfigs).forEach((configKey) => {
               const config = finalConfigs[configKey];
               const isActive = activeKeys.has(configKey);
               const createdAt = config.createdAt || 0;
               const age = now - createdAt;

               // Удаляем только если не активен И прошло достаточно времени
               if (!isActive && age > ONE_MINUTE) { 
                   delete finalConfigs[configKey];
               }
           });
       }

       // Применяем
       if (loggers.length > 0) setLoggers(loggers);
       setLoggerCalls(calls);
       
       // Force update timestamps
       const syncedConfigs = { ...finalConfigs };
       Object.keys(syncedConfigs).forEach(key => {
           syncedConfigs[key] = {
               ...syncedConfigs[key],
               lastChanged: Date.now()
           };
       });

       setLoggerConfigs(syncedConfigs);
       
       // Backup
       if (Object.keys(syncedConfigs).length > 0) {
          globalStorage.setItem('logger-configs-backup', JSON.stringify(syncedConfigs));
       }

       setNewLogsCount(0);
       setScanDiff(null);
       setPendingData(null);
       
       toast.success('Configuration updated successfully', {
           position: 'bottom-center',
           icon: '🚀'
       });
       
   }, [pendingData, scanDiff, setLoggers, setLoggerCalls, setLoggerConfigs, setNewLogsCount, getLoggerCallConfigKey]);

   // Очистка удаленных конфигов (Stale) - LEGACY, integrated into smartApply
   const clearStaleConfigs = useCallback(() => {
       if (!pendingData || !scanDiff) return;

       const { configs, calls } = pendingData;
       const newConfigs = { ...configs };
       
       // Собираем активные ключи из скана
       const activeKeys = new Set<string>();
       calls.forEach((loggerCall: LoggerCallInfo) => {
           activeKeys.add(getLoggerCallConfigKey(loggerCall));
       });
       // Компоненты тоже нужно учесть, но у нас их нет в явном виде в pendingData.calls
       // Мы можем восстановить их из ключей configs, если они не stale? 
       // Или лучше просто пройтись по configs и удалить те, что stale?
       
       // В scanLoggers мы считали stale по activeKeys. 
       // Здесь нам нужно повторить логику или просто довериться scanDiff?
       // Проще повторить логику обнаружения "мусора".
       
       // Восстанавливаем activeKeys (компоненты + логи из calls)
       const componentKeys = new Set<string>();
       calls.forEach((loggerCall: LoggerCallInfo) => {
           const configKey = getLoggerCallConfigKey(loggerCall);
           const parts = configKey.split(':');
           const componentKey = `${parts[0]}:${parts[1]}:component`;
           componentKeys.add(componentKey);
       });

       calls.forEach((loggerCall: LoggerCallInfo) => {
           activeKeys.add(getLoggerCallConfigKey(loggerCall));
       });
       componentKeys.forEach((key) => {
           activeKeys.add(key);
       });

       const now = Date.now();
       const ONE_MINUTE = 5000;
       let deletedCount = 0;

       Object.keys(newConfigs).forEach((configKey) => {
           const config = newConfigs[configKey];
           const isActive = activeKeys.has(configKey);
           const createdAt = config.createdAt || 0;
           const age = now - createdAt;

           if (!isActive && age > ONE_MINUTE) {
               delete newConfigs[configKey];
               deletedCount++;
           }
       });

       // Обновляем pendingData
       setPendingData({
           ...pendingData,
           configs: newConfigs
       });

       // Обновляем scanDiff (визуально убираем мусор)
       setScanDiff({
           ...scanDiff,
           staleConfigCount: 0,
           deletedConfigCount: scanDiff.deletedConfigCount + deletedCount, 
           stats: {
               logs: { ...scanDiff.stats.logs, stale: 0 },
               components: { ...scanDiff.stats.components, stale: 0 }
           }
       });
       
       toast.success(`Marked ${deletedCount} stale configs for removal`, {
           position: 'bottom-center',
           icon: '🧹'
       });

   }, [pendingData, scanDiff, getLoggerCallConfigKey]);

   // Восстановление из бэкапа
   const restoreFromBackup = useCallback(() => {
       try {
           const backup = JSON.parse(globalStorage.getItem('logger-configs-backup') || '{}');
           if (Object.keys(backup).length === 0) {
               toast.error('Backup is empty!', { position: 'bottom-center' });
               return;
           }

           // Применяем бэкап как текущий конфиг
           setLoggerConfigs(backup);
           
           // Также нужно обновить pendingData, чтобы diff пересчитался?
           // Или просто закрыть скан и сказать "готово"?
           // Лучше просто применить и закрыть окно скана.
           // Но нужно обновить timestamp, чтобы _Logger подхватил.
           
           const syncedBackup = { ...backup };
           Object.keys(syncedBackup).forEach(key => {
               syncedBackup[key] = {
                   ...syncedBackup[key],
                   lastChanged: Date.now()
               };
           });
           
           globalStorage.setItem('logger-configs', JSON.stringify(syncedBackup));
           setLoggerConfigs(syncedBackup);
           
           setScanDiff(null);
           setPendingData(null);
           
           toast.success(`Restored ${Object.keys(backup).length} configs from backup`, {
               position: 'bottom-center',
               icon: '♻️'
           });
           
       } catch (e) {
           logger.error('Error restoring from backup', e);
           toast.error('Failed to restore backup', { position: 'bottom-center' });
       }
   }, [setLoggerConfigs, scanLoggers]);


   // Замена console-.log на logger
   const fixConsoleLogLines = useCallback(async () => {
      try {
         const consoleResults = validationResults.results.filter((r: any) => r.type === 'console');

         const response = await fetch('/api/logger/fix-console-logs', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ results: consoleResults }),
         });

         if (response.ok) {
            // Пересканируем файлы после исправления consolee.log
            await scanLoggers();
            // Перезапускаем валидацию после исправления (удалено)
            logger.info('Auto-refreshed after fixing console logs', {
               consoleResults: consoleResults.length,
            });
         }
      } catch (error) {
         logger.error('Error fixing console logs:', error);
      }
   }, [validationResults, scanLoggers]);

   // Удаление console .log
   const deleteConsoleLog = useCallback(async (file: string, line: number) => {
      try {
         const response = await fetch('/api/logger/delete-console-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ file, line }),
         });

         if (response.ok) {
            toast.success('Console log deleted', { position: 'bottom-center', icon: '🗑️' });
            await scanLoggers(true);
         } else {
             const data = await response.json();
             toast.error(`Failed to delete: ${data.error}`, { position: 'bottom-center' });
         }
      } catch (error) {
         logger.error('Error deleting console log:', error);
         toast.error('Error deleting console log', { position: 'bottom-center' });
      }
   }, [scanLoggers]);

   // Фильтрация результатов валидации
   const getFilteredResults = useCallback(() => {
      if (!validationResults) return [];

      switch (selectedFilter) {
         case 'correct':
            return validationResults.results.filter((r: any) => r.isCorrect && r.type === 'logger');
         case 'incorrect':
            return validationResults.results.filter(
               (r: any) => !r.isCorrect && r.type === 'logger'
            );
         case 'console':
            return validationResults.results.filter((r: any) => r.type === 'console');
         default:
            return validationResults.results.filter(
               (r: any) => !r.isCorrect && r.type === 'logger'
            );
      }
   }, [validationResults, selectedFilter]);

   return {
      loading,
      validationLoading,
      scanLoggers,
      validateLoggerLines,
      fixSelectedLoggerLines: async () => {}, // Заглушка
      fixConsoleLogLines,
      deleteConsoleLog, // Exported
      getFilteredResults,
      confirmScan, // Exported
      cancelScan,  // Exported
      scanDiff,    // Exported
      smartApply,  // Exported
      clearStaleConfigs, // Exported
      restoreFromBackup // Exported
   };
}

