import { useState, useRef, useEffect } from 'react';
import { Task, Project } from '@/app/types';
import { globalStorage } from '@/utils/storage';
import { toast } from 'react-hot-toast';
import { projectService } from '@/app/_services/projectService';
import { useAsyncAction, ActionStatus } from '@/utils/supabase/useAsyncAction';
import { createLogger } from '@/utils/logger/Logger';
import { useFolderData } from './useFolderData';
import { useTaskData } from './useTaskData';
import { loadingService } from '@/app/_services/loadingService';

const logger = createLogger('ProjectScreenHook');

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

   // --- Use Sub-Hooks ---
   const { 
       folders, 
       setFolders, // Expose for DND if needed
       loadFolders,
       handleAddFolder: addFolderApi,
       handleUpdateFolder,
       handleDeleteFolder: deleteFolderApi,
       handleMoveFolder
   } = useFolderData(project.id, executeSave);

   const {
       tasks,
       setTasks,
       loadTasks,
       handleAddTask,
       handleUpdateTask,
       handleDeleteTask,
       handleAddGap,
       removeTasksForFolder
   } = useTaskData(project.id, selectedFolderId, executeSave);

   useEffect(() => {
       // If already loaded or load initiated, do nothing
       if (isDataLoaded || loadStartedRef.current) return;
       // If not allowed to load (e.g. background project waiting for active one), do nothing
       if (!canLoad) return;

       const load = async () => {
           loadStartedRef.current = true;
           
           if (isActive) {
               loadingService.logActiveProjectStart(project.title);
           } else {
               loadingService.logBackgroundProjectStart(project.title);
           }
           
           try {
               await loadData();
               
               // Artificial delay to separate active load from background load logs/process
               if (isActive) {
                   await new Promise(resolve => setTimeout(resolve, 100));
               }
               
               if (isActive) {
                   loadingService.logActiveProjectFinish(project.title);
               } else {
                   loadingService.logBackgroundProjectFinish(project.title);
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

    // --- Check for highlighted task ---
    useEffect(() => {
        if (isActive && isDataLoaded) {
            const highlightKey = `highlight_task_${project.id}`;
            const taskIdToHighlight = globalStorage.getItem(highlightKey);

            if (taskIdToHighlight) {
                logger.info('Highlighting restored task', { taskId: taskIdToHighlight });
                setHighlightedTaskId(taskIdToHighlight);
                
                // Clear storage immediately so it doesn't highlight again on refresh
                globalStorage.removeItem(highlightKey);

                // Clear highlight after delay
                setTimeout(() => {
                    setHighlightedTaskId(null);
                }, 2000); // 2 seconds highlight
            }
        }
    }, [isActive, isDataLoaded, project.id]);

    // --- Silent Refresh when becoming active ---
    useEffect(() => {
        if (isActive && isDataLoaded) {
            // Use taskService directly or expose refresh method in hook?
            // Hook exposes loadTasks, but that replaces state.
            // Let's use loadTasks and merge logic inside hook if needed, or just let it refresh.
            // But here we had custom merge logic. Ideally move to useTaskData as 'refreshTasks'.
            // For now, let's just reload.
            loadTasks(); 
        }
    }, [isActive, isDataLoaded, project.id]);


   const loadData = async () => {
      // Parallel loading using sub-hook method
      const [foldersData, tasksData] = await Promise.all([
          loadFolders(), 
          loadTasks()
      ]);

      if (foldersData.length > 0) {
         const savedFolderId = globalStorage.getItem(`active_folder_${project.id}`);
         const folderExists = savedFolderId ? foldersData.find((f: any) => f.id === savedFolderId) : null;
         
         setSelectedFolderId(folderExists ? savedFolderId! : foldersData[0].id);
      }

      setIsDataLoaded(true);
   };

   // --- Actions (Removed duplicated task logic) ---


   // --- Folder Coordination ---
   const handleAddFolder = async (title: string) => {
       const createdFolder = await addFolderApi(title);
       if (createdFolder) {
           setSelectedFolderId(createdFolder.id);
       }
   };

   const handleDeleteFolder = async (folderId: string) => {
       const oldFolders = [...folders];
       
       // Coordinate selection change BEFORE delete happens
       if (selectedFolderId === folderId) {
           const currentIndex = oldFolders.findIndex(f => f.id === folderId);
           const remaining = oldFolders.filter(f => f.id !== folderId);
           
           if (remaining.length > 0) {
               const newId = currentIndex > 0 
                   ? oldFolders[currentIndex - 1].id 
                   : remaining[0].id;
               setSelectedFolderId(newId);
           } else {
               setSelectedFolderId('');
           }
       }

       // Assume tasks logic: remove local tasks for this folder
       const oldTasks = [...tasks]; // We don't have access to set oldTasks state easily to revert
       // But we can call helper
       removeTasksForFolder(folderId);

       const success = await deleteFolderApi(folderId);
       
       if (!success) {
           // Rollback tasks if folder delete failed
           // setTasks(oldTasks); // Can't easily revert tasks state from here without exposing setTasks fully
           // But folder delete failures are rare. 
           // If needed, we can reload tasks.
           loadTasks();
       }
   };

   // --- Gap Management ---
   // (Removed duplicated gap logic)


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
       handleAddFolder,   // NEW from hook
       handleUpdateFolder,// NEW from hook
       handleDeleteFolder,// NEW from hook (wrapped)
       handleMoveFolder,  // NEW from hook
       handleEditProject,
       handleRemoveProject,
       getFolderTaskCount,
       highlightedTaskId, 
       handleAddGap
   };
};
