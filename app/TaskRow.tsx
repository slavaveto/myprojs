'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndContext } from '@dnd-kit/core';
import { FastCheckbox } from './components/FastCheckbox';
import { Checkbox } from '@heroui/react'; // Restore Checkbox import
import { GripVertical, Trash2, MoreVertical, Check, Pin } from 'lucide-react';
import { Task } from './types';
import { EditableCell } from './components/EditableCell';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { TaskContextMenu, TaskMenuItems } from './components/TaskContextMenu';
import { TaskStyleControl } from './components/TaskStyleControl';
import { TaskPinControl } from './components/TaskPinControl';
import { TaskTodayControl } from './components/TaskTodayControl';

interface TaskRowProps {
   task: Task;
   onUpdate: (id: string, updates: Partial<Task>) => void;
   onDelete: (id: string) => void;
   isOverlay?: boolean;
   isHighlighted?: boolean;
   onAddGap?: () => void;
   projectColor?: string;
   activeGroupColor?: string | null;
   projectsStructure?: any[];
   onMove?: (taskId: string, projectId: string, folderId: string) => void;
   currentProjectId?: string;
   onOpenMenu?: (taskId: string, e: React.MouseEvent | React.TouchEvent) => void;
   isMenuOpen?: boolean; // New prop
}

// Group Colors Palette (Restored for More menu)
const COLORS = [
   { name: 'Blue', value: '#3b82f6' },
   { name: 'Green', value: '#22c55e' },
   { name: 'Orange', value: '#f97316' },
   { name: 'Red', value: '#ef4444' },
   { name: 'Purple', value: '#a855f7' },
   { name: 'Cyan', value: '#06b6d4' },
   { name: 'Pink', value: '#ec4899' },
   { name: 'Gray', value: '#6b7280' },
];

// Separate component for Gap to keep logic clean and handle hooks
const GapRow = ({
   task,
   isOverlay,
   isDragging,
   isHovered,
   setIsHovered,
   style,
   setNodeRef,
   attributes,
   listeners,
   onDelete,
   onOpenMenu, // Receive onOpenMenu
   isMenuOpen, // Receive isMenuOpen
}: any) => {
   const { active } = useDndContext();
   const isAnyDragging = !!active;
   const [isIconHovered, setIsIconHovered] = React.useState(false); // New state for icon hover

   const gapClassName = clsx(
      'group relative flex items-center justify-center h-[12px] w-full rounded  outline-none transition-colors ',
      // Show background if hovered (icon area), dragging this gap, dragging ANY item, OR MENU OPEN
      isIconHovered || isDragging || isAnyDragging || isMenuOpen ? 'bg-default-100' : 'bg-transparent',
      // Cursor logic:
      isDragging ? 'cursor-grabbing' : 'cursor-default'
   );

   if (isOverlay) {
      return (
         <div
            ref={setNodeRef}
            style={{ ...style, opacity: 1, cursor: 'grabbing' }}
            className={clsx(
               gapClassName,
               'bg-default-200 border border-dashed border-default-400 cursor-grabbing'
            )}
         >
            <div className="absolute left-[7px] ">
               <GripVertical size={14} className="text-default-400" />
            </div>
         </div>
      );
   }

   return (
      // Context menu handler removed from wrapper.
      // We will handle onContextMenu on the row itself if needed, or rely on parent.
      // Actually, for consistency, we can add onContextMenu to the div.
      <motion.div
         ref={setNodeRef}
         style={style}
         data-task-row={task.id}
         className={gapClassName}
         // layout // Removed heavy layout animation
         initial={task.isNew ? { opacity: 0, height: 0 } : false}
         animate={{ opacity: 1, height: 12 }}
         exit={{ opacity: 0, height: 0 }}
         transition={{ duration: 0.2 }}
         onContextMenu={(e) => {
            e.preventDefault();
            onOpenMenu?.(task.id, e);
         }}
      >
         {/* Icon visible ONLY on ICON AREA hover, dragging SELF */}
         <div
            className={clsx(
               'absolute left-[2px] ml-[6px] cursor-grab active:cursor-grabbing hover:bg-default-100 rounded text-center outline-none transition-opacity duration-200 z-20 flex items-center justify-center h-[12px]', // Force 16px height
               isIconHovered || isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            {...attributes}
            {...listeners}
            onMouseEnter={() => setIsIconHovered(true)}
            onMouseLeave={() => setIsIconHovered(false)}
         >
            <GripVertical size={14} className="text-default-400 hover:text-default-600 " />
         </div>

         {/* Invisible Hit Area for Icon (larger than icon itself) */}
         <div
            className="absolute left-0 top-0 bottom-0 w-[30px] z-10" // Sensor zone on the left
            onMouseEnter={() => setIsIconHovered(true)}
            onMouseLeave={() => setIsIconHovered(false)}
         />
      </motion.div>
   );
};

// Use React.memo to prevent unnecessary re-renders of all rows during drag
export const TaskRow = React.memo(
   ({
      task,
      onUpdate,
      onDelete,
      isOverlay,
      isHighlighted,
      onAddGap,
      projectColor,
      activeGroupColor,
      projectsStructure,
      onMove,
      currentProjectId,
      onOpenMenu,
      isMenuOpen,
   }: TaskRowProps) => {
      const [isHovered, setIsHovered] = React.useState(false);
      const [optimisticCompleted, setOptimisticCompleted] = React.useState(task.is_completed);
      const creationTimeRef = React.useRef(Date.now()); // Track mount time

      React.useEffect(() => {
         setOptimisticCompleted(task.is_completed);
      }, [task.is_completed]);

      const handleCheckboxChange = (isSelected: boolean) => {
         setOptimisticCompleted(isSelected);

         if (isSelected) {
            // Delay update to allow animation to play
            setTimeout(() => {
               onUpdate(task.id, { is_completed: true });
            }, 600);
         } else {
            // Uncheck immediately
            onUpdate(task.id, { is_completed: false });
         }
      };

      const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
         id: task.id,
         data: task,
         disabled: task.is_pinned,
      });

      const style = {
         transform: CSS.Translate.toString(transform),
         transition,
      };

      // --- GAP RENDER ---
      if (task.task_type === 'gap') {
         return (
            <GapRow
               task={task}
               isOverlay={isOverlay}
               isDragging={isDragging}
               isHovered={isHovered}
               setIsHovered={setIsHovered}
               style={style}
               setNodeRef={setNodeRef}
               attributes={attributes}
               listeners={listeners}
               onDelete={onDelete}
               onOpenMenu={onOpenMenu} // Pass it down
               isMenuOpen={isMenuOpen} // Pass it down
            />
         );
      }

      // --- STANDARD TASK RENDER ---
      const isGroup = task.task_type === 'group';
      const isNote = task.task_type === 'note';

      // Group Color Logic
      // Use task.group_color or default project blue (#3b82f6) with 50% opacity (80 hex)
      // Use empty string to reset background style (Framer Motion allows empty string to remove style)
      const currentGroupColor = task.group_color || '#3b82f6';
      const groupBackgroundColor = isGroup ? `${currentGroupColor}20` : '';

      const className = clsx(
         'group px-1 flex justify-between min-h-[30px] items-center rounded border border-default-300 bg-content1 transition-colors outline-none ',
         !isDragging && !isOverlay && 'hover:bg-default-50',
         isDragging && '!opacity-50',
         isOverlay && 'z-50 bg-default-100 border-primary/50 pointer-events-none cursor-grabbing',
         isHighlighted && 'border-orange-500/50',
         activeGroupColor && 'ml-[20px] -rounded-l-[4px]',
         isNote && 'bg-default-50/50 text-default-600 py-2' // Removed pl-3 to keep drag handle in place
      );

      // const borderStyle = activeGroupColor ? { borderLeft: `1px solid ${activeGroupColor}50` } : undefined; // 33 is approx 20% opacity in hex
      const borderStyle: React.CSSProperties | undefined = undefined;

      const content = (
         <>
            {/* Drag Handle + Checkbox Wrapper */}
            <div className="flex flex-1 gap-1 flex-row items-center">
               {task.is_pinned ? (
                  <div className="w-[20px] flex justify-center text-primary">
                     <Pin size={16} className="rotate-45" fill="currentColor" />
                  </div>
               ) : (
                  <div
                     {...attributes}
                     {...listeners}
                     className={clsx(
                        'cursor-grab p-[2px] active:cursor-grabbing text-default-400 hover:text-default-600 outline-none hover:bg-default-100 rounded text-center'
                     )}
                     style={{
                        color:
                           activeGroupColor ||
                           (isGroup ? currentGroupColor : undefined) ||
                           undefined,
                     }}
                  >
                     <GripVertical size={16} />
                  </div>
               )}

               {!isGroup && !isNote && (
                  /* <FastCheckbox
                     isSelected={optimisticCompleted}
                     onValueChange={handleCheckboxChange}
                     className={clsx('mr-1 ml-0')}
                     size="sm"
                  /> */
                  <Checkbox
                     isSelected={optimisticCompleted}
                     // isSelected={task.is_completed} // Using optimistic state for standard checkbox too? Yes, for consistency.
                     onValueChange={handleCheckboxChange}
                     classNames={{
                        wrapper: 'after:bg-primary',
                     }}
                     className={clsx(' p-0 m-0 text-center  !w-[16px] mx-0')}
                     size="sm"
                     //   className="scale-90"
                  />
               )}

               <EditableCell
                  value={task.content}
                  // @ref:db02ba
                  // сохранение задачи 1 завершение редактирования
                  onSave={(val) => onUpdate(task.id, { content: val })}
                  autoFocus={task.isDraft}
                  onCancel={() => {
                     if (task.isDraft) onDelete(task.id);
                  }}
                  onBlur={(val) => {
                     const timeSinceCreation = Date.now() - creationTimeRef.current;
                     if (task.isDraft && !val.trim()) {
                        // Protect against immediate blur from menu closing (focus restoration)
                        if (task.isNew && timeSinceCreation < 500) {
                           return;
                        }
                        onDelete(task.id);
                     }
                  }}
                  isMultiline
                  autoWidth={isGroup}
                  className={clsx(
                     'text-[16px] p-0 m-0 pl-0 mr-0',
                     task.is_completed && 'text-default-400 line-through',
                     isGroup && 'font-semibold',
                     isNote && 'pl-2', // Added padding left specifically for note text
                     task.title_text_style === 'bold' && 'font-medium',
                     task.title_text_style === 'red' && 'text-danger',
                     task.title_text_style === 'red-bold' && 'text-danger font-medium'
                  )}
               />
               {isGroup && <div className="flex-1" />}
            </div>

            {/* Actions */}
            <div className="p-0 text-center relative flex justify-center items-center gap-1">
               {/* Style Button */}
               {!isGroup && (
                  <>
                     <TaskStyleControl task={task} onUpdate={onUpdate} />

                     {/* Pinned Button */}
                     <TaskPinControl task={task} onUpdate={onUpdate} />

                     {/* Today Button */}
                     <TaskTodayControl task={task} onUpdate={onUpdate} />
                  </>
               )}

               <button
                  className="opacity-100 p-[0px] group-hover:opacity-100 text-default-400 cursor-pointer hover:text-default-600 rounded transition-all outline-none"
                  aria-label="Task settings"
                  onClick={(e) => {
                     e.stopPropagation();
                     // Use specific event type casting if needed or let React handle it
                     onOpenMenu?.(task.id, e);
                  }}
               >
                  <MoreVertical size={16} />
               </button>
            </div>
         </>
      );

      if (isOverlay) {
         return (
            <div
               ref={setNodeRef}
               // style={{ ...style, opacity: 1, ...borderStyle }}
               style={{ ...style, opacity: 1 }}
               className={className}
            >
               {content}
            </div>
         );
      }

      return (
         // Removed TaskContextMenu wrapper
         <motion.div
            ref={setNodeRef}
            // style={{ ...style, ...borderStyle }}
            style={{ ...style }}
            data-task-row={task.id}
            className={clsx(className, 'overflow-hidden')} // Add overflow-hidden for smooth height animation
            // layout // Removed heavy layout animation
            initial={task.isNew ? { opacity: 0, height: 0, marginTop: 0, marginBottom: 0 } : false}
            animate={{
               opacity: 1,
               height: 'auto',
               marginTop: 0, // Ensure margins are controlled if needed, or rely on gaps
               marginBottom: 0,
               backgroundColor: isHighlighted ? 'var(--heroui-primary-100)' : groupBackgroundColor,
            }}
            exit={{
               opacity: 0,
               height: 0,
               marginTop: 0,
               marginBottom: 0,
               transition: { duration: 0.2, ease: 'easeInOut' }, // Smoother exit
            }}
            transition={{ duration: 0.2 }}
            onContextMenu={(e) => {
               e.preventDefault();
               onOpenMenu?.(task.id, e);
            }}
         >
            {content}

            {/* Dropdown removed, moved to TaskContextMenu */}
         </motion.div>
      );
   }
);
TaskRow.displayName = 'TaskRow';
