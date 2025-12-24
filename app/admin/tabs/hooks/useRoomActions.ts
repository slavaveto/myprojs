import { useSupabase } from '@/utils/supabase/useSupabase';
import { useAudit } from '@/app/admin/_services/useAudit';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('RoomActions');

export function useRoomActions() {
  const { supabase } = useSupabase();
  const { log } = useAudit();

  // 1. Создание
  const { execute: executeCreate, status: createStatus } = useAsyncAction({
    useToast: false, // Отключаем, так как тосты управляются из UI
    loadingMessage: 'Создание комнаты...',
    successMessage: 'Комната создана',
    errorMessage: 'Ошибка создания комнаты'
  });

  const createRoom = async (payload: { title: string; userId: string; roomId?: string; sortOrder?: number; isSection?: boolean; isActive?: boolean }) => {
    return executeCreate(async () => {
       const { data, error } = await supabase.from('rooms').insert({
          room_id: payload.roomId, // Supabase сам сгенерит если нет, но мы можем передать
          room_title: payload.title,
          user_id: payload.userId,
          sort_order: payload.sortOrder ?? 0,
          is_section: payload.isSection ?? false,
          is_active: payload.isActive ?? true,
       }).select().single();

       if (error) throw error;

       // Логируем
       log({ 
          action: 'ROOM_CREATE', 
          entity: 'rooms', 
          entityId: data.room_id, 
          details: { title: payload.title } 
       });

       return data;
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
       const { error } = await supabase.from('rooms').delete().eq('room_id', roomId);
       if (error) throw error;

       log({ 
          action: 'ROOM_DELETE', 
          entity: 'rooms', 
          entityId: roomId 
       });
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
        const { data, error } = await supabase
           .from('rooms')
           .update({
             ...updates,
             updated_at: new Date().toISOString()
           })
           .eq('room_id', roomId)
           .select()
           .single();

        if (error) throw error;

        log({ 
           action: 'ROOM_UPDATE', 
           entity: 'rooms', 
           entityId: roomId, 
           details: updates 
        });

        return data;
     });
  };

  return {
    createRoom,
    deleteRoom,
    updateRoom,
    isCreating: createStatus === 'loading',
    isDeleting: deleteStatus === 'loading',
    isUpdating: updateStatus === 'loading'
  };
}

