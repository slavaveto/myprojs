'use client';

import React from 'react';
import { Task } from '@/app/types';
import { TaskRow } from '@/app/components/TaskRow';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence } from 'framer-motion';

interface TaskListProps {
    tasks: Task[];
    onUpdateTask: (id: string, updates: Partial<Task>) => void;
    onDeleteTask: (id: string) => void;
    isEmpty: boolean;
    highlightedTaskId?: string | null;
    onAddGap?: (index: number) => void;
    projectColor?: string;
    projectsStructure?: any[];
    onMoveTask?: (taskId: string, projectId: string, folderId: string) => void;
    currentProjectId?: string;
}

export const TaskList = ({ tasks, onUpdateTask, onDeleteTask, isEmpty, highlightedTaskId, onAddGap, projectColor, projectsStructure, onMoveTask, currentProjectId }: TaskListProps) => {
    const pinnedTasks = React.useMemo(() => tasks.filter(t => t.is_pinned), [tasks]);
    const unpinnedTasks = React.useMemo(() => tasks.filter(t => !t.is_pinned), [tasks]);

    const tasksWithGroupInfo = React.useMemo(() => {
        let currentGroupColor: string | null = null;
        return unpinnedTasks.map(task => {
            if (task.task_type === 'group') {
                currentGroupColor = task.group_color || '#3b82f6';
                return { task, activeGroupColor: null }; // Group itself doesn't get the border
            }
            if (task.task_type === 'gap') {
                currentGroupColor = null;
                return { task, activeGroupColor: null };
            }
            return { task, activeGroupColor: currentGroupColor };
        });
    }, [unpinnedTasks]);

    return (
        <div className="flex-grow overflow-y-auto pr-0 pb-10">
             {pinnedTasks.length > 0 && (
                 <div className="flex flex-col gap-[3px] mb-6 pb-2  outline-none">
                     {pinnedTasks.map(task => (
                         <TaskRow 
                             key={task.id}
                             task={task}
                             onUpdate={onUpdateTask}
                             onDelete={onDeleteTask}
                             isHighlighted={highlightedTaskId === task.id}
                             projectColor={projectColor}
                             // Pinned tasks are not draggable, so onAddGap is not needed here or behaves differently
                         />
                     ))}
                 </div>
             )}

             <SortableContext
                items={unpinnedTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
             >
                <div className="flex flex-col gap-[3px] min-h-[50px] outline-none">
                   <AnimatePresence initial={false} mode="popLayout">
                       {tasksWithGroupInfo.map(({ task, activeGroupColor }, index) => (
                          <TaskRow
                             key={task._tempId || task.id}
                             task={task}
                             onUpdate={onUpdateTask}
                             onDelete={onDeleteTask}
                             isHighlighted={highlightedTaskId === task.id}
                             onAddGap={() => onAddGap?.(index)}
                             projectColor={projectColor}
                             activeGroupColor={activeGroupColor}
                             projectsStructure={projectsStructure}
                             onMove={onMoveTask}
                             currentProjectId={currentProjectId}
                          />
                       ))}
                   </AnimatePresence>
                   {isEmpty && (
                       <div className="text-center py-10 text-default-400">
                           No tasks in this folder.
                       </div>
                   )}
                </div>
             </SortableContext>
        </div>
    );
};
