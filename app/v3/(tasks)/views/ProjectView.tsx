import React, { useState, useEffect } from 'react';
import { useQuery } from '@powersync/react';
import { ProjectV3 } from '../components/ProjectBar';
import { Header } from '../components/Header';
import { FolderTabs, FolderV3 } from '../components/FolderTabs';
import { TaskList, TaskV3 } from '../components/TaskList';

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

            <div className="flex-1 p-6 md:p-8 bg-default-50 overflow-y-auto">
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
        </div>
    );
};
