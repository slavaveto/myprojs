'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { globalStorage } from '@/utils/storage';
import { LOGGER_NEXT_CONFIG_KEY, getAllLoggers } from './Logger';
// Import updated from LoggerNext
import { Button, Input, Switch, ScrollShadow, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { Search, RotateCw, Trash2, SlidersHorizontal, ArrowUpDown, ArrowDownAz, ListChecks, Pin, PinOff, Eye, EyeOff, Clock } from 'lucide-react';
import { AVAILABLE_COLORS, COLOR_MAP } from '@/utils/logger/loggerColors';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfigItem {
   key: string;
   name: string;
   file: string;
   enabled: boolean;
   color: string;
   pinned: boolean; 
   hidden: boolean;
   createdAt?: number;
   seen?: boolean;
   lastActive?: number;
}

interface SettingsPanelProps {
   width: number;
   isDragging: boolean;
}

const SORT_MODE_KEY = 'logger-next-sort-mode';

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ width, isDragging }) => {
   const [configs, setConfigs] = useState<ConfigItem[]>([]);
   const [search, setSearch] = useState('');
   const [showHidden, setShowHidden] = useState(false);
   const [sortMode, setSortMode] = useState<'enabled' | 'name' | 'created'>(() => {
      if (typeof window !== 'undefined') {
         const saved = globalStorage.getItem(SORT_MODE_KEY);
         return (saved === 'name' || saved === 'enabled' || saved === 'created') ? (saved as any) : 'enabled';
      }
      return 'enabled';
   });

   const updateSortMode = (mode: 'enabled' | 'name' | 'created') => {
      setSortMode(mode);
      globalStorage.setItem(SORT_MODE_KEY, mode);
   };

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
            let pinned = false;
            let hidden = false;
            let seen = false;
            let createdAt: number | undefined;

            // Приоритет: конфиг > дефолт
            if (savedVal !== undefined) {
               if (typeof savedVal === 'object' && savedVal !== null) {
                  enabled = !!savedVal.enabled;
                  color = savedVal.color || 'blue';
                  pinned = !!savedVal.pinned;
                  hidden = !!savedVal.hidden;
                  seen = !!savedVal.seen;
                  createdAt = savedVal.createdAt;
               } else {
                  enabled = !!savedVal;
               }
            } else {
               // Если нет в конфиге, берем из зарегистрированного
               const reg = registered.find(r => r.name === name);
               if (reg) {
                  color = reg.color;
                  // @ts-ignore
                  createdAt = reg.createdAt;
               }
            }
            
            return {
               key: name,
               name: name,
               file: '', 
               enabled,
               color,
               pinned,
               hidden,
               seen,
               createdAt
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

   const updateConfigItem = (key: string, updates: Record<string, any>) => {
      try {
         const str = globalStorage.getItem(LOGGER_NEXT_CONFIG_KEY);
         const raw = str ? JSON.parse(str) : {};
         
         let current = raw[key];
         // Handle legacy boolean format or missing
         if (typeof current === 'boolean') {
             current = { enabled: current, color: 'blue', pinned: false, hidden: false };
         } else if (!current) {
             current = { enabled: false, color: 'blue', pinned: false, hidden: false };
         }

         // Mark as seen on interaction, preserve createdAt
         raw[key] = { ...current, ...updates, seen: true };
         
         globalStorage.setItem(LOGGER_NEXT_CONFIG_KEY, JSON.stringify(raw));
         window.dispatchEvent(new Event('logger-next-config-change'));
         loadConfigs();
      } catch (e) {
         console.error(e);
      }
   };

   // Сортировка и фильтрация
   const { pinned, others } = useMemo(() => {
      let result = configs;

      if (!showHidden) {
         result = result.filter(c => !c.hidden);
      }

      if (search) {
         const q = search.toLowerCase();
         result = result.filter(
            (c) => c.name.toLowerCase().includes(q) || c.file.toLowerCase().includes(q)
         );
      }

      // Helper sort function
      const sortFn = (a: ConfigItem, b: ConfigItem) => {
         // 1. Sort by enabled state (if active)
         if (sortMode === 'enabled') {
            if (a.enabled !== b.enabled) {
               return a.enabled ? -1 : 1;
            }
         }

         // 2. Sort by created (if active)
         if (sortMode === 'created') {
            const tA = a.createdAt || 0;
            const tB = b.createdAt || 0;
            if (tA !== tB) return tB - tA; // Newest first
         }
         
         // 3. Sort by name
         return a.name.localeCompare(b.name);
      };

      // Helper to check if item is new
      const isNew = (item: ConfigItem) => {
         return !item.seen && item.createdAt && (Date.now() - item.createdAt < 180000);
      };

      const pinnedItems: ConfigItem[] = [];
      const otherItems: ConfigItem[] = [];

      for (const item of result) {
         // Add to pinned if pinned OR new
         if (item.pinned || isNew(item)) {
            pinnedItems.push(item);
         } else {
            otherItems.push(item);
         }
      }

      return {
         pinned: pinnedItems.sort(sortFn),
         others: otherItems.sort(sortFn)
      };
   }, [configs, search, sortMode]);

   const renderItem = (item: ConfigItem) => {
      const isNew = !item.seen && item.createdAt && (Date.now() - item.createdAt < 180000);

      return (
      <motion.div
         layout={!isDragging}
         initial={{ opacity: 0, y: 10 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95 }}
         transition={{ duration: 0.2 }}
         key={item.key}
         className={`
             group flex items-center justify-between p-2 py-[2px] bg-content2 border rounded-md border-default-200 hover:bg-default-100 transition-all
             ${item.enabled ? '!bg-primary-100/50' : ''}
             ${isNew ? 'ring-1 ring-warning ring-offset-1 ring-offset-content1 z-10' : ''}
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

            <div className="flex items-center gap-1">
               <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  className={`min-w-6 w-6 h-6 ${item.hidden ? 'text-default-500' : 'text-default-300 opacity-0 group-hover:opacity-100 transition-opacity'}`}
                  onPress={() => updateConfigItem(item.key, { hidden: !item.hidden })}
                  title={item.hidden ? "Unhide" : "Hide"}
               >
                  {item.hidden ? <EyeOff size={14} /> : <Eye size={14} />}
               </Button>

               <Button
                  isIconOnly
                  size="sm"
                  variant="light"
                  className={`min-w-6 w-6 h-6 ${item.pinned ? 'text-warning' : 'text-default-300'}`}
                  onPress={() => updateConfigItem(item.key, { pinned: !item.pinned })}
                  title={item.pinned ? "Unpin" : "Pin to top"}
               >
                  {item.pinned ? <Pin size={14} fill="currentColor" /> : <Pin size={14} />}
               </Button>

               <Popover placement="left">
                  <PopoverTrigger>
                     <motion.div
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        className="w-3 h-3 rounded-full cursor-pointer border border-default-200 mx-1"
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
                              onClick={() => updateConfigItem(item.key, { color: c.key })}
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
                  onValueChange={() => updateConfigItem(item.key, { enabled: !item.enabled })}
               />
            </div>
      </motion.div>
      );
   };

   return (
      <div 
         className="flex flex-col h-full bg-content1 border-l border-default-200"
         style={{ width: width, minWidth: width }}
      >
         {/* Header & Search */}
         <div className="px-2 py-0 border-b border-default-200 flex items-center gap-2 bg-content2 shrink-0 h-[36px]">
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
            
            {/* Sort Buttons */}
            <div className="flex bg-default-100 rounded-md p-0.5 gap-0.5 shrink-0 border border-default-200/50">
               <Button 
                  isIconOnly size="sm" variant={showHidden ? 'solid' : 'light'}
                  onPress={() => setShowHidden(!showHidden)}
                  title={showHidden ? "Hide Hidden Items" : "Show Hidden Items"}
                  className={`w-6 h-6 min-w-6 ${showHidden ? 'bg-background shadow-sm' : 'text-default-400'}`}
               >
                  {showHidden ? <Eye size={14} /> : <EyeOff size={14} />}
               </Button>
               <div className="w-[1px] bg-default-200 my-0.5 mx-0.5" />
               <Button 
                  isIconOnly size="sm" variant={sortMode === 'name' ? 'solid' : 'light'} 
                  onPress={() => updateSortMode('name')}
                  title="Sort by Name (A-Z)"
                  className={`w-6 h-6 min-w-6 ${sortMode === 'name' ? 'bg-background shadow-sm' : 'text-default-400'}`}
               >
                  <ArrowDownAz size={14} />
               </Button>
               <Button 
                  isIconOnly size="sm" variant={sortMode === 'created' ? 'solid' : 'light'}
                  onPress={() => updateSortMode('created')}
                  title="Sort by Newest"
                  className={`w-6 h-6 min-w-6 ${sortMode === 'created' ? 'bg-background shadow-sm' : 'text-default-400'}`}
               >
                  <Clock size={14} />
               </Button>
               <Button 
                  isIconOnly size="sm" variant={sortMode === 'enabled' ? 'solid' : 'light'}
                  onPress={() => updateSortMode('enabled')}
                  title="Sort by Enabled (Active First)"
                  className={`w-6 h-6 min-w-6 ${sortMode === 'enabled' ? 'bg-background shadow-sm' : 'text-default-400'}`}
               >
                  <ListChecks size={14} />
               </Button>
            </div>

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

         {/* Pinned Section (Fixed) */}
         {pinned.length > 0 && (
            <div className="flex flex-col p-2 gap-1 border-b border-default-200 bg-orange-50/50 shrink-0 z-10 max-h-[30%] overflow-y-auto">
               {/* <div className="flex items-center gap-2 px-1 pb-1">
                  <Pin size={10} className="text-default-400" />
                  <span className="text-[10px] font-bold text-default-400 uppercase tracking-wider">Pinned</span>
               </div> */}
               <AnimatePresence mode="popLayout" initial={false}>
                  {pinned.map(renderItem)}
               </AnimatePresence>
            </div>
         )}

         {/* Scrollable List */}
         <div className="flex-1 overflow-y-auto relative">
            <div className="flex flex-col p-2 gap-1">
               {pinned.length === 0 && others.length === 0 && (
                  <div className="text-center text-default-400 text-xs py-8">
                     No components found
                  </div>
               )}

               <AnimatePresence mode="popLayout" initial={false}>
                  {others.map(renderItem)}
               </AnimatePresence>
            </div>
         </div>
      </div>
   );
};
