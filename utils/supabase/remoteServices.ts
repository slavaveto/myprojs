import { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase/supabaseClient';
import { Folder, Task } from '@/app/types';
import { DB_TABLES } from '@/utils/supabase/db_tables';

// Helper to determine table names
const getTables = (isUi: boolean) => ({
    folders: isUi ? DB_TABLES.UI_FOLDERS : 'folders',
    tasks: isUi ? DB_TABLES.UI_ITEMS : 'tasks'
});

export const createRemoteFolderService = (client: SupabaseClient, isUi: boolean = false) => {
    const TABLES = getTables(isUi);

    return {
        getFolders: async (projectId: string) => {
            const { data, error } = await client
                .from(TABLES.folders)
                .select('*')
                .eq('project_id', projectId)
                // .is('is_deleted', false) // Removed strict check
                .neq('is_deleted', true) // Allow false OR null
                .order('sort_order');

            if (error) throw error;
            return data as Folder[];
        },

        createFolder: async (projectId: string, title: string, order: number) => {
            const { data, error } = await client
                .from(TABLES.folders)
                .insert({
                    project_id: projectId,
                    title,
                    sort_order: order,
                    is_deleted: false
                })
                .select()
                .single();

            if (error) throw error;
            return data as Folder;
        },

        updateFolder: async (folderId: string, updates: Partial<Folder>) => {
            const { error } = await client
                .from(TABLES.folders)
                .update({ ...updates, updated_at: new Date().toISOString() })
                .eq('id', folderId);

            if (error) throw error;
        },

        deleteFolder: async (folderId: string) => {
            // Soft delete
            const { error } = await client
                .from(TABLES.folders)
                .update({ is_deleted: true, updated_at: new Date().toISOString() })
                .eq('id', folderId);

            if (error) throw error;
        },

        updateFolderOrder: async (updates: { id: string; sort_order: number }[]) => {
             // Supabase doesn't support bulk update easily in one query without RPC.
             // We'll iterate for now (or use upsert if we select all fields).
             // Optimized approach: Promise.all
             
             const promises = updates.map(u => 
                 client
                    .from(TABLES.folders)
                    .update({ sort_order: u.sort_order, updated_at: new Date().toISOString() })
                    .eq('id', u.id)
             );
             
             await Promise.all(promises);
        }
    };
};

export const createRemoteTaskService = (client: SupabaseClient, isUi: boolean = false) => {
    const TABLES = getTables(isUi);

    return {
        getTasks: async (projectId: string) => {
            // We need to fetch tasks for all folders in this project.
            // First get folders to know IDs? Or just join?
            // "tasks" table has "folder_id".
            // So we need to filter tasks where folder_id IN (select id from folders where project_id = X)
            
            // Supabase approach:
            const { data, error } = await client
                .from(TABLES.tasks)
                .select(`
                    *,
                    folder: ${TABLES.folders}!inner(project_id)
                `)
                .eq(`${TABLES.folders}.project_id`, projectId)
                // .is('is_deleted', false) 
                .neq('is_deleted', true) // Allow false OR null
                .order('sort_order');

            if (error) throw error;
            
            // Flatten or clean up if needed
            // The join returns data structure like: { ...task, folder: { project_id: ... } }
            // We just return the tasks.
            return data.map((t: any) => {
                const { folder, ...rest } = t;
                return rest;
            }) as Task[];
        },

        createTask: async (folderId: string, content: string, order: number) => {
            const { data, error } = await client
                .from(TABLES.tasks)
                .insert({
                    folder_id: folderId,
                    content,
                    sort_order: order,
                    is_completed: false,
                    is_deleted: false,
                    task_type: 'task'
                })
                .select()
                .single();

            if (error) throw error;
            return data as Task;
        },

        updateTask: async (taskId: string, updates: Partial<Task>) => {
            // Filter out client-side only fields just in case
            const { 
                isNew, isDraft, _tempId, _isSaving, 
                // Don't send fields that don't exist in DB if Task type has extra stuff
                ...dbUpdates 
            } = updates as any;

            const { error } = await client
                .from(TABLES.tasks)
                .update({ ...dbUpdates, updated_at: new Date().toISOString() })
                .eq('id', taskId);

            if (error) throw error;
        },

        deleteTask: async (taskId: string) => {
            const { error } = await client
                .from(TABLES.tasks)
                .update({ is_deleted: true, updated_at: new Date().toISOString() })
                .eq('id', taskId);

            if (error) throw error;
        },
        
        moveTaskToFolder: async (taskId: string, folderId: string) => {
            const { error } = await client
                .from(TABLES.tasks)
                .update({ folder_id: folderId, updated_at: new Date().toISOString() })
                .eq('id', taskId);
                
            if (error) throw error;
        },

        updateTaskOrder: async (updates: { id: string; sort_order: number; group_id?: string | null }[]) => {
             const promises = updates.map(u => {
                 const payload: any = { sort_order: u.sort_order, updated_at: new Date().toISOString() };
                 if (u.group_id !== undefined) payload.group_id = u.group_id;
                 
                 return client
                    .from(TABLES.tasks)
                    .update(payload)
                    .eq('id', u.id);
             });
             
             await Promise.all(promises);
        }
    };
};

