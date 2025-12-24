import { useSupabase } from '@/utils/supabase/useSupabase';
import { useUser } from '@clerk/nextjs';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('AuditService');

export type AuditAction = 
  | 'ROOM_CREATE' 
  | 'ROOM_UPDATE' 
  | 'ROOM_DELETE'
  | 'LOCALIZATION_CREATE'
  | 'LOCALIZATION_UPDATE' 
  | 'LOCALIZATION_DELETE'
  | 'LOGIN'
  | 'LOGOUT'
  | 'USER_ROLE_UPDATE'
  | 'PROFILE_UPDATE';

export type AuditEntity = 'rooms' | 'ui' | 'users' | 'auth' | 'profile';

interface LogParams {
  action: AuditAction;
  entity: AuditEntity;
  entityId?: string;
  details?: Record<string, any>;
}

export function useAudit() {
  const { supabase } = useSupabase();
  const { user } = useUser();

  const log = async (params: LogParams) => {
    if (!user) {
      logger.warning('Attempted to log audit without user', params);
      return;
    }

    try {
      // Fire and forget - не ждем ответа, чтобы не тормозить UI
      const { error } = await supabase.from('logs').insert({
        user_id: user.id,
        action: params.action,
        entity: params.entity,
        entity_id: params.entityId,
        details: params.details || {},
        // ip_address можно достать только на сервере или через сторонние API,
        // пока оставляем пустым или можно добавить позже
      });

      if (error) {
        logger.error('Failed to write audit log', error);
      } else {
        logger.info('Audit action', params);
      }
    } catch (err) {
      logger.error('Audit exception', err);
    }
  };

  return { log };
}

