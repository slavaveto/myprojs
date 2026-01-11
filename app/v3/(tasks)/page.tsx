'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@powersync/react';
import { Spinner } from '@heroui/react';
import { ProjectBar, ProjectV3 } from './components/ProjectBar';
import { ProjectView } from './views/ProjectView';
import { FilterView } from './views/FilterView';
import { Header } from './components/Header';
import { globalStorage } from '@/utils/storage';
import { clsx } from 'clsx';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('TasksPageV3');

const STORAGE_KEY_ACTIVE_PROJECT = 'v3_active_project_id';

export default function TasksPageV3() {
    // --- QUERY: Projects ---
    const { data: projects, isLoading: isProjectsLoading } = useQuery(`
        SELECT * FROM projects 
        WHERE (is_deleted = 0 OR is_deleted IS NULL)
        AND (is_hidden = 0 OR is_hidden IS NULL)
        AND (parent_proj_id IS NULL OR parent_proj_id = '')
        ORDER BY sort_order
    `);
    
    // --- STATE ---
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [isRestored, setIsRestored] = useState(false);
    const [isMinTimeElapsed, setIsMinTimeElapsed] = useState(false);
    // Stages: 'loading' -> 'fading-out' -> 'gap' -> 'fading-in' -> 'ready'
    const [loadStage, setLoadStage] = useState<'loading' | 'fading-out' | 'gap' | 'fading-in' | 'ready'>('loading');

    // --- EFFECT: Minimum Timer & Restore ---
    useEffect(() => {
        // 1. Start minimum timer (2 seconds)
        const timer = setTimeout(() => {
            setIsMinTimeElapsed(true);
            logger.info('Minimum loading time elapsed');
        }, 2000);

        // 2. Restore active project
        const storedId = globalStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT);
        if (storedId) {
            setActiveProjectId(storedId);
        } else {
            setActiveProjectId('filter_inbox');
        }
        setIsRestored(true);

        return () => clearTimeout(timer);
    }, []);

    // --- QUERY: Preload Folders (for active project) ---
    // This ensures we don't show the app until the active project's content is ready
    const activeProjectIsReal = activeProjectId && !activeProjectId.startsWith('filter_');
    const { data: foldersData } = useQuery(
        activeProjectIsReal 
            ? 'SELECT id FROM folders WHERE project_id = ?' 
            : 'SELECT 1', // Dummy query for system views
        [activeProjectId || '']
    );

    // --- DERIVED: Is Data Ready? ---
    // Ready if: Projects loaded AND (System View OR Folders loaded)
    const isDataReady = !isProjectsLoading && projects !== undefined && foldersData !== undefined;

    // --- EFFECT: Loading Sequence ---
    useEffect(() => {
        // Start sequence only when:
        // 1. Data is fully ready
        // 2. State is restored
        // 3. Minimum time (2s) has elapsed
        if (isDataReady && isRestored && isMinTimeElapsed && loadStage === 'loading') {
            logger.info('Starting fade-in sequence');
            
            // 1. Start Fading Out Spinner
            setLoadStage('fading-out');

            // 2. After fade out duration (300ms) -> Gap
            setTimeout(() => {
                setLoadStage('gap');
                
                // 3. After gap (100ms) -> Start Fading In Content
                setTimeout(() => {
                    setLoadStage('fading-in');
                    
                    // 4. Trigger opacity transition (next tick)
                    requestAnimationFrame(() => {
                        setLoadStage('ready');
                    });
                }, 100); 
            }, 300);
        }
    }, [isDataReady, isRestored, isMinTimeElapsed, loadStage]);

    // Save state on change
    useEffect(() => {
        if (isRestored && activeProjectId) {
            globalStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, activeProjectId);
        }
    }, [activeProjectId, isRestored]);

    // --- RENDER HELPERS ---
    const showSpinner = loadStage === 'loading' || loadStage === 'fading-out';
    const showApp = loadStage === 'fading-in' || loadStage === 'ready';

    const safeProjects: ProjectV3[] = projects || [];
    const activeProject = safeProjects.find(p => p.id === activeProjectId);

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
                    projects={safeProjects}
                    activeProjectId={activeProjectId}
                    onSelectProject={setActiveProjectId}
                />

                {/* MAIN CONTENT AREA */}
                <div className="flex-1 flex flex-col min-w-0 bg-background">
                    
                    {/* HEADER */}
                    <Header activeProject={activeProject} />

                    <main className="flex-grow flex flex-col h-full overflow-hidden bg-white relative">
                        {/* System Views (Always mounted, hidden via CSS) */}
                        <div className={activeProjectId === 'filter_inbox' ? 'contents' : 'hidden'}>
                            <FilterView filterId="filter_inbox" isActive={activeProjectId === 'filter_inbox'} />
                        </div>
                        <div className={activeProjectId === 'filter_today' ? 'contents' : 'hidden'}>
                            <FilterView filterId="filter_today" isActive={activeProjectId === 'filter_today'} />
                        </div>
                        <div className={activeProjectId === 'filter_doing' ? 'contents' : 'hidden'}>
                            <FilterView filterId="filter_doing" isActive={activeProjectId === 'filter_doing'} />
                        </div>
                        <div className={activeProjectId === 'filter_done' ? 'contents' : 'hidden'}>
                            <FilterView filterId="filter_done" isActive={activeProjectId === 'filter_done'} />
                        </div>
                        <div className={activeProjectId === 'filter_logs' ? 'contents' : 'hidden'}>
                            <FilterView filterId="filter_logs" isActive={activeProjectId === 'filter_logs'} />
                        </div>

                        {/* Project Views (All mounted, hidden via CSS) */}
                        {projects?.map(project => (
                            <div key={project.id} className={activeProjectId === project.id ? 'contents' : 'hidden'}>
                                <ProjectView 
                                    project={project} 
                                    isActive={activeProjectId === project.id} 
                                />
                            </div>
                        ))}

                        {/* Fallback (if nothing selected) */}
                        {!activeProjectId && (
                            <div className="flex items-center justify-center h-full text-gray-400">
                                <div className="text-center">
                                    <h2 className="text-xl font-semibold mb-2">Welcome to DaySync V3</h2>
                                    <p className="text-sm">Select a project from the sidebar to get started.</p>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>
        </>
    );
}
