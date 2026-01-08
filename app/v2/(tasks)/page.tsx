'use client';

import React, { useState, useEffect } from 'react';
import { usePowerSync } from '@/app/_services/powerSync/SyncProvider';
import { useQuery } from '@powersync/react';
import { ProjectBar } from './components/ProjectBar';
import { Header } from './components/Header';
import { ProjectView } from './views/ProjectView';
import { LogsView } from './views/LogsView';
import { DoneView } from './views/DoneView';
import { TodayView } from './views/TodayView';
import { InboxView } from './views/InboxView';
import { DoingNowView } from './views/DoingNowView';
import { Project, Folder } from '@/app/types';
import { globalStorage } from '@/utils/storage';
import { Spinner } from '@heroui/react';
// import { motion, AnimatePresence } from 'framer-motion';

import { clsx } from 'clsx';

const STORAGE_KEYS = {
    ACTIVE_PROJECT: 'v2_active_project_id',
    ACTIVE_SYSTEM_TAB: 'v2_active_system_tab',
};

export default function TasksPage() {
  const powerSync = usePowerSync();
  
  // --- PROJECTS QUERY ---
  const { data: projectsData } = useQuery(`
    SELECT * FROM projects 
    WHERE (is_deleted IS NULL OR is_deleted = 0) 
      AND (is_hidden IS NULL OR is_hidden = 0)
      AND (proj_type IS NULL OR proj_type NOT IN ('info'))
    ORDER BY sort_order ASC
  `);
  const projects: Project[] = projectsData || [];

  // --- STATE ---
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeSystemTab, setActiveSystemTab] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);
  const [isMinTimeElapsed, setIsMinTimeElapsed] = useState(false);
  // Stages: 'loading' -> 'fading-out' -> 'gap' -> 'fading-in' -> 'ready'
  const [loadStage, setLoadStage] = useState<'loading' | 'fading-out' | 'gap' | 'fading-in' | 'ready'>('loading');

  // --- RESTORE STATE ON MOUNT ---
  useEffect(() => {
    // Start minimum timer immediately
    const timer = setTimeout(() => setIsMinTimeElapsed(true), 2000);

    const savedProjId = globalStorage.getItem(STORAGE_KEYS.ACTIVE_PROJECT);
    const savedSysTab = globalStorage.getItem(STORAGE_KEYS.ACTIVE_SYSTEM_TAB);

    // Prioritize Project ID if exists, otherwise System Tab, otherwise 'inbox'
    if (savedProjId && savedProjId !== 'null') {
        setActiveProjectId(savedProjId);
        setActiveSystemTab(null);
    } else if (savedSysTab && savedSysTab !== 'null') {
        setActiveSystemTab(savedSysTab);
        setActiveProjectId(null);
    } else {
        setActiveSystemTab('inbox');
        setActiveProjectId(null);
    }
    setIsRestored(true);
    
    return () => clearTimeout(timer);
  }, []);

  const activeProjectForCheck = activeProjectId; // Use raw ID
  
  // --- PRELOAD ACTIVE FOLDERS ---
  const { data: foldersData } = useQuery(
      activeProjectForCheck 
        ? `SELECT id FROM folders WHERE project_id = ?` 
        : '',
      [activeProjectForCheck || '']
  );
  
  // Ready if:
  // 1. Projects loaded (projectsData !== undefined)
  // 2. Active Project selected AND its folders loaded (foldersData !== undefined)
  // 3. OR No active project selected (system tab or empty)
  const isDataReady = projectsData !== undefined && (!activeProjectForCheck || foldersData !== undefined);

  // --- LOADING SEQUENCE ---
  useEffect(() => {
      // 1. Wait for data & restore (remain in 'loading')
      if (isRestored && projectsData !== undefined) {
          
          // Minimum loading time
          const minLoadTimer = setTimeout(() => {
              // 2. Start Fading Out Spinner
              setLoadStage('fading-out');

              // 3. After fade out duration (300ms) -> Gap
              setTimeout(() => {
                  setLoadStage('gap');
                  // 4. After gap (100ms) -> Start Fading In Content
                  setTimeout(() => {
                      setLoadStage('fading-in');
                    
                      // 5. Trigger opacity transition (next tick)
                      requestAnimationFrame(() => {
                          setLoadStage('ready');
                      });
                  }, 100); 
              }, 300);
          }, 2000); 

          return () => clearTimeout(minLoadTimer);
      }
  }, [isRestored, isDataReady]);

  // --- HANDLERS ---
  const handleSelectProject = (id: string) => {
      setActiveProjectId(id);
      setActiveSystemTab(null);
      globalStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, id);
      globalStorage.setItem(STORAGE_KEYS.ACTIVE_SYSTEM_TAB, 'null');
  };

  const handleSelectSystemTab = (tab: string) => {
      setActiveSystemTab(tab);
      setActiveProjectId(null);
      globalStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, 'null');
      globalStorage.setItem(STORAGE_KEYS.ACTIVE_SYSTEM_TAB, tab);
  };

  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : undefined;
  
  // Render Logic based on Stage
  const showSpinner = loadStage === 'loading' || loadStage === 'fading-out';
  const showApp = loadStage === 'fading-in' || loadStage === 'ready';
  
  return (
    <>
        {/* SPINNER LAYER */}
        {showSpinner && (
            <div 
                className={clsx(
                    "fixed inset-0 z-50 flex items-center justify-center bg-background",
                    "transition-opacity duration-300 ease-in-out",
                    loadStage === 'fading-out' ? "opacity-0" : "opacity-100"
                )}
            >
                <Spinner size="lg" color="primary" />
            </div>
        )}

        {/* MAIN APP CONTENT */}
        <div 
            className={clsx(
                "flex h-screen w-full overflow-hidden bg-background text-foreground font-sans",
                "transition-opacity duration-300 ease-in-out",
                showApp ? "opacity-100" : "opacity-0",
                // Prevent interaction while loading
                !showApp && "pointer-events-none"
            )}
        >
            
            {/* LEFT SIDEBAR (ProjectBar) */}
                <ProjectBar 
                    projects={projects}
                    activeProjectId={activeProjectId}
                    activeSystemTab={activeSystemTab}
                    onSelectProject={handleSelectProject}
                    onSelectSystemTab={handleSelectSystemTab}
                    onCreateProject={() => console.log('Create Project Clicked')}
                />

                {/* MAIN CONTENT AREA */}
                <div className="flex-1 flex flex-col min-w-0 bg-background">
                    
                    {/* UNIFIED HEADER */}
                    <Header 
                        activeProject={activeProject}
                        activeSystemTab={activeSystemTab}
                    />

                    {/* CONTENT AREA: RENDER ALL PROJECTS (Hidden/Block) */}
                    <div className="flex-1 relative overflow-hidden">
                        
                        {/* 1. Projects Views */}
                        {projects.map(project => {
                            const isActive = activeProjectId === project.id;
                            return (
                                <div 
                                    key={project.id} 
                                    className="absolute inset-0 w-full h-full bg-background"
                                    style={{ 
                                        display: isActive ? 'block' : 'none',
                                        zIndex: isActive ? 10 : 0
                                    }}
                                >
                                    {/* Direct render without animation to prevent flickering/jumping */}
                                    <ProjectView 
                                        project={project}
                                        isActive={isActive}
                                    />
                                </div>
                            );
                        })}

                        {/* 2. System Views (Inbox, Today, etc.) */}
                        <div 
                            className="absolute inset-0 w-full h-full bg-background"
                            style={{ display: activeSystemTab === 'logs' ? 'block' : 'none', zIndex: 10 }}
                        >
                            <LogsView isActive={activeSystemTab === 'logs'} />
                        </div>

                        <div 
                            className="absolute inset-0 w-full h-full bg-background"
                            style={{ display: activeSystemTab === 'done' ? 'block' : 'none', zIndex: 10 }}
                        >
                            <DoneView isActive={activeSystemTab === 'done'} />
                        </div>

                        <div 
                            className="absolute inset-0 w-full h-full bg-background"
                            style={{ display: activeSystemTab === 'today' ? 'block' : 'none', zIndex: 10 }}
                        >
                            <TodayView isActive={activeSystemTab === 'today'} />
                        </div>

                        <div 
                            className="absolute inset-0 w-full h-full bg-background"
                            style={{ display: activeSystemTab === 'inbox' ? 'block' : 'none', zIndex: 10 }}
                        >
                            <InboxView isActive={activeSystemTab === 'inbox'} />
                        </div>

                        <div 
                            className="absolute inset-0 w-full h-full bg-background"
                            style={{ display: activeSystemTab === 'doing_now' ? 'block' : 'none', zIndex: 10 }}
                        >
                            <DoingNowView isActive={activeSystemTab === 'doing_now'} />
                        </div>

                        {activeSystemTab && 
                        activeSystemTab !== 'logs' && 
                        activeSystemTab !== 'done' && 
                        activeSystemTab !== 'today' && 
                        activeSystemTab !== 'inbox' && 
                        activeSystemTab !== 'doing_now' && (
                            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-background z-10">
                                <div className="text-center text-default-400">
                                    <h2 className="text-2xl font-bold mb-2 capitalize">{activeSystemTab}</h2>
                                    <p>System view not implemented in v2 yet.</p>
                                </div>
                            </div>
                        )}

                        {/* 3. Empty State */}
                        {!activeProjectId && !activeSystemTab && (
                            <div className="absolute inset-0 w-full h-full flex items-center justify-center bg-background z-10">
                                <div className="text-default-400">Select a project</div>
                            </div>
                        )}

            </div>
        </div>
    </div>
    </>
  );
}
