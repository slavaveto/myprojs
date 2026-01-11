'use client';

import React, { useState, useEffect } from 'react';
import { useQuery } from '@powersync/react';
import { Spinner } from '@heroui/react';
import { ProjectBar, ProjectV3 } from './components/ProjectBar';
import { ProjectView } from './views/ProjectView';
import { FilterView } from './views/FilterView';
import { globalStorage } from '@/utils/storage';

const STORAGE_KEY_ACTIVE_PROJECT = 'v3_active_project_id';

export default function TasksPageV3() {
    const { data: projects, isLoading } = useQuery(`
        SELECT * FROM projects 
        WHERE (is_deleted = 0 OR is_deleted IS NULL)
        AND (is_hidden = 0 OR is_hidden IS NULL)
        AND (parent_proj_id IS NULL OR parent_proj_id = '')
        ORDER BY sort_order
    `);
    
    // Initialize state
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [isInitialized, setIsInitialized] = useState(false);

    // Restore state on mount
    useEffect(() => {
        const storedId = globalStorage.getItem(STORAGE_KEY_ACTIVE_PROJECT);
        if (storedId) {
            setActiveProjectId(storedId);
        } else {
            setActiveProjectId('filter_inbox');
        }
        setIsInitialized(true);
    }, []);

    // Save state on change
    useEffect(() => {
        if (isInitialized && activeProjectId) {
            globalStorage.setItem(STORAGE_KEY_ACTIVE_PROJECT, activeProjectId);
        }
    }, [activeProjectId, isInitialized]);

    if (isLoading || !isInitialized) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-[#1e2329]/80 backdrop-blur-sm">
                 <Spinner size="lg" color="primary" />
            </div>
        );
    }

    // Fallback
    const safeProjects: ProjectV3[] = projects || [];
    const activeProject = safeProjects.find(p => p.id === activeProjectId);
    const isSystemProject = activeProjectId?.startsWith('filter_');

    return (
        <div className="flex h-screen overflow-hidden bg-white text-black">
            <ProjectBar 
                projects={safeProjects}
                activeProjectId={activeProjectId}
                onSelectProject={setActiveProjectId}
            />
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

                {/* Project View (Single instance, switches props, hides if system active) */}
                {activeProject && (
                    <div className={!isSystemProject ? 'contents' : 'hidden'}>
                        <ProjectView 
                            project={activeProject} 
                            isActive={!isSystemProject} 
                        />
                    </div>
                )}

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
    );
}
