import React from 'react';
import { clsx } from 'clsx';
import { 
    LayoutGrid, 
    Plus, 
    Inbox, 
    Star, 
    Target, 
    CheckCircle2, 
    FileText 
} from 'lucide-react';
import { Button, Chip } from '@heroui/react';
import { Project } from '@/app/types';

// --- Components Types ---

interface SidebarItemProps {
    icon: any;
    label: string;
    onClick?: () => void;
    isActive?: boolean;
    count?: number;
}

const SidebarItem = ({ icon: Icon, label, onClick, isActive, count }: SidebarItemProps) => (
    <button
        onClick={onClick}
        className={clsx(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left cursor-pointer select-none mb-1',
            'text-foreground',
            isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-default-100 text-default-600'
        )}
    >
        <Icon 
            size={20} 
            className={clsx(
                (count && count > 0 && label === 'Doing Now') 
                   ? 'text-danger'
                   : (count && count > 0 && label === 'Today') 
                      ? 'text-warning'
                      : (count && count > 0 && label === 'Inbox')
                         ? 'text-primary'
                         : (isActive ? 'text-primary' : 'text-default-500')
            )}
            fill={((label === 'Today') && count && count > 0) ? "currentColor" : "none"}
        />
        <span className="truncate flex-grow text-sm">{label}</span>
        {count !== undefined && count > 0 && (
            <Chip 
                size="sm" 
                variant="flat" 
                className={clsx(
                   "h-5 min-w-5 px-1 text-[10px] font-medium",
                   label === 'Doing Now' && "bg-danger/10 text-danger",
                   label === 'Today' && "bg-warning/10 text-warning",
                   label === 'Inbox' && "bg-primary/10 text-primary"
                )}
            >
                {count}
            </Chip>
        )}
    </button>
);

interface ProjectBarProps {
    projects: Project[]; // PowerSync projects
    activeProjectId: string | null;
    activeSystemTab: string | null;
    onSelectProject: (id: string) => void;
    onSelectSystemTab: (tab: string) => void;
    onCreateProject?: () => void;
}

export const ProjectBar = ({
    projects,
    activeProjectId,
    activeSystemTab,
    onSelectProject,
    onSelectSystemTab,
    onCreateProject
}: ProjectBarProps) => {
    return (
        <aside className="w-[250px] flex-shrink-0 border-r border-default-200 bg-default-50 flex flex-col z-20 h-full">
            {/* Header */}
            <div className="p-4 border-b border-default-200/50 flex items-center justify-between bg-yellow-100/10">
                <div className="flex items-center gap-2 font-bold text-lg min-w-0 text-default-700">
                    <LayoutGrid size={24} className="text-primary flex-shrink-0" />
                    <span className="truncate">DaySync v2</span>
                </div>
                
                <Button 
                    isIconOnly 
                    size="sm" 
                    variant="flat" 
                    color="success" 
                    className="bg-green-100 text-green-700"
                    onClick={onCreateProject}
                >
                    <Plus size={20} />
                </Button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-grow overflow-y-auto px-2 py-3 space-y-6">
                
                {/* System Tabs */}
                <div>
                    <SidebarItem
                        icon={Inbox}
                        label="Inbox"
                        isActive={activeSystemTab === 'inbox'}
                        onClick={() => onSelectSystemTab('inbox')}
                    />
                    <SidebarItem
                        icon={Star}
                        label="Today"
                        isActive={activeSystemTab === 'today'}
                        onClick={() => onSelectSystemTab('today')}
                    />
                    <SidebarItem
                        icon={Target}
                        label="Doing Now"
                        isActive={activeSystemTab === 'doing_now'}
                        onClick={() => onSelectSystemTab('doing_now')}
                    />
                </div>

                {/* Projects List */}
                <div>
                    <div className="px-2 pb-2 text-xs font-semibold text-default-400 uppercase tracking-wider">
                        My Projects ({projects.length})
                    </div>
                    
                    <div className="space-y-0.5">
                        {projects.map(project => (
                            <div 
                                key={project.id}
                                onClick={() => onSelectProject(project.id)}
                                className={clsx(
                                    "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium",
                                    activeProjectId === project.id 
                                        ? "bg-primary/10 text-primary" 
                                        : "text-default-600 hover:bg-default-200/50"
                                )}
                            >
                                <div 
                                    className="w-[20px] h-2.5 rounded-full shadow-sm flex-shrink-0" 
                                    style={{ backgroundColor: project.proj_color || '#999' }} 
                                />
                                <span className="flex-1 truncate">{project.title}</span>
                            </div>
                        ))}
                        
                        {projects.length === 0 && (
                            <div className="px-4 py-4 text-xs text-default-400 text-center">
                                No projects yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom Tabs */}
                <div>
                    <div className="border-t border-default-200 mx-2 mb-2 opacity-50"/>
                    <SidebarItem
                        icon={CheckCircle2}
                        label="Done"
                        isActive={activeSystemTab === 'done'}
                        onClick={() => onSelectSystemTab('done')}
                    />
                    <SidebarItem
                        icon={FileText}
                        label="Logs"
                        isActive={activeSystemTab === 'logs'}
                        onClick={() => onSelectSystemTab('logs')}
                    />
                </div>

            </div>
        </aside>
    );
};

