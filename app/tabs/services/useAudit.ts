import { useSupabase } from '@/utils/supabase/useSupabase';
import { createLogger } from '@/utils/logger/Logger';
// REMOVED: import { useUser } from '@clerk/nextjs';

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
  // REMOVED: const { user } = useUser();
  const userId = 'guest-admin'; // Hardcoded for public admin

  const log = async (params: LogParams) => {
    // REMOVED: User check

    try {
      const { error } = await supabase.from('logs').insert({
        user_id: userId,
        action: params.action,
        entity: params.entity,
        entity_id: params.entityId,
        details: params.details || {},
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

