import { useSupabase } from '@/utils/supabase/useSupabase';
import { logService } from '@/app/admin/_services/logService';
import { userService } from '@/app/admin/_services/userService';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('UserActions');

export function useUserActions() {
  const { supabase, userId: currentUserId } = useSupabase();

  const { execute: executeUpdate, status: updateStatus } = useAsyncAction({
    useToast: false, // Отключаем, так как тосты управляются из UI
    loadingMessage: 'Обновление прав...',
    successMessage: 'Права обновлены',
    errorMessage: 'Ошибка обновления'
  });

  const updateUserRole = async (targetUserId: string, updates: { is_super_admin?: boolean; plan?: string }) => {
    return executeUpdate(async () => {
       // 1. Проверка защиты (читаем роль цели)
       const targetUser = await userService.getUser(supabase, targetUserId);
       
       if (targetUser?.is_owner) { // Используем optional chaining на случай странных данных
          throw new Error('Нельзя изменять права Владельца (Owner)!');
       }

       // 2. Обновление
       await userService.updateUser(supabase, targetUserId, updates);

       // 3. Лог
       if (currentUserId) {
         await logService.logAction(supabase, {
            action: 'USER_ROLE_UPDATE',
            entity: 'users',
            entityId: targetUserId,
            details: updates,
            userId: currentUserId
         });
       }
    });
  };

  return {
    updateUserRole,
    isUpdating: updateStatus === 'loading'
  };
}

