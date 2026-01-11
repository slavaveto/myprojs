import React from 'react';
import { Checkbox } from '@heroui/react';
import { clsx } from 'clsx';
import { TaskV3 } from './TaskList';

export interface SysTaskV3 extends TaskV3 {
    project_title?: string;
    proj_color?: string;
}

interface SysTaskListProps {
    tasks: SysTaskV3[];
    onSelectTask: (id: string) => void;
    selectedTaskId: string | null;
    onToggleTask: (id: string, isCompleted: boolean) => void;
}

export const SysTaskList = ({ tasks, onSelectTask, selectedTaskId, onToggleTask }: SysTaskListProps) => {

    if (tasks.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-default-400 py-10">
                <p>Нет задач</p>
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

                        {/* Content & Project Label */}
                        <div className="flex-1 flex flex-col min-w-0">
                            <div className={clsx(
                                "text-sm text-foreground break-words",
                                isCompleted && "line-through text-default-500",
                                task.title_text_style === 'bold' && "font-bold",
                                task.title_text_style === 'red' && "text-red-500",
                                task.title_text_style === 'red-bold' && "text-red-500 font-bold"
                            )}>
                                {task.content?.replace(/<[^>]*>/g, '') || 'Empty task'}
                            </div>
                            
                            {/* Project Badge (only if title exists) */}
                            {task.project_title && (
                                <div className="flex items-center gap-1.5 mt-0.5">
                                    <div 
                                        className="w-1.5 h-1.5 rounded-full" 
                                        style={{ backgroundColor: task.proj_color || '#999' }}
                                    />
                                    <span className="text-[10px] text-default-400 truncate">
                                        {task.project_title}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};

