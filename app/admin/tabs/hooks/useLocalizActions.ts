import { useSupabase } from '@/utils/supabase/useSupabase';
import { logService } from '@/app/admin/_services/logService';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { createLogger } from '@/utils/logger/Logger';
import { UIElement } from '@/utils/providers/localization/types';

const logger = createLogger('LocActions');
const TABLE_NAME = '_ui';

export function useLocalizActions() {
  const { supabase, userId: currentUserId } = useSupabase();

  // 1. Создание
  const { execute: executeCreate, status: createStatus } = useAsyncAction({
    useToast: false, // Отключаем, так как тосты управляются из UI
    loadingMessage: 'Создание...',
    successMessage: 'Элемент создан',
    errorMessage: (err) => `Ошибка создания: ${err.message}`
  });

  const createItem = async (item: Partial<UIElement>) => {
    return executeCreate(async () => {
       // Проверка дубликатов (уже была в компоненте, переносим сюда)
       const { data: dbExists } = await supabase
           .from(TABLE_NAME)
           .select('item_id')
           .eq('item_id', item.item_id)
           .maybeSingle();

       if (dbExists) {
           throw new Error(`ID "${item.item_id}" уже существует`);
       }

       const payload = {
           item_id: item.item_id,
           ru: item.ru || '',
           uk: item.uk || '',
           en: item.en || '',
           tab_id: item.tab_id || 'misc',
           sort_order: item.sort_order || 0,
           updated_at: new Date().toISOString(),
       };

       const { error } = await supabase.from(TABLE_NAME).insert(payload);
       if (error) throw error;

       if (currentUserId) {
         await logService.logAction(supabase, {
            action: 'LOCALIZATION_CREATE',
            entity: 'ui',
            entityId: item.item_id,
            details: payload,
            userId: currentUserId
         });
       }
    });
  };

  // 2. Удаление
  const { execute: executeDelete, status: deleteStatus } = useAsyncAction({
    useToast: false, // Отключаем, так как тосты управляются из UI
    loadingMessage: 'Удаление...',
    successMessage: 'Удалено',
    errorMessage: 'Ошибка удаления'
  });

  const deleteItem = async (itemId: string) => {
    return executeDelete(async () => {
       const { error } = await supabase.from(TABLE_NAME).delete().eq('item_id', itemId);
       if (error) throw error;

       if (currentUserId) {
         await logService.logAction(supabase, {
            action: 'LOCALIZATION_DELETE',
            entity: 'ui',
            entityId: itemId,
            userId: currentUserId
         });
       }
    });
  };

  // 3. Обновление (любого поля)
  const { execute: executeUpdate, status: updateStatus } = useAsyncAction({
     useToast: false, 
     successMessage: 'Сохранено',
     errorMessage: 'Ошибка сохранения'
  });

  const updateItem = async (itemId: string, updates: Partial<UIElement>) => {
     return executeUpdate(async () => {
        const { error } = await supabase
           .from(TABLE_NAME)
           .update({ ...updates, updated_at: new Date().toISOString() })
           .eq('item_id', itemId);

        if (error) throw error;

        if (currentUserId) {
          await logService.logAction(supabase, {
             action: 'LOCALIZATION_UPDATE',
             entity: 'ui',
             entityId: itemId,
             details: updates,
             userId: currentUserId
          });
        }
     });
  };

  // 4. Перемещение (Tab + Sort)
  const moveItem = async (itemId: string, newTabId: string, newSortOrder: number) => {
      // Тут можно без useAsyncAction, так как это часть UI логики драг-н-дропа
      const updates = { 
          tab_id: newTabId, 
          sort_order: newSortOrder,
          updated_at: new Date().toISOString() 
      };

      const { error } = await supabase
        .from(TABLE_NAME)
        .update(updates)
        .eq('item_id', itemId);

      if (error) throw error;
  };

  // 5. Массовая сортировка
  const updateSortOrders = async (updates: { item_id: string; sort_order: number }[]) => {
      const promises = updates.map(u => 
          supabase
             .from(TABLE_NAME)
             .update({ sort_order: u.sort_order, updated_at: new Date().toISOString() })
             .eq('item_id', u.item_id)
      );
      
      await Promise.all(promises);
      // Лог можно один на всех, или не писать вовсе для сортировки (слишком много шума)
  };

  return {
    createItem,
    deleteItem,
    updateItem,
    moveItem,
    updateSortOrders,
    isCreating: createStatus === 'loading',
    isDeleting: deleteStatus === 'loading',
    isUpdating: updateStatus === 'loading'
  };
}

