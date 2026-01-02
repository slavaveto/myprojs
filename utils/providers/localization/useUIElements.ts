'use client';
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/supabase/supabaseClient';
import type { UIElement, CachedData, Language } from './types';
import { createLogger } from '@/utils/logger/Logger';
import { storage, globalStorage } from '@/utils/storage';

import { DB_TABLES } from '@/utils/supabase/db_tables';

const CACHE_KEY = 'ui-elements-cache';
const CACHE_VERSION_KEY = 'ui-elements-version';
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

// ВРЕМЕННЫЙ ФЛАГ: установи false когда настроишь триггер updated_at в БД
const FORCE_LOAD_FROM_DB = false;

export function useUIElements() {
   const [uiData, setUIData] = useState<UIElement[]>([]);
   const [isUILoaded, setIsUILoaded] = useState(false);

   const logger = createLogger('useUIElements');

   useEffect(() => {
      loadUITable();
   }, []);

   const loadUITable = async () => {
      try {
         const cacheKey = `ui_${DB_TABLES.UI_ITEMS}`;
         const cached = typeof window !== 'undefined' ? globalStorage.getItem(cacheKey) : null;

         let shouldLoadFromDB = true;

         // Если флаг включен - очищаем кэш и грузим из БД
         if (FORCE_LOAD_FROM_DB) {
            if (typeof window !== 'undefined') {
               globalStorage.removeItem(cacheKey);
            }
            logger.warning('FORCE_LOAD_FROM_DB включён - игнорируем кэш');
            shouldLoadFromDB = true;
         } else if (cached) {
            const cachedData: CachedData<UIElement> = JSON.parse(cached);

            // Проверяем актуальность кэша (только активные элементы типа 'item')
            const { data: dbTimestamps } = await supabase
               .from(DB_TABLES.UI_ITEMS)
               .select('item_id, updated_at')
               .eq('is_deleted', false)
               .in('task_type', ['item']);

            if (dbTimestamps) {
               const outdatedItems = dbTimestamps.filter((dbItem) => {
                  const cachedItem = cachedData.items[dbItem.item_id];
                  return !cachedItem || cachedItem.updated_at !== dbItem.updated_at;
               });

               if (outdatedItems.length === 0) {
                  // Кэш актуальный
                  logger.success('UI загружен из кэша (все элементы актуальны)', {
                     totalItems: Object.keys(cachedData.items).length,
                  });
                  setUIData(Object.values(cachedData.items));
                  setIsUILoaded(true);
                  shouldLoadFromDB = false;
               } else if (outdatedItems.length < dbTimestamps.length) {
                  // Загружаем только устаревшие
                  logger.warning('UI частично из кэша, обновляем устаревшие', {
                     outdated: outdatedItems.length,
                     total: dbTimestamps.length,
                  });

                  const itemIds = outdatedItems.map((item) => item.item_id);
                  const { data: freshData } = await supabase
                     .from(DB_TABLES.UI_ITEMS)
                     .select('*')
                     .in('item_id', itemIds)
                     .eq('is_deleted', false)
                     .in('task_type', ['item']);

                  if (freshData) {
                     freshData.forEach((item) => {
                        cachedData.items[item.item_id] = item;
                     });

                     const updatedElements = Object.values(cachedData.items);
                     setUIData(updatedElements);

                     globalStorage.setItem(
                        cacheKey,
                        JSON.stringify({
                           items: cachedData.items,
                           lastSync: new Date().toISOString(),
                        })
                     );

                     logger.success('UI обновлён (кэш + новые данные из БД)', {
                        updatedItems: freshData.length,
                     });

                     setIsUILoaded(true);
                     shouldLoadFromDB = false;
                  }
               }
            }
         }

         if (shouldLoadFromDB) {
            // Загружаем все данные (только активные элементы типа 'item')
            logger.start('Загрузка UI из БД (кэш отсутствует или устарел)');

            const { data, error } = await supabase
               .from(DB_TABLES.UI_ITEMS)
               .select('*')
               .eq('is_deleted', false)
               .in('task_type', ['item']);

            if (data && !error) {
               setUIData(data);

               // Сохраняем в кэш
               const cacheData: CachedData<UIElement> = {
                  items: data.reduce(
                     (acc, item) => {
                        acc[item.item_id] = item;
                        return acc;
                     },
                     {} as Record<string, UIElement>
                  ),
                  lastSync: new Date().toISOString(),
               };

               if (typeof window !== 'undefined') {
                  globalStorage.setItem(cacheKey, JSON.stringify(cacheData));
               }

               logger.success('UI загружен из БД и сохранён в кэш', {
                  totalItems: data.length,
               });

               setIsUILoaded(true);
            } else {
               logger.error('Ошибка загрузки UI из БД', { error });
               // Даже при ошибке разблокируем UI, чтобы не висел вечный спиннер
               setIsUILoaded(true);
            }
         }
      } catch (error) {
         logger.error('Критическая ошибка загрузки UI', { error });
         // Даже при ошибке разблокируем UI, чтобы не висел вечный спиннер
         setIsUILoaded(true);
      }
   };

   // Метод получения UI элемента
   const getUI = (item_id: string, language: Language): string => {
      if (!uiData.length) {
         return item_id;
      }

      const element = uiData.find((e) => e.item_id === item_id);
      return element ? element[language] : item_id;
   };

   return {
      uiData,
      getUI,
      isUILoaded,
   };
}
