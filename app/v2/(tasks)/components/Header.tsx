import React from 'react';
import { EllipsisVertical, Search, Bell, Inbox, Star, Target, CheckCircle2, FileText } from 'lucide-react';
import { Button, Avatar } from '@heroui/react';
import { SyncIndicator } from './misc/SyncIndicator';
import { Project } from '@/app/types';

// Mock Search Component (Placeholder)
const GlobalSearch = () => (
    <div className="relative w-full max-w-[240px]">
        <div className="flex items-center px-3 py-1.5 bg-default-100 rounded-lg text-default-500 gap-2 text-sm border border-transparent hover:border-default-300 transition-colors cursor-text">
            <Search size={14} />
            <span>Search...</span>
            <div className="ml-auto text-[10px] border border-default-300 rounded px-1">⌘K</div>
        </div>
    </div>
);

// Mock User Menu (Placeholder)
const UserMenu = () => (
    <div className="flex items-center gap-2">
        <Button isIconOnly variant="light" size="sm" className="text-default-500">
            <Bell size={18} />
        </Button>
        <Avatar 
            src="https://i.pravatar.cc/150?u=a042581f4e29026024d" 
            size="sm" 
            className="cursor-pointer transition-transform hover:scale-105" 
        />
    </div>
);

interface HeaderProps {
    activeProject: Project | undefined;
    activeSystemTab: string | null;
}

export const Header = ({ activeProject, activeSystemTab }: HeaderProps) => {
    
    // Determine title based on context
    let title = "DaySync";
    let colorStyle = {};
    let iconClass = "text-default-500";
    let Icon = null;
    let iconFill = "none";

    if (activeProject) {
        title = activeProject.title;
        
        // System Projects Handling
        if (['Inbox', 'Today', 'Doing Now', 'Done', 'Logs', 'Logbook'].includes(activeProject.title)) {
             switch (activeProject.title) {
                case 'Inbox': Icon = Inbox; iconClass = "text-primary"; break;
                case 'Today': Icon = Star; iconClass = "text-warning"; iconFill = "currentColor"; break;
                case 'Doing Now': Icon = Target; iconClass = "text-danger"; break;
                case 'Done': Icon = CheckCircle2; iconClass = "text-success"; break;
                case 'Logs': case 'Logbook': Icon = FileText; iconClass = "text-default-500"; break;
             }
        } else {
            // Regular Projects
            // @ts-ignore
            const color = activeProject.proj_color || activeProject.color || '#333';
            colorStyle = { backgroundColor: color };
        }
    } else if (activeSystemTab) {
        switch (activeSystemTab) {
            case 'inbox': 
                title = "Inbox"; 
                iconClass = "text-primary"; 
                Icon = Inbox; 
                break;
            case 'today': 
                title = "Today"; 
                iconClass = "text-warning"; 
                Icon = Star; 
                iconFill = "currentColor"; 
                break;
            case 'doing_now': 
                title = "Doing Now"; 
                iconClass = "text-danger"; 
                Icon = Target; 
                break;
            case 'done': 
                title = "Completed Tasks"; 
                iconClass = "text-success"; 
                Icon = CheckCircle2; 
                break;
            case 'logs': 
                title = "Activity Logs"; 
                iconClass = "text-default-500"; 
                Icon = FileText; 
                break;
        }
    }

    return (
        <header className="flex-none px-6 py-3 border-b border-default-200 bg-background z-10 flex flex-col gap-4">
             <div className="grid grid-cols-[1fr_auto_1fr] items-center min-h-[32px] gap-4">
                
                {/* Left: Title & Context */}
                <div className="flex items-center gap-3 justify-self-start pl-1">
                    {/* Color Dot / Icon */}
                    {activeProject ? (
                        <div 
                            className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm border border-white/10 transition-colors duration-300" 
                            style={colorStyle}
                        />
                    ) : Icon ? (
                        <Icon size={24} className={iconClass} fill={iconFill} />
                    ) : null}
                    
                    {/* Title */}
                    <h1 className="text-xl font-bold text-foreground  truncate max-w-[300px]">
                        {title}
                    </h1>

                    {/* Actions (Only for projects) */}
                    {activeProject && (
                        <Button isIconOnly size="sm" variant="light" className="text-default-400 hover:text-default-600 -ml-1">
                            <EllipsisVertical size={18} />
                        </Button>
                    )}
                </div>
                
                {/* Center: Global Search */}
                <div className="w-full max-w-[320px] justify-self-center hidden md:block">
                    <GlobalSearch />
                </div>

                {/* Right: Actions & Sync */}
                <div className="flex items-center gap-3 justify-self-end">
                    <div className="flex items-center gap-2 pr-2 border-r border-default-200">
                        <SyncIndicator />
                    </div>
                    <UserMenu />
                </div>
             </div>
        </header>
    );
};

