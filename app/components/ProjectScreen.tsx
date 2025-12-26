'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAppLoader } from '@/app/AppLoader';
import { createLogger } from '@/utils/logger/Logger';
import { Folder, Task, Project } from '@/app/types';
import { globalStorage } from '@/utils/storage';
import { toast } from 'react-hot-toast';
import { clsx } from 'clsx';
import { EllipsisVertical } from 'lucide-react';
import { Button } from '@heroui/react';

import {
   DndContext,
   DragEndEvent,
   DragOverlay,
   DragStartEvent,
   DropAnimation,
   KeyboardSensor,
   PointerSensor,
   closestCenter,
   pointerWithin,
   rectIntersection,
   defaultDropAnimationSideEffects,
   useSensor,
   useSensors,
   CollisionDetection,
} from '@dnd-kit/core';
import {
   arrayMove,
   sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { TaskRow } from '@/app/components/TaskRow';
import { FolderTabs, FolderTab } from '@/app/components/FolderTabs';
import { TaskList } from '@/app/components/TaskList';
import { projectService } from '@/app/_services/projectService';
import { useAsyncAction, ActionStatus } from '@/utils/supabase/useAsyncAction';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { EditProjectPopover } from '@/app/components/EditProject';

const logger = createLogger('ProjectScreen');

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
    onUpdateProject: (updates: { title?: string; color?: string }) => void;
    onDeleteProject: () => void;
}

export const ProjectScreen = ({ project, isActive, onReady, globalStatus = 'idle', canLoad = true, onUpdateProject, onDeleteProject }: ProjectScreenProps) => {
   const [folders, setFolders] = useState<Folder[]>([]);
   const [tasks, setTasks] = useState<Task[]>([]);
   const [selectedFolderId, setSelectedFolderId] = useState<string>('');
   const [isDataLoaded, setIsDataLoaded] = useState(false);
   const [activeId, setActiveId] = useState<string | null>(null);
   const [isOverFolder, setIsOverFolder] = useState(false);
   const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
   const { setLoading } = useAppLoader();
   
   const loadStartedRef = useRef(false);
   const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
   const hoveredFolderIdRef = useRef<string | null>(null);
   const isDraggingRef = useRef(false);

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
   const handleAddTask = async (targetIndex?: number) => {
      if (!selectedFolderId) return;

      const currentFolderTasks = tasks
          .filter(t => t.folder_id === selectedFolderId)
          .sort((a, b) => a.sort_order - b.sort_order);
      
      let insertIndex = targetIndex !== undefined ? targetIndex : currentFolderTasks.length;
      if (insertIndex < 0) insertIndex = 0;
      if (insertIndex > currentFolderTasks.length) insertIndex = currentFolderTasks.length;

      const tempId = crypto.randomUUID();
      const newTask: Task = {
         id: tempId,
         folder_id: selectedFolderId,
         content: '',
         sort_order: insertIndex,
         is_completed: false,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString(),
         isNew: true,
         isDraft: true // Create as draft
      };

      // Optimistic update: insert and shift
      setTasks(prev => {
          const otherTasks = prev.filter(t => t.folder_id !== selectedFolderId);
          const newFolderTasks = [...currentFolderTasks];
          newFolderTasks.splice(insertIndex, 0, newTask);
          
          // Re-index locally
          const reindexed = newFolderTasks.map((t, idx) => ({ ...t, sort_order: idx }));
          return [...otherTasks, ...reindexed];
      });

      // Do NOT save to DB yet. Waiting for user input.
   };

   const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
      const task = tasks.find(t => t.id === id);
      if (!task) return;

      // Handle Draft Saving
      if (task.isDraft) {
          // Only proceed if we are updating content
          if (updates.content !== undefined) {
              const content = updates.content.trim();
              if (!content) {
                  // Empty content -> Delete draft
                  handleDeleteTask(id);
                  return;
              }

              // Create real task
              const updatesWithTimestamp = { ...updates, updated_at: new Date().toISOString() };
              const realTask = { ...task, ...updatesWithTimestamp, isDraft: false, isNew: false };
              
              // 1. Update local state (remove draft status)
              setTasks(prev => prev.map(t => t.id === id ? realTask : t));

              try {
                 await executeSave(async () => {
                     // 2. Create in DB
                     const data = await projectService.createTask(selectedFolderId, content, realTask.sort_order);
                     
                     // 3. Persist the new order for ALL tasks in this folder 
                     const currentFolderTasks = tasks.filter(t => t.folder_id === selectedFolderId).sort((a, b) => a.sort_order - b.sort_order);
                     const updatesForOrder = currentFolderTasks.map((t, idx) => ({ 
                         id: t.id === id ? data.id : t.id, 
                         sort_order: idx 
                     }));
                     
                     await projectService.updateTaskOrder(updatesForOrder);

                     // 4. Final local update with real ID
                     setTasks(prev => prev.map(t => t.id === id ? { ...data, sort_order: realTask.sort_order } : t));
                 });
              } catch (err) {
                 logger.error('Failed to create task from draft', err);
              }
          }
          return;
      }

      // Optimistic Update
      const updatesWithTimestamp = { ...updates, updated_at: new Date().toISOString() };
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updatesWithTimestamp } : t));
      
      if (task?.isNew) return; // Wait for creation

      try {
         await executeSave(async () => {
             await projectService.updateTask(id, updates);
         });
      } catch (err) {
         logger.error('Failed to update task', err);
      }
   };

   const handleDeleteTask = async (id: string) => {
      const task = tasks.find(t => t.id === id);
      const isDraft = task?.isDraft;

      const oldTasks = [...tasks];
      setTasks(prev => prev.filter(t => t.id !== id));
      
      if (isDraft) return; // Local delete only for drafts

      try {
         await executeSave(async () => {
             await projectService.deleteTask(id);
         });
      } catch (err) {
         logger.error('Failed to delete task', err);
         setTasks(oldTasks);
      }
   };

   const handleAddFolder = async (title: string) => {
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

   const handleUpdateFolder = async (folderId: string, title: string) => {
       setFolders(prev => prev.map(f => f.id === folderId ? { ...f, title, updated_at: new Date().toISOString() } : f));
       try {
           await executeSave(async () => {
               await projectService.updateFolder(folderId, { title });
           });
       } catch (err) {
           logger.error('Failed to update folder', err);
           // Rollback could be added here
       }
   };

   const handleDeleteFolder = async (folderId: string) => {
       const oldFolders = [...folders];
       const oldTasks = [...tasks];
       
       // Optimistic delete
       setFolders(prev => prev.filter(f => f.id !== folderId));
       setTasks(prev => prev.filter(t => t.folder_id !== folderId)); // Assume tasks deleted/moved
       
       // Switch selection if needed
       if (selectedFolderId === folderId) {
           const remaining = oldFolders.filter(f => f.id !== folderId);
           if (remaining.length > 0) {
               setSelectedFolderId(remaining[0].id);
           } else {
               setSelectedFolderId('');
           }
       }

       try {
           await executeSave(async () => {
               await projectService.deleteFolder(folderId);
           });
           toast.success('Folder deleted');
       } catch (err) {
           logger.error('Failed to delete folder', err);
           toast.error('Failed to delete folder');
           setFolders(oldFolders);
           setTasks(oldTasks);
       }
   };

   // --- Project Actions ---
   const handleEditProject = async (title: string, color: string) => {
       try {
           await executeSave(async () => {
               await projectService.updateProject(project.id, { title, color });
               onUpdateProject({ title, color });
           });
       } catch (err) {
           logger.error('Failed to update project', err);
       }
   };

   const handleRemoveProject = async () => {
       try {
           await projectService.deleteProject(project.id);
           onDeleteProject();
       } catch (err) {
           logger.error('Failed to delete project', err);
           toast.error('Failed to delete project');
       }
   };

   const sensors = useSensors(
      useSensor(PointerSensor, {
          activationConstraint: {
              delay: 150,
              tolerance: 5,
          },
      }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
   );

   const customCollisionDetection: CollisionDetection = (args) => {
      const { active } = args;
      const isDraggingFolder = active.id.toString().startsWith('folder-');

      // 1. Check folder tabs with pointerWithin
      const pointerCollisions = pointerWithin(args);
      const folderCollision = pointerCollisions.find(c => c.id.toString().startsWith('folder-'));
      
      if (folderCollision) {
          const folderId = folderCollision.id.toString();
          
          // Handle folder switch timer logic directly here because handleDragOver 
          // might not trigger if we return the same task collision
          if (!isDraggingFolder && hoveredFolderIdRef.current !== folderId) {
              hoveredFolderIdRef.current = folderId;
              
              // Update state for UI highlighting (safely via timeout to avoid render-cycle issues)
              setTimeout(() => {
                  if (isDraggingRef.current) {
                      setHoveredFolderId(folderId);
                  }
              }, 0);
              
              if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = null;
              }

              const targetId = folderId.replace('folder-', '');
              if (targetId !== selectedFolderId) {
                  hoverTimeoutRef.current = setTimeout(() => {
                      setSelectedFolderId(targetId);
                      globalStorage.setItem(`active_folder_${project.id}`, targetId);
                      // Don't reset background here, keep it highlighted as long as we hover
                  }, 700);
              }
          }

          // Force DndKit to think we are over the first task ONLY if dragging a TASK
          if (!isDraggingFolder && filteredTasks.length > 0) {
              return [{ id: filteredTasks[0].id }];
          }
          
          return [folderCollision];
      }
      
      // Reset if left folder area (only relevant for task dragging)
      if (!isDraggingFolder && hoveredFolderIdRef.current) {
          // If we detect no folder collision but ref is set -> we left the folder area
          // Double check if we are really not over a folder (sometimes collisions fluctuate)
          const stillOverFolder = pointerCollisions.some(c => c.id.toString().startsWith('folder-'));
          
          if (!stillOverFolder) {
              hoveredFolderIdRef.current = null;
              setTimeout(() => {
                  setHoveredFolderId(null);
              }, 0);

              if (hoverTimeoutRef.current) {
                  clearTimeout(hoverTimeoutRef.current);
                  hoverTimeoutRef.current = null;
              }
          }
      }

      // 2. For tasks list reordering use closestCenter (smoother)
      return closestCenter(args);
   };

   const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      isDraggingRef.current = true;
   };

   const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
       // Ignore if clicked on interactive elements (buttons, inputs)
       if ((e.target as HTMLElement).closest('button, input, [role="button"], [data-task-row]')) return;

       // Find all rendered task rows within this component
       // Use a ref for the container or just querySelector inside currentTarget if possible?
       // document.querySelectorAll is global, might pick up other screens if active?
       // But ProjectScreen is only one active (opacity 0 others). pointer-events-none on others.
       // So clicking is safe. Querying might find hidden ones?
       // Yes, opacity-0 elements are still in DOM.
       
       // We need to query only visible tasks.
       // Or scope query to e.currentTarget
       const container = e.currentTarget;
       const taskElements = Array.from(container.querySelectorAll('[data-task-row]'));
       
       const clickY = e.clientY;
       let insertIndex = taskElements.length;
       
       for (let i = 0; i < taskElements.length; i++) {
           const rect = taskElements[i].getBoundingClientRect();
           const centerY = rect.top + rect.height / 2;
           
           if (clickY < centerY) {
               insertIndex = i;
               break;
           }
       }
       
       handleAddTask(insertIndex);
   };

   // --- Spring-Loaded Folders Logic ---
   const handleDragOver = ({ active, over }: any) => {
       const folderOverId = hoveredFolderIdRef.current;
       const isOverFolderNode = !!folderOverId; 

       if (isOverFolder !== isOverFolderNode) {
           setIsOverFolder(isOverFolderNode);
       }
       
       // Timer logic moved to customCollisionDetection to handle "stuck" over updates
   };

   const handleDragEnd = async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      setIsOverFolder(false); 
      setHoveredFolderId(null);
      isDraggingRef.current = false;
      
      const folderOverId = hoveredFolderIdRef.current;
      hoveredFolderIdRef.current = null; // Reset ref

      // Clear timeout
      if (hoverTimeoutRef.current) {
          clearTimeout(hoverTimeoutRef.current);
          hoverTimeoutRef.current = null;
      }
      
      // If dropped over a folder (detected by custom collision)
      if (folderOverId && active.id.toString() !== folderOverId) {
          // Special handling for task dropped on folder tab
          const activeTaskId = active.id as string;
          const targetFolderId = folderOverId.replace('folder-', '');
          const task = tasks.find(t => t.id === activeTaskId);
          
          if (task && !activeTaskId.startsWith('folder-')) {
             // Calculate new sort order to be at the top
            const targetFolderTasks = tasks.filter(t => t.folder_id === targetFolderId);
            const minOrder = targetFolderTasks.length > 0 
                ? Math.min(...targetFolderTasks.map(t => t.sort_order)) 
                : 0;
            const newSortOrder = minOrder - 1000;

            const updatedTask = { 
                ...task, 
                folder_id: targetFolderId, 
                sort_order: newSortOrder,
                updated_at: new Date().toISOString() 
            };
            
            setTasks(prev => prev.map(t => t.id === activeTaskId ? updatedTask : t));
            setSelectedFolderId(targetFolderId);
            
            try {
                await executeSave(async () => {
                    await projectService.updateTask(activeTaskId, { 
                        folder_id: targetFolderId,
                        sort_order: newSortOrder
                    });
                });
            } catch(err) {
                logger.error('Failed to move task folder', err);
            }
            return;
          }
      }

      if (!over) return;

      if (active.data.current?.type === 'folder' && over.data.current?.type === 'folder') {
           if (active.id !== over.id) {
               setFolders((items) => {
                   const oldIndex = items.findIndex((i) => `folder-${i.id}` === active.id);
                   const newIndex = items.findIndex((i) => `folder-${i.id}` === over.id);
                   const newItems = arrayMove(items, oldIndex, newIndex);
                   
                   // Save to DB
                   const updates = newItems.map((f, index) => ({ id: f.id, sort_order: index }));
                   
                   executeSave(async () => {
                       await projectService.updateFolderOrder(updates);
                   }).catch(err => {
                       logger.error('Failed to reorder folders', err);
                   });
                   
                   return newItems;
               });
           }
           return;
      }

      // Removed old folder drop logic as it is now handled via folderOverId
      /* 
      if (over.id.toString().startsWith('folder-')) {
         ...
      } 
      */

      const activeTaskId = active.id as string;
      if (active.id !== over.id) {
         // Sort current folder tasks to match visual order
         const currentFolderTasks = tasks
            .filter(t => t.folder_id === selectedFolderId)
            .sort((a, b) => a.sort_order - b.sort_order);

         const activeTask = tasks.find(t => t.id === activeTaskId);
         
         // Case: Task moved from another folder into the list
         if (activeTask && activeTask.folder_id !== selectedFolderId) {
             const overIndex = currentFolderTasks.findIndex(t => t.id === over.id);
             
             // Fix off-by-one error when dropping items from another list.
             // If we drop over an item that is NOT the first one, we usually want to insert AFTER it
             // because dragging downwards typically means "append". 
             // Exception: Dragging to the very top (index 0).
             const modifier = overIndex === 0 ? 0 : 1;
             
             const newIndex = overIndex >= 0 ? overIndex + modifier : currentFolderTasks.length;
             
             // Insert at new index
             const updatedTask = { ...activeTask, folder_id: selectedFolderId, updated_at: new Date().toISOString() };
             
             // Create new list with inserted task
             const newSorted = [...currentFolderTasks];
             // Simple insertion at the index of the item we hovered over
             newSorted.splice(newIndex, 0, updatedTask);
             
             const updates = newSorted.map((t, index) => ({ id: t.id, sort_order: index }));

             setTasks(prev => {
                 const otherTasks = prev.filter(t => t.folder_id !== selectedFolderId && t.id !== activeTaskId);
                 const updatedCurrentTasks = newSorted.map((t, idx) => ({ ...t, sort_order: idx }));
                 return [...otherTasks, ...updatedCurrentTasks];
             });

             try {
                 await executeSave(async () => {
                     // 1. Update folder
                     await projectService.updateTask(activeTaskId, { folder_id: selectedFolderId });
                     // 2. Update all orders
                     await projectService.updateTaskOrder(updates);
                 });
             } catch(err) {
                 logger.error('Failed to move task to folder list', err);
             }
             return;
         }

         // Case: Reordering within same folder
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
      let tasksForFolder = tasks.filter(t => t.folder_id === selectedFolderId);

      // If dragging a task into a new folder (spring-loaded), include it in the list temporarily
      if (activeId && !activeId.toString().startsWith('folder-')) {
          const activeTask = tasks.find(t => t.id === activeId);
          
          // Logic: If task is from another folder OR we are currently hovering over ANY folder tab
          // we want to visualize it at the top of the current list
          if (activeTask && (activeTask.folder_id !== selectedFolderId || isOverFolder)) {
              // Calculate temp sort order to show it at the top
              const minOrder = tasksForFolder.length > 0 
                  ? Math.min(...tasksForFolder.map(t => t.sort_order)) 
                  : 0;
              
              const tempTask = { ...activeTask, sort_order: minOrder - 1000 };
              
              // If it's already in the list (same folder), replace it with the temp version
              if (activeTask.folder_id === selectedFolderId) {
                  tasksForFolder = tasksForFolder.map(t => t.id === activeId ? tempTask : t);
              } else {
                  // If from another folder, add it
                  tasksForFolder = [...tasksForFolder, tempTask];
              }
          }
      }

      return tasksForFolder.sort((a, b) => (a.sort_order - b.sort_order));
   }, [tasks, selectedFolderId, activeId]);

   const getFolderTaskCount = (folderId: string) => {
       return tasks.filter(t => t.folder_id === folderId).length;
   };

   // Removed early return to allow rendering empty state for new projects immediately
   // if (!isDataLoaded) {
   //    return null;
   // }

   return (
      <div 
          className={clsx(
            "h-full w-full overflow-hidden flex flex-col",
            activeId ? "cursor-grabbing *:[cursor:grabbing]" : ""
          )}
          onDoubleClick={handleDoubleClick}
      >
         <div className="flex-grow w-full max-w-5xl mx-auto flex flex-col px-[50px] py-6">
             <div className="flex justify-between items-center mb-4 min-h-[40px]">
            <div className="flex items-center gap-1">
                <h1 className="text-2xl font-bold">{project.title}</h1>
                <EditProjectPopover 
                    initialTitle={project.title}
                    initialColor={project.color}
                    onUpdate={handleEditProject}
                    onDelete={handleRemoveProject}
                >
                    <Button isIconOnly size="sm" variant="light" className="text-default-400 hover:text-default-600">
                        <EllipsisVertical size={18} />
                    </Button>
                </EditProjectPopover>
            </div>
            
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
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
         >
            <FolderTabs 
                folders={folders}
                selectedFolderId={selectedFolderId}
                onSelect={(id) => {
                    setSelectedFolderId(id);
                    globalStorage.setItem(`active_folder_${project.id}`, id);
                }}
                onAddFolder={handleAddFolder}
                onUpdateFolder={handleUpdateFolder}
                onDeleteFolder={handleDeleteFolder}
                getTaskCount={getFolderTaskCount}
                projectId={project.id}
                hoveredFolderId={hoveredFolderId}
            />

            <div className="mt-6 flex-grow flex flex-col min-h-0">
                {selectedFolderId ? (
                   <TaskList 
                        key={selectedFolderId}
                        tasks={filteredTasks}
                        onUpdateTask={handleUpdateTask}
                        onDeleteTask={handleDeleteTask}
                        isEmpty={filteredTasks.length === 0}
                   />
                ) : (
                    <div className="text-center py-20 text-default-400">
                        Create a folder to start adding tasks.
                    </div>
                )}
            </div>

            <DragOverlay dropAnimation={dropAnimationConfig}>
               {activeId ? (
                   activeId.startsWith('folder-') ? (
                       // Dragging a folder - Use visual component
                       <FolderTab 
                          folder={folders.find(f => `folder-${f.id}` === activeId)!}
                          count={getFolderTaskCount(activeId.replace('folder-', ''))}
                          isActive={selectedFolderId === activeId.replace('folder-', '')}
                          isDragging={true}
                          layoutIdPrefix="overlay" 
                          onClick={() => {}}
                       />
                   ) : (
                       // Dragging a task
                      <TaskRow
                         task={tasks.find(t => t.id === activeId)!}
                         onUpdate={() => {}}
                         onDelete={() => {}}
                         isOverlay
                      />
                   )
               ) : null}
            </DragOverlay>
         </DndContext>
         </div>
      </div>
   );
};
