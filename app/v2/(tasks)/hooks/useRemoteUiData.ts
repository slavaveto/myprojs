import { useState, useEffect, useMemo } from 'react';
import { useQuery, usePowerSync } from '@powersync/react';
import { useAuth } from '@clerk/nextjs';
import { Folder, Task } from '@/app/types';
import { globalStorage } from '@/utils/storage';

const REMOTE_STORAGE_KEY_PREFIX = 'v2_remote_ui_folder_';

export const useRemoteUiData = (projectId: string, ignoreProjectId = false) => {
    // 1. Local State for active folder in remote view
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const { userId } = useAuth();
    
    // Access CURRENT PowerSync instance
    const powerSync = usePowerSync();

    // 2. Load folders from "_ui_folders"
    const { data: foldersData } = useQuery(
        ignoreProjectId 
            ? `SELECT * FROM _ui_folders
               WHERE (is_deleted IS NULL OR is_deleted = 0) 
                 AND (is_hidden IS NULL OR is_hidden = 0) 
               ORDER BY sort_order ASC`
            : `SELECT * FROM _ui_folders
               WHERE project_id = ? 
                 AND (is_deleted IS NULL OR is_deleted = 0) 
                 AND (is_hidden IS NULL OR is_hidden = 0) 
               ORDER BY sort_order ASC`,
        ignoreProjectId ? [] : [projectId]
    );

    // MEMOIZE folders to prevent effect loops
    const folders: Folder[] = useMemo(() => (foldersData || []).map((f: any) => ({
        ...f,
        id: f.id,
    })), [foldersData]);

    // 3. Load items from "_ui_items"
    const { data: itemsData } = useQuery(
        ignoreProjectId
            ? `SELECT * FROM _ui_items
               WHERE (is_completed IS NULL OR is_completed = 0) 
                 AND (is_deleted IS NULL OR is_deleted = 0)
                 AND folder_id IN (SELECT id FROM _ui_folders)`
            : `SELECT * FROM _ui_items
               WHERE (is_completed IS NULL OR is_completed = 0) 
                 AND (is_deleted IS NULL OR is_deleted = 0)
                 AND folder_id IN (SELECT id FROM _ui_folders WHERE project_id = ?)`,
        ignoreProjectId ? [] : [projectId]
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
        if (!content.trim()) return;
        const id = crypto.randomUUID();
        // Calculate sort order (end of list)
        const folderTasks = activeTasks; // Memoized list for current folder
        const maxSort = folderTasks.reduce((max, t) => Math.max(max, t.sort_order || 0), 0);
        const newSort = maxSort + 1000;

        await powerSync.execute(
            `INSERT INTO _ui_items (id, folder_id, content, sort_order, created_at, updated_at, is_completed, is_deleted) 
             VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), 0, 0)`,
            [id, folderId, content, newSort]
        );
    };

    const updateTask = async (taskId: string, updates: Partial<Task>) => {
        const setParts: string[] = [];
        const args: any[] = [];

        if (updates.content !== undefined) {
            setParts.push('content = ?');
            args.push(updates.content);
        }
        if (updates.is_completed !== undefined) {
            setParts.push('is_completed = ?');
            args.push(updates.is_completed ? 1 : 0);
        }
        
        if (setParts.length === 0) return;

        setParts.push("updated_at = datetime('now')");
        args.push(taskId);

        await powerSync.execute(
            `UPDATE _ui_items SET ${setParts.join(', ')} WHERE id = ?`,
            args
        );
    };

    const updateFolder = async (folderId: string, title: string) => {
        await powerSync.execute(
            `UPDATE _ui_folders SET title = ?, updated_at = datetime('now') WHERE id = ?`,
            [title, folderId]
        );
    };

    const deleteFolder = async (folderId: string) => {
        // Soft delete
        await powerSync.execute(
            `UPDATE _ui_folders SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?`,
            [folderId]
        );
    };

    const deleteTask = async (taskId: string) => {
        await powerSync.execute(
            `UPDATE _ui_items SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?`,
            [taskId]
        );
    };

    return {
        folders,
        folderCounts,
        activeFolderId,
        handleSelectFolder,
        tasks: activeTasks, // Tasks for the active folder
        createFolder,
        updateFolder,
        deleteFolder,
        createTask,
        updateTask,
        deleteTask
    };
};

