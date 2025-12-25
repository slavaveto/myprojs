import { supabase } from '@/utils/supabase/supabaseClient';

export interface LogEntry {
    id: string;
    created_at: string;
    action: string;
    entity_table: string;
    entity_id: string;
    details?: any;
}

export const logService = {
    async logAction(
        action: string,
        entity_table: string,
        entity_id: string,
        details?: any
    ) {
        const { error } = await supabase
            .from('logs')
            .insert({
                action,
                entity_table,
                entity_id,
                details,
                created_at: new Date().toISOString()
            });
            
        if (error) {
            console.error('Failed to write log:', JSON.stringify(error, null, 2));
        }
    },

    async getLogs(limit = 100) {
        const { data, error } = await supabase
            .from('logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data as LogEntry[];
    }
};

