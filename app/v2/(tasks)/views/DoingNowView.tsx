import React from 'react';
import { useQuery } from '@powersync/react';
import { Task } from '@/app/types';
import { clsx } from 'clsx';

interface DoingNowViewProps {
    isActive: boolean;
}

const DoingNowViewComponent = ({ isActive }: DoingNowViewProps) => {
    // Doing Now definition: tasks with specific flag or status.
    // Assuming is_today = 1 AND maybe something else? Or just a separate list.
    // For now, let's placeholder it.
    
    // Placeholder query (empty for now until schema confirmed)
    const { data: tasksData } = useQuery(
        `SELECT * FROM tasks 
         WHERE 0 = 1 
         ORDER BY sort_order ASC`
    );
    
    const tasks: Task[] = tasksData || [];

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      
            
            <div className="flex-1 overflow-y-auto p-4">
                <div className="text-center text-default-400 py-10">Doing Now list logic pending.</div>
            </div>
        </div>
    );
};

export const DoingNowView = React.memo(DoingNowViewComponent, (prev, next) => {
    if (prev.isActive !== next.isActive) return false;
    if (!next.isActive) return true;
    return false;
});

