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
            "group flex items-center gap-3 p-2 rounded-lg border border-default-200 bg-content1 transition-all",
            isDragging && "z-50 shadow-xl ring-2 ring-primary opacity-50",
            isOverlay && "shadow-xl ring-2 ring-primary cursor-grabbing"
         )}
      >
         {/* Drag Handle */}
         <div
            {...attributes}
            {...listeners}
            className="cursor-grab active:cursor-grabbing text-default-400 hover:text-default-600 outline-none p-1 hover:bg-default-100 rounded transition-colors"
         >
            <GripVertical size={16} />
         </div>

         {/* Checkbox */}
         <Checkbox
            isSelected={task.is_completed}
            onValueChange={(isSelected) => onUpdate(task.id, { is_completed: isSelected })}
            classNames={{
               wrapper: "after:bg-primary"
            }}
         />

         {/* Content */}
         <div className="flex-grow min-w-0">
            <EditableCell
               value={task.content}
               onSave={(val) => onUpdate(task.id, { content: val })}
               isMultiline
               className={clsx(
                  "text-small font-medium",
                  task.is_completed && "text-default-400 line-through"
               )}
            />
         </div>

         {/* Actions */}
         <button
            onClick={() => onDelete(task.id)}
            className="opacity-0 group-hover:opacity-100 p-2 text-default-400 hover:text-danger hover:bg-danger/10 rounded-full transition-all"
            aria-label="Delete task"
         >
            <Trash2 size={16} />
         </button>
      </div>
   );
};
