'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Checkbox, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
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
   isHighlighted?: boolean;
   onAddGap?: () => void;
}

export const TaskRow = ({ task, onUpdate, onDelete, isOverlay, isHighlighted, onAddGap }: TaskRowProps) => {
   const [menuPos, setMenuPos] = React.useState<{x: number, y: number} | null>(null);
   const [isHovered, setIsHovered] = React.useState(false);
   
   const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: task.id,
      data: task,
   });

   const style = {
      transform: CSS.Translate.toString(transform),
      transition,
   };

   // --- GAP RENDER ---
   if (task.task_type === 'gap') {
       const gapClassName = clsx(
          'group relative flex items-center justify-center h-[16px] w-full rounded outline-none transition-colors',
          // Show background only on hover or when dragging something else (handled by parent/dnd ideally, but here local hover)
          (isHovered || isDragging) ? 'bg-default-100/50' : 'bg-transparent',
          isDragging && 'opacity-50 cursor-grabbing',
          !isDragging && 'hover:cursor-grab'
       );

       if (isOverlay) {
           return (
               <div ref={setNodeRef} style={{...style, opacity: 1}} className={clsx(gapClassName, 'bg-default-200 border border-dashed border-default-400')}>
                    <GripVertical size={14} className="text-default-400" />
               </div>
           );
       }

       return (
          <motion.div
             ref={setNodeRef}
             style={style}
             data-task-row={task.id}
             className={gapClassName}
             layout
             initial={task.isNew ? { opacity: 0, height: 0 } : false}
             animate={{ opacity: 1, height: 16 }}
             exit={{ opacity: 0, height: 0 }}
             transition={{ duration: 0.2 }}
             {...attributes}
             {...listeners}
             onMouseEnter={() => setIsHovered(true)}
             onMouseLeave={() => setIsHovered(false)}
             onContextMenu={(e) => {
                 e.preventDefault();
                 onDelete(task.id); 
             }}
          >
             {/* Icon positioned exactly like in standard task */}
             {(isHovered || isDragging) && (
                 <div className="absolute left-[7px]">
                    <GripVertical size={16} className="text-default-400" />
                 </div>
             )}
          </motion.div>
       );
   }

   // --- STANDARD TASK RENDER ---
   const className = clsx(
      'group px-1 flex justify-between min-h-[30px] items-center rounded-lg border border-default-300 bg-content1 transition-colors outline-none overflow-hidden',
      !isDragging && !isOverlay && 'hover:bg-default-50',
      isDragging && '!opacity-50', 
      isOverlay && 'z-50 bg-default-100 border-primary/50 pointer-events-none cursor-grabbing', 
      isHighlighted && 'border-orange-500/50' 
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
         animate={{ 
            opacity: 1, 
            height: 'auto',
            backgroundColor: isHighlighted ? 'var(--heroui-primary-100)' : undefined 
         }}
         exit={{ opacity: 0, height: 0 }}
         transition={{ duration: 0.2 }}
         onContextMenu={(e) => {
            e.preventDefault();
            // Using e.clientX/Y for absolute position on screen
            setMenuPos({
                x: e.clientX,
                y: e.clientY
            });
         }}
      >
         {content}

         <Dropdown 
            isOpen={!!menuPos} 
            onOpenChange={(open) => {
                if (!open) setMenuPos(null);
            }}
            placement="bottom-start"
            triggerScaleOnOpen={false}
         >
            <DropdownTrigger>
               <div 
                   style={{ 
                       position: 'fixed', 
                       left: menuPos?.x ?? 0, 
                       top: menuPos?.y ?? 0,
                       width: 0,
                       height: 0,
                       pointerEvents: 'none',
                       zIndex: 9999
                   }} 
               />
            </DropdownTrigger>
            <DropdownMenu 
                aria-label="Task Actions"
                onAction={(key) => {
                    if (key === 'make-gap') {
                        onAddGap?.();
                        setMenuPos(null);
                    }
                }}
            >
                <DropdownItem key="make-gap">Make Gap</DropdownItem>
            </DropdownMenu>
         </Dropdown>
      </motion.div>
   );
};
