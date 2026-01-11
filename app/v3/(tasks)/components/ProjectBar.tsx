import React from 'react';
import { clsx } from 'clsx';
import { 
    CircleCheckBig, 
    Inbox, 
    Star, 
    Target, 
    CheckCircle2, 
    FileText 
} from 'lucide-react';

// Minimal Project type for V3 UI
export interface ProjectV3 {
    id: string;
    title: string;
    proj_color?: string;
    icon?: React.ReactNode;
}

interface SidebarItemProps {
    icon: any;
    label: string;
    isActive: boolean;
    onClick: () => void;
    colorClass?: string;
}

const SidebarItem = ({ icon: Icon, label, isActive, onClick, colorClass }: SidebarItemProps) => (
    <div 
        onClick={onClick}
        className={clsx(
            "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium",
            isActive 
                ? "bg-primary/10 text-primary" 
                : "text-default-600 hover:bg-default-200/50"
        )}
    >
        <Icon 
            size={20} 
            className={clsx(
                isActive ? "text-primary" : (colorClass || "text-default-500")
            )} 
        />
        <span className="flex-1 truncate">{label}</span>
    </div>
);

interface ProjectBarProps {
    projects: ProjectV3[];
    activeProjectId: string | null;
    onSelectProject: (id: string) => void;
}

export const ProjectBar = ({
    projects,
    activeProjectId,
    onSelectProject,
}: ProjectBarProps) => {

    return (
        <aside className="w-[250px] flex-shrink-0 border-r border-default-200 bg-default-50 flex flex-col z-20 h-full">
            {/* Header */}
            <div className="p-4 border-b border-default-200/50 flex items-center justify-between bg-yellow-100/10">
                <div className="flex items-center gap-2 font-bold text-lg min-w-0 text-default-700">
                    <CircleCheckBig size={24} className="text-orange-500 flex-shrink-0" />
                    <span className="truncate">DaySync V3</span>
                </div>
            </div>

            {/* Scrollable Content */}
            <div className="flex-grow overflow-y-auto px-2 py-3 flex flex-col gap-6">
                
                {/* Top: System Tabs (Inbox, Today, Doing) */}
                <div className="space-y-0.5">
                    <SidebarItem 
                        icon={Inbox} 
                        label="Inbox" 
                        isActive={activeProjectId === 'filter_inbox'} 
                        onClick={() => onSelectProject('filter_inbox')}
                        colorClass="text-blue-500"
                    />
                    <SidebarItem 
                        icon={Star} 
                        label="Сегодня" 
                        isActive={activeProjectId === 'filter_today'} 
                        onClick={() => onSelectProject('filter_today')}
                        colorClass="text-yellow-500"
                    />
                    <SidebarItem 
                        icon={Target} 
                        label="В работе" 
                        isActive={activeProjectId === 'filter_doing'} 
                        onClick={() => onSelectProject('filter_doing')}
                        colorClass="text-red-500"
                    />
                </div>

                {/* Middle: Projects List */}
                <div>
                    <div className="px-2 pb-2 text-xs font-semibold text-default-400 uppercase tracking-wider flex justify-between items-center">
                        <span>My Projects</span>
                        <span className="text-[10px] bg-default-200 px-1.5 py-0.5 rounded-full">{projects.length}</span>
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
                                <div className="w-[20px] flex items-center justify-center">
                                    <div 
                                        className="w-2.5 h-2.5 rounded-full shadow-sm flex-shrink-0" 
                                        style={{ backgroundColor: project.proj_color || '#999' }} 
                                    />
                                </div>
                                <span className="flex-1 truncate">{project.title}</span>
                            </div>
                        ))}
                        
                        {projects.length === 0 && (
                            <div className="px-4 py-4 text-xs text-default-400 text-center italic">
                                No projects yet.
                            </div>
                        )}
                    </div>
                </div>

                {/* Bottom: Archive Tabs (Done, Logs) */}
                <div>
                    <div className="border-t border-default-200 mx-2 mb-2 opacity-50"/>
                    <div className="space-y-0.5">
                        <SidebarItem 
                            icon={CheckCircle2} 
                            label="Выполнено" 
                            isActive={activeProjectId === 'filter_done'} 
                            onClick={() => onSelectProject('filter_done')}
                        />
                        <SidebarItem 
                            icon={FileText} 
                            label="Лог" 
                            isActive={activeProjectId === 'filter_logs'} 
                            onClick={() => onSelectProject('filter_logs')}
                        />
                    </div>
                </div>

            </div>
        </aside>
    );
};
