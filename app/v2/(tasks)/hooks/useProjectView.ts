import { useState, useEffect, useMemo } from 'react';
import { useQuery, usePowerSync } from '@powersync/react';
import { Project, Folder, Task } from '@/app/types';
import { globalStorage } from '@/utils/storage';

const STORAGE_KEY_PREFIX = 'v2_active_folder_';
const REMOTE_TAB_KEY_PREFIX = 'v2_active_remote_tab_';

export const useProjectView = (project: Project, isActive: boolean) => {
    // 1. Local State
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const [activeRemoteTab, setActiveRemoteTab] = useState<'ui' | 'users' | 'logs' | 'tables' | null>(null);
    const powerSync = usePowerSync();

    // ... (query folders) ...
    const { data: foldersData } = useQuery(
        `SELECT * FROM folders 
         WHERE project_id = ? 
           AND (is_deleted IS NULL OR is_deleted = 0) 
           AND (is_hidden IS NULL OR is_hidden = 0) 
         ORDER BY sort_order ASC`,
        [project.id]
    );
    const folders: Folder[] = foldersData || [];

    // ... (query counts) ...
    const { data: countsData } = useQuery(
        `SELECT folder_id, COUNT(*) as count 
         FROM tasks 
         WHERE (is_completed IS NULL OR is_completed = 0) 
           AND (is_deleted IS NULL OR is_deleted = 0)
           AND folder_id IN (SELECT id FROM folders WHERE project_id = ?)
         GROUP BY folder_id`,
        [project.id]
    );

    const folderCounts = (countsData || []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.folder_id] = row.count;
        return acc;
    }, {});

    // ... (query tasks) ...
    const { data: tasksData } = useQuery(
        activeFolderId 
            ? `SELECT * FROM tasks 
               WHERE folder_id = ? 
                 AND (is_deleted IS NULL OR is_deleted = 0)
                 AND (is_completed IS NULL OR is_completed = 0)
               ORDER BY sort_order ASC`
            : '',
        activeFolderId ? [activeFolderId] : []
    );
    
    // Prevent flickering of old tasks when switching folders
    const tasks: Task[] = useMemo(() => {
        const data = tasksData || [];
        if (activeFolderId && data.length > 0 && data[0].folder_id !== activeFolderId) {
            return []; // Return empty if data doesn't match active folder yet
        }
        return data;
    }, [tasksData, activeFolderId]);

    // 3. Restore State (Initial Mount Only)
    useEffect(() => {
        // Restore Remote Tab
        const remoteTabKey = `${REMOTE_TAB_KEY_PREFIX}${project.id}`;
        const savedRemoteTab = globalStorage.getItem(remoteTabKey);
        
        if (savedRemoteTab && savedRemoteTab !== 'null') {
            setActiveRemoteTab(savedRemoteTab as any);
        }

        // Restore Active Folder
        const folderKey = `${STORAGE_KEY_PREFIX}${project.id}`;
        const savedFolderId = globalStorage.getItem(folderKey);
        
        if (savedFolderId && savedFolderId !== 'null') {
            setActiveFolderId(savedFolderId);
        }
    }, [project.id]);

    // 4. Auto-select folder logic
    // Only run if NO remote tab is active and NO folder is selected
    useEffect(() => {
        if (folders.length > 0) {
            // Check if we have a saved remote tab, if so - don't auto-select folder yet (wait for restore)
            // But restore happens in previous effect.
            
            // If remote tab is active, we don't care about auto-selecting folder
            if (activeRemoteTab) return;

            const isValid = activeFolderId && folders.find(f => f.id === activeFolderId);
            
            if (!activeFolderId || !isValid) {
                 const key = `${STORAGE_KEY_PREFIX}${project.id}`;
                 const savedId = globalStorage.getItem(key);
                 
                 // Try saved ID again, else first
                 if (savedId && folders.find(f => f.id === savedId)) {
                     setActiveFolderId(savedId);
                 } else {
                     const firstId = folders[0].id;
                     setActiveFolderId(firstId);
                     // Save default logic
                     globalStorage.setItem(key, firstId);
                 }
            }
        }
    }, [folders, activeFolderId, project.id, activeRemoteTab]);

    // ... (satellites) ...
    const hasRemoteUi = !!project.has_remote_ui;

    const handleToggleRemote = (tab: 'ui' | 'users' | 'logs' | 'tables') => {
        if (activeRemoteTab === tab) return;
        
        setActiveRemoteTab(tab);
        globalStorage.setItem(`${REMOTE_TAB_KEY_PREFIX}${project.id}`, tab);
    };

    const handleSelectFolder = (id: string) => {
        setActiveFolderId(id);
        setActiveRemoteTab(null);
        
        globalStorage.setItem(`${STORAGE_KEY_PREFIX}${project.id}`, id);
        globalStorage.setItem(`${REMOTE_TAB_KEY_PREFIX}${project.id}`, 'null'); // Clear remote tab
    };

    const createFolder = async (title: string) => {
        try {
            console.log('Creating local folder:', { title, projectId: project.id });
            const maxSort = folders.reduce((max, f) => Math.max(max, f.sort_order), 0);
            const newSort = maxSort + 100;
            const id = crypto.randomUUID();

            await powerSync.execute(
                `INSERT INTO folders (id, project_id, title, sort_order, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [id, project.id, title, newSort]
            );
            console.log('Local folder created successfully');
        } catch (error) {
            console.error('FAILED to create local folder:', error);
        }
    };

    return {
        folders,
        folderCounts,
        tasks,
        activeFolderId,
        handleSelectFolder,
        hasRemoteUi,
        activeRemoteTab,
        handleToggleRemote,
        createFolder
    };
};

