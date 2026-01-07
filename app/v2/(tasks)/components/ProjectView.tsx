import React, { useState } from 'react';
import { Project } from '@/app/types';
import { FolderTabs } from './FolderTabs';
import { TaskList } from './TaskList';
import { DetailsPanel } from './DetailsPanel';
import { clsx } from 'clsx';
import { useProjectView } from '../hooks/useProjectView';

interface ProjectViewProps {
    project: Project;
    isActive: boolean;
}

const ProjectViewComponent = ({ project, isActive }: ProjectViewProps) => {
    const { folders, activeFolderId, handleSelectFolder } = useProjectView(project, isActive);
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    return (
        <div className={clsx("flex flex-col h-full w-full", !isActive && "hidden")}>
            
            {/* Folder Tabs Area */}
            {folders.length > 0 && (
                <FolderTabs 
                    folders={folders}
                    activeFolderId={activeFolderId}
                    onSelectFolder={handleSelectFolder}
                    onCreateFolder={() => console.log('Create Folder in', project.title)}
                    // Fix framer-motion jump: unique layoutId per project
                    layoutIdPrefix={`project-${project.id}`}
                />
            )}

            {/* Split Content Area */}
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
                
                {/* Left: Task List */}
                <div className="flex-1 overflow-y-scroll p-6 bg-background">
                    {activeFolderId ? (
                        <TaskList 
                            folderId={activeFolderId} 
                            projectId={project.id} 
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

                {/* Right: Details Panel */}
                <DetailsPanel 
                    taskId={selectedTaskId} 
                />
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


