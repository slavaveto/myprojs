import { supabase } from '@/utils/supabase/supabaseClient';
import { Folder } from '@/app/types';
import { logService } from './logService';
import { BaseActions, EntityTypes, FolderUpdateTypes } from './actions';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('FolderService');

export const folderService = {
    async getFolders(projectId: string) {
        logger.info('Fetching folders...', { projectId });
        const { data, error } = await supabase
            .from('folders')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order');
        if (error) {
            logger.error('Failed to fetch folders', error);
            throw error;
        }
        logger.info('Folders loaded', { count: data?.length });
        return data as Folder[];
    },

    async createFolder(projectId: string, title: string, sort_order: number) {
        logger.info('Creating folder', { title, projectId });
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
        if (error) {
            logger.error('Failed to create folder', error);
            throw error;
        }
        
        await logService.logAction(
            BaseActions.CREATE,
            EntityTypes.FOLDER,
            data.id,
            { after: data },
            title
        );
        logger.success('Folder created', { id: data.id });
        return data as Folder;
    },

    async updateFolder(id: string, updates: { title?: string }) {
        logger.info('Updating folder', { id, updates });
        
        // 1. Get state BEFORE update
        const { data: beforeState, error: fetchError } = await supabase
            .from('folders')
            .select('*')
            .eq('id', id)
            .single();
            
        if (fetchError) {
            logger.error('Failed to fetch folder before update', fetchError);
            throw fetchError;
        }

        // 2. Perform UPDATE
        const { data: afterState, error } = await supabase
            .from('folders')
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            logger.error('Failed to update folder', error);
            throw error;
        }
        
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
            afterState.title,
            updateType
        );
        logger.success('Folder updated', { id });
    },

    async deleteFolder(id: string) {
        logger.info('Deleting folder', { id });
        
        // 1. Get state BEFORE delete
        const { data: folder, error: fetchError } = await supabase
            .from('folders')
            .select('*')
            .eq('id', id)
            .single();
            
        if (fetchError) throw fetchError;

        // 2. Soft delete tasks
        const { error: taskError } = await supabase
            .from('tasks')
            .update({ 
                is_deleted: true, 
                folder_id: null,
                updated_at: new Date().toISOString()
            })
            .eq('folder_id', id);
            
        if (taskError) {
             logger.error('Failed to soft delete tasks for folder', taskError);
             throw taskError;
        }

        // 3. Delete folder
        const { error } = await supabase
            .from('folders')
            .delete()
            .eq('id', id);
            
        if (error) {
            logger.error('Failed to delete folder', error);
            throw error;
        }

        await logService.logAction(
            BaseActions.DELETE,
            EntityTypes.FOLDER,
            id,
            { before: folder },
            folder.title
        );
        logger.success('Folder deleted', { id });
    },

    async updateFolderOrder(updates: { id: string; sort_order: number }[]) {
        if (updates.length === 0) return;
        
        const batchId = crypto.randomUUID();
        await logService.logAction(
            BaseActions.REORDER,
            EntityTypes.FOLDER,
            batchId,
            { count: updates.length }
        );
        
        // Batch update
        await Promise.all(
            updates.map(u => 
                supabase
                    .from('folders')
                    .update({
                        sort_order: u.sort_order
                        // updated_at: now // REMOVED
                    })
                    .eq('id', u.id)
            )
        );
        logger.info('Folders reordered', { count: updates.length });
    },
};

