import React, { useState, useEffect } from 'react';
import { useQuery } from '@powersync/react';
import { ProjectV3 } from '../components/ProjectBar';
import { Header } from '../components/Header';
import { FolderTabs, FolderV3 } from '../components/FolderTabs';
import { TaskList, TaskV3 } from '../components/TaskList';
import { DetailsPanel } from '../components/DetailsPanel';
import { usePanelResize } from '../hooks/usePanelResize';

interface ProjectViewProps {
    project: ProjectV3;
}

export const ProjectView = ({ project }: ProjectViewProps) => {
    // Fetch folders for this project
    const { data: foldersData } = useQuery(
        'SELECT * FROM folders WHERE project_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY sort_order', 
        [project.id]
    );

    const folders: FolderV3[] = foldersData || [];
    const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

    // Auto-select first folder if none selected
    useEffect(() => {
        if (folders.length > 0 && !activeFolderId) {
             setActiveFolderId(folders[0].id);
        } else if (folders.length === 0) {
             setActiveFolderId(null);
        }
    }, [foldersData, project.id]);

    // Fetch tasks for active folder
    const { data: tasksData } = useQuery(
        'SELECT * FROM tasks WHERE folder_id = ? AND (is_deleted = 0 OR is_deleted IS NULL) ORDER BY sort_order', 
        [activeFolderId || 'NO_FOLDER'] // Safety check
    );
    const tasks: TaskV3[] = tasksData || [];
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Resize Hook (V2 Logic)
    const { width: panelWidth, containerRef, startResizing } = usePanelResize(400);
    // Fallback if width is invalid (prevents NaN error)
    const safePanelWidth = isNaN(panelWidth) ? 400 : panelWidth;

    // Handlers (Placeholders)
    const handleCreateFolder = () => { console.log('Create folder'); };
    const handleToggleTask = (id: string, isCompleted: boolean) => { console.log('Toggle task', id, isCompleted); };

    return (
        <div className="flex flex-col h-full w-full bg-background">
            <Header activeProject={project} />
            
            {/* Folders Navigation */}
            <FolderTabs 
                folders={folders}
                activeFolderId={activeFolderId}
                onSelectFolder={setActiveFolderId}
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
            </div>
        </div>
    );
};
