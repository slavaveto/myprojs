import React, { useState } from 'react';
import { Project } from '@/app/types';
import { FolderTabs } from '../components/FolderTabs';
import { TaskList } from '../components/TaskList';
import { DetailsPanel } from '../components/DetailsPanel';
import { UsersView } from '../remoteviews/UsersView';
import { LogsView } from '../remoteviews/LogsView';
import { TablesView } from '../remoteviews/TablesView';
import { InfoView } from './InfoView';
import { RemoteUiView } from '../remoteviews/UiView';
import { clsx } from 'clsx';
import { useProjectView } from '../hooks/useProjectView';
import { useRemoteUiData } from '../hooks/useRemoteUiData';
import { useInfoData } from '../hooks/useInfoData';
import { usePanelResize } from '../hooks/usePanelResize';
import { getRemoteConfig } from '@/app/_services/powerSync/remoteConfig';
import { RemoteSyncProvider } from '@/app/_services/powerSync/RemoteSyncProvider';
import { RemoteDataLifter } from '../remoteviews/RemoteDataLifter';
import { Folder } from '@/app/types';

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
    
    const config = getRemoteConfig(project.title);
    const isRemoteProject = config.type === 'remote';

    // 1. REMOTE PROJECT LOGIC (Lifted via Callback)
    const [remoteUiFolders, setRemoteUiFolders] = useState<Folder[]>([]);
    const [remoteUiFolderCounts, setRemoteUiFolderCounts] = useState<Record<string, number>>({});
    const [activeRemoteUiFolderId, setActiveRemoteUiFolderId] = useState<string | null>(null);
    const remoteActionsRef = React.useRef<any>(null);

    const onFoldersLoaded = React.useCallback((folders: Folder[], counts: Record<string, number>) => {
        setRemoteUiFolders(folders);
        setRemoteUiFolderCounts(counts);
    }, []);

    const onActiveIdLoaded = React.useCallback((id: string | null) => {
        setActiveRemoteUiFolderId(id);
    }, []);

    const onActionsReady = React.useCallback((actions: any) => {
        remoteActionsRef.current = actions;
    }, []);

    // 2. LOCAL PROJECT LOGIC (Direct Hook)
    // Only fetch if NOT a remote project (to avoid double fetch or context errors)
    // WE PASS shouldSkip=isRemoteProject to prevent it from running against Main DB for remote projects
    const localUiData = useRemoteUiData(project.id, isRemoteProject, undefined, project.title, isRemoteProject); 

    // 3. MERGE / SELECT DATA SOURCE
    const uiFolders = isRemoteProject ? remoteUiFolders : localUiData.folders;
    const uiFolderCounts = isRemoteProject ? remoteUiFolderCounts : localUiData.folderCounts;
    const activeUiFolderId = isRemoteProject ? activeRemoteUiFolderId : localUiData.activeFolderId;

    // Handlers
    const handleSelectUiFolder = (id: string) => {
        if (isRemoteProject) {
            setActiveRemoteUiFolderId(id);
            remoteActionsRef.current?.handleSelectFolder(id);
        } else {
            localUiData.handleSelectFolder(id);
        }
    };

    const handleCreateUiFolder = (title: string) => {
        if (isRemoteProject) {
            remoteActionsRef.current?.createFolder(title);
        } else {
            localUiData.createFolder(title);
        }
    };

    const handleUpdateUiFolder = (id: string, title: string) => {
        if (isRemoteProject) {
            remoteActionsRef.current?.updateFolder(id, title);
        } else {
            localUiData.updateFolder(id, title);
        }
    };

    const handleDeleteUiFolder = (id: string) => {
        if (isRemoteProject) {
            remoteActionsRef.current?.deleteFolder(id);
        } else {
            localUiData.deleteFolder(id);
        }
    };

    const infoData = useInfoData(project.id);
    
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const { width: panelWidth, containerRef, startResizing } = usePanelResize(400);

    // Fallback if width is invalid (prevents NaN error)
    const safePanelWidth = isNaN(panelWidth) ? 400 : panelWidth;

    const SYSTEM_PROJECT_TITLES = ['Inbox', 'Today', 'Doing Now', 'Logs', 'Done', 'Logbook'];
    // const isRemoteProject = getRemoteConfig(project.title).type === 'remote'; // Removed duplicate declaration

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
                    
                    // UI Props (LIFTED)
                    uiFolders={uiFolders}
                    uiFolderCounts={uiFolderCounts}
                    activeUiFolderId={activeUiFolderId}
                    onSelectUiFolder={handleSelectUiFolder}
                    onCreateUiFolder={handleCreateUiFolder}
                    onUpdateUiFolder={handleUpdateUiFolder}
                    onDeleteUiFolder={handleDeleteUiFolder}

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
                
                {/* Remote UI View + Lifter (Always mounted if remote project) */}
                {hasRemote && isRemoteProject && (
                    <div className={clsx("absolute inset-0 w-full h-full bg-background z-20", activeRemoteTab !== 'ui' && "hidden")}>
                         <RemoteSyncProvider projectId={project.id} projectTitle={project.title}>
                             <RemoteDataLifter 
                                 projectId={project.id} 
                                 projectTitle={project.title}
                                 onFoldersLoaded={onFoldersLoaded}
                                 onActiveIdLoaded={onActiveIdLoaded}
                                 onActionsReady={onActionsReady}
                             />
                             <RemoteUiView 
                                projectId={project.id}
                                projectTitle={project.title}
                                activeFolderId={activeUiFolderId}
                             />
                         </RemoteSyncProvider>
                    </div>
                )}

                {/* Remote UI View for LOCAL projects (DaySync) - Mounted only when active */}
                {activeRemoteTab === 'ui' && !isRemoteProject && (
                    <div className="absolute inset-0 w-full h-full bg-background z-20">
                        <RemoteUiView 
                            projectId={project.id}
                            projectTitle={project.title}
                            activeFolderId={activeUiFolderId}
                        />
                    </div>
                )}

                {activeRemoteTab === 'info' ? (
                    <div className="absolute inset-0 w-full h-full bg-background z-20">
                        <InfoView projectId={project.id} />
                    </div>
                ) : activeRemoteTab === 'users' ? (
                    <div className="absolute inset-0 w-full h-full bg-background z-20">
                        <UsersView projectId={project.id} satelliteId={project.id} />
                    </div>
                ) : activeRemoteTab === 'logs' ? (
                    <div className="absolute inset-0 w-full h-full bg-background z-20">
                        <LogsView projectId={project.id} satelliteId={project.id} />
                    </div>
                ) : activeRemoteTab === 'tables' ? (
                    <div className="absolute inset-0 w-full h-full bg-background z-20">
                        <TablesView projectId={project.id} satelliteId={project.id} projectTitle={project.title} />
                    </div>
                ) : null}

                {/* Local Task List - Only show if NO remote tab is active */}
                {!activeRemoteTab && (
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
                            <DetailsPanel taskId={selectedTaskId} />
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


