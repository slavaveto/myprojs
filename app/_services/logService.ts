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

    async getLogs(limit = 100, timeFilter = 'all') {
        let query = supabase
            .from('logs')
            .select('*');

        // Filter by Time
        if (timeFilter !== 'all') {
            const now = new Date();
            let fromTime;

            if (timeFilter === 'hour') {
                fromTime = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
            } else if (timeFilter === 'today') {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                fromTime = today.toISOString();
            }

            if (fromTime) {
                query = query.gte('created_at', fromTime);
            }
        }

        const { data, error } = await query
            .order('created_at', { ascending: false })
            .limit(limit);

        if (error) throw error;
        return data as LogEntry[];
    }
};

