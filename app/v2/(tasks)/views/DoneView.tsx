import React from 'react';
import { useQuery } from '@powersync/react';
import { Task } from '@/app/types';
import { Checkbox } from '@heroui/react';
import { clsx } from 'clsx';
import { usePowerSync } from '@/app/_services/powerSync/SyncProvider';

interface DoneViewProps {
    isActive: boolean;
}

const DoneViewComponent = ({ isActive }: DoneViewProps) => {
    const powerSync = usePowerSync();

    // Query completed tasks
    const { data: tasksData } = useQuery(
        `SELECT * FROM tasks 
         WHERE is_completed = 1 
           AND (is_deleted IS NULL OR is_deleted = 0)
         ORDER BY updated_at DESC LIMIT 100`
    );
    
    const tasks: Task[] = tasksData || [];

    // Handler to restore task (uncomplete)
    const handleRestore = async (taskId: string) => {
        if (!powerSync) return;
        await powerSync.execute(
            `UPDATE tasks SET is_completed = 0, updated_at = datetime('now') WHERE id = ?`,
            [taskId]
        );
    };

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
     
            
            <div className="flex-1 overflow-y-auto p-4">
                {tasks.length === 0 ? (
                    <div className="text-center text-default-400 py-10">No completed tasks yet.</div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {tasks.map(task => (
                            <div 
                                key={task.id}
                                className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-default-50 transition-colors border border-transparent hover:border-default-200"
                            >
                                {/* Restore Checkbox */}
                                <div className="flex-shrink-0 pt-0.5">
                                    <Checkbox 
                                        isSelected={true} 
                                        color="success"
                                        radius="sm"
                                        size="md"
                                        onValueChange={() => handleRestore(task.id)}
                                        className="opacity-60 hover:opacity-100 transition-opacity"
                                    />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-default-600 line-through opacity-70 truncate">
                                        {task.content?.replace(/<[^>]*>/g, '') || 'Empty task'}
                                    </div>
                                    <div className="text-[10px] text-default-400">
                                        Completed: {new Date(task.updated_at).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export const DoneView = React.memo(DoneViewComponent, (prev, next) => {
    if (prev.isActive !== next.isActive) return false;
    if (!next.isActive) return true;
    return false;
});

