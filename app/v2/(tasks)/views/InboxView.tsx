import React from 'react';
import { useQuery } from '@powersync/react';
import { Task } from '@/app/types';
import { clsx } from 'clsx';

interface InboxViewProps {
    isActive: boolean;
}

const InboxViewComponent = ({ isActive }: InboxViewProps) => {
    // Inbox definition: Tasks without a project OR explicitly in Inbox folder/status?
    // For v2, let's assume Inbox tasks have folder_id = 'inbox' OR project_id is NULL (if schema allows)
    // Or we use a specific query. Let's try simple "no folder" or specific flag if exists.
    // Based on schemas, maybe we filter by project type 'inbox'? 
    
    // Placeholder query
    const { data: tasksData } = useQuery(
        `SELECT * FROM tasks 
         WHERE (folder_id IS NULL OR folder_id = 'inbox') 
           AND (is_deleted IS NULL OR is_deleted = 0)
           AND (is_completed IS NULL OR is_completed = 0)
         ORDER BY created_at DESC`
    );
    
    const tasks: Task[] = tasksData || [];

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
            <div className="flex-none p-4 border-b border-default-200 bg-blue-50/50">
                <h2 className="text-xl font-bold text-blue-600">Inbox</h2>
                <p className="text-xs text-default-500">Capture everything here</p>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4">
                {tasks.length === 0 ? (
                    <div className="text-center text-default-400 py-10">Inbox is empty. Great job!</div>
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

export const InboxView = React.memo(InboxViewComponent, (prev, next) => {
    if (prev.isActive !== next.isActive) return false;
    if (!next.isActive) return true;
    return false;
});

