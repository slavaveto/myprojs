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

    // --- Tasks ---
    async getTasks(projectId: string) {
        // Join folders to filter by project_id
        const { data, error } = await supabase
            .from('tasks')
            .select('*, folders!inner(project_id)')
            .eq('folders.project_id', projectId)
            .order('sort_order');
            
        if (error) throw error;
        return (data || []).map((t: any) => {
            const { folders, ...task } = t;
            return task as Task;
        });
    },

    async createTask(folderId: string, content: string, sort_order: number) {
        const { data, error } = await supabase
            .from('tasks')
            .insert({
                folder_id: folderId,
                content,
                sort_order,
                is_completed: false,
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
        const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id);
        if (error) throw error;
        
        await logService.logAction('delete', 'tasks', id);
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

