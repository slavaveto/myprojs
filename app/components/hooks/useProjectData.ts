import { useState, useRef, useEffect, useMemo } from 'react';
import { Task, Project } from '@/app/types';
import { globalStorage } from '@/utils/storage';
import { toast } from 'react-hot-toast';
import { createProjectService } from '@/services/supabase/projectService';
import { createTaskService } from '@/services/supabase/taskService';
import { createFolderService } from '@/services/supabase/folderService';
import { useAsyncAction, ActionStatus } from '@/utils/supabase/useAsyncAction';
import { createLogger } from '@/utils/logger/Logger';
import { useFolderData } from './useFolderData';
import { useTaskData } from './useTaskData';
import { loadingService } from '@/services/supabase/loadingLogsService';
import { NavigationTarget } from '@/app/components/GlobalSearch';
import { getProjectClient } from '@/utils/supabase/projectClientFactory';
import { createRemoteFolderService, createRemoteTaskService } from '@/services/supabase/remoteServices';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { DB_TABLES } from '@/utils/supabase/db_tables';
import { useRxDB } from '@/services/rxdb/RxDBProvider';
import { RxFolderAdapter } from '@/services/rxdb/adapters/folderAdapter';
import { RxTaskAdapter } from '@/services/rxdb/adapters/taskAdapter';
import { RxProjectAdapter } from '@/services/rxdb/adapters/projectAdapter';
import { Folder } from '@/app/types';

const logger = createLogger('ProjectScreenHook');

interface UseProjectDataProps {
    project: Project;
    isActive: boolean;
    onReady: () => void;
    canLoad?: boolean;
    onUpdateProject: (updates: { title?: string; proj_color?: string; is_highlighted?: boolean; hasUi?: boolean; hasDocs?: boolean }) => void;
    onDeleteProject: () => void;
    globalStatus?: ActionStatus;
    onNavigate?: (target: NavigationTarget) => void;
}

// Export updated types
export const useProjectData = ({ project, isActive, onReady, canLoad = true, onUpdateProject, onDeleteProject, globalStatus = 'idle', onNavigate }: UseProjectDataProps) => {
   const { supabase } = useSupabase();
   const db = useRxDB();
   
   // RxDB Data
   const [rxFolders, setRxFolders] = useState<Folder[] | undefined>(undefined);
   const [rxTasks, setRxTasks] = useState<Task[] | undefined>(undefined);

   // Adapters for RxDB (Write operations)
   const rxFolderService = useMemo(() => new RxFolderAdapter(db), [db]);
   const rxTaskService = useMemo(() => new RxTaskAdapter(db), [db]);
   const rxProjectService = useMemo(() => new RxProjectAdapter(db), [db]);

   // Create local services (Deprecated for read, used for fallback?) 
   const localProjectService = useMemo(() => createProjectService(supabase), [supabase]);
   const localTaskService = useMemo(() => createTaskService(supabase), [supabase]);
   const localFolderService = useMemo(() => createFolderService(supabase), [supabase]);
   
   // Determine which Project Service to use (RxDB for local, Supabase for remote logic mostly)
   const projectService = (project.proj_type !== 'ui' && !project.remote_proj_slug) 
       ? rxProjectService 
       : localProjectService;

   const [selectedFolderId, setSelectedFolderId] = useState<string>('');
   const [isDataLoaded, setIsDataLoaded] = useState(false);
   const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);
   const [projectsStructure, setProjectsStructure] = useState<any[]>([]);
   
   // Remote Client State
   const [remoteServices, setRemoteServices] = useState<{ taskService: any, folderService: any } | null>(null);

   const loadStartedRef = useRef(false);

   // --- RxDB Subscriptions (Local Only) ---
   useEffect(() => {
       const isLocalProject = project.proj_type !== 'ui' && !project.remote_proj_slug;
       if (!isLocalProject) {
           setRxFolders(undefined);
           setRxTasks(undefined);
           return;
       }

       // 1. Subscribe to Folders
       const folderSub = db.folders.find({
           selector: {
               project_id: project.id,
               is_deleted: { $ne: true }
           },
           sort: [{ sort_order: 'asc' }]
       }).$.subscribe(folders => {
           const mapped = folders.map(d => d.toJSON()) as Folder[];
           console.log(`RxDB ProjectData: Loaded ${mapped.length} folders for project ${project.id}`);
           setRxFolders(mapped);
       });

       return () => folderSub.unsubscribe();
   }, [db, project.id, project.proj_type, project.remote_proj_slug]);

       // 2. Subscribe to Tasks (Dependent on Folders)
       useEffect(() => {
           const isLocalProject = project.proj_type !== 'ui' && !project.remote_proj_slug;
           if (!isLocalProject || !rxFolders) return; // Wait for folders

           const folderIds = new Set(rxFolders.map(f => f.id));
           
           // Query ALL active tasks and filter in JS (Workaround for Dexie non-indexed $in issue)
           // Efficient enough for < 5000 tasks
           const taskSub = db.tasks.find({
               selector: {
                   is_deleted: { $ne: true }
               }
           }).$.subscribe(allTasks => {
               const projectTasks = allTasks
                   .map(d => d.toJSON() as Task)
                   .filter(t => t.folder_id && folderIds.has(t.folder_id));
               
               console.log(`RxDB ProjectData: Mapped ${projectTasks.length} tasks for project`);
               setRxTasks(projectTasks);
           });

           return () => taskSub.unsubscribe();
       }, [db, rxFolders, project.id, project.proj_type]);

   // --- Initialize Services (Local vs Remote) ---
   useEffect(() => {
       const initServices = async () => {
           let slug = null;

           // If UI project, try to get slug from parent
           if (project.proj_type === 'ui' && project.parent_proj_id) {
               try {
                   const remoteSlug = await projectService.getProjectSlug(project.parent_proj_id);
                   if (remoteSlug) {
                       slug = remoteSlug;
                   }
               } catch (e) {
                   logger.error('Failed to fetch parent project slug', e);
               }
           }

           // If UI project, we need remote client
           if (project.proj_type === 'ui' && slug) {
               try {
                   const client = await getProjectClient(slug);
                   if (client) {
                       setRemoteServices({
                           taskService: createRemoteTaskService(client, true), // isUi = true
                           folderService: createRemoteFolderService(client, true) // isUi = true
                       });
                   } else {
                       logger.error('Failed to initialize remote client for UI project');
                       // Fallback to local? Or error state?
                       // For now, if failed, hooks below will crash if we don't handle null.
                       // We should probably show an error UI.
                   }
               } catch (e) {
                   logger.error('Error initializing remote client', e);
               }
           } else {
               // Local project - use RxDB Adapters
               setRemoteServices({
                   taskService: rxTaskService,
                   folderService: rxFolderService
               });
           }
       };

       initServices();
   }, [project.id, project.proj_type, project.remote_proj_slug, project.parent_proj_id, supabase, rxTaskService, rxFolderService]);

   useEffect(() => {
       projectService.getProjectsWithFolders()
           .then(data => setProjectsStructure(data || []))
           .catch(err => logger.error('Failed to load projects structure', err));
   }, [projectService]);

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

   // --- Use Sub-Hooks (Only when services are ready) ---
   
   const activeServices = remoteServices || { taskService: localTaskService, folderService: localFolderService };

   const { 
       folders, 
       setFolders, 
       loadFolders,
       handleAddFolder: addFolderApi,
       handleUpdateFolder,
       handleDeleteFolder: deleteFolderApi,
       handleMoveFolder
   } = useFolderData(project.id, executeSave, activeServices.folderService, rxFolders); // Pass rxFolders

   const {
       tasks,
       setTasks,
       loadTasks,
       handleAddTask,
       handleUpdateTask,
       handleDeleteTask,
       handleAddGap,
       removeTasksForFolder
   } = useTaskData(
       project.id, 
       selectedFolderId, 
       executeSave, 
       activeServices.taskService,
       project.proj_type === 'ui', // Pass isUiProject flag
       rxTasks // Pass rxTasks
   );

   useEffect(() => {
       // Only start loading when services are initialized (for remote projects)
       if (project.proj_type === 'ui' && !remoteServices) return;

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
   }, [isActive, project.id, isDataLoaded, canLoad, remoteServices]);

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
            // For now, let's use the loadTasks directly as it seems to handle state replacement.
            // Note: If user was editing, this might overwrite. But we assume single user per local session mostly.
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


   // --- Move Task ---
   const handleMoveTask = async (taskId: string, targetProjectId: string, folderId: string) => {
       try {
           // Optimistic update
           setTasks(prev => prev.filter(t => t.id !== taskId));
           
           // Use unified helper (we need to inject active service for cross-project move? 
           // Or assume default service for cross-project? 
           // For now, let's use the active task service from hook props/state
           await activeServices.taskService.moveTaskToFolder(taskId, folderId);
           logger.success('Task moved to project');
           
           // Switch to target project if different
           if (targetProjectId !== project.id && onNavigate) {
                onNavigate({
                    type: 'project',
                    projectId: targetProjectId,
                    folderId: folderId,
                    taskId: taskId
                });
           } else if (targetProjectId !== project.id) {
               // Fallback if no navigation handler
               globalStorage.setItem(`highlight_task_${targetProjectId}`, taskId);
               globalStorage.setItem(`active_folder_${targetProjectId}`, folderId);
           }

       } catch (err) {
           logger.error('Failed to move task', err);
           loadTasks(); // Revert
       }
   };



   // --- Project Actions ---
   const handleEditProject = async (title: string, color: string, isHighlighted: boolean, hasUi: boolean, hasDocs: boolean) => {
       try {
           await executeSave(async () => {
               await projectService.updateProject(project.id, { title, proj_color: color, is_highlighted: isHighlighted });
               onUpdateProject({ title, proj_color: color, is_highlighted: isHighlighted, hasUi, hasDocs });
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
       return tasks.filter(t => 
           t.folder_id === folderId && 
           !t.is_completed && 
           t.task_type !== 'gap' && 
           t.task_type !== 'group'
       ).length;
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
       handleAddGap,
       projectsStructure,
       handleMoveTask,
       activeServices
   };
};
