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
            // Avoid !inner join which relies on implicit FK naming that might fail with custom table names like '-ui_items'.
            
            // 1. Get folder IDs first
            const { data: folders, error: foldersError } = await client
                .from(TABLES.folders)
                .select('id')
                .eq('project_id', projectId)
                .neq('is_deleted', true);

            if (foldersError) throw foldersError;

            const folderIds = folders.map(f => f.id);

            if (folderIds.length === 0) {
                return [] as Task[];
            }

            // 2. Fetch tasks for these folders
            const { data, error } = await client
                .from(TABLES.tasks)
                .select('*')
                .in('folder_id', folderIds)
                .neq('is_deleted', true) // Allow false OR null
                .order('sort_order');

            if (error) throw error;
            
            return data as Task[];
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
                    task_type: isUi ? 'item' : 'task'
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

