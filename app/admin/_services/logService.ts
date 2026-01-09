import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/utils/logger/Logger';
import { DB_TABLES } from '@/utils/supabase/db_tables';

const logger = createLogger('AdminLogService');

export type LogAction = 
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

export type LogEntity = 'rooms' | 'ui' | 'users' | 'auth' | 'profile';

export interface LogParams {
  action: LogAction;
  entity: LogEntity;
  entityId?: string;
  details?: Record<string, any>;
  userId: string;
}

export const logService = {
  async logAction(supabase: SupabaseClient, params: LogParams) {
    if (!params.userId) {
      logger.warn('Attempted to log audit without user', params);
      return;
    }

    try {
      // Fire and forget
      const { error } = await supabase.from(DB_TABLES.LOGS_ADMIN).insert({
        user_id: params.userId,
        action: params.action,
        entity: params.entity,
        entity_id: params.entityId,
        details: params.details || {},
        created_at: new Date().toISOString()
      });

      if (error) {
        logger.error('Failed to write audit log', error);
      } else {
        logger.info('Audit action', params);
      }
    } catch (err) {
      logger.error('Audit exception', err);
    }
  },

  async getLogs(supabase: SupabaseClient, limit = 100) {
      try {
        const { data, error } = await supabase
            .from(DB_TABLES.LOGS_ADMIN)
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data || [];
      } catch (err) {
          logger.error('Failed to fetch logs', err);
          throw err;
      }
  }
};

