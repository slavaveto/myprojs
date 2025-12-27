'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { globalStorage } from '@/utils/storage';
import { LOGGER_NEXT_CONFIG_KEY, getAllLoggers } from './LoggerNext';
// Import updated from LoggerNext
import { Button, Input, Switch, ScrollShadow, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { Search, RotateCw, Trash2, SlidersHorizontal, ArrowUpDown } from 'lucide-react';
import { AVAILABLE_COLORS, COLOR_MAP } from '@/utils/logger/services/loggerColors';

interface ConfigItem {
   key: string;
   name: string;
   file: string;
   enabled: boolean;
   color: string;
   lastActive?: number; // TODO: Implement last active tracking
}

interface SettingsPanelProps {
   width: number;
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ width }) => {
   const [configs, setConfigs] = useState<ConfigItem[]>([]);
   const [search, setSearch] = useState('');

   // Загрузка конфигов
   const loadConfigs = () => {
      try {
         const str = globalStorage.getItem(LOGGER_NEXT_CONFIG_KEY);
         const savedConfig = str ? JSON.parse(str) : {}; // { "Name": boolean | { enabled, color } }
         
         const registered = getAllLoggers(); // [{ name, enabled, color }] from cache
         
         const uniqueNames = new Set([...Object.keys(savedConfig), ...registered.map(r => r.name)]);
         
         const list: ConfigItem[] = Array.from(uniqueNames).map(name => {
            const savedVal = savedConfig[name];
            let enabled = false;
            let color = 'blue';

            // Приоритет: конфиг > дефолт
            if (savedVal !== undefined) {
               if (typeof savedVal === 'object' && savedVal !== null) {
                  enabled = !!savedVal.enabled;
                  color = savedVal.color || 'blue';
               } else {
                  enabled = !!savedVal;
               }
            } else {
               // Если нет в конфиге, берем из зарегистрированного (но там обычно false/blue по дефолту)
               // Можно найти в registered
               const reg = registered.find(r => r.name === name);
               if (reg) {
                  color = reg.color;
               }
            }
            
            return {
               key: name,
               name: name,
               file: '', 
               enabled,
               color
            };
         });
         
         setConfigs(list);
      } catch (e) {
         setConfigs([]);
      }
   };

   useEffect(() => {
      loadConfigs();

      // Слушаем изменения конфига из других мест
      const handleStorage = (e: StorageEvent) => {
         if (e.key === LOGGER_NEXT_CONFIG_KEY) loadConfigs();
      };

      window.addEventListener('storage', handleStorage);
      window.addEventListener('logger-next-config-change', loadConfigs); // Локальное обновление

      // Периодический опрос (на случай если новый логгер зарегистрировался)
      const interval = setInterval(loadConfigs, 2000);

      return () => {
         window.removeEventListener('storage', handleStorage);
         window.removeEventListener('logger-next-config-change', loadConfigs);
         clearInterval(interval);
      };
   }, []);

   const toggleLogger = (key: string, currentState: boolean, currentColor: string) => {
      try {
         const str = globalStorage.getItem(LOGGER_NEXT_CONFIG_KEY);
         const raw = str ? JSON.parse(str) : {};
         
         // Сохраняем как объект, чтобы сохранить цвет
         raw[key] = { enabled: !currentState, color: currentColor };
         
         globalStorage.setItem(LOGGER_NEXT_CONFIG_KEY, JSON.stringify(raw));
         
         // Уведомляем логгеры и UI
         window.dispatchEvent(new Event('logger-next-config-change'));
         loadConfigs();
      } catch (e) {
         console.error(e);
      }
   };

   const changeColor = (key: string, newColor: string, currentEnabled: boolean) => {
      try {
         const str = globalStorage.getItem(LOGGER_NEXT_CONFIG_KEY);
         const raw = str ? JSON.parse(str) : {};
         
         raw[key] = { enabled: currentEnabled, color: newColor };
         
         globalStorage.setItem(LOGGER_NEXT_CONFIG_KEY, JSON.stringify(raw));
         window.dispatchEvent(new Event('logger-next-config-change'));
         loadConfigs();
      } catch (e) {
         console.error(e);
      }
   };

   // Сортировка и фильтрация
   const filteredConfigs = useMemo(() => {
      let result = configs;

      if (search) {
         const q = search.toLowerCase();
         result = result.filter(
            (c) => c.name.toLowerCase().includes(q) || c.file.toLowerCase().includes(q)
         );
      }

      // Сортировка: Сначала включенные, потом по имени
      return result.sort((a, b) => {
         if (a.enabled === b.enabled) {
            return a.name.localeCompare(b.name);
         }
         return a.enabled ? -1 : 1;
      });
   }, [configs, search]);

   return (
      <div 
         className="flex flex-col h-full bg-content1 border-l border-default-200"
         style={{ width: width, minWidth: width }}
      >
         {/* Header & Search */}
         <div className="px-2 py-1 border-b border-default-200 flex items-center gap-2 bg-content2 shrink-0 h-[36px]">
            <SlidersHorizontal size={14} className="text-default-500 shrink-0" />
            <span className="font-medium text-sm shrink-0 mr-1">Settings</span>
            <Input
               placeholder="Search..."
               size="sm"
               variant="faded"
               value={search}
               onValueChange={setSearch}
               isClearable
               classNames={{
                  base: "h-[26px] flex-1",
                  mainWrapper: "h-[26px]",
                  inputWrapper: "h-[26px] min-h-[26px] px-2",
                  input: "text-[14px]",
                  innerWrapper: "pb-0",
               }}
            />
            <Button
               isIconOnly
               size="sm"
               variant="light"
               className="min-w-6 w-6 h-[28px] text-default-400 hover:text-danger"
               onPress={() => {
                  if (confirm('Reset all settings?')) {
                     globalStorage.removeItem(LOGGER_NEXT_CONFIG_KEY);
                     window.dispatchEvent(new Event('logger-next-config-change'));
                  }
               }}
               title="Reset Config"
            >
               <Trash2 size={14} />
            </Button>
         </div>

         {/* List */}
         <div className="flex-1 overflow-y-auto relative">
            {/* Gradient top */}
            <div className="sticky top-0 left-0 right-0 h-4 bg-gradient-to-b from-content1 to-transparent z-10 pointer-events-none" />

            <div className="flex flex-col">
               {filteredConfigs.length === 0 && (
                  <div className="text-center text-default-400 text-xs py-8">
                     No components found
                  </div>
               )}

               {filteredConfigs.map((item) => (
                  <div
                     key={item.key}
                     className={`
                         flex items-center justify-between p-3 border-b border-default-100 hover:bg-default-100 transition-colors
                         ${item.enabled ? 'bg-primary/5' : ''}
                      `}
                  >
                     <div className="flex flex-col overflow-hidden mr-3 flex-1">
                        <span
                           className={`font-medium text-sm truncate ${item.enabled ? 'text-foreground' : 'text-default-500'}`}
                           title={item.name}
                        >
                           {item.name}
                        </span>
                     </div>

                     <div className="flex items-center gap-2">
                        <Popover placement="left">
                           <PopoverTrigger>
                              <div
                                 className="w-3 h-3 rounded-full cursor-pointer hover:scale-125 transition-transform border border-default-200"
                                 style={{ backgroundColor: item.color === 'black' ? '#52525b' : (COLOR_MAP[item.color] || COLOR_MAP['blue']) }}
                                 title="Change Color"
                              />
                           </PopoverTrigger>
                           <PopoverContent className="p-2">
                              <div className="grid grid-cols-5 gap-1 w-[120px]">
                                 {AVAILABLE_COLORS.map((c) => (
                                    <button
                                       key={c.key}
                                       className={`w-5 h-5 rounded-full border border-transparent hover:scale-110 transition-transform ${item.color === c.key ? 'ring-2 ring-offset-1 ring-default-400' : ''}`}
                                       style={{ backgroundColor: c.key === 'black' ? '#52525b' : c.hex }}
                                       onClick={() => changeColor(item.key, c.key, item.enabled)}
                                       title={c.label}
                                    />
                                 ))}
                              </div>
                           </PopoverContent>
                        </Popover>

                        <Switch
                           size="sm"
                           className="scale-75"
                           isSelected={item.enabled}
                           onValueChange={() => toggleLogger(item.key, item.enabled, item.color)}
                        />
                     </div>
                  </div>
               ))}
            </div>
         </div>
      </div>
   );
};
