import React from 'react';
import { Task } from '@/app/types';
import { Checkbox } from '@heroui/react';
import { clsx } from 'clsx';

interface TaskListProps {
    tasks: Task[];
    onSelectTask: (id: string) => void;
    selectedTaskId: string | null;
    onUpdateTask?: (id: string, updates: Partial<Task>) => void;
}

export const TaskList = ({ tasks, onSelectTask, selectedTaskId, onUpdateTask }: TaskListProps) => {

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-default-400 py-10">
                <p>No tasks yet</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-[2px] pb-10">
            {tasks.map(task => (
                <div 
                    key={task.id}
                    onClick={() => onSelectTask(task.id)}
                    className={clsx(
                        "group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors border border-transparent cursor-pointer",
                        selectedTaskId === task.id ? "bg-primary/10 border-primary/20" : "hover:bg-default-100 hover:border-default-200",
                        task.is_completed && "opacity-60"
                    )}
                >
                    {/* Checkbox */}
                    <div className="flex-shrink-0 pt-0.5">
                        <Checkbox 
                            isSelected={!!task.is_completed} 
                            radius="sm"
                            size="md"
                            // Mock toggle for now
                            onValueChange={() => console.log('Toggle task', task.id)}
                        />
                    </div>

                    {/* Content */}
                    <div className={clsx(
                        "flex-1 text-sm text-foreground break-words min-w-0",
                        task.is_completed && "line-through text-default-500",
                        task.title_text_style === 'bold' && "font-bold",
                        task.title_text_style === 'red' && "text-red-500",
                        task.title_text_style === 'red-bold' && "text-red-500 font-bold"
                    )}>
                        {/* Remove HTML tags if content is rich text */}
                        {task.content?.replace(/<[^>]*>/g, '') || 'Empty task'}
                    </div>
                </div>
            ))}
        </div>
    );
};

