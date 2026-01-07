'use client';

import React, { useState, useEffect } from 'react';
import { usePowerSync } from '@/app/_services/powerSync/PowerSyncProvider';
import { useQuery } from '@powersync/react';
import { ProjectBar } from './components/ProjectBar';
import { Header } from './components/Header';
import { FolderTabs } from './components/FolderTabs';
import { Project, Folder } from '@/app/types';
import { globalStorage } from '@/utils/storage';

const STORAGE_KEYS = {
    ACTIVE_PROJECT: 'v2_active_project_id',
    ACTIVE_SYSTEM_TAB: 'v2_active_system_tab',
    folderForProject: (projId: string) => `v2_active_folder_${projId}`
};

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
  const [activeSystemTab, setActiveSystemTab] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [isRestored, setIsRestored] = useState(false);

  // --- RESTORE STATE ON MOUNT ---
  useEffect(() => {
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
  }, []);

  // --- RESTORE FOLDER WHEN PROJECT CHANGES ---
  useEffect(() => {
    if (!activeProjectId) {
        setActiveFolderId(null);
        return;
    }

    const savedFolderId = globalStorage.getItem(STORAGE_KEYS.folderForProject(activeProjectId));
    if (savedFolderId && savedFolderId !== 'null') {
        setActiveFolderId(savedFolderId);
    } else {
        setActiveFolderId(null); // Reset if no saved folder, effect below will select first
    }
  }, [activeProjectId]);

  // --- PERSIST STATE ---
  const handleSelectProject = (id: string) => {
      setActiveProjectId(id);
      setActiveSystemTab(null);
      globalStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, id);
      globalStorage.setItem(STORAGE_KEYS.ACTIVE_SYSTEM_TAB, 'null');
  };

  const handleSelectSystemTab = (tab: string) => {
      setActiveSystemTab(tab);
      setActiveProjectId(null);
      setActiveFolderId(null);
      globalStorage.setItem(STORAGE_KEYS.ACTIVE_PROJECT, 'null');
      globalStorage.setItem(STORAGE_KEYS.ACTIVE_SYSTEM_TAB, tab);
  };

  const handleSelectFolder = (id: string) => {
      setActiveFolderId(id);
      if (activeProjectId) {
          globalStorage.setItem(STORAGE_KEYS.folderForProject(activeProjectId), id);
      }
  };

  // --- FOLDERS QUERY ---
  // ... rest of the code ...
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

  // Auto-select first folder if folders loaded and none selected (and no saved folder found or saved folder not in list)
  useEffect(() => {
    if (activeProjectId && folders.length > 0) {
        // If no active folder, or active folder is not in current list (e.g. deleted), select first
        const isValid = activeFolderId && folders.find(f => f.id === activeFolderId);
        
        if (!activeFolderId || !isValid) {
            // Check if we just restored a folder that hasn't loaded yet? 
            // Actually, we should wait. But if data is loaded and our ID is not there -> reset.
            // For now, simple logic:
            setActiveFolderId(folders[0].id);
            // Update storage immediately
            globalStorage.setItem(STORAGE_KEYS.folderForProject(activeProjectId), folders[0].id);
        }
    }
  }, [activeProjectId, folders, activeFolderId]);

  // --- HANDLERS ---
  // (Handlers are defined above now)

  const activeProject = activeProjectId ? projects.find(p => p.id === activeProjectId) : undefined;
  
  // Prevent rendering content jump before restore (optional, but good for UX)
  if (!isRestored) return null; // Or a loading spinner

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
                    onSelectFolder={handleSelectFolder}
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

