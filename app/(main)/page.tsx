'use client';

import React, { useEffect, useState } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { supabase } from '@/utils/supabase/supabaseClient';
import { Project } from '@/app/types';
import { clsx } from 'clsx';
import { Button, Spinner } from '@heroui/react';
import { Plus, LayoutGrid } from 'lucide-react';
import { AppLoaderProvider, useAppLoader } from '@/app/AppLoader';
import { ProjectScreen } from '@/app/components/ProjectScreen';
import { globalStorage } from '@/utils/storage';

const logger = createLogger('AppManager');

function AppContent() {
   const [projects, setProjects] = useState<Project[]>([]);
   const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
   const { setLoading: setGlobalLoading } = useAppLoader();
   
   // Словарик готовности проектов: { [projectId]: true }
   const [readyProjects, setReadyProjects] = useState<Record<string, boolean>>({});
   
   // Флаг первичной инициализации списка проектов
   const [isInit, setIsInit] = useState(false);

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
   // Лоадер показываем, пока АКТИВНЫЙ проект не готов.
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

   return (
      <div className="flex h-screen w-full overflow-hidden bg-background">

         {/* Sidebar */}
         <aside className="w-64 flex-shrink-0 border-r border-default-200 bg-content1 flex flex-col z-20">
            <div className="p-4 border-b border-default-200 flex items-center justify-between">
               <div className="flex items-center gap-2 font-bold text-lg">
                  <LayoutGrid size={24} className="text-primary" />
                  <span>Projects</span>
               </div>
               <Button isIconOnly size="sm" variant="light">
                  <Plus size={20} />
               </Button>
            </div>

            <div className="flex-grow overflow-y-auto p-2 space-y-1">
               {projects.map((project) => {
                  const isActive = activeProjectId === project.id;

                  return (
                     <button
                        key={project.id}
                        onClick={() => {
                           setActiveProjectId(project.id);
                           globalStorage.setItem('active_project_id', project.id);
                        }}
                        className={clsx(
                           'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left cursor-pointer',
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
                        <span className="truncate">{project.title}</span>
                     </button>
                  );
               })}
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
