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
}

export const TaskList = ({ tasks, onUpdateTask, onDeleteTask, isEmpty }: TaskListProps) => {
    return (
        <div className="flex-grow overflow-y-auto pr-0 pb-10">
             <SortableContext
                items={tasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
             >
                <div className="flex flex-col gap-[3px] min-h-[50px] outline-none">
                   <AnimatePresence initial={false} mode="popLayout">
                       {tasks.map((task) => (
                          <TaskRow
                             key={task.id}
                             task={task}
                             onUpdate={onUpdateTask}
                             onDelete={onDeleteTask}
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

