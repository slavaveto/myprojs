import React, { useEffect } from 'react';
import { useRemoteUiData } from '../hooks/useRemoteUiData';
import { Folder } from '@/app/types';

interface RemoteDataLifterProps {
    projectId: string;
    onFoldersLoaded: (folders: Folder[], counts: Record<string, number>) => void;
    onActionsReady?: (actions: any) => void;
}

export const RemoteDataLifter = ({ projectId, onFoldersLoaded, onActionsReady }: RemoteDataLifterProps) => {
    // ignoreProjectId = true, так как мы внутри изолированной базы
    const { folders, folderCounts, createFolder, updateFolder, deleteFolder, handleSelectFolder } = useRemoteUiData(projectId, true);

    // 1. Lift Data
    useEffect(() => {
        onFoldersLoaded(folders, folderCounts);
    }, [folders, folderCounts, onFoldersLoaded]);

    // 2. Lift Actions
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

