'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { createTaskService } from '@/app/_services/taskService'; // Factory
import { useSupabase } from '@/utils/supabase/useSupabase'; // Auth client
import { clsx } from 'clsx';
import {
   CheckCircle2,
   Trash2,
   Folder as FolderIcon,
   RefreshCw,
   GripVertical,
   RotateCcw,
   Calendar,
   MoreVertical,
   MoveRight,
   ArrowRight,
   Star,
} from 'lucide-react';
import {
   Spinner,
   Chip,
   Button,
   Switch,
   Select,
   SelectItem,
   Checkbox,
   Dropdown,
   DropdownTrigger,
   DropdownMenu,
   DropdownItem,
   DropdownSection,
} from '@heroui/react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { useGlobalPersistentState, globalStorage } from '@/utils/storage';
import { AnimatePresence, motion } from 'framer-motion';
import { projectService } from '@/app/_services/projectService';
import { loadingService } from '@/app/_services/loadingLogsService';
import { EditableCell } from '../components/EditableCell';
import { TaskContextMenu, TaskMenuItems } from '../components/TaskContextMenu';
import { TaskStyleControl } from '../components/TaskStyleControl';
import { TaskTodayControl } from '../components/TaskTodayControl';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { GlobalSearch, NavigationTarget } from '@/app/components/GlobalSearch';
import { RichEditableCell } from '../components/RichEditableCell';

const logger = createLogger('TodayScreen');

interface TodayScreenProps {
   globalStatus?: string;
   canLoad?: boolean;
   isActive?: boolean;
   onRestoreTask?: (task: any) => void;
   onMoveTask?: (taskId: string, projectId: string, folderId: string) => void;
   onNavigate?: (target: NavigationTarget) => void;
}

// Visual clone of TaskRow for Today items
const TodayTaskRow = ({
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

               {/* Remove from Today button */}
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

export const TodayScreen = ({
   globalStatus = 'idle',
   canLoad = true,
   isActive = false,
   onMoveTask,
   onNavigate,
}: TodayScreenProps) => {
   const { supabase } = useSupabase();
   const taskService = useMemo(() => createTaskService(supabase), [supabase]);

   const [tasks, setTasks] = useState<any[]>([]);
   const [isLoading, setIsLoading] = useState(true); // Initial load (full screen)
   const [isRefreshing, setIsRefreshing] = useState(false); // Refresh (button spin)
   const [isLoaded, setIsLoaded] = useState(false);
   const [projectsStructure, setProjectsStructure] = useState<any[]>([]);

   const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

   // --- Check for highlighted task ---
   useEffect(() => {
      if (isActive && isLoaded) {
         const highlightKey = 'highlight_task_today';
         const taskIdToHighlight = globalStorage.getItem(highlightKey);

         if (taskIdToHighlight) {
            logger.info('Highlighting restored task', { taskId: taskIdToHighlight });
            setHighlightedTaskId(taskIdToHighlight);

            globalStorage.removeItem(highlightKey);

            setTimeout(() => {
               setHighlightedTaskId(null);
            }, 2000);
         }
      }
   }, [isActive, isLoaded]);

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

   // Persistent filters (if needed in future, currently none specific to Today like timeFilter)
   // const [showCompleted, setShowCompleted] = useGlobalPersistentState<boolean>('today_show_completed', true);

   const fetchTasks = async (showSpinner = true) => {
      // If we shouldn't load, just return.
      if (!canLoad && showSpinner) return;

      if (showSpinner) {
         setIsLoading(true);
         loadingService.logSystemTabStart('Today');
      } else {
         setIsRefreshing(true);
         logger.info('Refreshing today tasks...');
      }

      try {
         // Fetch tasks where is_today = true
         let data = await taskService.getTodayTasks();

         // Artificial delay for better UX (optional, matching DoneScreen)
         await new Promise((resolve) => setTimeout(resolve, 500));

         // Client-side sorting based on Folder Order then Task Order
         if (data) {
            data.sort((a, b) => {
               // 1. Folder Order
               const folderOrderA = a.folders?.sort_order ?? 0;
               const folderOrderB = b.folders?.sort_order ?? 0;
               if (folderOrderA !== folderOrderB) {
                  return folderOrderA - folderOrderB;
               }
               // 2. Task Order
               return (a.sort_order ?? 0) - (b.sort_order ?? 0);
            });
         }

         setTasks(data || []);
         loadingService.logSystemTabFinish('Today', data?.length || 0);
         setIsLoaded(true);
      } catch (err) {
         logger.error('Failed to load today tasks', err);
      } finally {
         setIsLoading(false);
         setIsRefreshing(false);
      }
   };

   useEffect(() => {
      // Fetch if allowed to load AND (it's active OR first load)
      if (canLoad && isActive) {
         logger.info('TodayScreen became active, fetching...');
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

         // If removing from today, filter out
         if (updates.is_today === false) {
            return newTasks.filter((t) => t.id !== id);
         }

         // Re-sort if folder or sort_order changed (though usually updates here are content/style/completion)
         // But user might drag drop in other screen? 
         // For now, let's keep the order stable unless refresh. 
         // Or if we want to support reordering here later.
         // Actually, removing the resort logic prevents jumping tasks when editing style.
         
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

         // 2. Remove from local list (optimistic) - or keep it if we want to show it?
         // User said "switch to where we moved". So we are leaving this screen.
         // But let's remove it from local state anyway to be clean.
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
            <Spinner label="Loading today's tasks..." />
         </div>
      );
   }

   return (
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-4 min-h-[40px] gap-4">
               <h1 className="tab-title justify-self-start">
                  <Star className={tasks.length > 0 ? "text-warning" : "text-default-400"} fill="currentColor" />
                  Today
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
               <div className="text-center py-20 text-default-400">No tasks for today.</div>
            ) : (
               <div className="flex flex-col gap-6">
                  {(() => {
                     // 1. Group tasks by Project (handling Inbox items)
                     const groups = tasks.reduce((acc, task) => {
                        const projectId = task.folders?.projects?.id || 'inbox';
                        const projectTitle = task.folders?.projects?.title || 'Inbox';
                        const projectColor = task.folders?.projects?.proj_color || '#a1a1aa'; // Zinc-400 for Inbox

                        if (!acc[projectId]) {
                           acc[projectId] = {
                              title: projectTitle,
                              color: projectColor,
                              tasks: []
                           };
                        }
                        acc[projectId].tasks.push(task);
                        return acc;
                     }, {} as Record<string, { title: string; color: string; tasks: any[] }>);

                     // 2. Sort groups based on projectsStructure
                     const sortedProjectIds = Object.keys(groups).sort((a, b) => {
                        // Always put Inbox at the top
                        if (a === 'inbox') return -1;
                        if (b === 'inbox') return 1;

                        const indexA = projectsStructure.findIndex((p: any) => p.id === a);
                        const indexB = projectsStructure.findIndex((p: any) => p.id === b);
                        
                        if (indexA === -1 && indexB === -1) return 0;
                        if (indexA === -1) return 1;
                        if (indexB === -1) return -1;
                        return indexA - indexB;
                     });

                     // 3. Render Groups
                     return sortedProjectIds.map((projectId) => {
                        const group = groups[projectId];
                        return (
                           <div key={projectId} className="flex flex-col gap-2">
                              {/* Project Header */}
                              <div className="flex items-center gap-2 px-1 sticky top-0 bg-background/95 backdrop-blur-sm z-10 py-2">
                                 <div 
                                    className="w-3 h-3 rounded-full flex-shrink-0"
                                    style={{ backgroundColor: group.color }}
                                 />
                                 <h3 className="font-semibold text-default-700">{group.title}</h3>
                                 <Chip size="sm" variant="flat" className="ml-2 h-5 min-w-5 px-1 text-[12px] bg-default-100 text-default-500">
                                    {group.tasks.length}
                                 </Chip>
                              </div>
      
                              {/* Tasks List */}
                              <div className="flex flex-col gap-[6px]">
                                 <AnimatePresence initial={false} mode="popLayout">
                                    {group.tasks.map((task: any) => (
                                       <TodayTaskRow
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
                           </div>
                        );
                     });
                  })()}
               </div>
            )}
         </div>
      </div>
   );
};
