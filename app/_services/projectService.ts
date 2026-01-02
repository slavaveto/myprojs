import { supabase } from '@/utils/supabase/supabaseClient';
import { Project } from '@/app/types';
import { logService } from './logService';
import { folderService } from './folderService';
import { BaseActions, EntityTypes, ProjectUpdateTypes } from './actions';
import { createLogger } from '@/utils/logger/Logger';
import { DB_TABLES } from '@/utils/supabase/db_tables';


const logger = createLogger('ProjectService');

export const projectService = {


    // @ref:8a2b3c
    // загрузка списка проектов
    async getProjects() {
        logger.info('Fetching projects...');
        const { data, error } = await supabase
            .from(DB_TABLES.PROJECTS)
            .select('*')
            .or('is_deleted.eq.false,is_deleted.is.null') // Soft Delete Filter
            .order('sort_order', { ascending: true });
            
        if (error) {
            logger.error('Failed to fetch projects', error);
            throw error;
        }
        
        logger.info('Projects loaded', { count: data?.length });
        return data as Project[];
    },

    async getProjectsWithFolders() {
        // We need to filter both projects AND folders.
        // Supabase join filtering works on the join relation.
        const { data, error } = await supabase
            .from(DB_TABLES.PROJECTS)
            .select(`
                *,
                folders (*)
            `)
            .or('is_deleted.eq.false,is_deleted.is.null') // Filter projects
            .order('sort_order', { ascending: true });

        if (error) throw error;

        // Filter folders manually or via complex query. 
        // Simple way: filter in memory after fetch, since we need to sort them anyway.
        if (data) {
            data.forEach(p => {
                if (p.folders && Array.isArray(p.folders)) {
                    // Filter deleted folders
                    p.folders = p.folders.filter((f: any) => !f.is_deleted);
                    // Sort
                    p.folders.sort((a: any, b: any) => a.sort_order - b.sort_order);
                }
            });
        }

        return data;
    },

    async createProject(title: string, color: string, sort_order: number) {
        logger.info('Creating project', { title });
        const { data, error } = await supabase
            .from(DB_TABLES.PROJECTS)
            .insert({
                title,
                proj_color: color,
                sort_order,
                is_deleted: false,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();
        if (error) {
            logger.error('Failed to create project', error);
            throw error;
        }

        // Create default folders
        try {
            await Promise.all([
                folderService.createFolder(data.id, 'Folder 1', 0),
                folderService.createFolder(data.id, 'Folder 2', 1),
                folderService.createFolder(data.id, 'Folder 3', 2)
            ]);
            logger.info('Default folders created for project', { projectId: data.id });
        } catch (folderError) {
            logger.error('Failed to create default folders', folderError);
            // Non-blocking error, proceed with project return
        }
        
        await logService.logAction(
            BaseActions.CREATE,
            EntityTypes.PROJECT,
            data.id,
            { after: data },
            title
        );
        logger.success('Project created', { id: data.id });
        return data as Project;
    },

    async createSatellite(parentId: string, type: 'ui' | 'docs', title: string, color: string) {
        logger.info('Creating/Enabling satellite project', { parentId, type });
        
        // Check existence (including disabled ones)
        const { data: existing } = await supabase
            .from(DB_TABLES.PROJECTS)
            .select('*')
            .eq('parent_proj_id', parentId)
            .eq('proj_type', type)
            .maybeSingle(); 
            
        if (existing) {
            // Enable if disabled or deleted
            if (existing.is_disabled || existing.is_deleted) {
                logger.info('Enabling satellite', { id: existing.id });
                
                // Just enable the project. Do NOT restore tasks/folders (they were never deleted by disable logic).
                const { data: restored, error: restoreError } = await supabase
                    .from(DB_TABLES.PROJECTS)
                    .update({ 
                        is_disabled: false,
                        is_deleted: false, 
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id)
                    .select()
                    .single();
                    
                if (restoreError) throw restoreError;
                return restored as Project;
            } else {
                logger.warning('Active satellite already exists, returning it', { id: existing.id });
                return existing as Project;
            }
        }
        
        // Create NEW
        const { data, error } = await supabase
            .from(DB_TABLES.PROJECTS)
            .insert({
                title,
                proj_color: color,
                sort_order: 9999, // Push to end
                is_deleted: false,
                is_disabled: false,
                proj_type: type,
                parent_proj_id: parentId,
                updated_at: new Date().toISOString(),
                created_at: new Date().toISOString()
            })
            .select()
            .single();
            
        if (error) {
            logger.error('Failed to create satellite project', error);
            throw error;
        }

        // Create default folder for satellite (only for docs, UI doesn't need folders by default)
        if (type !== 'ui') {
            try {
                await folderService.createFolder(data.id, 'General', 0);
            } catch (folderError) {
                logger.error('Failed to create default folder for satellite', folderError);
            }
        }
        
        logger.success('Satellite created', { id: data.id });
        return data as Project;
    },

    async disableProject(id: string) {
        logger.info('Disabling project', { id });
        const { error } = await supabase
            .from(DB_TABLES.PROJECTS)
            .update({
                is_disabled: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
            
        if (error) {
            logger.error('Failed to disable project', error);
            throw error;
        }
    },

    async updateProject(id: string, updates: Partial<Project>) {
        logger.info('Updating project', { id, updates });
        
        // 1. Get BEFORE
        const { data: beforeState, error: fetchError } = await supabase
            .from(DB_TABLES.PROJECTS)
            .select('*')
            .eq('id', id)
            .single();
            
        if (fetchError) {
            logger.error('Failed to fetch project before update', fetchError);
            throw fetchError;
        }

        // 2. Determine Type
        let updateType = undefined;
        if (updates.title) updateType = ProjectUpdateTypes.RENAME;
        else if (updates.proj_color) updateType = ProjectUpdateTypes.RECOLOR;
        else if ('is_highlighted' in updates) updateType = ProjectUpdateTypes.UPDATE_SETTINGS; 

        // 3. Update
        const { data: afterState, error } = await supabase
            .from(DB_TABLES.PROJECTS)
            .update({
                ...updates,
                updated_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
            
        if (error) {
            logger.error('Failed to update project', error);
            throw error;
        }
        
        // 4. Log
        await logService.logAction(
            BaseActions.UPDATE,
            EntityTypes.PROJECT,
            id,
            { before: beforeState, after: afterState },
            afterState.title,
            updateType
        );
        logger.success('Project updated', { id });
    },

    async deleteProject(id: string) {
        logger.info('Deleting project (soft)', { id });
        
        // Get BEFORE
        const { data: beforeState, error: fetchError } = await supabase
            .from(DB_TABLES.PROJECTS)
            .select('*')
            .eq('id', id)
            .single();
        if (fetchError) throw fetchError;

        // 1. Get all folders to find tasks
        const { data: folders } = await supabase
            .from(DB_TABLES.FOLDERS)
            .select('id')
            .eq('project_id', id);
            
        if (folders && folders.length > 0) {
            const folderIds = folders.map(f => f.id);
            
            // 2. Soft delete tasks (KEEP FOLDER_ID!)
            const { error: taskError } = await supabase
                .from(DB_TABLES.TASKS)
                .update({ 
                    is_deleted: true, 
                    // folder_id: null, <--- REMOVED! Keep relation for RLS
                    updated_at: new Date().toISOString()
                })
                .in('folder_id', folderIds);
                
            if (taskError) throw taskError;
            
            // 3. Soft delete folders
            const { error: foldersError } = await supabase
                .from(DB_TABLES.FOLDERS)
                .update({
                    is_deleted: true,
                    updated_at: new Date().toISOString()
                })
                .in('id', folderIds);
                
            if (foldersError) throw foldersError;
        }

        // 4. Soft delete project
        const { error } = await supabase
            .from(DB_TABLES.PROJECTS)
            .update({
                is_deleted: true,
                updated_at: new Date().toISOString()
            })
            .eq('id', id);
            
        if (error) {
            logger.error('Failed to delete project', error);
            throw error;
        }

        // 5. Soft delete satellites (UI/Docs projects)
        // We do this after main project delete to ensure consistency
        const { error: satellitesError } = await supabase
            .from(DB_TABLES.PROJECTS)
            .update({
                is_deleted: true,
                updated_at: new Date().toISOString()
            })
            .eq('parent_proj_id', id);

        if (satellitesError) {
             logger.error('Failed to delete satellites', satellitesError);
             // Non-blocking, main project is already deleted
        }
        
        await logService.logAction(
            BaseActions.DELETE,
            EntityTypes.PROJECT,
            id,
            { before: beforeState },
            beforeState.title
        );
        logger.success('Project deleted', { id });
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
                    .from(DB_TABLES.PROJECTS)
                    .update({
                        sort_order: u.sort_order
                        // updated_at: now // REMOVED
                    })
                    .eq('id', u.id)
            )
        );
        logger.info('Projects reordered', { count: updates.length });
    },
};
