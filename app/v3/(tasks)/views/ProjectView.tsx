import React, { useState, useEffect } from 'react';
import { useQuery } from '@powersync/react';
import { ProjectV3 } from '../components/ProjectBar';
import { Header } from '../components/Header';
import { FolderTabs, FolderV3 } from '../components/FolderTabs';

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
    }, [foldersData, project.id]); // React to data load or project switch

    // Handler to create folder (placeholder for now)
    const handleCreateFolder = () => {
        console.log('Create folder logic here');
    };

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

            <div className="flex-1 p-8 bg-default-50">
                {/* TaskList placeholder */}
                <div className="border-2 border-dashed border-gray-200 rounded-lg p-8 flex items-center justify-center text-gray-400">
                    {activeFolderId 
                        ? `Tasks for folder: ${folders.find(f => f.id === activeFolderId)?.title || activeFolderId}` 
                        : 'No folder selected'}
                </div>
            </div>
        </div>
    );
};
