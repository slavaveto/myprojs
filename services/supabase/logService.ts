import { SupabaseClient } from '@supabase/supabase-js';
import { DB_TABLES } from '@/utils/supabase/db_tables';

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

export const createLogService = (supabase: SupabaseClient) => ({
    async logAction(
        action: string,
        entity: string,
        entity_id: string,
        details?: any,
        entity_title?: string,
        update_type?: string
    ) {
        const { error } = await supabase
            .from(DB_TABLES.LOGS)
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
            .from(DB_TABLES.LOGS)
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
    },

    // --- Temporary Repair Script ---
    async fixMissingLogs(): Promise<{ count: number; error?: any }> {
        // 1. Get all completed or deleted tasks
        const { data: tasks, error } = await supabase
            .from(DB_TABLES.TASKS)
            .select('id, content, is_completed, is_deleted, updated_at, folder_id')
            .or('is_completed.eq.true,is_deleted.eq.true');

        if (error || !tasks) {
            console.error('Failed to fetch tasks for repair', error);
            return { count: 0, error };
        }

        // 2. Get existing logs for these tasks
        const { data: existingLogs } = await supabase
            .from(DB_TABLES.LOGS)
            .select('entity_id, action')
            .eq('entity', 'task')
            .in('entity_id', tasks.map(t => t.id));

        const existingLogMap = new Set(existingLogs?.map(l => l.entity_id + '_' + l.action));

        let fixedCount = 0;
        const fixDate = new Date();
        fixDate.setDate(fixDate.getDate() - 1); // Yesterday
        fixDate.setHours(12, 0, 0, 0); // 12:00

        const newLogs = [];

        for (const task of tasks) {
            let neededAction = null;
            if (task.is_deleted) neededAction = 'delete';
            else if (task.is_completed) neededAction = 'complete';

            if (!neededAction) continue;

            const hasLog = existingLogMap.has(task.id + '_' + neededAction);
            
            if (!hasLog) {
                newLogs.push({
                    action: neededAction,
                    entity: 'task',
                    entity_id: task.id,
                    entity_title: task.content || 'Unknown Task',
                    created_at: fixDate.toISOString(),
                    details: { note: 'Auto-repaired missing log' }
                });
                fixedCount++;
            }
        }

        if (newLogs.length > 0) {
            // Insert in batches of 100
            for (let i = 0; i < newLogs.length; i += 100) {
                const batch = newLogs.slice(i, i + 100);
                await supabase.from(DB_TABLES.LOGS).insert(batch);
            }
        }

        return { count: fixedCount };
    }
});
