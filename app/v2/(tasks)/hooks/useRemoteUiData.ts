import { useState, useEffect, useMemo } from 'react';
import { useQuery, usePowerSync } from '@powersync/react';
import { Folder, Task } from '@/app/types';
import { globalStorage } from '@/utils/storage';

const REMOTE_STORAGE_KEY_PREFIX = 'v2_remote_ui_folder_';

export const useRemoteUiData = (projectId: string) => {
    // 1. Local State for active folder in remote view
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    
    // Access CURRENT PowerSync instance
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

    // MEMOIZE folders to prevent effect loops
    const folders: Folder[] = useMemo(() => (foldersData || []).map((f: any) => ({
        ...f,
        id: f.id,
    })), [foldersData]);

    // 3. Load items from "_ui_items"
    const { data: itemsData } = useQuery(
        `SELECT * FROM _ui_items
         WHERE (is_completed IS NULL OR is_completed = 0) 
           AND (is_deleted IS NULL OR is_deleted = 0)
           AND folder_id IN (SELECT id FROM _ui_folders WHERE project_id = ?)`,
        [projectId]
    );
    
    // MEMOIZE tasks
    const allTasks: Task[] = useMemo(() => (itemsData || []).map((t: any) => ({
        ...t,
        id: t.id
    })), [itemsData]);

    // 4. Calculate counts (Memoized)
    const folderCounts = useMemo(() => allTasks.reduce((acc: Record<string, number>, task) => {
        if (task.folder_id) {
            acc[task.folder_id] = (acc[task.folder_id] || 0) + 1;
        }
        return acc;
    }, {}), [allTasks]);

    // 5. Filter tasks for active folder (Memoized)
    const activeTasks = useMemo(() => activeFolderId 
        ? allTasks.filter(t => t.folder_id === activeFolderId).sort((a, b) => a.sort_order - b.sort_order)
        : [], [activeFolderId, allTasks]);

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
                 
                 // Check against folders array, which is now stable thanks to useMemo
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
    const createFolder = async (title: string = 'New Folder') => {
        const maxSort = folders.reduce((max, f) => Math.max(max, f.sort_order || 0), 0);
        const newSort = maxSort + 100;
        const id = crypto.randomUUID();

        await powerSync.execute(
            `INSERT INTO _ui_folders (id, project_id, title, sort_order, created_at, updated_at) 
             VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
            [id, projectId, title, newSort]
        );
    };

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
        createFolder,
        createTask,
        updateTask,
        deleteTask
    };
};

