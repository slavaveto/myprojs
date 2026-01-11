import React, { useState, useEffect } from 'react';
import { useQuery } from '@powersync/react';
import { clsx } from 'clsx';
import { ProjectV3 } from '../components/ProjectBar';
import { FolderTabs, FolderV3 } from '../components/FolderTabs';
import { TaskList, TaskV3 } from '../components/TaskList';
import { TaskDetails } from '../components/TaskDetails';
import { usePanelResize } from '../hooks/usePanelResize';
import { createLogger } from '@/utils/logger/Logger';
import { globalStorage } from '@/utils/storage';

const logger = createLogger('ProjectView');

interface ProjectViewProps {
    project: ProjectV3;
    isActive: boolean;
}

const ProjectViewComponent = ({ project, isActive }: ProjectViewProps) => {
    // Fetch folders for this project
    const { data: foldersData } = useQuery(
        'SELECT * FROM folders WHERE project_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY sort_order', 
        [project.id]
    );

    const folders: FolderV3[] = foldersData || [];
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
    const storageKey = `v3_project_active_folder_${project.id}`;

    // Restore/Sync Active Folder
    useEffect(() => {
        // Only run if we have folders
        if (folders.length > 0) {
            const savedId = globalStorage.getItem(storageKey);
            // Verify saved ID still exists in current folders
            const folderExists = savedId && folders.some(f => f.id === savedId);
            
            if (folderExists) {
                setActiveFolderId(savedId);
            } else {
                // Default to first folder if no saved/valid ID
                setActiveFolderId(folders[0].id);
            }
        } else {
            setActiveFolderId(null);
        }
    }, [foldersData, project.id]);

    // Save Active Folder on change
    const handleSelectFolder = (id: string) => {
        setActiveFolderId(id);
        globalStorage.setItem(storageKey, id);
    };

    // Fetch tasks for active folder
    const { data: tasksData } = useQuery(
        'SELECT * FROM tasks WHERE folder_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY sort_order', 
        [activeFolderId || 'NO_FOLDER'] // Safety check
    );
    const tasks: TaskV3[] = tasksData || [];
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Resize Hook (V2 Logic)
    const { width: panelWidth, containerRef, startResizing } = usePanelResize(400);
    const safePanelWidth = isNaN(panelWidth) ? 400 : panelWidth;

    // Handlers
    const handleCreateFolder = () => { logger.info('Create folder'); };
    const handleToggleTask = (id: string, isCompleted: boolean) => { logger.info('Toggle task', { id, isCompleted }); };

    return (
        <div className={clsx("flex flex-col h-full w-full bg-background", !isActive && "hidden")}>
            {/* Folders Navigation */}
            <FolderTabs 
                folders={folders}
                activeFolderId={activeFolderId}
                onSelectFolder={handleSelectFolder}
                onCreateFolder={handleCreateFolder}
            />

            {/* Split Content Area - Added min-h-0 to match V2 */}
            <div 
                ref={containerRef}
                className="flex-1 flex min-h-0 overflow-hidden relative"
            >
                {/* Left: Task List */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
                    {activeFolderId ? (
                        <TaskList 
                            tasks={tasks} 
                            selectedTaskId={selectedTaskId}
                            onSelectTask={setSelectedTaskId}
                            onToggleTask={handleToggleTask}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-default-400">
                            {folders.length === 0 
                                ? "This project has no folders yet." 
                                : "Select a folder to view tasks."}
                        </div>
                    )}
                </div>

                {/* Resize Handle (V2 Exact Copy) */}
                <div
                    className="w-[1px] relative z-30 cursor-col-resize group select-none"
                    onMouseDown={startResizing}
                >
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-default-200 group-hover:w-[3px] group-hover:bg-primary transition-all duration-300 delay-200 ease-out" />
                    
                    {/* Invisible hit area */}
                    <div className="absolute inset-y-0 -left-1 -right-1 z-10 bg-transparent" />
                </div>

                {/* Right: Task Details */}
                <div 
                    style={{ width: safePanelWidth }}
                    className="flex-shrink-0 bg-content2/50 overflow-y-auto z-10"
                >
                    <TaskDetails taskId={selectedTaskId} />
                </div>
            </div>
        </div>
    );
};

export const ProjectView = React.memo(ProjectViewComponent, (prev, next) => {
    // Only re-render if visibility changes
    if (prev.isActive !== next.isActive) return false;
    // If hidden, don't re-render on data changes
    if (!next.isActive) return true;
    
    // Simple prop check
    return prev.project.id === next.project.id && prev.project.title === next.project.title;
});
