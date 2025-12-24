'use client';

import React from 'react';
import { Button, Chip, Table, TableHeader, TableColumn, TableBody, TableRow, TableCell } from '@heroui/react';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLoggerContext } from '@/utils/logger/LogsManager/LoggerContext';

export function ValidationResultsPanel() {
   const {
   validationResults,
   selectedFilter,
   setSelectedFilter,
      showValidationResults,
   setShowValidationResults,
   fixSelectedLoggerLines,
   fixConsoleLogLines,
   getFilteredResults,
   } = useLoggerContext();

   // Показываем результаты только если пользователь сам открыл
   const hasValidationIssues =
      validationResults &&
      (validationResults.summary.loggerIssues > 0 || validationResults.summary.consoleIssues > 0);

   const shouldShowResults = showValidationResults && hasValidationIssues;

   return (
      <AnimatePresence>
         {shouldShowResults && (
            <motion.div
               initial={{ opacity: 0, marginTop: 0, marginBottom: 0 }}
               animate={{ opacity: 1, marginTop: 24, marginBottom: 16 }}
               exit={{ opacity: 0, marginTop: 0, marginBottom: 0 }}
               transition={{ duration: 0.3, ease: 'easeInOut' }}
               className="p-3  bg-default-100 rounded-lg relative"
            >
               <button
                  onClick={() => setShowValidationResults(false)}
                  className="absolute top-2 right-2 p-1 hover:bg-default-200 rounded-full transition-colors z-10"
                  title="Скрыть результаты"
               >
                  <X size={16} className="text-default-500" />
               </button>

               <div className="flex justify-between items-center mb-2 pr-8">
                  <h4 className="font-semibold">Результаты проверки:</h4>
                  {selectedFilter === 'incorrect' &&
                     validationResults.summary.loggerIssues > 0 && (
                        <Button
                           size="sm"
                           color="success"
                           variant="flat"
                           onPress={fixSelectedLoggerLines}
                           className="text-xs"
                        >
                           Исправить номера строк ({validationResults.summary.loggerIssues})
                        </Button>
                     )}

                  {validationResults.summary.consoleIssues > 0 && (
                     <Button
                        size="sm"
                        color="warning"
                        variant="flat"
                        onPress={fixConsoleLogLines}
                        className="text-xs"
                     >
                        Заменить на logger ({validationResults.summary.consoleIssues})
                     </Button>
                  )}
               </div>

               <div className="flex gap-4 text-sm">
                  {validationResults.summary.correct > 0 && (
                     <button
                        onClick={() => setSelectedFilter('correct')}
                        className={`hover:underline transition-colors ${
                           selectedFilter === 'correct' ? 'font-bold' : ''
                        }`}
                     >
                        <span className="text-green-600">
                           Правильные номера строк: {validationResults.summary.correct}
                        </span>
                     </button>
                  )}

                  {validationResults.summary.loggerIssues > 0 && (
                     <button
                        onClick={() => setSelectedFilter('incorrect')}
                        className={`hover:underline transition-colors ${
                           selectedFilter === 'incorrect' ? 'font-bold' : ''
                        }`}
                     >
                        <span className="text-red-600">
                           Неверные номера строк: {validationResults.summary.loggerIssues}
                        </span>
                     </button>
                  )}

                  {validationResults.summary.consoleIssues > 0 && (
                     <button
                        onClick={() => setSelectedFilter('console')}
                        className={`hover:underline transition-colors ${
                           selectedFilter === 'console' ? 'font-bold' : ''
                        }`}
                     >
                        <span className="text-orange-600">
                           Consolee.log: {validationResults.summary.consoleIssues}
                        </span>
                     </button>
                  )}

                  {selectedFilter === 'console' &&
                     validationResults.summary.consoleIssues > 0 && (
                        <Button
                           size="sm"
                           color="warning"
                           variant="flat"
                           onPress={fixConsoleLogLines}
                           className="text-xs"
                        >
                           Заменить на logger ({validationResults.summary.consoleIssues})
                        </Button>
                     )}
               </div>

               {getFilteredResults().length > 0 && (
                  <div className="mt-3">
                     <Table
                        aria-label="Результаты валидации"
                        className="max-h-64"
                        isHeaderSticky
                        classNames={{
                           wrapper: 'min-h-[200px] max-h-64 overflow-auto',
                           table: 'min-w-full',
                           th: 'text-[14px] sticky top-0 z-10 bg-background',
                           td: 'text-[14px] py-1',
                        }}
                     >
                        <TableHeader className="!text-[14px]">
                           <TableColumn width="25%">Файл</TableColumn>
                           <TableColumn width="10%">Строка</TableColumn>
                           <TableColumn width="15%">Тип</TableColumn>
                           <TableColumn width="50%">Вызов</TableColumn>
                        </TableHeader>
                        <TableBody>
                           {getFilteredResults().map((result: any, index: number) => (
                              <TableRow key={index}>
                                 <TableCell className="text-[14px] truncate">
                                    {result.file.split('/').pop()}
                                 </TableCell>
                                 <TableCell className="text-[14px] text-red-600 font-mono">
                                    {result.actualLine}
                                 </TableCell>
                                 <TableCell className="text-[14px]">
                                    <Chip
                                       size="sm"
                                       color={
                                          result.type === 'console'
                                             ? 'warning'
                                             : result.isCorrect
                                               ? 'success'
                                               : 'danger'
                                       }
                                       variant="flat"
                                    >
                                       {result.type === 'console'
                                          ? 'Console'
                                          : result.isCorrect
                                            ? 'OK'
                                            : 'Logger'}
                                    </Chip>
                                 </TableCell>
                                 <TableCell className="text-[14px] font-mono">
                                    <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded text-[14px]">
                                       {result.loggerCall}
                                    </code>
                                 </TableCell>
                              </TableRow>
                           ))}
                        </TableBody>
                     </Table>
                  </div>
               )}
            </motion.div>
         )}
      </AnimatePresence>
   );
}
