import { useState, useEffect } from 'react';
import { useQuery, usePowerSync } from '@powersync/react';
import { Folder, Task } from '@/app/types';
import { globalStorage } from '@/utils/storage';

const REMOTE_STORAGE_KEY_PREFIX = 'v2_remote_ui_folder_';

export const useRemoteUiData = (projectId: string) => {
    // 1. Local State for active folder in remote view
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    
    // Access CURRENT PowerSync instance (provided by RemotePowerSyncProvider or Main)
    const powerSync = usePowerSync();

    // 2. Load folders from "_ui_folders"
    const { data: foldersData } = useQuery(
        `SELECT * FROM _ui_folders
         WHERE project_id = ? 
           AND (is_deleted IS NULL OR is_deleted = 0) 
           AND (is_hidden IS NULL OR is_hidden = 0) 
         ORDER BY sort_order ASC`,
        [projectId]
    );
    // Map remote folders to standard Folder interface
    // Since schema is identical, just casting
    const folders: Folder[] = (foldersData || []).map((f: any) => ({
        ...f,
        id: f.id, // Ensure ID exists
    }));

    // 3. Load items from "_ui_items" (tasks)
    // We load ALL active items for the project to calculate counts
    // (Assuming items have folder_id which links to folders of this project)
    
    // Wait, items don't have project_id directly usually, they link to folder.
    // So we need: WHERE folder_id IN (SELECT id FROM "_ui_folders" WHERE project_id = ?)
    
    const { data: itemsData } = useQuery(
        `SELECT * FROM _ui_items
         WHERE (is_completed IS NULL OR is_completed = 0) 
           AND (is_deleted IS NULL OR is_deleted = 0)
           AND folder_id IN (SELECT id FROM _ui_folders WHERE project_id = ?)`,
        [projectId]
    );
    
    const allTasks: Task[] = (itemsData || []).map((t: any) => ({
        ...t,
        id: t.id
    }));

    // 4. Calculate counts
    const folderCounts = allTasks.reduce((acc: Record<string, number>, task) => {
        if (task.folder_id) {
            acc[task.folder_id] = (acc[task.folder_id] || 0) + 1;
        }
        return acc;
    }, {});

    // 5. Filter tasks for active folder
    const activeTasks = activeFolderId 
        ? allTasks.filter(t => t.folder_id === activeFolderId).sort((a, b) => a.sort_order - b.sort_order)
        : [];

    // 6. Restore active folder state
    useEffect(() => {
        const key = `${REMOTE_STORAGE_KEY_PREFIX}${projectId}`;
        const savedId = globalStorage.getItem(key);
        
        if (savedId && savedId !== 'null') {
            setActiveFolderId(savedId);
        }
    }, [projectId]);

    // 7. Auto-select folder logic
    useEffect(() => {
        if (folders.length > 0) {
            const isValid = activeFolderId && folders.find(f => f.id === activeFolderId);
            
            if (!activeFolderId || !isValid) {
                 const key = `${REMOTE_STORAGE_KEY_PREFIX}${projectId}`;
                 const savedId = globalStorage.getItem(key);
                 
                 if (savedId && folders.find(f => f.id === savedId)) {
                     setActiveFolderId(savedId);
                 } else {
                     const firstId = folders[0].id;
                     setActiveFolderId(firstId);
                     globalStorage.setItem(key, firstId);
                 }
            }
        }
    }, [folders, activeFolderId, projectId]);

    const handleSelectFolder = (id: string) => {
        setActiveFolderId(id);
        globalStorage.setItem(`${REMOTE_STORAGE_KEY_PREFIX}${projectId}`, id);
    };

    // CRUD Operations (Wrappers around PowerSync)
    const createTask = async (content: string, folderId: string) => {
        // TODO: Implement using powerSync.execute
        // INSERT INTO "-ui_items" ...
        console.log("Create remote task", content, folderId);
    };

    const updateTask = async (taskId: string, updates: Partial<Task>) => {
        // TODO: Implement
        console.log("Update remote task", taskId, updates);
    };

    const deleteTask = async (taskId: string) => {
        // TODO: Implement
        console.log("Delete remote task", taskId);
    };

    return {
        folders,
        folderCounts,
        activeFolderId,
        handleSelectFolder,
        tasks: activeTasks, // Tasks for the active folder
        createTask,
        updateTask,
        deleteTask
    };
};

