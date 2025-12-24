// utils/logger/LogsManager/RightPanel/RightPanelHeader.tsx
import React from 'react';
import { Switch } from '@heroui/react';
import { SortField, SortDirection } from './types';
import { ArrowDown, ArrowUp } from 'lucide-react';

interface RightPanelHeaderProps {
   selectedComponent: { name: string; file: string } | null;
   selectedFolder: string | null;
   allLoggerCalls: any[];
   displayLoggerCalls: any[];
   displayFilter: 'all' | 'enabled' | 'disabled' | 'new';
   setDisplayFilter: (filter: 'all' | 'enabled' | 'disabled' | 'new') => void;
   enabledCount: number;
   disabledCount: number;
   newCount: number;
   setLastViewedTimestamp: (timestamp: number) => void;
   masterSwitchState: boolean;
   toggleMasterSwitch: (enabled: boolean) => void;
   sortField: SortField;
   setSortField: (field: SortField) => void;
   sortDirection: SortDirection;
   setSortDirection: (dir: SortDirection) => void;
}

export const RightPanelHeader = ({
   selectedComponent,
   selectedFolder,
   allLoggerCalls,
   displayLoggerCalls,
   displayFilter,
   setDisplayFilter,
   enabledCount,
   disabledCount,
   newCount,
   setLastViewedTimestamp,
   masterSwitchState,
   toggleMasterSwitch,
   sortField,
   setSortField,
   sortDirection,
   setSortDirection,
}: RightPanelHeaderProps) => {
   const handleSort = (field: SortField) => {
      if (sortField === field) {
         setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
         setSortField(field);
         setSortDirection('asc');
      }
   };

   const SortButton = ({ field, label }: { field: SortField; label: string }) => (
      <button
         onClick={() => handleSort(field)}
         className={`px-2 py-1 text-[12px] rounded flex items-center gap-1 transition-colors ${
            sortField === field
               ? 'bg-primary/20 text-primary font-medium'
               : 'bg-default-50 text-default-500 hover:bg-default-100'
         }`}
      >
         {label}
         {sortField === field &&
            (sortDirection === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
      </button>
   );

   return (
      <div className="px-5 py-3 border-b border-divider">
         <div className="flex items-center justify-between mb-3 h-[30px]">
            <div className="flex items-center gap-2">
               <span className="text font-medium">
                  {selectedComponent
                     ? `${selectedComponent.name}`
                     : selectedFolder
                       ? `${selectedFolder}`
                       : 'Логгеры'}
               </span>
            </div>

            <div className="flex justify-end gap-2">
               {/* ГЛАВНЫЙ ВЫКЛЮЧАТЕЛЬ - только для выбранного файла */}
               {selectedComponent && allLoggerCalls.length > 0 && (
                  <div className="flex items-center justify-between">
                     <span className="text-sm font-medium text-orange-700 dark:text-orange-400 mr-2">
                        Вкл/Выкл все логи
                     </span>
                     <Switch
                        size="sm"
                        color={masterSwitchState ? 'warning' : 'default'}
                        className="scale-60"
                        classNames={{
                           wrapper: masterSwitchState ? undefined : 'bg-danger-200',
                        }}
                        isSelected={masterSwitchState}
                        onValueChange={toggleMasterSwitch}
                     />
                  </div>
               )}

               <div className="flex items-center gap-2">
                  <span className="text text-default-500">Логов:</span>
                  <span className="text font-semibold text-primary">
                     {displayLoggerCalls.length}
                  </span>
               </div>
            </div>
         </div>

         <div className="flex justify-between items-center gap-2">
            {/* Сортировка */}
            <div className="flex items-center gap-1">
               <span className="text-[10px] text-default-400 uppercase tracking-wider mr-1">
                  Sort:
               </span>
               <SortButton field="line" label="Line" />
               <SortButton field="created" label="Time" />
               <SortButton field="message" label="Msg" />
            </div>

            {/* Фильтр отображения */}
            <div className="flex flex-col gap-2 items-end mt-0">
               <div className="flex items-center gap-1 justify-end">
                  <button
                     onClick={() => setDisplayFilter('all')}
                     disabled={allLoggerCalls.length === 0}
                     className={`px-2 py-1 text-[12px] rounded transition-colors ${
                        allLoggerCalls.length === 0
                           ? 'bg-default-100 text-default-400 cursor-default'
                           : displayFilter === 'all'
                             ? 'bg-primary/20 text-primary font-medium cursor-pointer'
                             : 'bg-default-100 text-primary hover:bg-default-200 cursor-pointer'
                     }`}
                  >
                     Все ({allLoggerCalls.length})
                  </button>
                  <button
                     onClick={() => setDisplayFilter('enabled')}
                     disabled={enabledCount === 0}
                     className={`px-2 py-1 text-[12px] rounded transition-colors ${
                        enabledCount === 0
                           ? 'bg-default-100 text-default-400 cursor-default'
                           : displayFilter === 'enabled'
                             ? 'bg-success/20 text-success font-medium cursor-pointer'
                             : 'bg-default-100 text-success hover:bg-default-200 cursor-pointer'
                     }`}
                  >
                     Вкл ({enabledCount})
                  </button>
                  <button
                     onClick={() => setDisplayFilter('disabled')}
                     disabled={disabledCount === 0}
                     className={`px-2 py-1 text-[12px] rounded transition-colors ${
                        disabledCount === 0
                           ? 'bg-default-100 text-default-400 cursor-default'
                           : displayFilter === 'disabled'
                             ? 'bg-danger/20 text-danger font-medium cursor-pointer'
                             : 'bg-default-100 text-danger hover:bg-default-200 cursor-pointer'
                     }`}
                  >
                     Выкл ({disabledCount})
                  </button>
                  <button
                     onClick={() => setDisplayFilter('new')}
                     disabled={newCount === 0}
                     className={`px-2 py-1 text-[12px] rounded transition-colors ${
                        newCount === 0
                           ? 'bg-default-100 text-default-400 cursor-default'
                           : displayFilter === 'new'
                             ? 'bg-warning/20 text-warning font-medium cursor-pointer'
                             : 'bg-default-100 text-warning hover:bg-default-200 cursor-pointer'
                     }`}
                  >
                     ⭐ Новые ({newCount})
                  </button>
               </div>
            </div>
         </div>

         {/* Кнопка "Пометить прочитанными" - показываем только при активном фильтре "Новые" */}
         {displayFilter === 'new' && newCount > 0 && (
            <div className="flex justify-end mt-2">
               <button
                  onClick={() => {
                     setLastViewedTimestamp(Date.now());
                     setDisplayFilter('all'); // Переключаемся на "Все"
                  }}
                  className="px-3 py-1 text-[12px] rounded bg-default-100 text-default-600 hover:bg-default-200 transition-colors cursor-pointer"
               >
                  ✓ Пометить прочитанными
               </button>
            </div>
         )}
      </div>
   );
};
