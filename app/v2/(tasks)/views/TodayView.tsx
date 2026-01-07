import React from 'react';
import { useQuery } from '@powersync/react';
import { Task } from '@/app/types';
import { clsx } from 'clsx';
import { TaskList } from '../components/TaskList'; // Reusing TaskList component logic or creating similar list

interface TodayViewProps {
    isActive: boolean;
}

const TodayViewComponent = ({ isActive }: TodayViewProps) => {
    // Query Today tasks
    const { data: tasksData } = useQuery(
        `SELECT * FROM tasks 
         WHERE is_today = 1 
           AND (is_deleted IS NULL OR is_deleted = 0)
           AND (is_completed IS NULL OR is_completed = 0)
         ORDER BY sort_order ASC`
    );
    
    const tasks: Task[] = tasksData || [];

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
            <div className="flex-none p-4 border-b border-default-200 bg-yellow-50/50">
                <h2 className="text-xl font-bold text-yellow-600">Today</h2>
                <p className="text-xs text-default-500">Focus on what matters today</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
                {tasks.length === 0 ? (
                    <div className="text-center text-default-400 py-10">No tasks for today. Add some!</div>
                ) : (
                    <div className="flex flex-col gap-1">
                        {tasks.map(task => (
                            <div 
                                key={task.id}
                                className="group flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-default-50 transition-colors border border-transparent hover:border-default-200"
                            >
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm text-default-700">
                                        {task.content?.replace(/<[^>]*>/g, '') || 'Empty task'}
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

export const TodayView = React.memo(TodayViewComponent, (prev, next) => {
    if (prev.isActive !== next.isActive) return false;
    if (!next.isActive) return true;
    return false;
});

