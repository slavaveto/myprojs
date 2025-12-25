'use client';

import React, { useEffect, useState } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { supabase } from '@/utils/supabase/supabaseClient';
import { Project } from '@/app/types';
import { clsx } from 'clsx';
import { Button, Spinner } from '@heroui/react';
import { Plus, LayoutGrid, GripVertical } from 'lucide-react';
import { AppLoaderProvider, useAppLoader } from '@/app/AppLoader';
import { ProjectScreen } from '@/app/components/ProjectScreen';
import { globalStorage } from '@/utils/storage';

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
}

const SortableProjectItem = ({ project, isActive, onClick }: SortableProjectItemProps) => {
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
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 10 : 1,
        position: 'relative' as const,
    };

    return (
        <div ref={setNodeRef} style={style} className="w-full mb-1">
             <button
                {...attributes}
                {...listeners}
                onClick={onClick}
                className={clsx(
                   'group flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left cursor-pointer active:cursor-grabbing select-none',
                   'text-foreground',
                   isActive
                      ? 'bg-primary/10 text-primary font-medium'
                      : 'hover:bg-default-100'
                )}
             >
                <div
                   className="w-3 h-3 rounded-full flex-shrink-0"
                   style={{ backgroundColor: project.color }}
                />
                <span className="truncate flex-grow">{project.title}</span>
             </button>
        </div>
    );
};

function AppContent() {
   const [projects, setProjects] = useState<Project[]>([]);
   const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
   const { setLoading: setGlobalLoading } = useAppLoader();
   
   // Словарик готовности проектов: { [projectId]: true }
   const [readyProjects, setReadyProjects] = useState<Record<string, boolean>>({});
   
   // Флаг первичной инициализации списка проектов
   const [isInit, setIsInit] = useState(false);

   // DnD Sensors
   const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor, {
         coordinateGetter: sortableKeyboardCoordinates,
      })
   );

   // 1. Загрузка списка проектов
   useEffect(() => {
      const init = async () => {
         try {
            const { data, error } = await supabase
               .from('projects')
               .select('*')
               .order('sort_order', { ascending: true });

            if (error) throw error;
            
            const projectsData = data || [];
            setProjects(projectsData);
            
            // Восстановление активного проекта
            if (projectsData.length > 0) {
                const savedId = globalStorage.getItem('active_project_id');
                const projectExists = savedId ? projectsData.find(p => p.id === savedId) : null;
                setActiveProjectId(projectExists ? savedId : projectsData[0].id);
            }
            
            setIsInit(true);
         } catch (err) {
            logger.error('Failed to load projects', err);
            setGlobalLoading(false);
         }
      };

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
           setGlobalLoading(false);
       } else {
           setGlobalLoading(true);
       }
   }, [isInit, activeProjectId, readyProjects, setGlobalLoading]);

   const handleProjectReady = (projectId: string) => {
       setReadyProjects(prev => ({ ...prev, [projectId]: true }));
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
               Promise.all(updates.map(u => 
                   supabase.from('projects').update({ sort_order: u.sort_order }).eq('id', u.id)
               )).catch(err => {
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
               <div className="flex items-center gap-2 font-bold text-lg">
                  <LayoutGrid size={24} className="text-primary" />
                  <span>Projects</span>
               </div>
               <Button isIconOnly size="sm" variant="flat" color="success">
                  <Plus size={20} />
               </Button>
            </div>

            <div className="flex-grow overflow-y-auto p-2">
                <DndContext 
                    sensors={sensors} 
                    collisionDetection={closestCenter} 
                    onDragEnd={handleDragEnd}
                    modifiers={[restrictToVerticalAxis]}
                >
                    <SortableContext 
                        items={projects.map(p => p.id)} 
                        strategy={verticalListSortingStrategy}
                    >
                       {projects.map((project) => (
                          <SortableProjectItem 
                              key={project.id}
                              project={project}
                              isActive={activeProjectId === project.id}
                              onClick={() => {
                                 setActiveProjectId(project.id);
                                 globalStorage.setItem('active_project_id', project.id);
                              }}
                          />
                       ))}
                    </SortableContext>
                </DndContext>
            </div>

            <div className="p-4 border-t border-default-200 text-xs text-default-400 text-center">
               Task Manager v2.0
            </div>
         </aside>

         {/* Main Content */}
         <main className="flex-grow flex flex-col h-full overflow-hidden relative">
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
                      onReady={() => handleProjectReady(project.id)}
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
