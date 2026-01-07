'use client';

import React from 'react';
import { clsx } from 'clsx';
import { EllipsisVertical, Search, Bell, Settings, User } from 'lucide-react';
import { Button, Avatar } from '@heroui/react';
import { usePowerSync } from '@/app/_services/powerSync/PowerSyncProvider';
import { useQuery, useStatus } from '@powersync/react';

// --- LOCAL MOCK COMPONENTS (to avoid dependency hell) ---

const MockGlobalSearch = () => (
    <div className="relative w-full max-w-[240px]">
        <div className="flex items-center px-3 py-1.5 bg-default-100 rounded-lg text-default-500 gap-2 text-sm border border-transparent hover:border-default-300 transition-colors cursor-text">
            <Search size={14} />
            <span>Search...</span>
            <div className="ml-auto text-[10px] border border-default-300 rounded px-1">⌘K</div>
        </div>
    </div>
);

const MockUserMenu = () => (
    <div className="flex items-center gap-2">
        <Button isIconOnly variant="light" size="sm" className="text-default-500">
            <Bell size={18} />
        </Button>
        <Avatar src="https://i.pravatar.cc/150?u=a042581f4e29026024d" size="sm" className="cursor-pointer" />
    </div>
);

export default function TasksPage() {
  const powerSync = usePowerSync();
  const status = useStatus();
  
  // PowerSync Query: Real-time sync from SQLite
  const { data: projectsData, isLoading, error } = useQuery('SELECT * FROM projects ORDER BY sort_order ASC');
  
  const projects = projectsData || [];
  
  // DEBUG INFO
  // const status = powerSync.currentStatus; // OLD: Not reactive
  
  const activeProject = projects.length > 0 ? projects[0] : { id: '0', title: 'Loading...', color: '#ccc' };

  // --- MOCK FOLDERS & TASKS (Still mock for now) ---
  const FOLDERS = [
      { id: 'f1', title: 'Inbox', count: 5, isActive: false },
      { id: 'f2', title: 'To Do', count: 5, isActive: true },
      { id: 'f3', title: 'Done', count: 5, isActive: false },
  ];

  const TASKS = Array.from({ length: 15 }, (_, i) => ({
      id: `t${i}`,
      content: `Task Item ${i + 1} - Exact Visual Copy`,
      is_completed: i % 3 === 0,
      is_group: false
  }));

  return (
    <div className="flex h-screen w-full overflow-hidden bg-background text-foreground font-sans">
        
        {/* LEFT SIDEBAR (Projects) */}
        <div className="w-[260px] flex-shrink-0 border-r border-default-200 bg-default-50 flex flex-col">
            {/* Sidebar Header */}
            <div className="flex flex-col px-4 py-2 border-b border-default-200/50 bg-yellow-100/10">
                <div className="font-bold text-lg text-default-700">My Projects (PowerSync)</div>
                {/* DEBUG STATUS TOP */}
                <div className="mt-1 text-[10px] font-mono leading-tight text-default-500">
                    <div className="flex items-center gap-1">
                        Status: <span className={status?.connected ? "text-green-600 font-bold" : "text-red-500 font-bold"}>
                            {status?.connected ? 'CONNECTED' : 'DISCONNECTED'}
                        </span>
                    </div>
                    <div>Sync: {status?.lastSyncedAt?.toLocaleTimeString() || 'Waiting...'}</div>
                    <div>Count: {projects.length}</div>
                    {error && <div className="text-red-500 bg-red-50 p-1 rounded mt-1">SQL: {error.message}</div>}
                </div>
            </div>
            
            {/* Project List */}
            <div className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
                {projects.map((proj: any) => (
                    <div 
                        key={proj.id} 
                        className={clsx(
                            "group flex items-center gap-3 px-3 py-2 rounded-lg cursor-pointer transition-colors text-sm font-medium",
                            // Mock active check for now
                            proj.id === activeProject.id 
                                ? "bg-primary/10 text-primary" 
                                : "text-default-600 hover:bg-default-200/50"
                        )}
                    >
                        <div 
                            className={clsx("w-2.5 h-2.5 rounded-full shadow-sm")} 
                            style={{ backgroundColor: proj.proj_color || '#999' }} 
                        />
                        <span className="flex-1 truncate">{proj.title}</span>
                    </div>
                ))}
                {projects.length === 0 && (
                    <div className="px-4 py-4 text-xs text-default-400 text-center">
                        No projects found. Check sync.
                    </div>
                )}
            </div>

        </div>

        {/* MAIN CONTENT AREA */}
        <div className="flex-1 flex flex-col min-w-0 bg-background">
            
            {/* HEADER */}
            <div className="flex-none px-6 py-4 border-b border-default-200 bg-background z-10 flex flex-col gap-4">
                 <div className="grid grid-cols-[1fr_auto_1fr] items-center min-h-[20px] gap-4">
                    {/* Title Area */}
                    <div className="flex items-center gap-2 justify-self-start pl-1">
                        <div 
                            className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm border border-white/10" 
                            style={{ backgroundColor: activeProject.proj_color || activeProject.color }}
                        />
                        <h1 className="text-xl font-bold text-foreground leading-none pt-0.5">{activeProject.title}</h1>
                        <Button isIconOnly size="sm" variant="light" className="text-default-400 hover:text-default-600 -ml-1">
                            <EllipsisVertical size={18} />
                        </Button>
                    </div>
                    
                    {/* Global Search Center */}
                    <div className="w-full max-w-[240px] justify-self-center">
                        <MockGlobalSearch />
                    </div>

                    {/* Right Actions */}
                    <div className="flex items-center gap-2 justify-self-end">
                        <span className="text-xs text-green-500 font-mono flex items-center gap-1">
                             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"/>
                             POWER
                        </span>
                        <MockUserMenu />
                    </div>
                 </div>
            </div>

            {/* FOLDER TABS - Exact visual match */}
            {/* Using a wrapper to match padding and background */}
            <div className="px-6 py-2 bg-background/50 flex-none z-10 border-b border-transparent backdrop-blur-sm sticky top-0">
                <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                    {FOLDERS.map(folder => (
                        <div 
                            key={folder.id} 
                            className={clsx(
                                "relative flex items-center px-4 py-1.5 rounded-full cursor-pointer text-sm font-medium transition-all select-none border",
                                folder.isActive 
                                    ? "bg-default-100 text-default-900 border-default-200 shadow-sm" 
                                    : "bg-transparent text-default-500 border-transparent hover:bg-default-50 hover:text-default-700"
                            )}
                        >
                            {folder.title}
                            <span className={clsx(
                                "ml-2 text-[10px] font-bold",
                                folder.isActive ? "text-default-500" : "text-default-400"
                            )}>{folder.count}</span>
                        </div>
                    ))}
                    
                    {/* Add Folder Button Mock */}
                    <button className="w-7 h-7 rounded-full flex items-center justify-center text-default-400 hover:bg-default-100 transition-colors ml-1">
                        +
                    </button>
                </div>
            </div>

            {/* TASK LIST (Scrollable) */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden bg-background">
                <div className="flex-grow px-6 py-4 pt-2">
                    <div className="flex flex-col gap-[3px] min-h-[50px]">
                        {TASKS.map(task => (
                            <div 
                                key={task.id} 
                                className={clsx(
                                    "group px-1 flex justify-between min-h-[30px] items-center rounded border border-default-300 bg-content1 transition-colors outline-none",
                                    "hover:bg-default-50 border-l-[3px] border-l-default-300" // Default border style
                                )}
                            >
                                <div className="flex flex-1 gap-1 flex-row items-center">
                                    {/* Drag Handle */}
                                    <div className="cursor-grab text-default-400 hover:text-default-600 p-[2px] rounded text-center opacity-0 group-hover:opacity-100 transition-opacity">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="12" r="1"/><circle cx="9" cy="5" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="15" cy="19" r="1"/></svg>
                                    </div>

                                    {/* Custom Checkbox Mock */}
                                    <div className={clsx(
                                        "w-4 h-4 rounded border flex items-center justify-center cursor-pointer transition-colors mr-2 ml-0",
                                        task.is_completed ? "bg-primary border-primary" : "border-default-400 hover:border-default-500 bg-transparent"
                                    )}>
                                        {task.is_completed && <CheckIcon />}
                                    </div>

                                    {/* Content (Simulating RichEditableCell look) */}
                                    <div className={clsx(
                                        "flex-1 py-1 text-sm text-default-700",
                                        task.is_completed && "text-default-400 line-through opacity-70"
                                    )}>
                                        {task.content}
                                    </div>
                                    
                                    {/* Hover Actions (Mock) */}
                                    <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 pr-2 transition-opacity">
                                        <button className="p-1 text-default-400 hover:text-default-600 rounded"><Settings size={14} /></button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    </div>
  );
}

// Helper Icon
const CheckIcon = () => (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
    </svg>
);
