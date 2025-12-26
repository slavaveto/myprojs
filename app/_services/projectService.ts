import { supabase } from '@/utils/supabase/supabaseClient';
import { Project, Folder, Task } from '@/app/types';
import { logService } from './logService';

export const projectService = {
    // --- Projects ---
    async getProjects() {
        const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('sort_order', { ascending: true });
        if (error) throw error;
        return data as Project[];
    },

    async createProject(title: string, color: string, sort_order: number) {
        const { data, error } = await supabase
            .from('projects')
            .insert({
                title,
                color,
                sort_order,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        if (error) throw error;
        
        await logService.logAction('create', 'projects', data.id, { title, color });
        return data as Project;
    },

    async updateProject(id: string, updates: { title?: string; color?: string }) {
        const { error } = await supabase
            .from('projects')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        if (error) throw error;
        
        await logService.logAction('update', 'projects', id, updates);
    },

    async deleteProject(id: string) {
        // 1. Get all folders to find tasks
        const { data: folders } = await supabase
            .from('folders')
            .select('id')
            .eq('project_id', id);
            
        if (folders && folders.length > 0) {
            const folderIds = folders.map(f => f.id);
            
            // 2. Soft delete all tasks in these folders and detach them (make orphan)
            // This prevents physical deletion if CASCADE is set on DB
            const { error: taskError } = await supabase
                .from('tasks')
                .update({ 
                    is_deleted: true, 
                    folder_id: null, // Detach from folder
                    updated_at: new Date().toISOString()
                })
                .in('folder_id', folderIds);
                
            if (taskError) throw taskError;
            
            // 2.1. Explicitly delete folders (since no CASCADE in DB)
            const { error: foldersError } = await supabase
                .from('folders')
                .delete()
                .in('id', folderIds);
                
            if (foldersError) throw foldersError;
        }

        // 4. Delete project
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);
        if (error) throw error;
        
        try {
            await logService.logAction('delete', 'projects', id);
        } catch (logError) {
            console.error('Failed to log project deletion:', logError);
        }
    },

    async updateProjectOrder(updates: { id: string; sort_order: number }[]) {
        if (updates.length === 0) return;
        
        const batchId = crypto.randomUUID();
        await logService.logAction('reorder', 'projects', batchId, { count: updates.length });

        // Batch update через Promise.all (параллельные запросы)
        const now = new Date().toISOString();
        
        await Promise.all(
            updates.map(u => 
                supabase
                    .from('projects')
                    .update({
                        sort_order: u.sort_order,
                        updated_at: now
                    })
                    .eq('id', u.id)
            )
        );
    },

    // --- Folders ---
    async getFolders(projectId: string) {
        const { data, error } = await supabase
            .from('folders')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order');
        if (error) throw error;
        return data as Folder[];
    },

    async createFolder(projectId: string, title: string, sort_order: number) {
        const { data, error } = await supabase
            .from('folders')
            .insert({
                project_id: projectId,
                title,
                sort_order,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        if (error) throw error;
        
        await logService.logAction('create', 'folders', data.id, { title, project_id: projectId });
        return data as Folder;
    },

    async updateFolder(id: string, updates: { title?: string }) {
        const { error } = await supabase
            .from('folders')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        if (error) throw error;
        
        await logService.logAction('update', 'folders', id, updates);
    },

    async deleteFolder(id: string) {
        // 1. Soft delete tasks (orphan them or move to inbox? usually just detach)
        // Check if we should move them to "Inbox" or just delete?
        // Logic in deleteProject was: soft delete tasks.
        // For folder delete, let's keep tasks but move them to "Inbox" (folder_id = null)? 
        // OR soft delete them too.
        // Usually deleting a folder implies deleting its content.
        
        const { error: taskError } = await supabase
            .from('tasks')
            .update({ 
                is_deleted: true, 
                folder_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('folder_id', id);
            
        if (taskError) throw taskError;

        // 3. Delete folder
        const { error } = await supabase
            .from('folders')
            .delete()
            .eq('id', id);
        if (error) throw error;

        try {
            await logService.logAction('delete', 'folders', id);
        } catch (logError) {
            console.error('Failed to log folder deletion:', logError);
        }
    },

    async updateFolderOrder(updates: { id: string; sort_order: number }[]) {
        if (updates.length === 0) return;
        
        const batchId = crypto.randomUUID();
        await logService.logAction('reorder', 'folders', batchId, { count: updates.length });
        
        // Batch update через Promise.all (параллельные запросы)
        const now = new Date().toISOString();
        
        await Promise.all(
            updates.map(u => 
                supabase
                    .from('folders')
                    .update({
                        sort_order: u.sort_order,
                        updated_at: now
                    })
                    .eq('id', u.id)
            )
        );
    },

    // --- Tasks ---
    async getTasks(projectId: string) {
        // Join folders to filter by project_id
        // Filter out deleted tasks
        const { data, error } = await supabase
            .from('tasks')
            .select('*, folders!inner(project_id)')
            .eq('folders.project_id', projectId)
            .or('is_deleted.eq.false,is_deleted.is.null') // Explicitly include false OR null
            .order('sort_order');
            
        if (error) throw error;
        return (data || []).map((t: any) => {
            const { folders, ...task } = t;
            return task as Task;
        });
    },

    async getDoneTasks(showDeleted = false, timeFilter = 'all') {
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

        // 1. Filter by Status (Done / Deleted)
        if (showDeleted) {
            // Show done OR deleted (archive view)
            query = query.or('is_completed.eq.true,is_deleted.eq.true');
        } else {
            // Show ONLY done and NOT deleted
            // Note: is_deleted can be null or false
            query = query.eq('is_completed', true).or('is_deleted.eq.false,is_deleted.is.null');
        }

        // 2. Filter by Time
        if (timeFilter !== 'all') {
            const now = new Date();
            let fromTime;

            if (timeFilter === 'hour') {
                fromTime = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
            } else if (timeFilter === 'today') {
                // Beginning of today (local time approximated or UTC depending on reqs, usually UTC for simplicity)
                // For simplicity let's take just the date part in UTC or last 24h?
                // "Today" usually means "since midnight". 
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
            .order('created_at', { ascending: false }) // Secondary sort for stability
            .limit(100);

        if (error) throw error;
        return data;
    },

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
        
        await logService.logAction('create', 'tasks', data.id, { folder_id: folderId });
        return data as Task;
    },

    async updateTask(id: string, updates: Partial<Task>) {
        const { error } = await supabase
            .from('tasks')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        if (error) throw error;
        
        await logService.logAction('update', 'tasks', id, updates);
    },

    // Special method to restore task to the TOP of its folder
    async restoreTask(id: string) {
        // 1. Get task to find folder_id
        const { data: task, error: taskError } = await supabase
            .from('tasks')
            .select('folder_id')
            .eq('id', id)
            .single();
            
        if (taskError) throw taskError;
        
        // 2. Find min sort_order in this folder
        const { data: minTask, error: minError } = await supabase
            .from('tasks')
            .select('sort_order')
            .eq('folder_id', task.folder_id)
            .or('is_completed.eq.false,is_completed.is.null') // Only active tasks
            .order('sort_order', { ascending: true })
            .limit(1)
            .maybeSingle(); // Use maybeSingle to avoid error on empty folder
            
        // If no tasks, default to 0
        const minOrder = minTask ? minTask.sort_order : 0;
        
        // 3. Update task
        const { error } = await supabase
            .from('tasks')
            .update({
                is_completed: false,
                sort_order: minOrder - 1000, // Put at the top
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
            
        if (error) throw error;
        
        await logService.logAction('update', 'tasks', id, { is_completed: false, action: 'restore_top' });
    },

    async deleteTask(id: string) {
        // Soft delete
        const { error } = await supabase
            .from('tasks')
            .update({ 
                is_deleted: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
        if (error) throw error;
        
        await logService.logAction('delete', 'tasks', id, { soft: true });
    },

    async updateTaskOrder(updates: { id: string; sort_order: number }[]) {
        if (updates.length === 0) return;
        
        const batchId = crypto.randomUUID();
        await logService.logAction('reorder', 'tasks', batchId, { count: updates.length });
        
        // Batch update через Promise.all (параллельные запросы)
        const now = new Date().toISOString();
        
        await Promise.all(
            updates.map(u => 
                supabase
                    .from('tasks')
                    .update({
                        sort_order: u.sort_order,
                        updated_at: now
                    })
                    .eq('id', u.id)
            )
        );
    }
};
