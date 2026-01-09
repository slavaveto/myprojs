import { useState, useEffect, useMemo } from 'react';
import { useQuery, usePowerSync } from '@powersync/react';
import { Project, Folder, Task } from '@/app/types';
import { globalStorage } from '@/utils/storage';
import { useAuth } from '@clerk/nextjs';

const INFO_STORAGE_KEY_PREFIX = 'v2_info_folder_';

// Renamed from useRemoteInfoData to reflect it uses LOCAL DB
export const useInfoData = (parentProjectId: string) => {
    // 1. Find the Info Project
    const { data: projectsData } = useQuery(
        `SELECT * FROM projects WHERE parent_proj_id = ? AND title = 'Info' LIMIT 1`,
        [parentProjectId]
    );
    const infoProject: Project | undefined = projectsData?.[0] as any;

    // 2. Local State
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const powerSync = usePowerSync();
    const { userId } = useAuth();

    // 3. Load Data (Only if infoProject exists)
    const projectId = infoProject?.id;

    // Folders
    const { data: foldersData } = useQuery(
        projectId 
            ? `SELECT * FROM folders 
               WHERE project_id = ? 
                 AND (is_deleted IS NULL OR is_deleted = 0) 
                 AND (is_hidden IS NULL OR is_hidden = 0) 
               ORDER BY sort_order ASC`
            : '',
        projectId ? [projectId] : []
    );
    const folders: Folder[] = foldersData || [];

    // Tasks (for all folders to calc counts)
    const { data: countsData } = useQuery(
        projectId
            ? `SELECT folder_id, COUNT(*) as count 
               FROM tasks 
               WHERE (is_completed IS NULL OR is_completed = 0) 
                 AND (is_deleted IS NULL OR is_deleted = 0)
                 AND folder_id IN (SELECT id FROM folders WHERE project_id = ?)
               GROUP BY folder_id`
            : '',
        projectId ? [projectId] : []
    );

    const folderCounts = (countsData || []).reduce((acc: Record<string, number>, row: any) => {
        acc[row.folder_id] = row.count;
        return acc;
    }, {});

    // Active Tasks
    const { data: tasksData } = useQuery(
        (projectId && activeFolderId)
            ? `SELECT * FROM tasks 
               WHERE folder_id = ? 
                 AND (is_deleted IS NULL OR is_deleted = 0)
                 AND (is_completed IS NULL OR is_completed = 0)
               ORDER BY sort_order ASC`
            : '',
        (projectId && activeFolderId) ? [activeFolderId] : []
    );
    const tasks: Task[] = tasksData || [];

    // 4. Restore/Auto-select state
    useEffect(() => {
        if (!projectId) return;
        const key = `${INFO_STORAGE_KEY_PREFIX}${projectId}`;
        
        if (folders.length > 0) {
            const savedId = globalStorage.getItem(key);
            if (savedId && folders.find(f => f.id === savedId)) {
                setActiveFolderId(savedId);
            } else if (!activeFolderId) {
                setActiveFolderId(folders[0].id);
            }
        }
    }, [projectId, folders, activeFolderId]);

    const handleSelectFolder = (id: string) => {
        setActiveFolderId(id);
        if (projectId) {
            globalStorage.setItem(`${INFO_STORAGE_KEY_PREFIX}${projectId}`, id);
        }
    };

    // 5. CRUD
    const createFolder = async (title: string) => {
        if (!projectId || !userId) return;
        const maxSort = folders.reduce((max, f) => Math.max(max, f.sort_order), 0);
        const newSort = maxSort + 100;
        const id = crypto.randomUUID();

        await powerSync.execute(
            `INSERT INTO folders (id, project_id, title, sort_order, created_at, updated_at, user_id) 
             VALUES (?, ?, ?, ?, datetime('now'), datetime('now'), ?)`,
            [id, projectId, title, newSort, userId]
        );
    };

    const updateFolder = async (folderId: string, title: string) => {
        await powerSync.execute(
            `UPDATE folders SET title = ?, updated_at = datetime('now') WHERE id = ?`,
            [title, folderId]
        );
    };

    const deleteFolder = async (folderId: string) => {
        await powerSync.execute(
            `UPDATE folders SET is_deleted = 1, updated_at = datetime('now') WHERE id = ?`,
            [folderId]
        );
    };

    const updateTask = async (taskId: string, updates: Partial<Task>) => {
        // Implement task update logic similar to main project
        // For brevity:
        const setParts: string[] = [];
        const args: any[] = [];
        if (updates.content !== undefined) { setParts.push('content = ?'); args.push(updates.content); }
        if (updates.is_completed !== undefined) { setParts.push('is_completed = ?'); args.push(updates.is_completed ? 1 : 0); }
        
        if (setParts.length > 0) {
            setParts.push("updated_at = datetime('now')");
            args.push(taskId);
            await powerSync.execute(`UPDATE tasks SET ${setParts.join(', ')} WHERE id = ?`, args);
        }
    };

    return {
        infoProject,
        folders,
        folderCounts,
        tasks,
        activeFolderId,
        handleSelectFolder,
        createFolder,
        updateFolder,
        deleteFolder,
        updateTask
    };
};

