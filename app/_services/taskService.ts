import { supabase } from '@/utils/supabase/supabaseClient';
import { Task } from '@/app/types';
import { logService } from './logService';
import { BaseActions, EntityTypes, TaskUpdateTypes, BaseActionType } from './actions';

export const taskService = {
    // --- Reads ---
    async getTasks(projectId: string) {
        const { data, error } = await supabase
            .from('tasks')
            .select('*, folders!inner(project_id)')
            .eq('folders.project_id', projectId)
            .or('is_deleted.eq.false,is_deleted.is.null')
            .order('sort_order');
            
        if (error) throw error;
        return (data || []).map((t: any) => {
            const { folders, ...task } = t;
            return task as Task;
        });
    },

    async getDoneTasks(showDeleted = false, timeFilter = 'all') {
        // ... (Logic from projectService, can be refined later to use logs if needed)
        // For now, keep as is, or use the LOGS approach?
        // User asked to use logs. But that's a UI/Query change.
        // Let's implement standard DB query first, then we can add separate method for "Done with Logs".
        
        let query = supabase
            .from('tasks')
            .select(`
                *,
                folders (
                    id,
                    title,
                    projects (
                        id,
                        title,
                        color
                    )
                )
            `);

        if (showDeleted) {
            query = query.or('is_completed.eq.true,is_deleted.eq.true');
        } else {
            query = query.eq('is_completed', true).or('is_deleted.eq.false,is_deleted.is.null');
        }

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
                query = query.gte('updated_at', fromTime);
            }
        }

        const { data, error } = await query
            .order('updated_at', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(100);

        if (error) throw error;
        return data;
    },

    async getTodayTasks() {
        const { data, error } = await supabase
            .from('tasks')
            .select(`
                *,
                folders (
                    id,
                    title,
                    projects (
                        id,
                        title,
                        color
                    )
                )
            `)
            .eq('is_today', true)
            .eq('is_completed', false)
            .or('is_deleted.eq.false,is_deleted.is.null')
            .order('sort_order', { ascending: true });

        if (error) throw error;
        return data as any[];
    },

    // --- Writes ---
    async createTask(folderId: string, content: string, sort_order: number) {
        const { data, error } = await supabase
            .from('tasks')
            .insert({
                folder_id: folderId,
                content,
                sort_order,
                is_completed: false,
                is_deleted: false,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        if (error) throw error;
        
        await logService.logAction(
            BaseActions.CREATE,
            EntityTypes.TASK,
            data.id,
            { after: data },
            content || 'New Task'
        );
        return data as Task;
    },

    async updateTask(id: string, updates: Partial<Task>) {
        // 1. Get BEFORE state
        const { data: beforeState, error: fetchError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .single();
            
        if (fetchError) throw fetchError;

        // 2. Determine Action & Update Type
        let baseAction: BaseActionType = BaseActions.UPDATE;
        let updateType = undefined;

        // Check for specific actions
        if ('is_completed' in updates) {
            baseAction = updates.is_completed ? BaseActions.COMPLETE : BaseActions.RESTORE;
        } 
        
        // Determine Update Type
        const keys = Object.keys(updates);
        if (keys.includes('content')) updateType = TaskUpdateTypes.RENAME;
        else if (keys.includes('folder_id')) updateType = TaskUpdateTypes.MOVE;
        else if (keys.includes('is_pinned')) updateType = updates.is_pinned ? TaskUpdateTypes.PIN : TaskUpdateTypes.UNPIN;
        else if (keys.includes('is_today')) updateType = updates.is_today ? TaskUpdateTypes.MARK_TODAY : TaskUpdateTypes.UNMARK_TODAY;
        else if (keys.includes('task_type')) updateType = TaskUpdateTypes.TASK_TYPE_CHANGE;
        else if (keys.includes('title_text_style')) updateType = TaskUpdateTypes.TITLE_STYLE_CHANGE;
        else if (keys.includes('group_color')) updateType = TaskUpdateTypes.GROUP_RECOLOR;

        // 3. Perform UPDATE
        const { data: afterState, error } = await supabase
            .from('tasks')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        
        // 4. Log
        await logService.logAction(
            baseAction,
            EntityTypes.TASK,
            id,
            { 
                before: beforeState, 
                after: afterState,
                // Only log diff in update_type if needed, but we have full snapshots
            },
            afterState.content || 'Task',
            updateType
        );
    },

    async restoreTask(id: string) {
        // Special restore to top
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('folder_id, content')
            .eq('id', id)
            .single();
            
        if (taskError) throw taskError;
        
        const { data: minTask } = await supabase
            .from('tasks')
            .select('sort_order')
            .eq('folder_id', task.folder_id)
            .or('is_completed.eq.false,is_completed.is.null')
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle();
            
        const minOrder = minTask ? minTask.sort_order : 0;
        
        // Get BEFORE
        const { data: beforeState } = await supabase.from('tasks').select('*').eq('id', id).single();

        // Update
        const { data: afterState, error } = await supabase
            .from('tasks')
            .update({
                is_completed: false,
                is_deleted: false,
                sort_order: minOrder - 1000,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
            
        if (error) throw error;
        
        await logService.logAction(
            BaseActions.RESTORE,
            EntityTypes.TASK,
            id,
            { before: beforeState, after: afterState },
            task.content
        );
    },

    async deleteTask(id: string) {
        // Get BEFORE
        const { data: beforeState, error: fetchError } = await supabase
            .from('tasks')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError) throw fetchError;

        // Soft delete
        const { data: afterState, error } = await supabase
            .from('tasks')
            .update({ 
                is_deleted: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        
        await logService.logAction(
            BaseActions.DELETE,
            EntityTypes.TASK,
            id,
            { before: beforeState, after: afterState },
            beforeState.content
        );
    },

    async updateTaskOrder(updates: { id: string; sort_order: number }[]) {
        if (updates.length === 0) return;
        
        const batchId = crypto.randomUUID();
        await logService.logAction(
            BaseActions.REORDER,
            EntityTypes.TASK,
            batchId,
            { count: updates.length }
        );
        
        await Promise.all(
            updates.map(u => 
                supabase
                    .from('tasks')
                    .update({
                        sort_order: u.sort_order
                        // updated_at: now // REMOVED to preserve history
                    })
                    .eq('id', u.id)
            )
        );
    }
};

