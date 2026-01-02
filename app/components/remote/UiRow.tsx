'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Trash2 } from 'lucide-react';
import { Task } from '@/app/types';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { RichEditableCell } from '@/app/components/RichEditableCell'; // Import Editor

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
         'group px-1 flex justify-between min-h-[30px] items-center rounded border border-default-300 bg-content1 transition-colors outline-none ',
         !isDragging && !isOverlay && 'hover:bg-default-50',
         isDragging && '!opacity-50',
         isOverlay && 'z-50 bg-content1 !border-primary/50 !border-l-[3px] pointer-events-none cursor-grabbing',
         isHighlighted && '!border-orange-300',
         isSelected && 'bg-primary/5 border-primary/30', 
         
         // Standard Task Style
         'border-l-[3px] border-l-default-300' 
      );

      const content = (
         <>
            {/* Drag Handle */}
            <div className="flex flex-1 gap-1 flex-row items-center">
                <div
                    {...attributes}
                    {...listeners}
                    className={clsx(
                    'cursor-grab p-[2px] active:cursor-grabbing text-default-400 hover:text-default-600 outline-none hover:bg-default-100 rounded text-center'
                    )}
                >
                    <GripVertical size={16} />
                </div>

                {/* Main Content: Item ID (Editable) */}
                <div className="flex-1 min-w-0" onClick={(e) => {
                    if ((e.target as HTMLElement).closest('.ProseMirror')) return;
                    onSelect?.();
                }}>
                    <RichEditableCell
                        id={`ui-item-${task.id}`}
                        value={task.item_id || ''}
                        onSave={(val) => {
                            const cleanVal = val.replace(/<[^>]*>/g, '').trim();
                            onUpdate(task.id, { item_id: cleanVal });
                        }}
                        autoFocus={task.isNew}
                        placeholder="item_id"
                        className="w-full"
                    />
                </div>
                
                {/* Preview (Small gray text on the right or hidden? Let's hide it to look like standard task, or keep subtle) */}
                {/* Let's remove the preview to match standard look perfectly as requested */}
            </div>

            {/* Actions */}
            <div className="p-0 text-center relative flex justify-center items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
               <button
                  className="p-[2px] text-default-400 hover:text-danger hover:bg-danger/10 rounded transition-colors"
                  onClick={(e) => {
                     e.stopPropagation();
                     if (confirm('Delete UI element?')) {
                         onDelete(task.id);
                     }
                  }}
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
            initial={task.isNew ? { opacity: 0, height: 0 } : false}
            animate={{ opacity: 1, height: 'auto' }}
            transition={{ duration: 0.2 }}
            onMouseDown={(e) => {
                // Allow selection on click
                // Prevent selection when clicking drag handle to avoid conflict with dnd-kit
                if ((e.target as HTMLElement).closest('.cursor-grab')) return;
                
                if (e.button === 0) {
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

