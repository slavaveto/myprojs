import React from 'react';
import { EllipsisVertical, Search, Bell } from 'lucide-react';
import { Button, Avatar } from '@heroui/react';
import { ProjectV3 } from './ProjectBar';

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
    activeProject: ProjectV3 | undefined;
}

export const Header = ({ activeProject }: HeaderProps) => {
    const title = activeProject ? activeProject.title : "DaySync";
    const colorStyle = activeProject?.proj_color ? { backgroundColor: activeProject.proj_color } : {};

    return (
        <header className="flex-none px-6 py-3 border-b border-default-200 bg-background z-10 flex flex-col gap-4">
             <div className="grid grid-cols-[1fr_auto_1fr] items-center min-h-[32px] gap-4">
                
                {/* Left: Title & Context */}
                <div className="flex items-center gap-3 justify-self-start pl-1">
                    {activeProject && (
                        <div 
                            className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm border border-white/10 transition-colors duration-300" 
                            style={colorStyle}
                        />
                    )}
                    
                    <h1 className="text-xl font-bold text-foreground truncate max-w-[300px]">
                        {title}
                    </h1>

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

                {/* Right: Actions */}
                <div className="flex items-center gap-3 justify-self-end">
                    {/* Placeholder for future SyncIndicator */}
                    <div className="w-8 h-8 flex items-center justify-center border rounded-full border-dashed border-gray-300 text-gray-300 text-xs" title="Sync Status Placeholder">S</div>
                    <UserMenu />
                </div>
             </div>
        </header>
    );
};

