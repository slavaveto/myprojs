'use client';

import React, { useState } from 'react';
import { useQuery } from '@powersync/react';
import { Spinner } from '@heroui/react';
import { ProjectBar, ProjectV3 } from './components/ProjectBar';

export default function TasksPageV3() {
    const { data: projects, isLoading } = useQuery('SELECT * FROM projects ORDER BY sort_order');
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

    return (
        <div className="flex h-screen overflow-hidden bg-white text-black">
            <ProjectBar 
                projects={safeProjects}
                activeProjectId={activeProjectId}
                onSelectProject={setActiveProjectId}
            />
            <main className="flex-grow p-8 bg-gray-50 flex flex-col">
                <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                    <h1 className="text-2xl font-bold mb-4">V3 Content Area</h1>
                    <div className="text-sm text-gray-500">
                        Selected Project ID: <span className="font-mono bg-gray-100 px-1 rounded">{activeProjectId || 'None'}</span>
                    </div>
                    {activeProjectId && (
                        <div className="mt-4">
                            <h2 className="text-lg font-semibold">Active Project Data:</h2>
                            <pre className="mt-2 p-4 bg-gray-100 rounded text-xs overflow-auto max-h-[300px]">
                                {JSON.stringify(safeProjects.find(p => p.id === activeProjectId), null, 2)}
                            </pre>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
