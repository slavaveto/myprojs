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
        }

        // 3. Delete project (will cascade delete folders)
        const { error } = await supabase
            .from('projects')
            .delete()
            .eq('id', id);
        if (error) throw error;
        
        await logService.logAction('delete', 'projects', id);
    },

    async updateProjectOrder(updates: { id: string; sort_order: number }[]) {
        // Log the reorder action (batch)
        if (updates.length > 0) {
             const batchId = crypto.randomUUID();
             await logService.logAction('reorder', 'projects', batchId, { count: updates.length });
        }

        for (const u of updates) {
           const { error } = await supabase.from('projects').update({
               sort_order: u.sort_order,
               updated_at: new Date().toISOString()
           }).eq('id', u.id);
           if (error) throw error;
        }
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

    async updateFolderOrder(updates: { id: string; sort_order: number }[]) {
        if (updates.length > 0) {
             const batchId = crypto.randomUUID();
             await logService.logAction('reorder', 'folders', batchId, { count: updates.length });
        }
        for (const u of updates) {
            const { error } = await supabase.from('folders').update({
                sort_order: u.sort_order,
                updated_at: new Date().toISOString()
            }).eq('id', u.id);
            if (error) throw error;
        }
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

    async getDoneTasks() {
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
            .or('is_completed.eq.true,is_deleted.eq.true')
            .order('updated_at', { ascending: false })
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
        if (updates.length > 0) {
             const batchId = crypto.randomUUID();
             await logService.logAction('reorder', 'tasks', batchId, { count: updates.length });
        }
        for (const u of updates) {
            const { error } = await supabase.from('tasks').update({
                sort_order: u.sort_order,
                updated_at: new Date().toISOString()
            }).eq('id', u.id);
            if (error) throw error;
        }
    }
};

