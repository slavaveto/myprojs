import { useState, useEffect, useRef, useMemo } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { createProjectService } from '@/services/supabase/projectService';
import { Project } from '@/app/types';
import { useAppLoader } from '@/app/AppLoader';
import { globalStorage } from '@/utils/storage';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { loadingService } from '@/services/supabase/loadingLogsService';
import { NavigationTarget } from '@/app/components/GlobalSearch';
import { toast } from 'react-hot-toast';
import {
   useSensor,
   useSensors,
   DragEndEvent,
   PointerSensor,
   KeyboardSensor,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates, arrayMove } from '@dnd-kit/sortable';
import { createTaskService, taskUpdateEvents } from '@/services/supabase/taskService';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { useRxDB } from '@/services/rxdb/RxDBProvider';

// Main App Logic Hook
const logger = createLogger('AppManager');

export function usePageLogic() {
   const { supabase } = useSupabase();
   const { db } = useRxDB() as any;
   const taskService = useMemo(() => createTaskService(supabase), [supabase]);
   const projectService = useMemo(() => createProjectService(supabase), [supabase]);

   const [projects, setProjects] = useState<Project[]>([]);
   const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
   const [activeSystemTab, setActiveSystemTab] = useState<string | null>(null); // 'inbox' | 'today' | 'done' | null
   const [projectScreenMode, setProjectScreenMode] = useState<'tasks' | 'docs' | 'admin'>('tasks');
   const [doingNowCount, setDoingNowCount] = useState<number>(0);
   const [doingNowMap, setDoingNowMap] = useState<Record<string, number>>({});
   const [todayCount, setTodayCount] = useState<number>(0);
   const [inboxCount, setInboxCount] = useState<number>(0);
   const { setLoading: setGlobalLoading } = useAppLoader();

   // Словарик готовности проектов: { [projectId]: true }
   const [readyProjects, setReadyProjects] = useState<Record<string, boolean>>({});

   // Флаг первичной инициализации списка проектов
   const [isInit, setIsInit] = useState(false);

   // Флаг, разрешающий фоновую загрузку (когда активный проект готов)
   const [canLoadBackground, setCanLoadBackground] = useState(false);
   const timerRef = useRef<NodeJS.Timeout | null>(null);

   // Status for sidebar actions (reordering)
   const {
      execute: executeSidebarAction,
      status: sidebarStatus,
      error: sidebarError,
   } = useAsyncAction({
      useToast: false,
      minDuration: 500,
      successDuration: 1500,
   });

   // DnD Sensors
   const sensors = useSensors(
      useSensor(PointerSensor, {
         activationConstraint: {
            delay: 0,
            tolerance: 0,
         },
      }),
      useSensor(KeyboardSensor, {
         coordinateGetter: sortableKeyboardCoordinates,
      })
   );

   // 1. Загрузка списка проектов (RxDB)
      useEffect(() => {
         loadingService.logAppInit();

         // Subscribe to projects from RxDB (Filter out deleted)
         const subscription = db.projects.find({
             selector: {
                 is_deleted: { $ne: true }
             }
         }).sort({ sort_order: 'asc' }).$.subscribe(async (projectsData) => {
          // Convert RxDocuments to plain JSON if needed, or use as is (they behave like objects)
          // But our Project type might not match exactly with RxDocument methods
          const plainProjects = projectsData.map(doc => doc.toJSON()) as Project[];
          console.log('RxDB Subscription: Projects received', plainProjects.length);
          
          setProjects(plainProjects);

          // Initialize counters (Doing Now, Today, Inbox) only once or on change?
          // Let's keep the original logic of fetching counters here for now, 
          // although ideally they should also be reactive via RxDB.
          
          // Only init active project logic on FIRST load of data
          if (!isInit && plainProjects.length > 0) {
               const savedId = globalStorage.getItem('active_project_id');
               const projectExists = savedId ? plainProjects.find((p) => p.id === savedId) : null;
               setActiveProjectId(projectExists ? savedId : plainProjects[0].id);
               setIsInit(true); // Mark as initialized
          } else if (!isInit && plainProjects.length === 0) {
              // If empty, maybe we are still syncing? 
              // For now, let's wait. Or if it's truly empty user, we should handle that.
              // But 'isInit' controls the global loader. If we never set it true, loader spins forever.
              // Let's assume if we got a result (even empty), RxDB is ready-ish.
              // But better to wait for at least one project if we expect them.
              // For new users, we might need a timeout or check replication status.
              // Lets set isInit true after a short timeout if still empty?
              setTimeout(() => setIsInit(true), 2000);
          }
      });

      // Keep the old task counters logic for now (it uses Supabase directly via taskService)
      // TODO: Migrate these to RxDB reactive queries later
      const fetchCounters = () => {
            taskService.getDoingNowTasks().then(tasks => {
                setDoingNowCount(tasks?.length || 0);
                const map: Record<string, number> = {};
                (tasks || []).forEach((t: any) => {
                    const pid = t.folders?.projects?.id;
                    if (pid) map[pid] = (map[pid] || 0) + 1;
                });
                setDoingNowMap(map);
            }).catch(err => console.error(err));

            taskService.getTodayTasks().then(tasks => {
                setTodayCount(tasks?.length || 0);
            }).catch(err => console.error(err));

            taskService.getInboxTasks().then(tasks => {
                setInboxCount(tasks?.length || 0);
            }).catch(err => console.error(err));
      };

      fetchCounters();
      const taskUnsub = taskUpdateEvents.subscribe(fetchCounters);

      return () => {
         subscription.unsubscribe();
         taskUnsub(); // Call as function
      };
   }, [db]); // Re-subscribe if db instance changes (should be stable)

   // 2. Управление глобальным лоадером
   useEffect(() => {
      if (!isInit) return; // Еще список не загрузился
      if (!activeProjectId) {
         setGlobalLoading(false); // Нет проектов - нет загрузки
         return;
      }

      const isActiveReady = readyProjects[activeProjectId];

      if (isActiveReady) {
         if (!canLoadBackground && !timerRef.current) {
            loadingService.logTransitionToBackground(200);
            // Small delay to visually separate active load finish from background start
            timerRef.current = setTimeout(() => {
               setGlobalLoading(false);
               setCanLoadBackground(true);
               timerRef.current = null;
               toast.success('Данные успешно загружены');
            }, 200);
         }
      } else {
         if (timerRef.current) {
             clearTimeout(timerRef.current);
             timerRef.current = null;
         }
         setGlobalLoading(true);
         setCanLoadBackground(false);
      }
   }, [isInit, activeProjectId, readyProjects, setGlobalLoading, canLoadBackground]);

   // 3. Лог завершения загрузки всех проектов
   useEffect(() => {
      if (isInit && projects.length > 0) {
         const readyCount = Object.keys(readyProjects).length;
         if (readyCount === projects.length) {
            loadingService.logAllFinished(readyCount);
         }
      }
   }, [readyProjects, projects.length, isInit]);

   const handleProjectReady = (projectId: string) => {
      setReadyProjects((prev) => ({ ...prev, [projectId]: true }));
   };

   const handleCreateProject = async (title: string, color?: string) => {
      try {
         const finalColor = color || '#3b82f6'; // Default blue-500 (matches palette)

         const newProject = await projectService.createProject(title, finalColor, projects.length);
         setProjects((prev) => [...prev, newProject]);

         // Mark as ready immediately to prevent global spinner for new empty project
         setReadyProjects((prev) => ({ ...prev, [newProject.id]: true }));

         // Switch to new project
         setActiveProjectId(newProject.id);
         setActiveSystemTab(null);
         globalStorage.setItem('active_project_id', newProject.id);
      } catch (err) {
         logger.error('Failed to create project', err);
      }
   };

   const handleUpdateProject = async (projectId: string, title: string, color: string, isHighlighted?: boolean, hasUi?: boolean, hasDocs?: boolean) => {
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, title, proj_color: color, is_highlighted: isHighlighted } : p)));
      try {
         await executeSidebarAction(async () => {
            await projectService.updateProject(projectId, { title, proj_color: color, is_highlighted: isHighlighted });
         });

         // Handle Modules
         if (hasUi !== undefined) {
             const uiSat = projects.find(p => p.parent_proj_id === projectId && p.proj_type === 'ui');
             const isUiEnabled = uiSat && !uiSat.is_disabled && !uiSat.is_deleted;
             if (hasUi !== !!isUiEnabled) await handleToggleSatellite(projectId, 'ui', hasUi, true);
         }
         if (hasDocs !== undefined) {
             const docsSat = projects.find(p => p.parent_proj_id === projectId && p.proj_type === 'docs');
             const isDocsEnabled = docsSat && !docsSat.is_disabled && !docsSat.is_deleted;
             if (hasDocs !== !!isDocsEnabled) await handleToggleSatellite(projectId, 'docs', hasDocs, true);
         }
      } catch (err) {
         logger.error('Failed to update project', err);
      }
   };

   const handleToggleSatellite = async (parentId: string, type: 'ui' | 'docs', isEnabled: boolean, silent = false) => {
      const parentProject = projects.find(p => p.id === parentId);
      if (!parentProject) return;

      if (isEnabled) {
         // Check local existence first for Optimistic UI
         const existing = projects.find(p => p.parent_proj_id === parentId && p.proj_type === type);
         
         if (existing) {
            // Optimistic Enable
            if (existing.is_disabled || existing.is_deleted) {
                 setProjects(prev => prev.map(p => p.id === existing.id ? { ...p, is_disabled: false, is_deleted: false } : p));
            } else {
                 return; // Already active
            }
         }

         // Network Request
         try {
             const title = `${parentProject.title} ${type.toUpperCase()}`;
             const color = parentProject.proj_color;
             
             const satellite = await projectService.createSatellite(parentId, type, title, color);
             
             setProjects(prev => {
                const idx = prev.findIndex(p => p.id === satellite.id);
                if (idx !== -1) {
                    return prev.map(p => p.id === satellite.id ? satellite : p);
                }
                return [...prev, satellite];
             });
             
             if (!silent) toast.success(`${type.toUpperCase()} module enabled`);
         } catch (err) {
             // Revert optimistic if needed (complex for 'create', but handled for 'update')
             if (existing) {
                 setProjects(prev => prev.map(p => p.id === existing.id ? { ...p, is_disabled: true } : p));
             }
             logger.error('Failed to create satellite', err);
             if (!silent) toast.error('Failed to enable module');
         }
      } else {
         // Disable
         const satellite = projects.find(p => p.parent_proj_id === parentId && p.proj_type === type);
         if (satellite) {
             // Optimistic Disable
             setProjects(prev => prev.map(p => p.id === satellite.id ? { ...p, is_disabled: true } : p));
             
             // If active, switch immediately
             if (activeProjectId === satellite.id) {
                 setActiveProjectId(parentId);
                 setProjectScreenMode('tasks');
             }

             try {
                 await projectService.disableProject(satellite.id);
                 if (!silent) toast.success(`${type.toUpperCase()} module disabled`);
             } catch (err) {
                 // Revert
                 setProjects(prev => prev.map(p => p.id === satellite.id ? { ...p, is_disabled: false } : p));
                 logger.error('Failed to disable satellite', err);
                 if (!silent) toast.error('Failed to disable module');
             }
         }
      }
   };

   // Pure state update (for when deletion is handled by child component)
   const removeProjectFromState = (projectId: string) => {
      if (activeProjectId === projectId) {
         const currentIndex = projects.findIndex((p) => p.id === projectId);
         const remainingProjects = projects.filter((p) => p.id !== projectId);

         if (remainingProjects.length > 0) {
            const nextProject =
               remainingProjects[currentIndex] ||
               remainingProjects[currentIndex - 1] ||
               remainingProjects[0];
            setActiveProjectId(nextProject.id);
            globalStorage.setItem('active_project_id', nextProject.id);
         } else {
            setActiveProjectId(null);
            setActiveSystemTab('inbox');
            globalStorage.removeItem('active_project_id');
         }
      }

      setProjects((prev) => prev.filter((p) => p.id !== projectId));
   };

   const handleDeleteProject = async (projectId: string) => {
      try {
         await projectService.deleteProject(projectId);
         removeProjectFromState(projectId);
         toast.success('Project deleted');
      } catch (err) {
         logger.error('Failed to delete project', err);
         toast.error('Failed to delete project');
      }
   };

   const handleRestoreTaskFromDone = (task: any) => {
      if (task && task.folders?.projects?.id && task.folders?.id) {
         const projectId = task.folders.projects.id;
         const folderId = task.folders.id;

         logger.info('Restoring task, switching to:', { projectId, folderId });

         // Save target folder to storage so ProjectScreen can pick it up
         globalStorage.setItem(`active_folder_${projectId}`, folderId);

         // Save task ID for highlighting
         globalStorage.setItem(`highlight_task_${projectId}`, task.id);

         // Switch project

         setActiveProjectId(projectId);
         setActiveSystemTab(null);
         globalStorage.setItem('active_project_id', projectId);
      }
   };

   const handleMoveTask = (taskId: string, targetProjectId: string, targetFolderId: string) => {
      logger.info('Moving task, switching to:', {
         projectId: targetProjectId,
         folderId: targetFolderId,
      });

      // Save target folder to storage
      globalStorage.setItem(`active_folder_${targetProjectId}`, targetFolderId);

      // Save task ID for highlighting
      globalStorage.setItem(`highlight_task_${targetProjectId}`, taskId);

      // Switch project
      setActiveProjectId(targetProjectId);
      setActiveSystemTab(null);
      globalStorage.setItem('active_project_id', targetProjectId);
   };

   // --- Global Navigation Handler ---
   const handleNavigate = (target: NavigationTarget) => {
      logger.info('Navigating to:', target);

      if (target.type === 'project' && target.projectId) {
         // Switch to Project
         setActiveProjectId(target.projectId);
         setActiveSystemTab(null);
         globalStorage.setItem('active_project_id', target.projectId);

         if (target.folderId) {
            globalStorage.setItem(`active_folder_${target.projectId}`, target.folderId);
         }

         if (target.taskId) {
            globalStorage.setItem(`highlight_task_${target.projectId}`, target.taskId);
         }
      } else if (target.type === 'inbox') {
         setActiveProjectId(null);
         setActiveSystemTab('inbox');

         if (target.taskId) {
            // Store ID for Inbox highlight
            globalStorage.setItem('highlight_task_inbox', target.taskId);
         }
      } else if (target.type === 'today') {
         setActiveProjectId(null);
         setActiveSystemTab('today');

         if (target.taskId) {
            // Store ID for Today highlight
            globalStorage.setItem('highlight_task_today', target.taskId);
         }
      }
      
      // Refresh count on navigation/action
      taskService.getDoingNowTasks().then(tasks => {
          setDoingNowCount(tasks?.length || 0);
          
          // Group by project
          const map: Record<string, number> = {};
          (tasks || []).forEach((t: any) => {
              const pid = t.folders?.projects?.id;
              if (pid) {
                  map[pid] = (map[pid] || 0) + 1;
              }
          });
          setDoingNowMap(map);
      }).catch(err => console.error(err));

      taskService.getTodayTasks().then(tasks => {
          setTodayCount(tasks?.length || 0);
      }).catch(err => console.error(err));

      taskService.getInboxTasks().then(tasks => {
          setInboxCount(tasks?.length || 0);
      }).catch(err => console.error(err));
   };

   // --- DnD Handlers ---
   const handleDragEnd = async (event: DragEndEvent) => {
      const { active, over } = event;

      if (active.id !== over?.id) {
         setProjects((allProjects) => {
            // 1. Separate visible and hidden (satellite/personal) projects
            const visibleProjects = allProjects.filter(p => p.proj_type !== 'ui' && p.proj_type !== 'docs' && p.proj_type !== 'personal');
            const satelliteProjects = allProjects.filter(p => p.proj_type === 'ui' || p.proj_type === 'docs' || p.proj_type === 'personal');

            // 2. Find indices in the VISIBLE list only
            const oldIndex = visibleProjects.findIndex((i) => i.id === active.id);
            const newIndex = visibleProjects.findIndex((i) => i.id === over?.id);

            // Safety check
            if (oldIndex === -1 || newIndex === -1) return allProjects;

            // 3. Move items within visible list
            const newVisibleProjects = arrayMove(visibleProjects, oldIndex, newIndex);

            // 4. Update sort_order for visible projects
            const updates = newVisibleProjects.map((p, index) => ({ id: p.id, sort_order: index }));

            // 5. Send updates to backend
            executeSidebarAction(async () => {
               await projectService.updateProjectOrder(updates);
            }).catch((err) => {
               logger.error('Failed to reorder projects', err);
            });

            // 6. Merge back: Visible (sorted) + Satellites (unchanged)
            // We put satellites at the end just to keep them out of the way, or keep original relative positions?
            // Since they are never visible in the list, appending them at the end is safest for future index calculations.
            return [...newVisibleProjects, ...satelliteProjects];
         });
      }
   };
   
   // Хелпер для ручного обновления состояния проектов извне (например, из ProjectScreen)
   const updateProjectInState = (projectId: string, updates: Partial<Project>) => {
      setProjects((prev) =>
         prev.map((p) => (p.id === projectId ? { ...p, ...updates } : p))
      );
   };

   return {
      // State
      projects,
      activeProjectId,
      activeSystemTab,
      projectScreenMode,
      isInit,
      canLoadBackground,
      sidebarStatus,
      readyProjects,
      
      // State Setters (если нужны напрямую)
      setActiveProjectId,
      setActiveSystemTab,
      setProjectScreenMode,
      
      // Handlers
      handleCreateProject,
      handleUpdateProject,
      handleDeleteProject,
      removeProjectFromState,
      handleDragEnd,
      handleNavigate,
      handleMoveTask,
      handleRestoreTaskFromDone,
      handleProjectReady,
      updateProjectInState,
      handleToggleSatellite, // Export new handler
      
      doingNowCount, // Export count
      setDoingNowCount, // Export setter for manual refresh
      doingNowMap, // Export map
      
      todayCount,
      setTodayCount,

      inboxCount,
      setInboxCount,

      // Props
      sensors,
   };
}

