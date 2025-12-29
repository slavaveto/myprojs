import { useSupabase } from '@/utils/supabase/useSupabase';
import { logService } from '@/app/admin/_services/logService';
import { roomService } from '@/app/admin/_services/roomService';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('RoomActions');

export function useRoomActions() {
  const { supabase, userId: currentUserId } = useSupabase();

  // 1. Создание
  const { execute: executeCreate, status: createStatus } = useAsyncAction({
    useToast: false, // Отключаем, так как тосты управляются из UI
    loadingMessage: 'Создание комнаты...',
    successMessage: 'Комната создана',
    errorMessage: 'Ошибка создания комнаты'
  });

  const createRoom = async (payload: { title: string; userId: string; roomId?: string; sortOrder?: number; isSection?: boolean; isActive?: boolean }) => {
    return executeCreate(async () => {
       const roomData = {
          room_id: payload.roomId, // Supabase сам сгенерит если нет, но мы можем передать
          room_title: payload.title,
          user_id: payload.userId,
          sort_order: payload.sortOrder ?? 0,
          is_section: payload.isSection ?? false,
          is_active: payload.isActive ?? true,
       };

       await roomService.createRoom(supabase, roomData);

       // Логируем
       if (currentUserId) {
         await logService.logAction(supabase, {
            action: 'ROOM_CREATE',
            entity: 'rooms',
            entityId: payload.roomId, // Внимание: если ID генерит база, тут может быть undefined, но в createRoom мы передавали его
            details: { title: payload.title },
            userId: currentUserId
         });
       }

       return roomData; // Раньше возвращали data из базы, сейчас просто payload, т.к. service void
    });
  };

  // 2. Удаление
  const { execute: executeDelete, status: deleteStatus } = useAsyncAction({
    useToast: false, // Отключаем, так как тосты управляются из UI
    loadingMessage: 'Удаление...',
    successMessage: 'Комната удалена',
    errorMessage: 'Ошибка удаления'
  });

  const deleteRoom = async (roomId: string) => {
    return executeDelete(async () => {
       await roomService.deleteRoom(supabase, roomId);

       if (currentUserId) {
         await logService.logAction(supabase, {
            action: 'ROOM_DELETE',
            entity: 'rooms',
            entityId: roomId,
            userId: currentUserId
         });
       }
    });
  };

  // 3. Обновление (любого поля)
  const { execute: executeUpdate, status: updateStatus } = useAsyncAction({
     useToast: false, // Отключаем, так как тосты управляются из UI
     successMessage: 'Сохранено',
     errorMessage: 'Ошибка сохранения'
  });

  const updateRoom = async (roomId: string, updates: Record<string, any>) => {
     // Для обновлений часто не нужен лоадер на весь экран, но нужен тост
     return executeUpdate(async () => {
        await roomService.updateRoom(supabase, roomId, updates);

        if (currentUserId) {
          await logService.logAction(supabase, {
             action: 'ROOM_UPDATE',
             entity: 'rooms',
             entityId: roomId,
             details: updates,
             userId: currentUserId
          });
        }
     });
  };

  // 4. Массовая сортировка (добавили)
  const updateSortOrders = async (updates: { room_id: string; sort_order: number }[]) => {
      await roomService.updateSortOrders(supabase, updates);
  };

  return {
    createRoom,
    deleteRoom,
    updateRoom,
    updateSortOrders, // Экспортируем новый метод
    isCreating: createStatus === 'loading',
    isDeleting: deleteStatus === 'loading',
    isUpdating: updateStatus === 'loading'
  };
}

