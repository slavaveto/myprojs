import { useSupabase } from '@/utils/supabase/useSupabase';
import { useAudit } from '@/app/admin/_services/useAudit';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('UserActions');
const TABLE_NAME = 'users';

export function useUserActions() {
  const { supabase } = useSupabase();
  const { log } = useAudit();

  const { execute: executeUpdate, status: updateStatus } = useAsyncAction({
    useToast: false, // Отключаем, так как тосты управляются из UI
    loadingMessage: 'Обновление прав...',
    successMessage: 'Права обновлены',
    errorMessage: 'Ошибка обновления'
  });

  const updateUserRole = async (targetUserId: string, updates: { is_super_admin?: boolean; plan?: string }) => {
    return executeUpdate(async () => {
       // 1. Проверка защиты (читаем роль цели)
       const { data: targetUser, error: fetchError } = await supabase
          .from(TABLE_NAME)
          .select('is_owner')
          .eq('user_id', targetUserId)
          .single();
       
       if (fetchError) throw fetchError;

       if (targetUser?.is_owner) { // Используем optional chaining на случай странных данных
          throw new Error('Нельзя изменять права Владельца (Owner)!');
       }

       // 2. Обновление
       const { error } = await supabase
          .from(TABLE_NAME)
          .update({
             ...updates,
             updated_at: new Date().toISOString()
          })
          .eq('user_id', targetUserId);

       if (error) throw error;

       // 3. Лог
       log({ 
          action: 'USER_ROLE_UPDATE', 
          entity: 'users', 
          entityId: targetUserId, 
          details: updates 
       });
    });
  };

  return {
    updateUserRole,
    isUpdating: updateStatus === 'loading'
  };
}

