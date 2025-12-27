import { supabase } from '@/utils/supabase/supabaseClient';
import { Folder } from '@/app/types';
import { logService } from './logService';
import { BaseActions, EntityTypes, FolderUpdateTypes } from './actions';

export const folderService = {
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
        
        await logService.logAction(
            BaseActions.CREATE,
            EntityTypes.FOLDER,
            data.id,
            { after: data }, // Full snapshot
            title
        );
        return data as Folder;
    },

    async updateFolder(id: string, updates: { title?: string }) {
        // 1. Get state BEFORE update
        const { data: beforeState, error: fetchError } = await supabase
            .from('folders')
            .select('*')
            .eq('id', id)
            .single();
            
        if (fetchError) throw fetchError;

        // 2. Perform UPDATE
        const { data: afterState, error } = await supabase
            .from('folders')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select() // Get state AFTER update
            .single();

        if (error) throw error;
        
        // 3. Log
        let updateType = undefined;
        if (updates.title) updateType = FolderUpdateTypes.RENAME;
        
        await logService.logAction(
            BaseActions.UPDATE,
            EntityTypes.FOLDER,
            id,
            { 
                before: beforeState, 
                after: afterState 
            },
            afterState.title, // Current title
            updateType
        );
    },

    async deleteFolder(id: string) {
        // 1. Get state BEFORE delete
        const { data: folder, error: fetchError } = await supabase
            .from('folders')
            .select('*')
            .eq('id', id)
            .single();
            
        if (fetchError) throw fetchError;

        // 2. Soft delete tasks (logic moved from projectService)
        // Note: Assuming we still want to soft delete tasks inside.
        // We might want to move this logic to taskService later, but for now we do it directly via supabase.
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

        await logService.logAction(
            BaseActions.DELETE,
            EntityTypes.FOLDER,
            id,
            { before: folder }, // Full snapshot for restore
            folder.title
        );
    },

    async updateFolderOrder(updates: { id: string; sort_order: number }[]) {
        if (updates.length === 0) return;
        
        const batchId = crypto.randomUUID();
        // For reorder we don't log every single item change in detail, just the batch count
        await logService.logAction(
            BaseActions.REORDER,
            EntityTypes.FOLDER,
            batchId,
            { count: updates.length }
        );
        
        // Batch update WITHOUT changing updated_at
        await Promise.all(
            updates.map(u => 
                supabase
                    .from('folders')
                    .update({
                        sort_order: u.sort_order
                        // updated_at: now // REMOVED to preserve history
                    })
                    .eq('id', u.id)
            )
        );
    },
};

