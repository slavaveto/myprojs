'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAppLoader } from '@/app/AppLoader';
import { createLogger } from '@/utils/logger/Logger';
import { Folder, Task, Project } from '@/app/types';
import { globalStorage } from '@/utils/storage';
import { toast } from 'react-hot-toast';
import {
   DndContext,
   DragEndEvent,
   DragOverlay,
   DragStartEvent,
   DropAnimation,
   KeyboardSensor,
   PointerSensor,
   closestCorners,
   defaultDropAnimationSideEffects,
   useSensor,
   useSensors,
} from '@dnd-kit/core';
import {
   SortableContext,
   arrayMove,
   sortableKeyboardCoordinates,
   verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button, Chip } from '@heroui/react';
import { Plus } from 'lucide-react';
import { TaskRow } from '@/app/components/TaskRow';
import { clsx } from 'clsx';
import { projectService } from '@/app/_services/projectService';
import { useAsyncAction, ActionStatus } from '@/utils/supabase/useAsyncAction';
import { StatusBadge } from '@/utils/supabase/StatusBadge';

const logger = createLogger('ProjectScreen');

// --- Custom Tab Component (Simple Version) ---
interface FolderTabProps {
    folder: Folder;
    count: number;
    isActive: boolean;
    onClick: () => void;
}

const FolderTab = ({ folder, count, isActive, onClick }: FolderTabProps) => {
    return (
       <div
          onClick={onClick}
          className={clsx(
             'group relative flex items-center gap-2 px-3 h-[40px] cursor-pointer select-none transition-colors min-w-fit outline-none',
             isActive ? 'text-primary font-medium' : 'text-default-500 hover:text-default-700'
          )}
       >
          <span>{folder.title}</span>
          <Chip 
              size="sm" 
              variant="flat" 
              className={clsx(
                  "h-5 min-w-5 px-1 text-[10px]",
                  isActive ? "bg-primary/20 text-primary" : "bg-default-100 text-default-500"
              )}
          >
             {count}
          </Chip>
          
          {/* Active Indicator (Underline) */}
          {isActive && (
              <div className="absolute bottom-0 left-0 w-full h-[2px] bg-primary" />
          )}
       </div>
    );
};

const dropAnimationConfig: DropAnimation = {
   sideEffects: defaultDropAnimationSideEffects({
      styles: {
         active: { opacity: '0.4' },
      },
   }),
};

interface ProjectScreenProps {
    project: Project;
    isActive: boolean;
    onReady: () => void;
    globalStatus?: ActionStatus;
    canLoad?: boolean;
}

export const ProjectScreen = ({ project, isActive, onReady, globalStatus = 'idle', canLoad = true }: ProjectScreenProps) => {
   const [folders, setFolders] = useState<Folder[]>([]);
   const [tasks, setTasks] = useState<Task[]>([]);
   const [selectedFolderId, setSelectedFolderId] = useState<string>('');
   const [isDataLoaded, setIsDataLoaded] = useState(false);
   const [activeId, setActiveId] = useState<string | null>(null);
   const { setLoading } = useAppLoader();
   
   const loadStartedRef = useRef(false);

   // --- Status Management ---
   const { execute: executeSave, status: saveStatus, error: saveError } = useAsyncAction({
       useToast: false, // StatusBadge handles UI
       minDuration: 800,
       successDuration: 2000,
       loadingMessage: 'Saving...',
       successMessage: 'Saved',
       errorMessage: 'Failed to save'
   });

   const displayStatus = globalStatus !== 'idle' ? globalStatus : saveStatus;

   useEffect(() => {
       // If already loaded or load initiated, do nothing
       if (isDataLoaded || loadStartedRef.current) return;
       // If not allowed to load (e.g. background project waiting for active one), do nothing
       if (!canLoad) return;

       const load = async () => {
           loadStartedRef.current = true;
           
           if (isActive) {
               logger.start(`Loading active project: ${project.title}`);
           } else {
               logger.start(`Starting background load: ${project.title}`);
           }
           
           try {
               await loadData();
               
               if (isActive) {
                   logger.success(`Active project loaded: ${project.title}`);
                   toast.success(`Данные загружены!`, {
                       id: 'project-loaded', 
                       position: 'bottom-center'
                   });
               } else {
                   logger.success(`Background project loaded: ${project.title}`);
               }
           } catch (err) {
               logger.error(`Failed to load project: ${project.title}`, err);
           }
           
           onReady(); 
       };

       load();
   }, [isActive, project.id, isDataLoaded, canLoad]);

   const loadData = async () => {
      // Parallel loading
      const [foldersData, tasksData] = await Promise.all([
          projectService.getFolders(project.id),
          projectService.getTasks(project.id)
      ]);

      setFolders(foldersData);

      if (foldersData.length > 0) {
         const savedFolderId = globalStorage.getItem(`active_folder_${project.id}`);
         const folderExists = savedFolderId ? foldersData.find((f: any) => f.id === savedFolderId) : null;
         
         setSelectedFolderId(folderExists ? savedFolderId! : foldersData[0].id);
      }

      setTasks(tasksData);
      setIsDataLoaded(true);
   };

   // --- Actions ---
   const handleAddTask = async () => {
      if (!selectedFolderId) return;

      const currentFolderTasks = tasks.filter(t => t.folder_id === selectedFolderId);
      const newOrder = currentFolderTasks.length > 0 
         ? Math.max(...currentFolderTasks.map(t => t.sort_order)) + 1 
         : 0;

      const tempId = crypto.randomUUID();
      const newTask: Task = {
         id: tempId,
         folder_id: selectedFolderId,
         content: '',
         sort_order: newOrder,
         is_completed: false,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString(),
         isNew: true
      };

      setTasks(prev => [newTask, ...prev]);

      try {
         await executeSave(async () => {
             const data = await projectService.createTask(selectedFolderId, '', newOrder);
             setTasks(prev => prev.map(t => t.id === tempId ? data : t));
         });
      } catch (err) {
         logger.error('Failed to create task', err);
         setTasks(prev => prev.filter(t => t.id !== tempId));
      }
   };

   const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
      // Optimistic Update
      const updatesWithTimestamp = { ...updates, updated_at: new Date().toISOString() };
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updatesWithTimestamp } : t));
      
      const task = tasks.find(t => t.id === id);
      if (task?.isNew) return; // Wait for creation

      try {
         await executeSave(async () => {
             await projectService.updateTask(id, updates);
         });
      } catch (err) {
         logger.error('Failed to update task', err);
         // Optional: rollback logic here
      }
   };

   const handleDeleteTask = async (id: string) => {
      const oldTasks = [...tasks];
      setTasks(prev => prev.filter(t => t.id !== id));
      try {
         await executeSave(async () => {
             await projectService.deleteTask(id);
         });
      } catch (err) {
         logger.error('Failed to delete task', err);
         setTasks(oldTasks);
      }
   };

   const handleAddFolder = async () => {
       const title = prompt('Folder Name:');
       if (!title) return;

       const newOrder = folders.length > 0 
          ? Math.max(...folders.map(f => f.sort_order)) + 1 
          : 0;
       
       const tempId = crypto.randomUUID();
       const newFolder = {
           id: tempId,
           project_id: project.id,
           title,
           sort_order: newOrder,
           created_at: new Date().toISOString(),
           updated_at: new Date().toISOString(),
       };
       
       setFolders(prev => [...prev, newFolder]);
       
       try {
           await executeSave(async () => {
               const data = await projectService.createFolder(project.id, title, newOrder);
               setFolders(prev => prev.map(f => f.id === tempId ? data : f));
               setSelectedFolderId(data.id);
           });
       } catch (err) {
           logger.error('Failed to create folder', err);
           setFolders(prev => prev.filter(f => f.id !== tempId));
       }
   };

   const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
   );

   const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
   };

   const handleDragEnd = async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;
      const activeTaskId = active.id as string;
      
      if (over.id.toString().startsWith('folder-')) {
         const targetFolderId = over.id.toString().replace('folder-', '');
         const task = tasks.find(t => t.id === activeTaskId);
         if (task && task.folder_id !== targetFolderId) {
            const updatedTask = { ...task, folder_id: targetFolderId, updated_at: new Date().toISOString() };
            
            // Move to new folder locally
            setTasks(prev => prev.map(t => t.id === activeTaskId ? updatedTask : t));
            
            // Switch to that folder so user sees the task (optional UX choice, usually good)
            setSelectedFolderId(targetFolderId);
            
            try {
                await executeSave(async () => {
                    await projectService.updateTask(activeTaskId, { folder_id: targetFolderId });
                });
            } catch(err) {
                logger.error('Failed to move task folder', err);
            }
         }
         return;
      }

      if (active.id !== over.id) {
         const currentFolderTasks = tasks.filter(t => t.folder_id === selectedFolderId);
         const oldIndex = currentFolderTasks.findIndex(t => t.id === active.id);
         const newIndex = currentFolderTasks.findIndex(t => t.id === over.id);

         if (oldIndex !== -1 && newIndex !== -1) {
             const newSorted = arrayMove(currentFolderTasks, oldIndex, newIndex);
             const updates = newSorted.map((t, index) => ({ id: t.id, sort_order: index }));
             
             setTasks(prev => {
                 const otherTasks = prev.filter(t => t.folder_id !== selectedFolderId);
                 const updatedCurrentTasks = newSorted.map((t, idx) => ({ ...t, sort_order: idx }));
                 return [...otherTasks, ...updatedCurrentTasks];
             });

             try {
                 await executeSave(async () => {
                     await projectService.updateTaskOrder(updates);
                 });
             } catch(err) {
                 logger.error('Failed to reorder tasks', err);
             }
         }
      }
   };

   const filteredTasks = useMemo(() => {
      return tasks
         .filter(t => t.folder_id === selectedFolderId)
         .sort((a, b) => (a.sort_order - b.sort_order));
   }, [tasks, selectedFolderId]);

   const getFolderTaskCount = (folderId: string) => {
       return tasks.filter(t => t.folder_id === folderId).length;
   };

   if (!isDataLoaded) {
       return null;
   }

   return (
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
         <div className="flex justify-between items-center mb-4 min-h-[40px]">
            <h1 className="text-2xl font-bold">{project.title}</h1>
            
            <div className="flex items-center gap-2">
                <StatusBadge 
                    status={displayStatus}
                    loadingText="Saving..."
                    successText="Saved"
                    errorMessage={saveError?.message}
                />
            </div>
         </div>

         <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
         >
            <div className="flex items-end gap-2 w-full">
               <div className="flex-grow overflow-x-auto scrollbar-hide flex items-center gap-2">
                   {folders.map((folder) => (
                         <FolderTab 
                            key={folder.id}
                            folder={folder}
                            count={getFolderTaskCount(folder.id)}
                            isActive={selectedFolderId === folder.id}
                            onClick={() => {
                                setSelectedFolderId(folder.id);
                                globalStorage.setItem(`active_folder_${project.id}`, folder.id);
                            }}
                         />
                   ))}
               </div>
               <Button 
                   isIconOnly 
                   variant="flat" 
                   size="sm" 
                   color="success"
                   onPress={handleAddFolder}
                   className="mb-1"
               >
                   <Plus size={20} />
               </Button>
            </div>

            <div className="mt-6 flex-grow flex flex-col min-h-0">
                {selectedFolderId ? (
                   <>
                      <div className="flex-grow overflow-y-auto pr-0 pb-10">
                         <SortableContext
                            items={filteredTasks.map(t => t.id)}
                            strategy={verticalListSortingStrategy}
                         >
                            <div className="flex flex-col gap-2">
                               {filteredTasks.map((task) => (
                                  <TaskRow
                                     key={task.id}
                                     task={task}
                                     onUpdate={handleUpdateTask}
                                     onDelete={handleDeleteTask}
                                  />
                               ))}
                               {filteredTasks.length === 0 && (
                                   <div className="text-center py-10 text-default-400">
                                       No tasks in this folder.
                                   </div>
                               )}
                            </div>
                         </SortableContext>
                      </div>
                   </>
                ) : (
                    <div className="text-center py-20 text-default-400">
                        Create a folder to start adding tasks.
                    </div>
                )}
            </div>

            <DragOverlay dropAnimation={dropAnimationConfig}>
               {activeId ? (
                  <TaskRow
                     task={tasks.find(t => t.id === activeId)!}
                     onUpdate={() => {}}
                     onDelete={() => {}}
                     isOverlay
                  />
               ) : null}
            </DragOverlay>
         </DndContext>
      </div>
   );
};
