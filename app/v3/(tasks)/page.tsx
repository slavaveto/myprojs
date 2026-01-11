'use client';

import React, { useState } from 'react';
import { useQuery } from '@powersync/react';
import { Spinner } from '@heroui/react';
import { ProjectBar, ProjectV3 } from './components/ProjectBar';
import { ProjectView } from './views/ProjectView';

export default function TasksPageV3() {
    const { data: projects, isLoading } = useQuery(`
        SELECT * FROM projects 
        WHERE (is_deleted = 0 OR is_deleted IS NULL)
        AND (is_hidden = 0 OR is_hidden IS NULL)
        AND (parent_proj_id IS NULL OR parent_proj_id = '')
        ORDER BY sort_order
    `);
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-white/80 dark:bg-[#1e2329]/80 backdrop-blur-sm">
                 <Spinner size="lg" color="primary" />
            </div>
        );
    }

    // Fallback
    const safeProjects: ProjectV3[] = projects || [];
    const activeProject = safeProjects.find(p => p.id === activeProjectId);

    return (
        <div className="flex h-screen overflow-hidden bg-white text-black">
            <ProjectBar 
                projects={safeProjects}
                activeProjectId={activeProjectId}
                onSelectProject={setActiveProjectId}
            />
            <main className="flex-grow flex flex-col h-full overflow-hidden bg-white">
                {activeProject ? (
                    <ProjectView project={activeProject} />
                ) : (
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
