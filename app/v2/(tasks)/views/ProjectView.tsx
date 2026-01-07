import React, { useState } from 'react';
import { Project } from '@/app/types';
import { FolderTabs } from '../components/FolderTabs';
import { TaskList } from '../components/TaskList';
import { DetailsPanel } from '../components/DetailsPanel';
import { RemoteUiView } from '../remoteviews/RemoteUiView';
import { RemoteUsersView } from '../remoteviews/RemoteUsersView';
import { RemoteLogsView } from '../remoteviews/RemoteLogsView';
import { RemoteTablesView } from '../remoteviews/RemoteTablesView';
import { clsx } from 'clsx';
import { useProjectView } from '../hooks/useProjectView';
import { useRemoteUiData } from '../hooks/useRemoteUiData';
import { usePanelResize } from '../hooks/usePanelResize';

interface ProjectViewProps {
    project: Project;
    isActive: boolean;
}

const ProjectViewComponent = ({ project, isActive }: ProjectViewProps) => {
    const { 
        folders, folderCounts, tasks, activeFolderId, handleSelectFolder,
        hasRemoteUi, activeRemoteTab, handleToggleRemote
    } = useProjectView(project, isActive);
    
    // Remote UI Data (Always fetched if project active, but lightweight)
    const remoteUi = useRemoteUiData(project.id);
    
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const { width: panelWidth, containerRef, startResizing } = usePanelResize(400);

    const SYSTEM_PROJECT_TITLES = ['Inbox', 'Today', 'Doing Now', 'Logs', 'Done', 'Logbook'];

    return (
        <div className={clsx("flex flex-col h-full w-full", !isActive && "hidden")}>
            
            {/* Folder Tabs Area */}
            {folders.length > 0 && !SYSTEM_PROJECT_TITLES.includes(project.title) && (
                <FolderTabs 
                    folders={folders}
                    folderCounts={folderCounts}
                    activeFolderId={activeFolderId}
                    onSelectFolder={handleSelectFolder}
                    onCreateFolder={() => console.log('Create Folder in', project.title)}
                    layoutIdPrefix={`project-${project.id}`}
                    hasRemoteUi={hasRemoteUi}
                    activeRemoteTab={activeRemoteTab}
                    onToggleRemote={handleToggleRemote}
                    
                    // Remote Props
                    remoteFolders={remoteUi.folders}
                    remoteFolderCounts={remoteUi.folderCounts}
                    activeRemoteFolderId={remoteUi.activeFolderId}
                    onSelectRemoteFolder={remoteUi.handleSelectFolder}
                />
            )}

            {/* Split Content Area */}
            <div 
                ref={containerRef}
                className="flex-1 flex min-h-0 overflow-hidden relative"
            >
                
                {activeRemoteTab === 'ui' ? (
                    <RemoteUiView 
                        tasks={remoteUi.tasks}
                        activeFolderId={remoteUi.activeFolderId}
                        updateTask={remoteUi.updateTask}
                    />
                ) : activeRemoteTab === 'users' ? (
                    <RemoteUsersView projectId={project.id} satelliteId={project.id} />
                ) : activeRemoteTab === 'logs' ? (
                    <RemoteLogsView projectId={project.id} satelliteId={project.id} />
                ) : activeRemoteTab === 'tables' ? (
                    <RemoteTablesView projectId={project.id} satelliteId={project.id} />
                ) : (
                    <>
                        {/* Left: Task List */}
                        <div className="flex-1 overflow-y-scroll p-6 bg-background">
                            {activeFolderId ? (
                                <TaskList 
                                    tasks={tasks}
                                    onSelectTask={setSelectedTaskId}
                                    selectedTaskId={selectedTaskId}
                                />
                            ) : (
                                <div className="border-2 border-dashed border-default-200 rounded-xl h-full flex items-center justify-center text-default-400">
                                    <div className="text-center">
                                        <h2 className="text-xl font-bold text-foreground mb-2">{project.title}</h2>
                                        <p>Select a folder to view tasks</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Resize Handle */}
                        <div
                            className="w-[1px] bg-default-200 hover:bg-primary cursor-col-resize relative z-20 transition-colors group"
                            onMouseDown={startResizing}
                        >
                            {/* Invisible hit area for easier grabbing */}
                            <div className="absolute inset-y-0 -left-1 -right-1 z-10 bg-transparent group-hover:bg-primary/10" />
                        </div>

                        {/* Right: Details Panel */}
                        <div 
                            style={{ width: panelWidth }}
                            className="flex-shrink-0 border-l border-default-200 bg-content2/50 overflow-y-auto z-10"
                        >
                            <DetailsPanel 
                                taskId={selectedTaskId} 
                            />
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// --- MEMOIZATION ---
export const ProjectView = React.memo(ProjectViewComponent, (prev, next) => {
    if (prev.isActive !== next.isActive) return false;
    if (prev.project !== next.project) return false;
    if (!next.isActive) return true; // Keep hidden state memoized
    return false;
});


