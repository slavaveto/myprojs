'use client';

import React, { useEffect, useState } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { taskService } from '@/app/_services/taskService';
import { clsx } from 'clsx';
import {
   RefreshCw,
   MoreVertical,
   Target,
} from 'lucide-react';
import {
   Spinner,
   Button,
   Checkbox,
   Dropdown,
   DropdownTrigger,
   DropdownMenu,
} from '@heroui/react';
import { globalStorage } from '@/utils/storage';
import { AnimatePresence, motion } from 'framer-motion';
import { projectService } from '@/app/_services/projectService';
import { loadingService } from '@/app/_services/loadingLogsService';
import { TaskContextMenu, TaskMenuItems } from '../components/TaskContextMenu';
import { TaskStyleControl } from '../components/TaskStyleControl';
import { TaskTodayControl } from '../components/TaskTodayControl';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { GlobalSearch, NavigationTarget } from '@/app/components/GlobalSearch';
import { RichEditableCell } from '../components/RichEditableCell';

const logger = createLogger('DoingNowScreen');

interface DoingNowScreenProps {
   globalStatus?: string;
   canLoad?: boolean;
   isActive?: boolean;
   onMoveTask?: (taskId: string, projectId: string, folderId: string) => void;
   onNavigate?: (target: NavigationTarget) => void;
}

// Visual clone of TaskRow for DoingNow items
const DoingNowTaskRow = ({
   task,
   onUpdate,
   onDelete,
   projectsStructure,
   onMove,
   isHighlighted,
}: {
   task: any;
   onUpdate: (id: string, updates: any) => void;
   onDelete: (id: string) => void;
   projectsStructure: any[];
   onMove?: (taskId: string, projectId: string, folderId: string) => void;
   isHighlighted?: boolean;
}) => {
   return (
      <TaskContextMenu
         task={task}
         onUpdate={onUpdate}
         onDelete={onDelete}
         onMove={onMove}
         projectsStructure={projectsStructure}
         items={{
            delete: true,
            move: true,
            styles: true,
            today: true,
         }}
      >
         <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{
               opacity: 1,
               height: 'auto',
               backgroundColor: isHighlighted
                  ? 'var(--highlight-bg, rgba(250, 204, 21, 0.2))'
                  : undefined,
            }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className={clsx(
               'group px-1 flex justify-between min-h-[30px] items-center rounded border border-default-300 bg-content1 transition-colors outline-none overflow-hidden mb-[0px]',
               'hover:bg-default-50',
               'border-l-[3px]',
               isHighlighted && 'ring-2 ring-primary ring-opacity-50'
            )}
         >
            <div className="flex flex-1 gap-1 flex-row items-center pl-1">
               <Checkbox
                  isSelected={task.is_completed}
                  onValueChange={(isSelected) => {
                     onUpdate(task.id, { is_completed: isSelected });
                  }}
                  classNames={{
                     wrapper: 'after:bg-primary',
                  }}
                  className={clsx('p-0 m-0 text-center !w-[16px] mx-0')}
                  size="sm"
               />

               <div className="flex-grow min-w-0 mr-2 rounded flex flex-col justify-center py-0">
                  <RichEditableCell
                     value={task.content}
                     onSave={(val) => onUpdate(task.id, { content: val })}
                     className={clsx(
                        'leading-normal break-words whitespace-pre-wrap',
                        task.is_completed && 'text-default-400 line-through',
                        task.title_text_style === 'bold' && 'font-medium',
                        task.title_text_style === 'red' && 'text-danger',
                        task.title_text_style === 'red-bold' && 'text-danger font-medium'
                     )}
                  />
               </div>
            </div>

            {/* Actions */}
            <div className="p-0 text-center relative flex justify-center items-center gap-1">
               {/* Style Button */}
               <TaskStyleControl task={task} onUpdate={onUpdate} />

               {/* Today Toggle */}
               <TaskTodayControl task={task} onUpdate={onUpdate} />

               <Dropdown placement="bottom-end">
                  <DropdownTrigger>
                     <button
                        className="opacity-100 p-[0px] text-default-default-400 cursor-pointer hover:text-default-600 rounded transition-all outline-none"
                        aria-label="Task settings"
                     >
                        <MoreVertical size={16} />
                     </button>
                  </DropdownTrigger>
                  <DropdownMenu aria-label="Task Actions">
                     {TaskMenuItems({
                        task,
                        onUpdate,
                        onDelete,
                        onMove,
                        projectsStructure,
                        items: {
                           delete: true,
                           move: true,
                           styles: true,
                           today: true,
                        },
                     })}
                  </DropdownMenu>
               </Dropdown>
            </div>
         </motion.div>
      </TaskContextMenu>
   );
};

export const DoingNowScreen = ({
   globalStatus = 'idle',
   canLoad = true,
   isActive = false,
   onMoveTask,
   onNavigate,
}: DoingNowScreenProps) => {
   const [tasks, setTasks] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(true); // Initial load (full screen)
   const [isRefreshing, setIsRefreshing] = useState(false); // Refresh (button spin)
   const [isLoaded, setIsLoaded] = useState(false);
   const [projectsStructure, setProjectsStructure] = useState<any[]>([]);

   const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

   const {
      execute: executeSave,
      status: saveStatus,
      error: saveError,
   } = useAsyncAction({
      useToast: false,
      minDuration: 800,
      successDuration: 2000,
      loadingMessage: 'Saving...',
      successMessage: 'Saved',
      errorMessage: 'Failed to save',
   });

   useEffect(() => {
      // Load projects structure for Move menu
      projectService
         .getProjectsWithFolders()
         .then((data) => setProjectsStructure(data || []))
         .catch((err) => logger.error('Failed to load projects structure', err));
   }, []);

   const fetchTasks = async (showSpinner = true) => {
      // If we shouldn't load, just return.
      if (!canLoad && showSpinner) return;

      if (showSpinner) {
         setIsLoading(true);
         loadingService.logSystemTabStart('DoingNow');
      } else {
         setIsRefreshing(true);
         logger.info('Refreshing doing now tasks...');
      }

      try {
         // Fetch tasks from "Doing Now" folders
         let data = await taskService.getDoingNowTasks();

         // Artificial delay for better UX
         await new Promise((resolve) => setTimeout(resolve, 500));

         // Client-side sorting based on Priority (Style) then Alphabetical
         if (data) {
            data.sort((a, b) => {
               // 1. Priority Weight
               const getWeight = (style: string | null) => {
                  if (style === 'red-bold') return 3;
                  if (style === 'red') return 2;
                  if (style === 'bold') return 1;
                  return 0;
               };

               const weightA = getWeight(a.title_text_style);
               const weightB = getWeight(b.title_text_style);

               if (weightA !== weightB) {
                  return weightB - weightA; // Higher weight first
               }

               // 2. Alphabetical (content)
               const textA = a.content || '';
               const textB = b.content || '';
               return textA.localeCompare(textB);
            });
         }

         setTasks(data || []);
         loadingService.logSystemTabFinish('DoingNow', data?.length || 0);
         setIsLoaded(true);
      } catch (err) {
         logger.error('Failed to load doing now tasks', err);
      } finally {
         setIsLoading(false);
         setIsRefreshing(false);
      }
   };

   useEffect(() => {
      // Fetch if allowed to load AND (it's active OR first load)
      if (canLoad && isActive) {
         logger.info('DoingNowScreen became active, fetching...');
         // Don't show full spinner if already loaded, just refresh icon spin
         fetchTasks(!isLoaded);
      } else if (canLoad && !isLoaded) {
         // Initial background load
         fetchTasks(true);
      }
   }, [canLoad, isActive]);

   const handleUpdate = async (id: string, updates: any) => {
      // Optimistic update
      setTasks((prev) => {
         const newTasks = prev.map((t) => (t.id === id ? { ...t, ...updates } : t));

         // If completing, remove from list
         if (updates.is_completed === true) {
             return newTasks.filter((t) => t.id !== id);
         }

         // Re-sort if style or content changed
         if ('title_text_style' in updates || 'content' in updates) {
            return newTasks.sort((a, b) => {
               const getWeight = (style: string | null) => {
                  if (style === 'red-bold') return 3;
                  if (style === 'red') return 2;
                  if (style === 'bold') return 1;
                  return 0;
               };

               const weightA = getWeight(a.title_text_style);
               const weightB = getWeight(b.title_text_style);

               if (weightA !== weightB) return weightB - weightA;

               const textA = a.content || '';
               const textB = b.content || '';
               return textA.localeCompare(textB);
            });
         }

         return newTasks;
      });

      try {
         await executeSave(async () => {
            await taskService.updateTask(id, updates);
         });
      } catch (err) {
         logger.error('Failed to update task', err);
         fetchTasks(false); // Revert on error
      }
   };

   const handleMove = async (taskId: string, projectId: string, folderId: string) => {
      try {
         await executeSave(async () => {
            // 1. Update task in DB (move to top of target folder)
            await taskService.moveTaskToFolder(taskId, folderId);
         });

         // 2. Remove from local list (optimistic)
         setTasks((prev) => prev.filter((t) => t.id !== taskId));

         // 3. Trigger parent navigation
         onMoveTask?.(taskId, projectId, folderId);

         logger.success('Task moved to project');
      } catch (err) {
         logger.error('Failed to move task', err);
         fetchTasks(false); // Revert
      }
   };

   const handleDelete = async (id: string) => {
      // Optimistic update
      setTasks((prev) => prev.filter((t) => t.id !== id));

      try {
         await executeSave(async () => {
            await taskService.deleteTask(id); // Soft delete
         });
      } catch (err) {
         logger.error('Failed to delete task', err);
         fetchTasks(false);
      }
   };

   if (isLoading) {
      return (
         <div className="flex justify-center items-center h-full">
            <Spinner label="Loading doing now tasks..." />
         </div>
      );
   }

   return (
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
         <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-4 min-h-[40px] gap-4">
            <h1 className="tab-title justify-self-start">
               <Target className={tasks.length > 0 ? "text-danger-400" : "text-primary-400"} />
               Делаю Сейчас
            </h1>

            <div className="w-full max-w-[240px] justify-self-center">
               {onNavigate && <GlobalSearch onNavigate={onNavigate} />}
            </div>

            <div className="flex items-center gap-4 justify-self-end">
               <StatusBadge status={saveStatus} errorMessage={saveError?.message} />

               <Button
                  isIconOnly
                  size="sm"
                  variant="flat"
                  color="success"
                  onPress={() => fetchTasks(false)}
                  isLoading={isRefreshing}
               >
                  <RefreshCw size={18} />
               </Button>
            </div>
         </div>

         <div className="flex-grow overflow-y-auto pr-0 pb-10">
            {tasks.length === 0 ? (
               <div className="text-center py-20 text-default-400">No tasks in "Делаю Прямо Сейчас" folders.</div>
            ) : (
               <div className="flex flex-col gap-[6px]">
                  <AnimatePresence initial={false} mode="popLayout">
                     {tasks.map((task) => (
                        <DoingNowTaskRow
                           key={task.id}
                           task={task}
                           onUpdate={handleUpdate}
                           onDelete={handleDelete}
                           projectsStructure={projectsStructure}
                           onMove={handleMove}
                           isHighlighted={highlightedTaskId === task.id}
                        />
                     ))}
                  </AnimatePresence>
               </div>
            )}
         </div>
      </div>
   );
};

