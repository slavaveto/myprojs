import { SupabaseClient } from '@supabase/supabase-js';
import { Task } from '@/app/types';
import { logService } from './logService';
import { BaseActions, EntityTypes, TaskUpdateTypes, BaseActionType } from './actions';
import { createLogger } from '@/utils/logger/Logger';
import { DB_TABLES } from '@/utils/supabase/db_tables';

const logger = createLogger('TaskService');

// Simple Event Bus for task updates
type Listener = () => void;
const listeners: Listener[] = [];

export const taskUpdateEvents = {
   subscribe: (l: Listener) => {
      listeners.push(l);
      return () => {
         const i = listeners.indexOf(l);
         if (i > -1) listeners.splice(i, 1);
      };
   },
   emit: () => listeners.forEach((l) => l()),
};

export const createTaskService = (supabase: SupabaseClient) => ({
   // --- Reads ---
   async getTasks(projectId: string) {
      logger.info('Fetching tasks...', { projectId });
      const { data, error } = await supabase
         .from(DB_TABLES.TASKS)
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

   async getDoneTasks(showDeleted = false, timeFilter = 'all', limit = 200) {
      logger.info('Fetching done tasks...', { showDeleted, timeFilter, limit });

      // 1. Fetch Logs first to get accurate completion times
      let logQuery = supabase
         .from(DB_TABLES.LOGS)
         .select('entity_id, created_at, action')
         .eq('entity', 'task')
         .order('created_at', { ascending: false });

      if (!showDeleted) {
         logQuery = logQuery.eq('action', 'complete');
      } else {
         logQuery = logQuery.in('action', ['complete', 'delete']);
      }

      const logLimit = limit > 500 ? limit * 2 : 500;
      const { data: logs, error: logError } = await logQuery.limit(logLimit);

      if (logError) {
         logger.error('Failed to fetch task logs', logError);
      }

      const logMap = new Map<string, string>();
      if (logs) {
         logs.forEach((log) => {
            if (!logMap.has(log.entity_id)) {
               logMap.set(log.entity_id, log.created_at);
            }
         });
      }

      // 2. Fetch Tasks
      let query = supabase.from(DB_TABLES.TASKS).select(`
                *,
                folders (
                    id,
                    title,
                    sort_order,
                    projects (
                        id,
                        title,
                        proj_color,
                        is_disabled
                    )
                )
            `)
            .order('updated_at', { ascending: false });

      if (showDeleted) {
         query = query.or('is_completed.eq.true,is_deleted.eq.true');
      } else {
         query = query.eq('is_completed', true).or('is_deleted.eq.false,is_deleted.is.null');
      }

      const { data, error } = await query.limit(limit);

      if (error) {
         logger.error('Failed to fetch done tasks', error);
         throw error;
      }

      // 3. Merge and Sort + FILTER DISABLED PROJECTS
      let mergedTasks = (data || [])
         .filter((task: any) => {
             const project = task.folders?.projects;
             return !project?.is_disabled;
         })
         .map((task: any) => {
             const realCompletedAt = logMap.get(task.id) || task.updated_at;
             return {
                ...task,
                updated_at: realCompletedAt,
             };
         });

      // 4. Apply Time Filter in Memory
      if (timeFilter !== 'all') {
         const now = new Date();
         let fromTimeTime = 0;

         if (timeFilter === 'hour') {
            fromTimeTime = now.getTime() - 60 * 60 * 1000;
         } else if (timeFilter === 'today') {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            fromTimeTime = today.getTime();
         }

         if (fromTimeTime > 0) {
            mergedTasks = mergedTasks.filter(
               (t: any) => new Date(t.updated_at).getTime() >= fromTimeTime
            );
         }
      }

      // 5. Final Sort (Newest completed first)
      mergedTasks.sort((a: any, b: any) => {
         return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      });

      logger.info('Done tasks loaded', { count: mergedTasks.length });
      return mergedTasks;
   },

   async getTodayTasks() {
      logger.info('Fetching today tasks...');
      const { data, error } = await supabase
         .from(DB_TABLES.TASKS)
         .select(
            `
                *,
                folders (
                    id,
                    title,
                    sort_order,
                    projects (
                        id,
                        title,
                        proj_color,
                        is_disabled
                    )
                )
            `
         )
         .eq('is_today', true)
         .eq('is_completed', false)
         .or('is_deleted.eq.false,is_deleted.is.null')
         .order('sort_order', { ascending: true });

      if (error) {
         logger.error('Failed to fetch today tasks', error);
         throw error;
      }
      
      const filtered = (data || []).filter((t: any) => {
          const project = t.folders?.projects;
          return !project?.is_disabled;
      });

      logger.info('Today tasks loaded', { count: filtered.length });
      return filtered as any[];
   },

   async getDoingNowTasks() {
      logger.info('Fetching doing now tasks (GROUP based)...');
      
      const { data: groups, error: groupError } = await supabase
          .from(DB_TABLES.TASKS)
          .select('id, folder_id, content, folders!inner(project_id)')
          .eq('task_type', 'group')
          .ilike('content', '%Делаю%Прямо%Сейчас%')
          .or('is_deleted.eq.false,is_deleted.is.null');

      if (groupError) {
          logger.error('Failed to fetch doing now groups', groupError);
          throw groupError;
      }

      if (!groups || groups.length === 0) {
          logger.info('No "Doing Now" groups found');
          return [];
      }

      const groupIds = groups.map(g => g.id);

      const { data, error } = await supabase
         .from(DB_TABLES.TASKS)
         .select(
            `
                *,
                folders (
                    id,
                    title,
                    sort_order,
                    projects (
                        id,
                        title,
                        proj_color,
                        is_disabled
                    )
                )
            `
         )
         .in('group_id', groupIds)
         .eq('is_completed', false)
         .or('is_deleted.eq.false,is_deleted.is.null')
         .order('sort_order', { ascending: true });

      if (error) {
         logger.error('Failed to fetch tasks in doing now groups', error);
         throw error;
      }

      const filtered = (data || []).filter((t: any) => {
          const project = t.folders?.projects;
          return !project?.is_disabled;
      });

      logger.info('Doing now tasks loaded', { count: filtered.length });
      return filtered as any[];
   },

   async getInboxTasks() {
      logger.info('Fetching inbox tasks...');
      const { data, error } = await supabase
         .from(DB_TABLES.TASKS)
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

   async getAllTasksShort() {
      logger.info('Fetching all tasks for search index...');
      const { data, error } = await supabase
         .from(DB_TABLES.TASKS)
         .select(
            `
                id,
                content,
                is_completed,
                folder_id,
                is_today,
                folders (
                    id,
                    title,
                    sort_order,
                    projects (
                        id,
                        title,
                        proj_color,
                        is_disabled
                    )
                )
            `
         )
         .or('is_deleted.eq.false,is_deleted.is.null')
         .limit(2000);

      if (error) {
         logger.error('Failed to fetch search index', error);
         return [];
      }
      
      const filtered = (data || []).filter((t: any) => !t.folders?.projects?.is_disabled);
      return filtered;
   },

   async moveTaskToFolder(taskId: string, folderId: string) {
      logger.info('Moving task to folder (top)', { taskId, folderId });

      const { data: minTask } = await supabase
         .from(DB_TABLES.TASKS)
         .select('sort_order')
         .eq('folder_id', folderId)
         .order('sort_order', { ascending: true })
         .limit(1)
         .maybeSingle();

      const minOrder = minTask ? minTask.sort_order : 0;
      const newSortOrder = minOrder - 10000;

      await this.updateTask(taskId, {
         folder_id: folderId,
         sort_order: newSortOrder,
      });
   },

   async createTask(folderId: string | null, content: string, sort_order: number) {
      logger.info('Creating task', { content, folderId });
      const { data, error } = await supabase
         .from(DB_TABLES.TASKS)
         .insert({
            folder_id: folderId,
            content,
            sort_order,
            is_completed: false,
            is_deleted: false,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
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
      taskUpdateEvents.emit();
      logger.success('Task created', { id: data.id });
      return data as Task;
   },

   async updateTask(id: string, updates: Partial<Task>) {
      logger.info('Updating task', { id, updates });
      const { data: beforeState, error: fetchError } = await supabase
         .from(DB_TABLES.TASKS)
         .select('*')
         .eq('id', id)
         .single();

      if (fetchError) throw fetchError;

      let baseAction: BaseActionType = BaseActions.UPDATE;
      let updateType = undefined;

      if ('is_completed' in updates) {
         baseAction = updates.is_completed ? BaseActions.COMPLETE : BaseActions.RESTORE;
      }

      const keys = Object.keys(updates);
      if (keys.includes('content')) updateType = TaskUpdateTypes.RENAME;
      else if (keys.includes('folder_id')) updateType = TaskUpdateTypes.MOVE;
      else if (keys.includes('is_pinned'))
         updateType = updates.is_pinned ? TaskUpdateTypes.PIN : TaskUpdateTypes.UNPIN;
      else if (keys.includes('is_today'))
         updateType = updates.is_today ? TaskUpdateTypes.MARK_TODAY : TaskUpdateTypes.UNMARK_TODAY;
      else if (keys.includes('task_type')) updateType = TaskUpdateTypes.TASK_TYPE_CHANGE;
      else if (keys.includes('title_text_style')) updateType = TaskUpdateTypes.TITLE_STYLE_CHANGE;
      else if (keys.includes('group_color')) updateType = TaskUpdateTypes.GROUP_RECOLOR;

      const { data: afterState, error } = await supabase
         .from(DB_TABLES.TASKS)
         .update({
            ...updates,
            updated_at: new Date().toISOString(),
         })
         .eq('id', id)
         .select()
         .single();

      if (error) {
         logger.error('Failed to update task', error);
         throw error;
      }

      await logService.logAction(
         baseAction,
         EntityTypes.TASK,
         id,
         {
            before: beforeState,
            after: afterState,
         },
         afterState.content || 'Task',
         updateType
      );
      taskUpdateEvents.emit();
      logger.success('Task updated', { id });
   },

   async restoreTask(id: string) {
      logger.info('Restoring task', { id });
      const { data: task, error: taskError } = await supabase
         .from(DB_TABLES.TASKS)
         .select('folder_id, content')
         .eq('id', id)
         .single();

      if (taskError) throw taskError;

      const { data: minTask } = await supabase
         .from(DB_TABLES.TASKS)
         .select('sort_order')
         .eq('folder_id', task.folder_id)
         .or('is_completed.eq.false,is_completed.is.null')
         .order('sort_order', { ascending: true })
         .limit(1)
         .maybeSingle();

      const minOrder = minTask ? minTask.sort_order : 0;

      const { data: beforeState } = await supabase
         .from(DB_TABLES.TASKS)
         .select('*')
         .eq('id', id)
         .single();

      const { data: afterState, error } = await supabase
         .from(DB_TABLES.TASKS)
         .update({
            is_completed: false,
            is_deleted: false,
            sort_order: minOrder - 1000,
            updated_at: new Date().toISOString(),
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
      taskUpdateEvents.emit();
      logger.success('Task restored', { id });
   },

   async deleteTask(id: string) {
      logger.info('Deleting task', { id });
      const { data: beforeState, error: fetchError } = await supabase
         .from(DB_TABLES.TASKS)
         .select('*')
         .eq('id', id)
         .maybeSingle();
      
      if (fetchError) throw fetchError;
      if (!beforeState) {
          logger.warning('Task not found for deletion', { id });
          return;
      }

      const { data: afterState, error } = await supabase
         .from(DB_TABLES.TASKS)
         .update({
            is_deleted: true,
            updated_at: new Date().toISOString(),
         })
         .eq('id', id)
         .select()
         .maybeSingle();

      if (error) {
         logger.error('Failed to delete task', error);
         throw error;
      }

      if (afterState) {
          await logService.logAction(
             BaseActions.DELETE,
             EntityTypes.TASK,
             id,
             { before: beforeState, after: afterState },
             beforeState.content
          );
      }
      taskUpdateEvents.emit();
      logger.success('Task deleted', { id });
   },

   async updateTaskOrder(updates: { id: string; sort_order: number; group_id?: string | null }[]) {
      if (updates.length === 0) return;

      const batchId = crypto.randomUUID();
      await logService.logAction(BaseActions.REORDER, EntityTypes.TASK, batchId, {
         count: updates.length,
      });

      await Promise.all(
         updates.map((u) => {
            const payload: any = {
                sort_order: u.sort_order,
            };
            if (u.group_id !== undefined) {
                payload.group_id = u.group_id;
            }
            return supabase
               .from(DB_TABLES.TASKS)
               .update(payload)
               .eq('id', u.id)
         })
      );
      taskUpdateEvents.emit();
      logger.info('Tasks reordered', { count: updates.length });
   },
});

// DEFAULT INSTANCE (для обратной совместимости, если где-то еще импортируется)
// Но он будет анонимным!
import { supabase as defaultSupabase } from '@/utils/supabase/supabaseClient';
export const taskService = createTaskService(defaultSupabase);
