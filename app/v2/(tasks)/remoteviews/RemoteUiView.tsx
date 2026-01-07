import React, { useState } from 'react';
import { TaskList } from '../components/TaskList';
import { Task } from '@/app/types';

interface RemoteUiViewProps {
    tasks: Task[];
    activeFolderId: string | null;
    updateTask: (id: string, updates: Partial<Task>) => void;
}

export const RemoteUiView = ({ tasks, activeFolderId, updateTask }: RemoteUiViewProps) => {
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
            <div className="flex-1 flex min-h-0 overflow-hidden relative">
                {/* Left: Remote Task List */}
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
                            <div className="text-center">
                                <h2 className="text-xl font-bold text-foreground mb-2">Remote UI</h2>
                                <p>Select a folder to view items</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Details Panel Placeholder */}
                <div className="w-[400px] flex-shrink-0 border-l border-default-200 bg-content2/50 p-6 overflow-y-auto z-20">
                     {selectedTaskId ? (
                        <div className="text-default-500">
                            Details for remote task {selectedTaskId} <br/>
                            (Edit logic pending implementation)
                        </div>
                     ) : (
                        <div className="h-full flex items-center justify-center text-default-400">
                            Select an item to view details
                        </div>
                     )}
                </div>
            </div>
        </div>
    );
};

