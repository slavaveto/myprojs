'use client';

import React, { useEffect, useState } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { projectService } from '@/app/_services/projectService';
import { Project } from '@/app/types';
import { clsx } from 'clsx';
import { Button, Spinner } from '@heroui/react';
import { Plus, LayoutGrid, GripVertical, Inbox, Calendar, CheckCircle2, FileText, EllipsisVertical, Star } from 'lucide-react';
import { AppLoaderProvider, useAppLoader } from '@/app/AppLoader';
import { ProjectScreen } from '@/app/components/ProjectScreen';
import { CreateItemPopover } from '@/app/components/CreateItem';
import { LogsScreen } from '@/app/components/LogsScreen';
import { DoneScreen } from '@/app/components/DoneScreen';
import { TodayScreen } from '@/app/components/TodayScreen';
import { InboxScreen } from '@/app/components/InboxScreen';
import { SystemScreen } from '@/app/components/SystemScreen';
import { globalStorage } from '@/utils/storage';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { EditProjectPopover } from '@/app/components/EditProject';
import { toast } from 'react-hot-toast';
import { loadingService } from '@/app/_services/loadingService';

// DnD Imports
import {
   DndContext,
   closestCenter,
   KeyboardSensor,
   PointerSensor,
   useSensor,
   useSensors,
   DragEndEvent,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
   arrayMove,
   SortableContext,
   sortableKeyboardCoordinates,
   verticalListSortingStrategy,
   useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const logger = createLogger('AppManager');

// --- Sortable Project Item Component ---
interface SortableProjectItemProps {
    project: Project;
    isActive: boolean;
    onClick: () => void;
    children?: React.ReactNode;
}

const SortableProjectItem = ({ project, isActive, onClick, children }: SortableProjectItemProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: project.id });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: 1, // Keep full opacity
        zIndex: isDragging ? 10 : 1,
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} className="w-full mb-1 group relative">
             <button
                {...attributes}
                {...listeners}
                onClick={onClick}
                className={clsx(
                   'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left select-none pr-9',
                   
                   // Dragging state (cursor, z-index, ring)
                   isDragging && 'cursor-grabbing z-20 ring-1 ring-primary/30',
                   
                   // Hover state (handled via group-hover on parent to keep highlight when hovering actions)
                   !isDragging && !isActive && 'cursor-pointer group-hover:bg-default-100',
                   !isDragging && isActive && 'cursor-pointer',

                   // Colors and Backgrounds
                   isDragging 
                       ? clsx('bg-default-100', isActive ? 'text-primary font-medium' : 'text-foreground')
                       : isActive 
                           ? 'bg-primary/10 text-primary font-medium'
                           : 'text-foreground'
                )}
             >
                <div
                   className="w-3 h-3 rounded-full flex-shrink-0"
                   style={{ backgroundColor: project.color || '#3b82f6' }} // Default blue-500
                />
                <span className="truncate flex-grow">{project.title}</span>
             </button>

            {children && (
                <div 
                    className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => e.stopPropagation()}
                >
                    {children}
                </div>
            )}
        </div>
    );
};

// --- Helper for System Tabs ---
const SidebarItem = ({ icon: Icon, label, onClick, isActive }: { icon: any, label: string, onClick?: () => void, isActive?: boolean }) => (
    <button
        onClick={onClick}
        className={clsx(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left cursor-pointer select-none mb-1',
            'text-foreground',
            isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-default-100'
        )}
    >
        <Icon size={20} className={isActive ? "text-primary" : "text-default-500"} />
        <span className="truncate flex-grow">{label}</span>
    </button>
);

function AppContent() {
   const [projects, setProjects] = useState<Project[]>([]);
   const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
   const [activeSystemTab, setActiveSystemTab] = useState<string | null>(null); // 'inbox' | 'today' | 'done' | null
   const { setLoading: setGlobalLoading } = useAppLoader();
   
   // Словарик готовности проектов: { [projectId]: true }
   const [readyProjects, setReadyProjects] = useState<Record<string, boolean>>({});
   
   // Флаг первичной инициализации списка проектов
   const [isInit, setIsInit] = useState(false);
   
   // Флаг, разрешающий фоновую загрузку (когда активный проект готов)
   const [canLoadBackground, setCanLoadBackground] = useState(false);

   // Status for sidebar actions (reordering)
   const { execute: executeSidebarAction, status: sidebarStatus, error: sidebarError } = useAsyncAction({
       useToast: false,
       minDuration: 500,
       successDuration: 1500,
   });

   // DnD Sensors
   const sensors = useSensors(
      useSensor(PointerSensor, {
         activationConstraint: {
             delay: 150,
             tolerance: 5,
         },
     }),
      useSensor(KeyboardSensor, {
         coordinateGetter: sortableKeyboardCoordinates,
      })
   );

   // 1. Загрузка списка проектов
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
                const projectExists = savedId ? projectsData.find(p => p.id === savedId) : null;
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
           if (!canLoadBackground) {
               loadingService.logTransitionToBackground(200);
               // Small delay to visually separate active load finish from background start
               setTimeout(() => {
                   setGlobalLoading(false);
                   setCanLoadBackground(true);
               }, 200);
           }
       } else {
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
       setReadyProjects(prev => ({ ...prev, [projectId]: true }));
   };

   const handleCreateProject = async (title: string, color?: string) => {
       try {
           const finalColor = color || '#3b82f6'; // Default blue-500 (matches palette)
           
           const newProject = await projectService.createProject(title, finalColor, projects.length);
           setProjects(prev => [...prev, newProject]);
           
           // Mark as ready immediately to prevent global spinner for new empty project
           setReadyProjects(prev => ({ ...prev, [newProject.id]: true }));
           
           // Switch to new project
           setActiveProjectId(newProject.id);
           setActiveSystemTab(null);
           globalStorage.setItem('active_project_id', newProject.id);
       } catch (err) {
           logger.error('Failed to create project', err);
       }
   };

   const handleUpdateProject = async (projectId: string, title: string, color: string) => {
       setProjects(prev => prev.map(p => p.id === projectId ? { ...p, title, color } : p));
       try {
           await executeSidebarAction(async () => {
               await projectService.updateProject(projectId, { title, color });
           });
       } catch (err) {
           logger.error('Failed to update project', err);
       }
   };

   const handleDeleteProject = async (projectId: string) => {
       try {
           await projectService.deleteProject(projectId);
           
           if (activeProjectId === projectId) {
                const currentIndex = projects.findIndex(p => p.id === projectId);
                const remainingProjects = projects.filter(p => p.id !== projectId);
                
                if (remainingProjects.length > 0) {
                     const nextProject = remainingProjects[currentIndex] || remainingProjects[currentIndex - 1] || remainingProjects[0];
                     setActiveProjectId(nextProject.id);
                     globalStorage.setItem('active_project_id', nextProject.id);
                } else {
                     setActiveProjectId(null);
                     setActiveSystemTab('inbox');
                     globalStorage.removeItem('active_project_id');
                }
           }
           
           setProjects(prev => prev.filter(p => p.id !== projectId));
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
               }).catch(err => {
                   logger.error('Failed to reorder projects', err);
               });

               return newItems;
           });
       }
   };

   return (
      <div className="flex h-screen w-full overflow-hidden bg-background">

         {/* Sidebar */}
         <aside className="w-64 flex-shrink-0 border-r border-default-200 bg-content1 flex flex-col z-20">
            <div className="p-4 border-b border-default-200 flex items-center justify-between">

               <div className="flex items-center gap-2 font-bold text-lg min-w-0">
                  <LayoutGrid size={24} className="text-primary flex-shrink-0" />
                  <span className="truncate">Projects</span>
               </div>
               
               <CreateItemPopover 
                   title="New Project" 
                   inputPlaceholder="Project Name"
                   onCreate={handleCreateProject}
                   placement="right"
                   withColorPicker={true}
               >
                   <Button isIconOnly size="sm" variant="flat" color="success">
                      <Plus size={20} />
                   </Button>
               </CreateItemPopover>
            </div>

            <div className="flex-grow overflow-y-auto p-2">
                
                {/* System Tabs Top */}
                <div className="mb-5">
                    <SidebarItem 
                        icon={Inbox} 
                        label="Inbox" 
                        isActive={activeSystemTab === 'inbox'}
                        onClick={() => {
                            setActiveSystemTab('inbox');
                            setActiveProjectId(null);
                        }} 
                    />
                    <SidebarItem 
                        icon={Star} 
                        label="Today" 
                        isActive={activeSystemTab === 'today'}
                        onClick={() => {
                            setActiveSystemTab('today');
                            setActiveProjectId(null);
                        }} 
                    />
                </div>

                <div className="px-2 pb-2 text-xs font-semibold text-default-400 uppercase tracking-wider">
                    My Projects
                </div>

                <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis]}
                >
                    <SortableContext 
                        items={projects.map((p: Project) => p.id)} 
                        strategy={verticalListSortingStrategy}
                    >
                       {projects.map((project) => (
                          <SortableProjectItem 
                              key={project.id}
                              project={project}
                              isActive={activeProjectId === project.id}
                              onClick={() => {
                                 setActiveProjectId(project.id);
                                 setActiveSystemTab(null);
                                 globalStorage.setItem('active_project_id', project.id);
                              }}
                          >
                                <EditProjectPopover 
                                    initialTitle={project.title}
                                    initialColor={project.color}
                                    onUpdate={(t, c) => handleUpdateProject(project.id, t, c)}
                                    onDelete={() => handleDeleteProject(project.id)}
                                >
                                    <button 
                                        type="button"
                                        className="w-8 h-8 flex items-center justify-center text-default-400 hover:text-primary transition-colors outline-none cursor-pointer"
                                    >
                                        <EllipsisVertical size={18} />
                                    </button>
                                </EditProjectPopover>
                          </SortableProjectItem>
                       ))}
                    </SortableContext>
                </DndContext>

                <div className="pt-5">

                <SidebarItem 
                    icon={CheckCircle2} 
                    label="Done" 
                    isActive={activeSystemTab === 'done'}
                    onClick={() => {
                        setActiveSystemTab('done');
                        setActiveProjectId(null);
                    }} 
                />

                 <SidebarItem 
                    icon={FileText} 
                    label="Logs" 
                    isActive={activeSystemTab === 'logs'}
                    onClick={() => {
                        setActiveSystemTab('logs');
                        setActiveProjectId(null);
                    }} 
                />
                 
            </div>
            </div>

            
         </aside>

         {/* Main Content */}
         <main className="flex-grow flex flex-col h-full overflow-hidden relative">
            {/* System Screens */}
            <div 
               className={clsx(
                  "absolute inset-0 w-full h-full bg-background transition-opacity duration-300",
                  activeSystemTab === 'logs' ? "z-30 opacity-100 pointer-events-auto" : "z-0 opacity-0 pointer-events-none"
               )}
            >
                {/* System Screen: Logs */}
                <LogsScreen 
                    globalStatus={sidebarStatus} 
                    canLoad={canLoadBackground || activeSystemTab === 'logs'} 
                    isActive={activeSystemTab === 'logs'}
                />
            </div>
            
            <div 
               className={clsx(
                  "absolute inset-0 w-full h-full bg-background transition-opacity duration-300",
                  activeSystemTab === 'inbox' ? "z-30 opacity-100 pointer-events-auto" : "z-0 opacity-0 pointer-events-none"
               )}
            >
                <InboxScreen 
                    globalStatus={sidebarStatus} 
                    canLoad={canLoadBackground || activeSystemTab === 'inbox'} 
                    isActive={activeSystemTab === 'inbox'}
                />
            </div>

            <div 
               className={clsx(
                  "absolute inset-0 w-full h-full bg-background transition-opacity duration-300",
                  activeSystemTab === 'today' ? "z-30 opacity-100 pointer-events-auto" : "z-0 opacity-0 pointer-events-none"
               )}
            >
                <TodayScreen globalStatus={sidebarStatus} canLoad={canLoadBackground || activeSystemTab === 'today'} isActive={activeSystemTab === 'today'} />
            </div>

            <div 
               className={clsx(
                  "absolute inset-0 w-full h-full bg-background transition-opacity duration-300",
                  activeSystemTab === 'done' ? "z-30 opacity-100 pointer-events-auto" : "z-0 opacity-0 pointer-events-none"
               )}
            >
                <DoneScreen 
                    globalStatus={sidebarStatus} 
                    canLoad={canLoadBackground || activeSystemTab === 'done'} 
                    isActive={activeSystemTab === 'done'}
                    onRestoreTask={handleRestoreTaskFromDone}
                />
            </div>
            
            {projects.map((project) => (
               <div
                  key={project.id}
                  className={clsx(
                     "absolute inset-0 w-full h-full bg-background transition-opacity duration-300",
                     activeProjectId === project.id 
                        ? "opacity-100 z-10 pointer-events-auto" 
                        : "opacity-0 z-0 pointer-events-none"
                  )}
               >
                  <ProjectScreen 
                      project={project} 
                      isActive={activeProjectId === project.id}
                      canLoad={activeProjectId === project.id || canLoadBackground}
                      onReady={() => handleProjectReady(project.id)}
                      globalStatus={sidebarStatus}
                      onUpdateProject={(updates) => {
                          setProjects(prev => prev.map(p => p.id === project.id ? { ...p, ...updates } : p));
                      }}
                      onDeleteProject={() => {
                          const currentIndex = projects.findIndex(p => p.id === project.id);
                          const remainingProjects = projects.filter(p => p.id !== project.id);
                          setProjects(remainingProjects);
                          
                          // Switch to nearest project or Inbox
                          if (remainingProjects.length > 0) {
                              // Try next project, otherwise previous
                              const nextProject = remainingProjects[currentIndex] || remainingProjects[currentIndex - 1];
                              if (nextProject) {
                                  setActiveProjectId(nextProject.id);
                                  globalStorage.setItem('active_project_id', nextProject.id);
                              } else {
                                  // Should not happen if length > 0
                                  setActiveProjectId(remainingProjects[0].id);
                                  globalStorage.setItem('active_project_id', remainingProjects[0].id);
                              }
                          } else {
                              setActiveProjectId(null);
                              setActiveSystemTab('inbox'); // Fallback to Inbox
                              globalStorage.removeItem('active_project_id');
                          }
                      }}
                  />
               </div>
            ))}
            
            {projects.length === 0 && isInit && (
                <div className="flex items-center justify-center h-full text-default-400">
                    No projects found. Create one to get started.
                </div>
            )}
         </main>
      </div>
   );
}

function LoaderOverlay() {
   const { isLoading } = useAppLoader();
   
   return (
      <div 
         className={clsx(
            "fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-[9999] transition-opacity duration-300",
            isLoading ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
         )}
      >
         <Spinner size="lg" label="Loading Workspace..." color="primary" />
      </div>
   );
}

export default function MainPage() {
   return (
      <AppLoaderProvider>
         <AppContent />
         <LoaderOverlay />
      </AppLoaderProvider>
   );
}
