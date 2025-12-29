import { useSupabase } from '@/utils/supabase/useSupabase';
import { logService } from '@/app/admin/_services/logService';
import { localizationService } from '@/app/admin/_services/localizationService';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { createLogger } from '@/utils/logger/Logger';
import { UIElement } from '@/utils/providers/localization/types';

const logger = createLogger('LocActions');

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
       // Проверка дубликатов
       if (item.item_id) {
           const exists = await localizationService.checkIdExists(supabase, item.item_id);
           if (exists) {
               throw new Error(`ID "${item.item_id}" уже существует`);
           }
       }

       const payload = await localizationService.createItem(supabase, item);

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
       await localizationService.deleteItem(supabase, itemId);

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
        await localizationService.updateItem(supabase, itemId, updates);

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
          sort_order: newSortOrder
      };
      await localizationService.updateItem(supabase, itemId, updates);
  };

  // 5. Массовая сортировка
  const updateSortOrders = async (updates: { item_id: string; sort_order: number }[]) => {
      await localizationService.updateSortOrders(supabase, updates);
      // Лог можно один на всех, или не писать вовсе для сортировки
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

