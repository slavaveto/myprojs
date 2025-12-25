import { supabase } from '@/utils/supabase/supabaseClient';

export interface LogEntry {
    id: string;
    created_at: string;
    user_id?: string;
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
        // In a real app, we might get user_id from auth context or pass it in
        // const { data: { user } } = await supabase.auth.getUser();
        
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
            console.error('Failed to write log:', error);
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

