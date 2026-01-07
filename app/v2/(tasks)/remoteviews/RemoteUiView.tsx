import React, { useState } from 'react';
import { useRemoteUiData } from '../hooks/useRemoteUiData';
import { TaskList } from '../components/TaskList';
import { FolderTabs } from '../components/FolderTabs';
import { DetailsPanel } from '../components/DetailsPanel';
import { clsx } from 'clsx';

interface RemoteUiViewProps {
    projectId: string;
    satelliteId?: string; // ID of the UI project
}

export const RemoteUiView = ({ projectId, satelliteId }: RemoteUiViewProps) => {
    // Use satelliteId if available, otherwise fallback to projectId (though for UI view satelliteId should exist)
    const targetId = satelliteId || projectId;

    const { 
        folders, 
        folderCounts, 
        tasks, 
        activeFolderId, 
        handleSelectFolder,
        updateTask, 
        createTask 
    } = useRemoteUiData(targetId);

    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // TODO: Implement create folder for remote UI
    const handleCreateFolder = () => {
        console.log('Create Remote Folder Clicked');
    };

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
            {/* Remote Folder Tabs - always render if we have a targetId to allow creating folders */}
            <FolderTabs 
                folders={folders}
                folderCounts={folderCounts}
                activeFolderId={activeFolderId}
                onSelectFolder={handleSelectFolder}
                onCreateFolder={handleCreateFolder}
                layoutIdPrefix={`remote-ui-${targetId}`}
                // Remote view doesn't need satellites or remote toggles for now
                hasRemoteUi={false}
                activeRemoteTab={null}
                onToggleRemote={() => {}}
            />

            <div className="flex-1 flex min-h-0 overflow-hidden relative">
                {/* Left: Remote Task List */}
                <div className="flex-1 overflow-y-scroll p-6 bg-background">
                    {activeFolderId ? (
                        <TaskList 
                            tasks={tasks}
                            onSelectTask={setSelectedTaskId}
                            selectedTaskId={selectedTaskId}
                            onUpdateTask={updateTask}
                        />
                    ) : (
                        <div className="border-2 border-dashed border-default-200 rounded-xl h-full flex items-center justify-center text-default-400">
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-foreground mb-2">Remote UI</h2>
                                <p>Select a folder to view items</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Details Panel Placeholder */}
                <div className="w-[400px] flex-shrink-0 border-l border-default-200 bg-content2/50 p-6 overflow-y-auto z-20">
                     {selectedTaskId ? (
                        <div className="text-default-500">
                            Details for remote task {selectedTaskId} <br/>
                            (Edit logic pending implementation)
                        </div>
                     ) : (
                        <div className="h-full flex items-center justify-center text-default-400">
                            Select an item to view details
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};

