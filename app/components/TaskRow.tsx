'use client';

import * as React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDndContext } from '@dnd-kit/core';
import { Checkbox, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { GripVertical, Trash2, MoreVertical, Check, Star, Pin, Bold, Type, X } from 'lucide-react';
import { Task } from '../types';
import { EditableCell } from './EditableCell';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { TaskContextMenu } from './TaskContextMenu';

interface TaskRowProps {
   task: Task;
   onUpdate: (id: string, updates: Partial<Task>) => void;
   onDelete: (id: string) => void;
   isOverlay?: boolean;
   isHighlighted?: boolean;
   onAddGap?: () => void;
   projectColor?: string;
   activeGroupColor?: string | null;
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
}: any) => {
   const { active } = useDndContext();
   const isAnyDragging = !!active;
   const [isIconHovered, setIsIconHovered] = React.useState(false); // New state for icon hover

   const gapClassName = clsx(
      'group relative flex items-center justify-center h-[12px] w-full rounded  outline-none transition-colors ',
      // Show background if hovered (icon area), dragging this gap, dragging ANY item
      isIconHovered || isDragging || isAnyDragging
         ? 'bg-default-100'
         : 'bg-transparent',
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
      <TaskContextMenu 
         task={task} 
         onDelete={onDelete} 
         items={{ delete: true }}
      >
         <motion.div
            ref={setNodeRef}
            style={style}
            data-task-row={task.id}
            className={gapClassName}
            layout
            initial={task.isNew ? { opacity: 0, height: 0 } : false}
            animate={{ opacity: 1, height: 12 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
         >
            {/* Icon visible ONLY on ICON AREA hover, dragging SELF */}
            <div
               className={clsx(
                  'absolute left-[2px] ml-[6px] cursor-grab active:cursor-grabbing hover:bg-default-100 rounded text-center outline-none transition-opacity duration-200 z-20 flex items-center justify-center h-[12px]', // Force 16px height
                  isIconHovered || isDragging
                     ? 'opacity-100'
                     : 'opacity-0 pointer-events-none'
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
      </TaskContextMenu>
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
   }: TaskRowProps) => {
      const [isHovered, setIsHovered] = React.useState(false);

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
            />
         );
      }

      // --- STANDARD TASK RENDER ---
      const isGroup = task.task_type === 'group';

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
         activeGroupColor && 'ml-[20px] -rounded-l-[4px]'
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

               {!isGroup && (
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
               )}

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
                  autoWidth={isGroup}
                  className={clsx(
                     'text-[16px] p-0 m-0 pl-0 mr-0',
                     task.is_completed && 'text-default-400 line-through',
                     isGroup && 'font-semibold',
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
                     <Dropdown placement="bottom-start" className="min-w-0 w-auto">
                        <DropdownTrigger>
                           <button
                              className={clsx(
                                 'p-[2px] cursor-pointer rounded transition-all outline-none opacity-0 group-hover:opacity-100 text-default-300 hover:text-foreground',
                                 task.title_text_style && 'opacity-0 text-foreground'
                              )}
                              aria-label="Text Style"
                           >
                              <Type size={16} />
                           </button>
                        </DropdownTrigger>
                        <DropdownMenu
                           aria-label="Text Style Selection"
                           variant="flat"
                           className="p-0 min-w-0 w-fit"
                        >
                           <DropdownItem
                              key="style-row"
                              isReadOnly
                              className="cursor-default opacity-100 data-[hover=true]:bg-transparent p-1 w-fit min-w-0"
                              textValue="Style Options"
                           >
                              <div className="flex flex-wrap gap-1">
                                 <button
                                    type="button"
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       onUpdate(task.id, { title_text_style: 'bold' });
                                    }}
                                    className={clsx(
                                       'w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors',
                                       task.title_text_style === 'bold' &&
                                          'bg-default-300 text-foreground'
                                    )}
                                    title="Bold"
                                 >
                                    <Bold size={16} />
                                 </button>
                                 <button
                                    type="button"
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       onUpdate(task.id, { title_text_style: 'red' });
                                    }}
                                    className={clsx(
                                       'w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-danger',
                                       task.title_text_style === 'red' && 'bg-danger/20'
                                    )}
                                    title="Red"
                                 >
                                    <Type size={16} />
                                 </button>
                                 <button
                                    type="button"
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       onUpdate(task.id, { title_text_style: 'red-bold' });
                                    }}
                                    className={clsx(
                                       'w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-danger font-bold',
                                       task.title_text_style === 'red-bold' && 'bg-danger/20'
                                    )}
                                    title="Red Bold"
                                 >
                                    <Bold size={16} />
                                 </button>
                                 <button
                                    type="button"
                                    onClick={(e) => {
                                       e.stopPropagation();
                                       onUpdate(task.id, { title_text_style: null });
                                    }}
                                    className={clsx(
                                       'w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-default-400'
                                    )}
                                    title="Reset"
                                 >
                                    <X size={16} />
                                 </button>
                              </div>
                           </DropdownItem>
                        </DropdownMenu>
                     </Dropdown>

                     {/* Pinned Button */}
                     <button
                        onClick={() => onUpdate(task.id, { is_pinned: !task.is_pinned })}
                        className={clsx(
                           'p-[2px] hidden cursor-pointer rounded transition-all outline-none',
                           task.is_pinned
                              ? 'opacity-100 text-primary rotate-45'
                              : 'opacity-0 group-hover:opacity-100 text-default-300 hover:text-primary'
                        )}
                        aria-label="Toggle Pin"
                     >
                        <Pin size={16} fill={task.is_pinned ? 'currentColor' : 'none'} />
                     </button>

                     {/* Today Button */}
                     <button
                        onClick={() => onUpdate(task.id, { is_today: !task.is_today })}
                        className={clsx(
                           'p-[2px] cursor-pointer rounded transition-all outline-none',
                           task.is_today
                              ? 'opacity-100 text-warning'
                              : 'opacity-0 group-hover:opacity-100 text-default-300 hover:text-warning'
                        )}
                        aria-label="Toggle Today"
                     >
                        <Star size={16} fill={task.is_today ? 'currentColor' : 'none'} />
                     </button>
                  </>
               )}

               <Dropdown placement="bottom-end">
                  <DropdownTrigger>
                     <button
                        className="opacity-100 p-[0px] group-hover:opacity-100 text-default-400 cursor-pointer hover:text-default-600 rounded transition-all outline-none"
                        aria-label="Task settings"
                     >
                        <MoreVertical size={16} />
                     </button>
                  </DropdownTrigger>
                  <DropdownMenu
                     aria-label="Task Actions"
                     onAction={(key) => {
                        if (key === 'delete') {
                           onDelete(task.id);
                        } else if (key === 'make-gap') {
                           onAddGap?.();
                        } else if (key === 'make-group') {
                           onUpdate(task.id, {
                              task_type: 'group',
                              group_color: '#3b82f6', // Default blue from palette
                           });
                        } else if (key === 'revert-task') {
                           onUpdate(task.id, {
                              task_type: 'task',
                              group_color: null as any,
                           });
                        }
                     }}
                  >
                     {!isGroup
                        ? null // Style options moved to separate button
                        : null}

                     {isGroup ? (
                        <DropdownItem key="revert-task">Revert To Task</DropdownItem>
                     ) : !activeGroupColor ? (
                        <DropdownItem key="make-group">Make As Group</DropdownItem>
                     ) : null}

                     {isGroup ? (
                        <DropdownItem
                           key="group-color"
                           isReadOnly
                           className="cursor-default opacity-100"
                           textValue="Group Color"
                        >
                           <div className="flex flex-col gap-2 py-1">
                              <span className="text-tiny text-default-500 font-semibold">
                                 Group Color
                              </span>
                              <div className="flex flex-wrap gap-1">
                                 {COLORS.map((color) => (
                                    <button
                                       key={color.value}
                                       type="button"
                                       onClick={(e) => {
                                          e.stopPropagation(); // Prevent dropdown from closing immediately if desired, or let it close
                                          onUpdate(task.id, { group_color: color.value });
                                       }}
                                       className={clsx(
                                          'w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center outline-none ',
                                          currentGroupColor.toLowerCase() ===
                                             color.value.toLowerCase() &&
                                             'ring-0 ring-primary scale-110'
                                       )}
                                       style={{ backgroundColor: color.value }}
                                       title={color.name}
                                    >
                                       {currentGroupColor.toLowerCase() ===
                                          color.value.toLowerCase() && (
                                          <Check size={12} className="text-white drop-shadow-sm" />
                                       )}
                                    </button>
                                 ))}
                              </div>
                           </div>
                        </DropdownItem>
                     ) : null}

                     <DropdownItem key="make-gap">Make Gap Below</DropdownItem>
                     <DropdownItem key="delete" className="text-danger" color="danger">
                        Delete
                     </DropdownItem>
                  </DropdownMenu>
               </Dropdown>
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
         <TaskContextMenu
            task={task}
            onDelete={onDelete}
            onAddGap={onAddGap}
            onUpdate={onUpdate}
            items={{
               delete: true,
               makeGap: true,
               makeGroup: true,
               styles: true
            }}
         >
            <motion.div
               ref={setNodeRef}
               // style={{ ...style, ...borderStyle }}
               style={{ ...style }}
               data-task-row={task.id}
               className={className}
               layout
               initial={task.isNew ? { opacity: 0, height: 0 } : false}
               animate={{
                  opacity: 1,
                  height: 'auto',
                  backgroundColor: isHighlighted ? 'var(--heroui-primary-100)' : groupBackgroundColor,
               }}
               exit={{ opacity: 0, height: 0 }}
               transition={{ duration: 0.2 }}
            >
               {content}

               {/* Dropdown removed, moved to TaskContextMenu */}
            </motion.div>
         </TaskContextMenu>
      );
   }
);
TaskRow.displayName = 'TaskRow';
