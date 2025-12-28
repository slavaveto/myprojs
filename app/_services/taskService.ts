import { supabase } from '@/utils/supabase/supabaseClient';
import { Task } from '@/app/types';
import { logService } from './logService';
import { BaseActions, EntityTypes, TaskUpdateTypes, BaseActionType } from './actions';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('TaskService');

export const taskService = {
    // --- Reads ---
    async getTasks(projectId: string) {
        logger.info('Fetching tasks...', { projectId });
        const { data, error } = await supabase
            .from('tasks')
            .select('*, folders!inner(project_id)')
            .eq('folders.project_id', projectId)
            .or('is_deleted.eq.false,is_deleted.is.null')
            .order('sort_order');
            
        if (error) {
            logger.error('Failed to fetch tasks', error);
            throw error;
        }
        logger.info('Tasks loaded', { count: data?.length });
        return (data || []).map((t: any) => {
            const { folders, ...task } = t;
            return task as Task;
        });
    },

    async getDoneTasks(showDeleted = false, timeFilter = 'all') {
        logger.info('Fetching done tasks...', { showDeleted, timeFilter });
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

        if (error) {
            logger.error('Failed to fetch done tasks', error);
            throw error;
        }
        logger.info('Done tasks loaded', { count: data?.length });
        return data;
    },

    async getTodayTasks() {
        logger.info('Fetching today tasks...');
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

        if (error) {
             logger.error('Failed to fetch today tasks', error);
             throw error;
        }
        logger.info('Today tasks loaded', { count: data?.length });
        return data as any[];
    },

    async getInboxTasks() {
        logger.info('Fetching inbox tasks...');
        const { data, error } = await supabase
            .from('tasks')
            .select('*')
            .is('folder_id', null)
            .eq('is_completed', false)
            .or('is_deleted.eq.false,is_deleted.is.null')
            .order('created_at', { ascending: false });

        if (error) {
             logger.error('Failed to fetch inbox tasks', error);
             throw error;
        }
        logger.info('Inbox tasks loaded', { count: data?.length });
        return data as any[];
    },

    // --- Search Index ---
    async getAllTasksShort() {
        logger.info('Fetching all tasks for search index...');
        const { data, error } = await supabase
            .from('tasks')
            .select(`
                id,
                content,
                is_completed,
                folder_id,
                is_today,
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
            .or('is_deleted.eq.false,is_deleted.is.null') // Only active tasks
            .limit(2000); // Reasonable limit for performance

        if (error) {
            logger.error('Failed to fetch search index', error);
            return [];
        }

        return data || [];
    },

    async moveTaskToFolder(taskId: string, folderId: string) {
        logger.info('Moving task to folder (top)', { taskId, folderId });
        
        // Find min sort order
        const { data: minTask } = await supabase
            .from('tasks')
            .select('sort_order')
            .eq('folder_id', folderId)
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle();
            
        const minOrder = minTask ? minTask.sort_order : 0;
        const newSortOrder = minOrder - 10000; // Ensure it's well above
        
        // Update task
        await this.updateTask(taskId, { 
            folder_id: folderId,
            sort_order: newSortOrder
        });
    },

    // --- Writes ---
    async createTask(folderId: string | null, content: string, sort_order: number) {
        logger.info('Creating task', { content, folderId });
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
        if (error) {
            logger.error('Failed to create task', error);
            throw error;
        }
        
        await logService.logAction(
            folderId ? BaseActions.CREATE : BaseActions.CREATE_INBOX,
            EntityTypes.TASK,
            data.id,
            { after: data },
            content || 'New Task'
        );
        logger.success('Task created', { id: data.id });
        return data as Task;
    },

    async updateTask(id: string, updates: Partial<Task>) {
        logger.info('Updating task', { id, updates });
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

        if (error) {
             logger.error('Failed to update task', error);
             throw error;
        }
        
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
        logger.success('Task updated', { id });
    },

    async restoreTask(id: string) {
        logger.info('Restoring task', { id });
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
            
        if (error) {
             logger.error('Failed to restore task', error);
             throw error;
        }
        
        await logService.logAction(
            BaseActions.RESTORE,
            EntityTypes.TASK,
            id,
            { before: beforeState, after: afterState },
            task.content
        );
        logger.success('Task restored', { id });
    },

    async deleteTask(id: string) {
        logger.info('Deleting task', { id });
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

        if (error) {
             logger.error('Failed to delete task', error);
             throw error;
        }
        
        await logService.logAction(
            BaseActions.DELETE,
            EntityTypes.TASK,
            id,
            { before: beforeState, after: afterState },
            beforeState.content
        );
        logger.success('Task deleted', { id });
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
        logger.info('Tasks reordered', { count: updates.length });
    }
};
