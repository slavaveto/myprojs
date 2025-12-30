import { useState, useEffect, useRef } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { projectService } from '@/app/_services/projectService';
import { Project } from '@/app/types';
import { useAppLoader } from '@/app/AppLoader';
import { globalStorage } from '@/utils/storage';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { loadingService } from '@/app/_services/loadingLogsService';
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

const logger = createLogger('AppManager');

export function usePageLogic() {
   const [projects, setProjects] = useState<Project[]>([]);
   const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
   const [activeSystemTab, setActiveSystemTab] = useState<string | null>(null); // 'inbox' | 'today' | 'done' | null
   const [projectScreenMode, setProjectScreenMode] = useState<'tasks' | 'docs'>('tasks');
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
            tolerance: 5,
         },
      }),
      useSensor(KeyboardSensor, {
         coordinateGetter: sortableKeyboardCoordinates,
      })
   );

   // 1. Загрузка списка проектов - триггер
   useEffect(() => {
      // Test New Logger for Highlight Feature
      const testLogger = createLogger('NewFeatureComponent3');
      testLogger.info('This is a new component log!');

      const init = async () => {
         try {
            const projectsData = await projectService.getProjects();
            setProjects(projectsData);

            // Восстановление активного проекта
            if (projectsData.length > 0) {
               const savedId = globalStorage.getItem('active_project_id');
               const projectExists = savedId ? projectsData.find((p) => p.id === savedId) : null;
               setActiveProjectId(projectExists ? savedId : projectsData[0].id);
            }

            setIsInit(true);
         } catch (err) {
            console.error('Failed to load projects', err);
            setGlobalLoading(false);
         }
      };

      loadingService.logAppInit();
      init();
   }, []); // setGlobalLoading стабилен

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

   const handleUpdateProject = async (projectId: string, title: string, color: string) => {
      setProjects((prev) => prev.map((p) => (p.id === projectId ? { ...p, title, color } : p)));
      try {
         await executeSidebarAction(async () => {
            await projectService.updateProject(projectId, { title, color });
         });
      } catch (err) {
         logger.error('Failed to update project', err);
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
   };

   // --- DnD Handlers ---
   const handleDragEnd = async (event: DragEndEvent) => {
      const { active, over } = event;

      if (active.id !== over?.id) {
         setProjects((items) => {
            const oldIndex = items.findIndex((i) => i.id === active.id);
            const newIndex = items.findIndex((i) => i.id === over?.id);

            const newItems = arrayMove(items, oldIndex, newIndex);

            // Save to DB
            const updates = newItems.map((p, index) => ({ id: p.id, sort_order: index }));

            executeSidebarAction(async () => {
               await projectService.updateProjectOrder(updates);
            }).catch((err) => {
               logger.error('Failed to reorder projects', err);
            });

            return newItems;
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
      
      // Props
      sensors,
   };
}

