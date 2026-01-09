import React, { useEffect } from 'react';
import { useRemoteUiData } from '../hooks/useRemoteUiData';
import { Folder } from '@/app/types';

interface RemoteDataLifterProps {
    projectId: string;
    projectTitle?: string;
    onFoldersLoaded: (folders: Folder[], counts: Record<string, number>) => void;
    onActiveIdLoaded?: (id: string | null) => void;
    onActionsReady?: (actions: any) => void;
}

export const RemoteDataLifter = ({ projectId, projectTitle, onFoldersLoaded, onActiveIdLoaded, onActionsReady }: RemoteDataLifterProps) => {
    // ignoreProjectId = true, так как мы внутри изолированной базы
    const { folders, folderCounts, activeFolderId, createFolder, updateFolder, deleteFolder, handleSelectFolder } = useRemoteUiData(projectId, true, undefined, projectTitle);

    // 1. Lift Data
    useEffect(() => {
        onFoldersLoaded(folders, folderCounts);
    }, [folders, folderCounts, onFoldersLoaded]);

    // 2. Lift Active ID
    useEffect(() => {
        if (onActiveIdLoaded && activeFolderId) {
            onActiveIdLoaded(activeFolderId);
        }
    }, [activeFolderId, onActiveIdLoaded]);

    // 3. Lift Actions
    useEffect(() => {
        if (onActionsReady) {
            onActionsReady({
                createFolder,
                updateFolder,
                deleteFolder,
                handleSelectFolder // <--- ADDED THIS
            });
        }
    }, [createFolder, updateFolder, deleteFolder, handleSelectFolder, onActionsReady]);

    return null;
};

