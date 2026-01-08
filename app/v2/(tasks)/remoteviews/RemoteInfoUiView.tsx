import React, { useState } from 'react';
import { Task } from '@/app/types';
import { TaskList } from '../components/TaskList';
import { DetailsPanel } from '../components/DetailsPanel';
import { usePanelResize } from '../hooks/usePanelResize';
import { Button } from '@heroui/react';
import { Plus } from 'lucide-react';
import { FolderFormPopover } from '../components/FolderFormPopover';

interface RemoteInfoUiViewProps {
    title?: string; // 'Remote UI' or 'Info'
    tasks: Task[];
    activeFolderId: string | null;
    updateTask: (id: string, updates: Partial<Task>) => void;
    onCreateFolder?: (title: string) => void;
}

export const RemoteInfoUiView = ({ 
    title = 'Remote View',
    tasks, 
    activeFolderId, 
    updateTask,
    onCreateFolder
}: RemoteInfoUiViewProps) => {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const { width: panelWidth, containerRef, startResizing } = usePanelResize(400);
    const safePanelWidth = isNaN(panelWidth) ? 400 : panelWidth;

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
            <div 
                ref={containerRef}
                className="flex-1 flex min-h-0 overflow-hidden relative"
            >
                {/* Left: Task List */}
                <div className="flex-1 overflow-y-scroll p-6 bg-background">
                    {activeFolderId ? (
                        <TaskList 
                            tasks={tasks}
                            onSelectTask={setSelectedTaskId}
                            selectedTaskId={selectedTaskId}
                            onUpdateTask={updateTask}
                        />
                    ) : (
                        <div className="border-2 border-dashed border-default-200 rounded-xl h-full flex items-center justify-center text-default-400">
                            <div className="text-center flex flex-col items-center gap-4">
                                <div>
                                    <h2 className="text-xl font-bold text-foreground mb-2">{title}</h2>
                                    <p>Select a folder to view items</p>
                                </div>

                                {onCreateFolder && (
                                    <FolderFormPopover
                                        mode="create"
                                        onSubmit={onCreateFolder}
                                        trigger={
                                            <Button 
                                                color="primary" 
                                                variant="flat"
                                                startContent={<Plus size={20} />}
                                            >
                                                Create First Folder
                                            </Button>
                                        }
                                    />
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Resize Handle */}
                <div
                    className="w-[1px] relative z-30 cursor-col-resize group select-none"
                    onMouseDown={startResizing}
                >
                    {/* Visual Line: expands symmetrically from center */}
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-default-200 group-hover:w-[3px] group-hover:bg-primary transition-all duration-150" />
                    
                    {/* Invisible hit area */}
                    <div className="absolute inset-y-0 -left-1 -right-1 z-10 bg-transparent" />
                </div>

                {/* Right: Details Panel */}
                <div 
                    style={{ width: safePanelWidth }}
                    className="flex-shrink-0 bg-content2/50 overflow-y-auto z-10"
                >
                    <DetailsPanel 
                        taskId={selectedTaskId} 
                    />
                </div>
            </div>
        </div>
    );
};

