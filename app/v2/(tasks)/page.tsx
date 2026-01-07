'use client';

import React, { useState, useEffect } from 'react';
import { usePowerSync } from '@/app/_services/powerSync/PowerSyncProvider';
import { useQuery } from '@powersync/react';
import { ProjectBar } from './components/ProjectBar';
import { Header } from './components/Header';
import { FolderTabs } from './components/FolderTabs';
import { Project, Folder } from '@/app/types';

export default function TasksPage() {
  const powerSync = usePowerSync();
  
  // --- PROJECTS QUERY ---
  const { data: projectsData } = useQuery(`
    SELECT * FROM projects 
    WHERE (is_deleted IS NULL OR is_deleted = 0) 
      AND (is_hidden IS NULL OR is_hidden = 0)
      AND (proj_type IS NULL OR proj_type NOT IN ('ui', 'docs'))
    ORDER BY sort_order ASC
  `);
  const projects: Project[] = projectsData || [];

  // --- STATE ---
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [activeSystemTab, setActiveSystemTab] = useState<string | null>('inbox');
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  // --- FOLDERS QUERY ---
  // Only query if a project is active
  const { data: foldersData } = useQuery(
    activeProjectId 
        ? `SELECT * FROM folders 
           WHERE project_id = ? 
             AND (is_deleted IS NULL OR is_deleted = 0) 
             AND (is_hidden IS NULL OR is_hidden = 0) 
           ORDER BY sort_order ASC`
        : '',
    activeProjectId ? [activeProjectId] : []
  );
  
  // DEBUG: Check folders
  console.log('[TasksPage] Active Project:', activeProjectId);
  console.log('[TasksPage] Folders Found:', foldersData?.length, foldersData);

  const folders: Folder[] = foldersData || [];

  // Auto-select first folder if folders loaded and none selected
  useEffect(() => {
    if (activeProjectId && folders.length > 0 && !activeFolderId) {
        setActiveFolderId(folders[0].id);
    }
  }, [activeProjectId, folders, activeFolderId]);

  // --- HANDLERS ---
  const handleSelectProject = (id: string) => {
      setActiveProjectId(id);
      setActiveSystemTab(null);
      setActiveFolderId(null); // Reset folder when switching project
  };

  const handleSelectSystemTab = (tab: string) => {
      setActiveSystemTab(tab);
      setActiveProjectId(null);
      setActiveFolderId(null);
  };

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

            {/* FOLDER TABS (Only for Projects) */}
            {activeProject && (
                <FolderTabs 
                    folders={folders}
                    activeFolderId={activeFolderId}
                    onSelectFolder={setActiveFolderId}
                    onCreateFolder={() => console.log('Create Folder')}
                />
            )}

            {/* CONTENT PLACEHOLDER */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="border-2 border-dashed border-default-200 rounded-xl h-full flex items-center justify-center text-default-400">
                    {activeProject ? (
                        <div className="text-center">
                            <h2 className="text-xl font-bold text-foreground mb-2">{activeProject.title}</h2>
                            <p>Active Folder: {folders.find(f => f.id === activeFolderId)?.title || 'None'}</p>
                            <p className="text-sm mt-2">Task List will be here...</p>
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

