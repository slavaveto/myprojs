import React from 'react';
import { ProjectV3 } from '../components/ProjectBar';
import { Header } from '../components/Header';

interface ProjectViewProps {
    project: ProjectV3;
}

export const ProjectView = ({ project }: ProjectViewProps) => {
    return (
        <div className="flex flex-col h-full w-full bg-background">
            <Header activeProject={project} />
            
            <div className="flex-1 p-8">
                {/* Место для FolderTabs и TaskList */}
                <h2 className="text-gray-400">Project View Content Placeholder</h2>
            </div>
        </div>
    );
};

