import { supabase } from '@/utils/supabase/supabaseClient';
import { Project } from '@/app/types';
import { logService } from './logService';
import { BaseActions, EntityTypes, ProjectUpdateTypes } from './actions';

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
        
        await logService.logAction(
            BaseActions.CREATE,
            EntityTypes.PROJECT,
            data.id,
            { after: data },
            title
        );
        return data as Project;
    },

    async updateProject(id: string, updates: { title?: string; color?: string }) {
        // 1. Get BEFORE
        const { data: beforeState, error: fetchError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError) throw fetchError;

        // 2. Determine Type
        let updateType = undefined;
        if (updates.title) updateType = ProjectUpdateTypes.RENAME;
        else if (updates.color) updateType = ProjectUpdateTypes.RECOLOR;

        // 3. Update
        const { data: afterState, error } = await supabase
            .from('projects')
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
            BaseActions.UPDATE,
            EntityTypes.PROJECT,
            id,
            { before: beforeState, after: afterState },
            afterState.title,
            updateType
        );
    },

    async deleteProject(id: string) {
        // Get BEFORE
        const { data: beforeState, error: fetchError } = await supabase
            .from('projects')
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError) throw fetchError;

        // 1. Get all folders to find tasks
        const { data: folders } = await supabase
            .from('folders')
            .select('id')
            .eq('project_id', id);
            
        if (folders && folders.length > 0) {
            const folderIds = folders.map(f => f.id);
            
            // 2. Soft delete tasks
            const { error: taskError } = await supabase
                .from('tasks')
                .update({ 
                    is_deleted: true, 
                    folder_id: null,
                    updated_at: new Date().toISOString()
                })
                .in('folder_id', folderIds);
                
            if (taskError) throw taskError;
            
            // 3. Delete folders
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
        
        await logService.logAction(
            BaseActions.DELETE,
            EntityTypes.PROJECT,
            id,
            { before: beforeState },
            beforeState.title
        );
    },

    async updateProjectOrder(updates: { id: string; sort_order: number }[]) {
        if (updates.length === 0) return;
        
        const batchId = crypto.randomUUID();
        await logService.logAction(
            BaseActions.REORDER,
            EntityTypes.PROJECT,
            batchId,
            { count: updates.length }
        );

        // Batch update without updated_at
        await Promise.all(
            updates.map(u => 
                supabase
                    .from('projects')
                    .update({
                        sort_order: u.sort_order
                        // updated_at: now // REMOVED
                    })
                    .eq('id', u.id)
            )
        );
    },
};
