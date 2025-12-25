'use client';

import React, { useEffect, useState } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { supabase } from '@/utils/supabase/supabaseClient';
import { Project } from '@/app/types';
import { Link } from '@heroui/link';
import { usePathname } from 'next/navigation';
import { clsx } from 'clsx';
import { Button, Spinner } from '@heroui/react';
import { Plus, LayoutGrid } from 'lucide-react';
import { AppLoaderProvider, useAppLoader } from '@/app/AppLoader';

const logger = createLogger('AppLayout');

function Sidebar() {
   const [projects, setProjects] = useState<Project[]>([]);
   const pathname = usePathname();

   useEffect(() => {
      loadProjects();
   }, []);

   const loadProjects = async () => {
      try {
         const { data, error } = await supabase
            .from('projects')
            .select('*')
            .order('sort_order', { ascending: true });

         if (error) throw error;
         setProjects(data || []);
      } catch (err) {
         logger.error('Failed to load projects', err);
      }
   };

   return (
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
               const href = `/${project.id}`; // Relative to root since we are in (main)
               // But Link href needs to be absolute or relative to current segment?
               // Since we are at root, `/${project.id}` is correct.
               // Check if pathname matches
               const isActive = pathname === `/${project.id}`;

               return (
                  <Link
                     key={project.id}
                     href={href}
                     className={clsx(
                        'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full',
                        'text-foreground hover:text-foreground no-underline',
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
                  </Link>
               );
            })}
         </div>

         <div className="p-4 border-t border-default-200 text-xs text-default-400 text-center">
            Task Manager v2.0
         </div>
      </aside>
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

export default function MainLayout({ children }: { children: React.ReactNode }) {
   return (
      <AppLoaderProvider>
         <div className="flex h-screen w-full overflow-hidden bg-background">
            <Sidebar />
            <main className="flex-grow flex flex-col h-full overflow-hidden relative">
               {children}
            </main>
            <LoaderOverlay />
         </div>
      </AppLoaderProvider>
   );
}

