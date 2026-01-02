'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2, Globe } from 'lucide-react';
import { Task } from '@/app/types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

interface UiRowProps {
   task: Task;
   onUpdate: (id: string, updates: Partial<Task>) => void;
   onDelete: (id: string) => void;
   isOverlay?: boolean;
   isHighlighted?: boolean;
   onSelect?: () => void;
   isSelected?: boolean;
}

export const UiRow = React.memo(
   ({
      task,
      onUpdate,
      onDelete,
      isOverlay,
      isHighlighted,
      onSelect,
      isSelected,
   }: UiRowProps) => {
      
      const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
         id: task.id,
         data: task,
      });

      const style = {
         transform: CSS.Translate.toString(transform),
         transition,
      };

      const className = clsx(
         'group px-2 flex justify-between min-h-[40px] items-center rounded border border-default-300 bg-content1 transition-colors outline-none mb-1',
         !isDragging && !isOverlay && 'hover:bg-default-50',
         isDragging && '!opacity-50',
         isOverlay && 'z-50 bg-content1 !border-primary/50 !border-l-[3px] pointer-events-none cursor-grabbing shadow-lg',
         isHighlighted && '!border-orange-300',
         isSelected && 'bg-primary/5 border-primary/30', 
         
         // Style for UI items
         'border-l-[3px] border-l-purple-400' 
      );

      const content = (
         <>
            {/* Drag Handle */}
            <div
                {...attributes}
                {...listeners}
                className={clsx(
                'cursor-grab p-[4px] mr-2 active:cursor-grabbing text-default-400 hover:text-default-600 outline-none hover:bg-default-100 rounded text-center'
                )}
            >
                <GripVertical size={16} />
            </div>

            {/* Main Content: Item ID + Preview */}
            <div className="flex-grow flex flex-col justify-center min-w-0 py-1" onClick={onSelect}>
                <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-purple-700 truncate">
                        {task.item_id || <span className="text-default-300 italic">no_id</span>}
                    </span>
                    {task.isNew && <span className="text-[10px] bg-blue-100 text-blue-600 px-1 rounded">NEW</span>}
                </div>
                {/* Preview of translation (RU or EN) */}
                <div className="text-xs text-default-500 truncate h-4">
                    {task.ru || task.en || <span className="opacity-50">...</span>}
                </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button
                  className="p-1 text-default-400 hover:text-danger hover:bg-danger/10 rounded transition-colors"
                  onClick={(e) => {
                     e.stopPropagation();
                     if (confirm('Delete UI element?')) {
                         onDelete(task.id);
                     }
                  }}
               >
                  <Trash2 size={14} />
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
            initial={task.isNew ? { opacity: 0, height: 0 } : false}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
            onClick={(e) => {
                // Allow selection on row click
                if (!(e.target as HTMLElement).closest('.cursor-grab') && !(e.target as HTMLElement).closest('button')) {
                    onSelect?.();
                }
            }}
         >
            {content}
         </motion.div>
      );
   }
);
UiRow.displayName = 'UiRow';

