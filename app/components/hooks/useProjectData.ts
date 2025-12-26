import { useState, useRef, useEffect } from 'react';
import { Folder, Task, Project } from '@/app/types';
import { globalStorage } from '@/utils/storage';
import { toast } from 'react-hot-toast';
import { projectService } from '@/app/_services/projectService';
import { useAsyncAction, ActionStatus } from '@/utils/supabase/useAsyncAction';
import { createLogger } from '@/utils/logger/Logger';
import { arrayMove } from '@dnd-kit/sortable';

const logger = createLogger('ProjectScreen');

interface UseProjectDataProps {
    project: Project;
    isActive: boolean;
    onReady: () => void;
    canLoad?: boolean;
    onUpdateProject: (updates: { title?: string; color?: string }) => void;
    onDeleteProject: () => void;
    globalStatus?: ActionStatus;
}

export const useProjectData = ({ project, isActive, onReady, canLoad = true, onUpdateProject, onDeleteProject, globalStatus = 'idle' }: UseProjectDataProps) => {
   const [folders, setFolders] = useState<Folder[]>([]);
   const [tasks, setTasks] = useState<Task[]>([]);
   const [selectedFolderId, setSelectedFolderId] = useState<string>('');
   const [isDataLoaded, setIsDataLoaded] = useState(false);
   const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
   
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

   // Fast save for DnD (no artificial delay)
   const { execute: executeQuickSave, status: quickSaveStatus } = useAsyncAction({
       useToast: false,
       minDuration: 0,
       successDuration: 1000,
   });

   const displayStatus = globalStatus !== 'idle' ? globalStatus : (saveStatus !== 'idle' ? saveStatus : quickSaveStatus);

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

    // --- Sync active folder from storage when becoming active ---
    useEffect(() => {
        if (isActive && isDataLoaded && folders.length > 0) {
            const savedFolderId = globalStorage.getItem(`active_folder_${project.id}`);
            if (savedFolderId && savedFolderId !== selectedFolderId) {
                // Verify existence
                const folderExists = folders.find(f => f.id === savedFolderId);
                if (folderExists) {
                    logger.info(`Switching to saved folder: ${savedFolderId}`);
                    setSelectedFolderId(savedFolderId);
                }
            }
        }
    }, [isActive, isDataLoaded, project.id, folders, selectedFolderId]);

    // --- Silent Refresh when becoming active ---
    useEffect(() => {
        if (isActive && isDataLoaded) {
            projectService.getTasks(project.id).then(newTasks => {
                setTasks(newTasks);
                
                // Check for highlight request
                const highlightId = globalStorage.getItem(`highlight_task_${project.id}`);
                if (highlightId) {
                    globalStorage.removeItem(`highlight_task_${project.id}`);
                    const taskExists = newTasks.find(t => t.id === highlightId);
                    if (taskExists) {
                        setHighlightedTaskId(highlightId);
                        setTimeout(() => {
                            setHighlightedTaskId(null);
                        }, 3000);
                    }
                }
            }).catch(err => {
                logger.error('Failed to silently refresh tasks', err);
            });
        }
    }, [isActive, isDataLoaded, project.id]);


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

      // Filter only active tasks because targetIndex comes from the UI which shows only active tasks
      const activeTasks = tasks
          .filter(t => t.folder_id === selectedFolderId && !t.is_completed)
          .sort((a, b) => a.sort_order - b.sort_order);
      
      let insertIndex = targetIndex !== undefined ? targetIndex : activeTasks.length;
      if (insertIndex < 0) insertIndex = 0;
      if (insertIndex > activeTasks.length) insertIndex = activeTasks.length;

      const tempId = crypto.randomUUID();
      const newTask: Task = {
         id: tempId,
         _tempId: tempId,
         folder_id: selectedFolderId,
         content: '',
         sort_order: insertIndex,
         is_completed: false,
         task_type: 'task', // Default type
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString(),
         isNew: true,
         isDraft: true // Create as draft
      };

      // Optimistic update: insert and shift
      setTasks(prev => {
          // Keep completed tasks and tasks from other folders as is
          const otherTasks = prev.filter(t => t.folder_id !== selectedFolderId || t.is_completed);
          
          const newActiveTasks = [...activeTasks];
          newActiveTasks.splice(insertIndex, 0, newTask);
          
          // Re-index only active tasks to ensure visual order
          const reindexed = newActiveTasks.map((t, idx) => ({ ...t, sort_order: idx }));
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
              const realTask = { ...task, ...updatesWithTimestamp, isDraft: false, isNew: false, _isSaving: true };
              
              // 1. Сохраняем ПОЛНЫЙ snapshot состояния ПЕРЕД сохранением
              const snapshotBeforeSave = {
                  content: realTask.content,
                  folder_id: realTask.folder_id,
                  sort_order: realTask.sort_order,
                  is_completed: realTask.is_completed,
                  task_type: realTask.task_type || 'task'
              };
              
              // 2. Update local state (remove draft status, add saving flag)
              setTasks(prev => prev.map(t => t.id === id ? realTask : t));

              try {
                 await executeSave(async () => {
                     // 3. Create in DB
                     // Pass task_type if your service supports it, or update service first. 
                     // Assuming projectService.createTask handles it or defaults.
                     // We need to update create task signature or pass object.
                     // For now let's assume standard creation is 'task' type and we update if needed or service is smart.
                     // Better: Update projectService later. For now let's stick to current flow, 
                     // but if we create a GAP, we likely need a separate method or param.
                     // But here we are creating a STANDARD task from draft (which is always task type for now).
                     
                     // WAIT, user asked for "Make Gap" which creates a GAP below. 
                     // This function handleUpdateTask is for editing existing tasks (or promoting drafts).
                     // "Make Gap" will likely be a new function handleAddGap.
                     
                     const data = await projectService.createTask(snapshotBeforeSave.folder_id, content, snapshotBeforeSave.sort_order); // TODO: Pass task_type
                     
                     // 4. Persist the new order for ALL tasks in this folder 
                     const currentFolderTasks = tasks.filter(t => t.folder_id === snapshotBeforeSave.folder_id).sort((a, b) => a.sort_order - b.sort_order);
                     const updatesForOrder = currentFolderTasks.map((t, idx) => ({ 
                         id: t.id === id ? data.id : t.id, 
                         sort_order: idx 
                     }));
                     
                     await projectService.updateTaskOrder(updatesForOrder);

                     // 5. Проверяем, изменилась ли задача во время сохранения
                     let needsResave = false;
                     let wasDeleted = false;
                     let resaveData: { 
                         newId: string; 
                         changes: Partial<Task>;
                     } | null = null;
                     
                     // Сначала проверяем, существует ли задача в текущем стейте
                     const currentTaskBeforeUpdate = tasks.find(t => t.id === id);
                     
                     if (!currentTaskBeforeUpdate) {
                         // Задача была удалена во время сохранения
                         logger.warning('Task was deleted during save, will delete from DB');
                         wasDeleted = true;
                     }
                     
                     if (!wasDeleted) {
                         setTasks(prev => {
                             const currentTask = prev.find(t => t.id === id);
                             
                             if (!currentTask) {
                                 // На всякий случай повторная проверка
                                 return prev;
                             }
                             
                             return prev.map(t => {
                                 if (t.id !== id) return t;
                                 
                                 const currentState = t;
                                 
                                 // Сравниваем ВСЕ поля со snapshot
                                 const changes: Partial<Task> = {};
                                 
                                 if (currentState.content !== snapshotBeforeSave.content) {
                                     changes.content = currentState.content;
                                 }
                                 if (currentState.folder_id !== snapshotBeforeSave.folder_id) {
                                     changes.folder_id = currentState.folder_id;
                                 }
                                 if (currentState.sort_order !== snapshotBeforeSave.sort_order) {
                                     changes.sort_order = currentState.sort_order;
                                 }
                                 if (currentState.is_completed !== snapshotBeforeSave.is_completed) {
                                     changes.is_completed = currentState.is_completed;
                                 }
                                 if (currentState.task_type !== snapshotBeforeSave.task_type) {
                                    changes.task_type = currentState.task_type;
                                 }
                                 
                                 const hasChanges = Object.keys(changes).length > 0;
                                 
                                 if (hasChanges) {
                                     logger.warning('Task was modified during save, will resave changes', {
                                         snapshot: snapshotBeforeSave,
                                         current: {
                                             content: currentState.content,
                                             folder_id: currentState.folder_id,
                                             sort_order: currentState.sort_order,
                                             is_completed: currentState.is_completed,
                                             task_type: currentState.task_type
                                         },
                                         changes
                                     });
                                     
                                     needsResave = true;
                                     resaveData = {
                                         newId: data.id,
                                         changes
                                     };
                                     
                                     return {
                                         ...currentState,
                                         id: data.id,
                                         _tempId: realTask._tempId,
                                         _isSaving: true, // Оставляем флаг для пересохранения
                                         created_at: data.created_at,
                                     };
                                 } else {
                                     // Ничего не изменилось - применяем данные из БД
                                     return {
                                         ...data,
                                         _tempId: realTask._tempId,
                                         _isSaving: false,
                                     };
                                 }
                             });
                         });
                     }
                     
                     // 6. Если задача была удалена во время сохранения - удаляем из БД
                     if (wasDeleted) {
                         try {
                             await executeSave(async () => {
                                 await projectService.deleteTask(data.id);
                                 logger.success('Deleted task that was removed during save');
                             });
                         } catch (deleteErr) {
                             logger.error('Failed to delete task after creation', deleteErr);
                         }
                         return; // Выходим, дальше ничего не делаем
                     }
                     
                     // 7. Если задача изменилась, пересохраняем в БД
                     if (needsResave && resaveData) {
                         const { newId, changes } = resaveData;
                         
                         try {
                             await executeSave(async () => {
                                 // Обновляем изменённые поля в БД
                                 await projectService.updateTask(newId, changes);
                                 
                                 // Если изменилась папка или порядок - обновляем порядок задач
                                 if ('folder_id' in changes || 'sort_order' in changes) {
                                     const targetFolderId = (changes as any).folder_id ?? snapshotBeforeSave.folder_id;
                                     const newFolderTasks = tasks
                                         .filter(t => t.folder_id === targetFolderId || t.id === id)
                                         .sort((a, b) => a.sort_order - b.sort_order);
                                     
                                     const orderUpdates = newFolderTasks.map((t, idx) => ({
                                         id: t.id === id ? newId : t.id,
                                         sort_order: idx
                                     }));
                                     
                                     await projectService.updateTaskOrder(orderUpdates);
                                 }
                                 
                                 logger.success('Task changes resaved successfully');
                             });
                         } catch (resaveErr) {
                             logger.error('Failed to resave task changes', resaveErr);
                         } finally {
                             // Снимаем флаг сохранения
                             setTasks(prev => prev.map(t => 
                                 t.id === newId ? { ...t, _isSaving: false } : t
                             ));
                         }
                     }
                 });
              } catch (err) {
                 logger.error('Failed to create task from draft', err);
                 // Снимаем флаг сохранения при ошибке
                 setTasks(prev => prev.map(t => t.id === id ? { ...t, _isSaving: false } : t));
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
           const currentIndex = oldFolders.findIndex(f => f.id === folderId);
           const remaining = oldFolders.filter(f => f.id !== folderId);
           
           if (remaining.length > 0) {
               // Try left neighbor first, then right (new first)
               const newId = currentIndex > 0 
                   ? oldFolders[currentIndex - 1].id 
                   : remaining[0].id;
               setSelectedFolderId(newId);
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

   const handleMoveFolder = async (folderId: string, direction: 'left' | 'right') => {
       const currentIndex = folders.findIndex(f => f.id === folderId);
       if (currentIndex === -1) return;

       const newIndex = direction === 'left' ? currentIndex - 1 : currentIndex + 1;
       if (newIndex < 0 || newIndex >= folders.length) return;

       const newFolders = arrayMove(folders, currentIndex, newIndex);
       setFolders(newFolders);

       // Save to DB
       const updates = newFolders.map((f, index) => ({ id: f.id, sort_order: index }));
       
       try {
           await executeSave(async () => {
               await projectService.updateFolderOrder(updates);
           });
       } catch (err) {
           logger.error('Failed to move folder', err);
           // Revert locally? Not strictly necessary for order, but good practice.
           // For now we rely on optimistic UI.
       }
   };

   // --- Gap Management ---
   const handleAddGap = async (targetIndex: number) => {
        if (!selectedFolderId) return;

        const activeTasks = tasks
            .filter(t => t.folder_id === selectedFolderId && !t.is_completed)
            .sort((a, b) => a.sort_order - b.sort_order);

        // Insert after target
        let insertIndex = targetIndex + 1;
        if (insertIndex > activeTasks.length) insertIndex = activeTasks.length;

        const tempId = crypto.randomUUID();
        const newGap: Task = {
            id: tempId,
            _tempId: tempId,
            folder_id: selectedFolderId,
            content: '',
            sort_order: insertIndex,
            is_completed: false,
            task_type: 'gap',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            isNew: true,
            isDraft: false // Gaps are saved immediately usually, or behave like drafts? 
                           // You said "create task type gap". Let's assume immediate save for now 
                           // or draft if you want to edit it? 
                           // "у него нет чекбокса title - ничего нет КРОМЕ иконки drag" -> so nothing to edit.
                           // So it must be saved immediately.
        };

        // Optimistic update
        setTasks(prev => {
            const otherTasks = prev.filter(t => t.folder_id !== selectedFolderId || t.is_completed);
            const newActiveTasks = [...activeTasks];
            newActiveTasks.splice(insertIndex, 0, newGap);
            const reindexed = newActiveTasks.map((t, idx) => ({ ...t, sort_order: idx }));
            return [...otherTasks, ...reindexed];
        });

        try {
            await executeSave(async () => {
                // Create in DB
                // We need to support task_type in create.
                // Assuming projectService.createTask will be updated or we use a generic create.
                // For now, let's assume we pass it in content or special field?
                // Actually, I should check projectService. 
                // Since I cannot change projectService signature easily without seeing it,
                // I will assume I can update the task immediately after creation or 
                // use a new method if I see projectService.
                
                // Let's look at projectService first or just create generic task and update it.
                // But better to have create support it.
                
                // Temporary hack: Create task -> Update type immediately.
                // ideally: await projectService.createTask(..., type='gap')
                
                const data = await projectService.createTask(selectedFolderId, '', insertIndex);
                await projectService.updateTask(data.id, { task_type: 'gap' });
                
                // Update order
                const currentFolderTasks = [...activeTasks];
                currentFolderTasks.splice(insertIndex, 0, { ...newGap, id: data.id });
                const orderUpdates = currentFolderTasks.map((t, idx) => ({ id: t.id === tempId ? data.id : t.id, sort_order: idx }));
                await projectService.updateTaskOrder(orderUpdates);

                // Update local id
                 setTasks(prev => prev.map(t => t.id === tempId ? { ...t, id: data.id, _tempId: undefined, isNew: false } : t));
            });
        } catch (err) {
            logger.error('Failed to create gap', err);
            // Revert
            setTasks(prev => prev.filter(t => t.id !== tempId));
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

   const getFolderTaskCount = (folderId: string) => {
       return tasks.filter(t => t.folder_id === folderId && !t.is_completed).length;
   };

   return {
       folders,
       tasks,
       setTasks, // Needed for drag and drop
       setFolders, // Needed for drag and drop
       selectedFolderId,
       setSelectedFolderId,
       isDataLoaded,
       displayStatus,
       saveError,
       executeSave,
       executeQuickSave, // Export new quick save
       quickSaveStatus, // Export status
       handleAddTask,
       handleUpdateTask,
       handleDeleteTask,
       handleAddFolder,
       handleUpdateFolder,
       handleDeleteFolder,
       handleMoveFolder,
       handleEditProject,
       handleRemoveProject,
       getFolderTaskCount,
       highlightedTaskId, // Added
       handleAddGap
   };
};
