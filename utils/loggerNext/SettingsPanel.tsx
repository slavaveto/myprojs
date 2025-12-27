'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { globalStorage } from '@/utils/storage';
import { LOGGER_NEXT_CONFIG_KEY } from './LoggerNext';
import { Button, Input, Switch, ScrollShadow } from '@heroui/react';
import { Search, RotateCw, Trash2, SlidersHorizontal, ArrowUpDown } from 'lucide-react';

interface ConfigItem {
   key: string;
   name: string;
   file: string;
   enabled: boolean;
   lastActive?: number; // TODO: Implement last active tracking
}

export function SettingsPanel() {
   const [configs, setConfigs] = useState<ConfigItem[]>([]);
   const [search, setSearch] = useState('');
   
   // Загрузка конфигов
   const loadConfigs = () => {
      try {
         const str = globalStorage.getItem(LOGGER_NEXT_CONFIG_KEY);
         const raw = str ? JSON.parse(str) : {};
         
         const list: ConfigItem[] = Object.entries(raw).map(([key, value]) => {
            const [name, file] = key.split(':');
            return {
               key,
               name,
               file: file || 'unknown',
               enabled: value as boolean
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

   const toggleLogger = (key: string, currentState: boolean) => {
      try {
         const str = globalStorage.getItem(LOGGER_NEXT_CONFIG_KEY);
         const raw = str ? JSON.parse(str) : {};
         
         raw[key] = !currentState;
         
         globalStorage.setItem(LOGGER_NEXT_CONFIG_KEY, JSON.stringify(raw));
         
         // Уведомляем логгеры и UI
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
         result = result.filter(c => 
            c.name.toLowerCase().includes(q) || 
            c.file.toLowerCase().includes(q)
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
      <div className="flex flex-col h-full bg-content1 border-l border-default-200 w-[350px]">
         {/* Header */}
         <div className="p-3 border-b border-default-200 flex items-center justify-between bg-content2">
            <div className="flex items-center gap-2 font-medium">
               <SlidersHorizontal size={16} />
               <span>Settings</span>
            </div>
            <div className="text-xs text-default-400">
               {configs.length} components
            </div>
         </div>

         {/* Search */}
         <div className="p-2 border-b border-default-200">
            <Input
               placeholder="Search components..."
               size="sm"
               startContent={<Search size={14} className="text-default-400" />}
               value={search}
               onValueChange={setSearch}
               isClearable
               classNames={{
                  inputWrapper: "h-8"
               }}
            />
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
                      <div className="flex flex-col overflow-hidden mr-3">
                         <span className={`font-medium text-sm truncate ${item.enabled ? 'text-foreground' : 'text-default-500'}`}>
                            {item.name}
                         </span>
                         <span className="text-[10px] text-default-400 truncate font-mono">
                            {item.file}
                         </span>
                      </div>
                      
                      <Switch 
                         size="sm" 
                         isSelected={item.enabled} 
                         onValueChange={() => toggleLogger(item.key, item.enabled)}
                      />
                   </div>
                ))}
             </div>
         </div>
         
         {/* Footer Actions */}
         <div className="p-2 border-t border-default-200 bg-content2 flex justify-end">
             <Button 
                size="sm" 
                variant="light" 
                color="danger"
                startContent={<Trash2 size={14} />}
                onPress={() => {
                   if (confirm('Reset all settings?')) {
                      globalStorage.removeItem(LOGGER_NEXT_CONFIG_KEY);
                      window.dispatchEvent(new Event('logger-next-config-change'));
                   }
                }}
             >
                Reset Config
             </Button>
         </div>
      </div>
   );
}

