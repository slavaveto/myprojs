'use client';

import React, { useState } from 'react';
import { usePowerSync } from '@/app/_services/powerSync/PowerSyncProvider';
import { useQuery } from '@powersync/react';
import { ProjectBar } from './components/ProjectBar';
import { Header } from './components/Header';
import { Project } from '@/app/types';

export default function TasksPage() {
  const powerSync = usePowerSync();
  
  // PowerSync Query: Real-time sync from SQLite
  const { data: projectsData } = useQuery('SELECT * FROM projects ORDER BY sort_order ASC');
  const projects: Project[] = projectsData || [];

  // --- STATE ---
  // Active Project ID (null if system tab is active)
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  
  // Active System Tab ('inbox', 'today', etc.) - default to 'inbox' if no project
  const [activeSystemTab, setActiveSystemTab] = useState<string | null>('inbox');

  // --- HANDLERS ---
  const handleSelectProject = (id: string) => {
      setActiveProjectId(id);
      setActiveSystemTab(null); // Clear system tab
  };

  const handleSelectSystemTab = (tab: string) => {
      setActiveSystemTab(tab);
      setActiveProjectId(null); // Clear project
  };

  // Find active project object for Header
  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : undefined;

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
        
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

            {/* CONTENT PLACEHOLDER */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="border-2 border-dashed border-default-200 rounded-xl h-full flex items-center justify-center text-default-400">
                    {activeProject ? (
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-foreground mb-2">{activeProject.title}</h2>
                            <p>Task List will be here...</p>
                        </div>
                    ) : (
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-foreground mb-2 capitalize">{activeSystemTab}</h2>
                            <p>System view content...</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    </div>
  );
}

