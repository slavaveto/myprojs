import React, { useState } from 'react';
import { Project } from '@/app/types';
import { FolderTabs } from '../components/FolderTabs';
import { TaskList } from '../components/TaskList';
import { DetailsPanel } from '../components/DetailsPanel';
import { InfoUiView } from '../remoteviews/InfoUiView';
import { UsersView } from '../remoteviews/UsersView';
import { LogsView } from '../remoteviews/LogsView';
import { TablesView } from '../remoteviews/TablesView';
// import { RemoteInfoView } from '../remoteviews/RemoteInfoView';
import { clsx } from 'clsx';
import { useProjectView } from '../hooks/useProjectView';
import { useRemoteUiData } from '../hooks/useRemoteUiData';
import { useRemoteInfoData } from '../hooks/useRemoteInfoData';
import { usePanelResize } from '../hooks/usePanelResize';

interface ProjectViewProps {
    project: Project;
    isActive: boolean;
}

const ProjectViewComponent = ({ project, isActive }: ProjectViewProps) => {
    const { 
        folders, folderCounts, tasks, activeFolderId, handleSelectFolder,
        hasRemote, activeRemoteTab, handleToggleRemote, createFolder,
        updateFolder, deleteFolder
    } = useProjectView(project, isActive);
    
    // DEBUG: Check hasRemote
    if (isActive) {
        console.log('[ProjectView] Project:', project.title);
        console.log('hasRemote (hook):', hasRemote);
        console.log('project.has_remote:', project.has_remote);
        console.log('Full Project:', JSON.stringify(project));
    }

    // Remote UI Data (Always fetched if project active, but lightweight)
    const remoteUi = useRemoteUiData(project.id);
    const infoData = useRemoteInfoData(project.id);
    
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const { width: panelWidth, containerRef, startResizing } = usePanelResize(400);

    // Fallback if width is invalid (prevents NaN error)
    const safePanelWidth = isNaN(panelWidth) ? 400 : panelWidth;

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
                    onCreateFolder={createFolder}
                    layoutIdPrefix={`project-${project.id}`}
                    hasRemote={hasRemote}
                    
                    // Local Edit/Delete
                    onUpdateFolder={updateFolder}
                    onDeleteFolder={deleteFolder}
                    activeRemoteTab={activeRemoteTab}
                    onToggleRemote={handleToggleRemote}
                    
                    // UI Props
                    uiFolders={remoteUi.folders}
                    uiFolderCounts={remoteUi.folderCounts}
                    activeUiFolderId={remoteUi.activeFolderId}
                    onSelectUiFolder={remoteUi.handleSelectFolder}
                    onCreateUiFolder={(title) => remoteUi.createFolder(title)}
                    onUpdateUiFolder={(id, title) => remoteUi.updateFolder(id, title)}
                    onDeleteUiFolder={(id) => remoteUi.deleteFolder(id)}

                    // Info Props
                    infoFolders={infoData.folders}
                    infoFolderCounts={infoData.folderCounts}
                    activeInfoFolderId={infoData.activeFolderId}
                    onSelectInfoFolder={infoData.handleSelectFolder}
                    onCreateInfoFolder={(title) => infoData.createFolder(title)}
                    onUpdateInfoFolder={(id, title) => infoData.updateFolder(id, title)}
                    onDeleteInfoFolder={(id) => infoData.deleteFolder(id)}
                />
            )}

            {/* Split Content Area */}
            <div 
                ref={containerRef}
                className="flex-1 flex min-h-0 overflow-hidden relative"
            >
                
                {activeRemoteTab === 'ui' ? (
                    <InfoUiView 
                        title="Remote UI"
                        tasks={remoteUi.tasks}
                        activeFolderId={remoteUi.activeFolderId}
                        updateTask={remoteUi.updateTask}
                    />
                ) : activeRemoteTab === 'info' ? (
                    <InfoUiView 
                        title="Info"
                        tasks={infoData.tasks}
                        activeFolderId={infoData.activeFolderId}
                        updateTask={(id, updates) => infoData.updateTask(id, updates)}
                    />
                ) : activeRemoteTab === 'users' ? (
                    <UsersView projectId={project.id} satelliteId={project.id} />
                ) : activeRemoteTab === 'logs' ? (
                    <LogsView projectId={project.id} satelliteId={project.id} />
                ) : activeRemoteTab === 'tables' ? (
                    <TablesView projectId={project.id} satelliteId={project.id} />
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
                            
                        </div>
                    )}
                </div>

                        {/* Resize Handle */}
                        <div
                            className="w-[1px] relative z-30 cursor-col-resize group select-none"
                            onMouseDown={startResizing}
                        >
                            {/* Visual Line: expands symmetrically from center */}
                            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-default-200 group-hover:w-[3px] group-hover:bg-primary transition-all duration-300 delay-200 ease-out" />
                            
                            {/* Invisible hit area */}
                            <div className="absolute inset-y-0 -left-1 -right-1 z-10 bg-transparent" />
                        </div>

                {/* Right: Details Panel */}
                        <div 
                            style={{ width: safePanelWidth }}
                            className="flex-shrink-0 bg-content2/50 overflow-y-auto z-10"
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


