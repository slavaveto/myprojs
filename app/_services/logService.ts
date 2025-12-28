import { supabase } from '@/utils/supabase/supabaseClient';

export interface LogEntry {
    id: string;
    created_at: string;
    action: string;
    entity: string;
    entity_id: string;
    entity_title?: string;
    update_type?: string;
    details?: any;
}

export const logService = {
    async logAction(
        action: string,
        entity: string,
        entity_id: string,
        details?: any,
        entity_title?: string,
        update_type?: string
    ) {
        const { error } = await supabase
            .from('logs')
            .insert({
                action,
                entity,
                entity_id,
                details,
                entity_title,
                update_type,
                created_at: new Date().toISOString()
            });
            
        if (error) {
            console.error('Failed to log action:', error);
        }
    },

    async getLogs(limit = 100, timeFilter = 'all', actionFilter = 'all') {
        let query = supabase
            .from('logs')
            .select('*');

        // Filter by Action
        if (actionFilter !== 'all') {
            query = query.eq('action', actionFilter);
        }

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
