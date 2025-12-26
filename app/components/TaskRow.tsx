'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox } from '@heroui/react';
import { GripVertical, Trash2 } from 'lucide-react';
import { Task } from '../types';
import { EditableCell } from './EditableCell';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface TaskRowProps {
   task: Task;
   onUpdate: (id: string, updates: Partial<Task>) => void;
   onDelete: (id: string) => void;
   isOverlay?: boolean;
}

export const TaskRow = ({ task, onUpdate, onDelete, isOverlay }: TaskRowProps) => {
   const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: task.id,
      data: task,
   });

   const style = {
      transform: CSS.Translate.toString(transform),
      transition,
   };

   const className = clsx(
      'group px-1 flex justify-between min-h-[30px] items-center rounded-lg border border-default-300 bg-content1 transition-colors outline-none overflow-hidden',
      !isDragging && !isOverlay && 'hover:bg-default-50',
      isDragging && '!opacity-50', // Placeholder (в списке) - прозрачный
      isOverlay && 'z-50 bg-default-100 border-primary/50 pointer-events-none cursor-grabbing' // Overlay - непрозрачный
   );

   const content = (
      <>
         {/* Drag Handle + Checkbox Wrapper */}
         <div className="flex flex-1 gap-1 flex-row items-center justify-center">
            <div
               {...attributes}
               {...listeners}
               className="cursor-grab p-[2px] active:cursor-grabbing text-default-400 hover:text-default-600 outline-none hover:bg-default-100 rounded text-center"
            >
               <GripVertical size={16} />
            </div>

            <Checkbox
               isSelected={task.is_completed}
               onValueChange={(isSelected) => onUpdate(task.id, { is_completed: isSelected })}
               classNames={{
                  wrapper: 'after:bg-primary',
               }}
               className={clsx(' p-0 m-0 text-center  !w-[16px] mx-0')}
               size="sm"
               //   className="scale-90"
            />

            <EditableCell
               value={task.content}
               onSave={(val) => onUpdate(task.id, { content: val })}
               autoFocus={task.isDraft}
               onCancel={() => {
                   if (task.isDraft) onDelete(task.id);
               }}
               onBlur={(val) => {
                   if (task.isDraft && !val.trim()) {
                       onDelete(task.id);
                   }
               }}
               isMultiline
               className={clsx(
                  'text-[16px]  w-full p-0 m-0 pl-1 mr-2 ',
                  task.is_completed && 'text-default-400 line-through'
               )}
            />
         </div>

         {/* Actions */}
         <div className="p-0 text-center relative flex justify-center">
            <button
               onClick={() => onDelete(task.id)}
               className="opacity-0 p-[2px] group-hover:opacity-100  text-default-400 cursor-pointer hover:text-danger hover:bg-danger/10 rounded transition-all"
               aria-label="Delete task"
            >
               <Trash2 size={16} />
            </button>
         </div>
      </>
   );

   if (isOverlay) {
      return (
         <div
            ref={setNodeRef}
            style={{ ...style, opacity: 1 }}
            className={className}
         >
            {content}
         </div>
      );
   }

   return (
      <motion.div
         ref={setNodeRef}
         style={style}
         data-task-row={task.id}
         className={className}
         layout
         initial={task.isNew ? { opacity: 0, height: 0 } : false}
         animate={{ opacity: 1, height: 'auto' }}
         exit={{ opacity: 0, height: 0 }}
         transition={{ duration: 0.2 }}
      >
         {content}
      </motion.div>
   );
};
