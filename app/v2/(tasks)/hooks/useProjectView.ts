import { useState, useEffect } from 'react';
import { useQuery } from '@powersync/react';
import { Project, Folder } from '@/app/types';
import { globalStorage } from '@/utils/storage';

const STORAGE_KEY_PREFIX = 'v2_active_folder_';

export const useProjectView = (project: Project, isActive: boolean) => {
    // 1. Local State for this project's active folder
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

    // 2. Load folders for THIS project
    const { data: foldersData } = useQuery(
        `SELECT * FROM folders 
         WHERE project_id = ? 
           AND (is_deleted IS NULL OR is_deleted = 0) 
           AND (is_hidden IS NULL OR is_hidden = 0) 
         ORDER BY sort_order ASC`,
        [project.id]
    );
    const folders: Folder[] = foldersData || [];

    // 2.5 Load task counts
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

    // 3. Restore active folder state (Initial Mount Only)
    useEffect(() => {
        const key = `${STORAGE_KEY_PREFIX}${project.id}`;
        const savedId = globalStorage.getItem(key);
        
        if (savedId && savedId !== 'null') {
            setActiveFolderId(savedId);
        }
    }, [project.id]);

    // 4. Auto-select folder logic
    useEffect(() => {
        // Only run if we have folders and NO active selection (or invalid selection)
        if (folders.length > 0) {
            const isValid = activeFolderId && folders.find(f => f.id === activeFolderId);
            
            if (!activeFolderId || !isValid) {
                 const key = `${STORAGE_KEY_PREFIX}${project.id}`;
                 const savedId = globalStorage.getItem(key);
                 
                 // Try saved ID again (if folders loaded later), else first
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
    }, [folders, activeFolderId, project.id]);

    const handleSelectFolder = (id: string) => {
        setActiveFolderId(id);
        globalStorage.setItem(`${STORAGE_KEY_PREFIX}${project.id}`, id);
    };

    return {
        folders,
        folderCounts,
        activeFolderId,
        handleSelectFolder
    };
};

