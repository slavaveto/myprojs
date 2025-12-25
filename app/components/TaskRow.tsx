'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@heroui/react';
import { GripVertical, Trash2 } from 'lucide-react';
import { Task } from '../types';
import { EditableCell } from './EditableCell';
import { clsx } from 'clsx';

interface TaskRowProps {
   task: Task;
   onUpdate: (id: string, updates: Partial<Task>) => void;
   onDelete: (id: string) => void;
   isOverlay?: boolean;
}

export const TaskRow = ({ task, onUpdate, onDelete, isOverlay }: TaskRowProps) => {
   const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
   } = useSortable({ id: task.id, data: task });

   const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      opacity: isDragging ? 0.3 : 1,
   };

   return (
      <div
         ref={setNodeRef}
         style={style}
         className={clsx(
            "group grid grid-cols-[30px_1fr_40px] gap-1 items-center min-h-[32px] rounded-lg border border-default-300 bg-content1 transition-colors outline-none",
            !isDragging && !isOverlay && "hover:bg-default-50",
            (isDragging || isOverlay) && "z-50 bg-content1 shadow-lg border-primary/50 pointer-events-none cursor-grabbing"
         )}
      >
         {/* Drag Handle + Checkbox Wrapper */}
         <div className="flex items-center justify-center pl-1">
             <div
                {...attributes}
                {...listeners}
                className="cursor-grab active:cursor-grabbing text-default-400 hover:text-default-600 outline-none p-0.5 hover:bg-default-100 rounded mr-1"
             >
                <GripVertical size={14} />
             </div>
         </div>

         {/* Content */}
         <div className="p-1 text-start relative whitespace-normal flex items-center pl-0">
            <div className="flex items-center gap-2 w-full">
                <Checkbox
                    isSelected={task.is_completed}
                    onValueChange={(isSelected) => onUpdate(task.id, { is_completed: isSelected })}
                    classNames={{
                        wrapper: "after:bg-primary"
                    }}
                    size="sm"
                />
                <EditableCell
                   value={task.content}
                   onSave={(val) => onUpdate(task.id, { content: val })}
                   isMultiline
                   className={clsx(
                      "text-small font-medium w-full",
                      task.is_completed && "text-default-400 line-through"
                   )}
                />
            </div>
         </div>

         {/* Actions */}
         <div className="p-1 text-center relative flex justify-center">
            <button
               onClick={() => onDelete(task.id)}
               className="opacity-0 group-hover:opacity-100 p-1 text-default-400 hover:text-danger hover:bg-danger/10 rounded transition-all"
               aria-label="Delete task"
            >
               <Trash2 size={16} />
            </button>
         </div>
      </div>
   );
};
