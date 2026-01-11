import React from 'react';
import { Checkbox } from '@heroui/react';
import { clsx } from 'clsx';

// Minimal Task type for V3
export interface TaskV3 {
    id: string;
    content: string;
    is_completed: number; // 0 or 1
    folder_id: string;
    sort_order?: number;
    title_text_style?: string; // bold, red, etc.
}

interface TaskListProps {
    tasks: TaskV3[];
    onSelectTask: (id: string) => void;
    selectedTaskId: string | null;
    onToggleTask: (id: string, isCompleted: boolean) => void;
}

export const TaskList = ({ tasks, onSelectTask, selectedTaskId, onToggleTask }: TaskListProps) => {

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-default-400 py-10">
                <p>No tasks yet</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-[2px] pb-10">
            {tasks.map(task => {
                const isCompleted = task.is_completed === 1;

                return (
                    <div 
                        key={task.id}
                        onClick={() => onSelectTask(task.id)}
                        className={clsx(
                            "group flex items-center gap-2 px-2 py-1.5 rounded-lg transition-colors border border-transparent cursor-pointer",
                            selectedTaskId === task.id ? "bg-primary/10 border-primary/20" : "hover:bg-default-100 hover:border-default-200",
                            isCompleted && "opacity-60"
                        )}
                    >
                        {/* Checkbox */}
                        <div className="flex-shrink-0 pt-0.5" onClick={(e) => e.stopPropagation()}>
                            <Checkbox 
                                isSelected={isCompleted} 
                                onValueChange={(checked) => onToggleTask(task.id, checked)}
                                radius="sm"
                                size="md"
                            />
                        </div>

                        {/* Content */}
                        <div className={clsx(
                            "flex-1 text-sm text-foreground break-words min-w-0",
                            isCompleted && "line-through text-default-500",
                            task.title_text_style === 'bold' && "font-bold",
                            task.title_text_style === 'red' && "text-red-500",
                            task.title_text_style === 'red-bold' && "text-red-500 font-bold"
                        )}>
                            {/* Remove HTML tags if content is rich text (simple strip) */}
                            {task.content?.replace(/<[^>]*>/g, '') || 'Empty task'}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
