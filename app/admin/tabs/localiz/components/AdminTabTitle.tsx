'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Chip } from '@heroui/react';
import { EllipsisVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { EditTabPopover } from './EditTabPopover';

interface AdminTabTitleProps {
   id: string;
   label: string;
   count: number;
   isActive?: boolean;
   onUpdate?: (title: string) => Promise<void> | void;
   onDelete?: () => Promise<void> | void;
   onMove?: (direction: 'left' | 'right') => void;
   canMoveLeft?: boolean;
   canMoveRight?: boolean;
}

export const AdminTabTitle = ({ 
    id, 
    label, 
    count, 
    isActive,
    onUpdate,
    onDelete,
    onMove,
    canMoveLeft,
    canMoveRight
}: AdminTabTitleProps) => {
   const { isOver, setNodeRef } = useDroppable({
      id: `tab-${id}`,
      data: { type: 'tab', tabId: id }
   });

   // Special styling for Misc/Entry/Room (system tabs might not be editable? 
   // Or we allow editing everything? Let's allow everything for now, 
   // or maybe restrict deleting 'misc'?)
   const isSystemTab = id === 'misc'; 

   return (
      <div 
         ref={setNodeRef}
         className={clsx(
            "group/tab relative flex items-center gap-2 px-2 py-1 rounded-lg transition-colors min-h-[32px]",
            isOver ? "bg-primary/20 ring-2 ring-primary border-transparent" : "hover:bg-default-100",
            isActive && !isOver ? "text-primary font-medium" : "text-default-500"
         )}
      >
         <span className="relative z-10 select-none">{label}</span>
         
         <div className="relative flex items-center justify-center min-w-[20px] h-5">
            {/* Chip - visible by default */}
            <div 
               className={clsx(
                   "transition-opacity duration-200",
                   (onUpdate && onDelete && !isSystemTab) && "group-hover/tab:opacity-0"
               )}
            >
               <Chip 
                   size="sm" 
                   variant="flat" 
                   className={clsx(
                       "h-5 min-w-5 px-1 text-[10px] relative z-10",
                       isActive ? "bg-primary/20 text-primary" : "bg-default-200 text-default-500"
                   )}
               >
                  {count}
               </Chip>
            </div>

            {/* Action Button - hidden by default, visible on hover */}
            {!isSystemTab && onUpdate && onDelete && (
               <div 
                   className={clsx(
                       "absolute inset-0 flex items-center justify-center",
                       "opacity-0 group-hover/tab:opacity-100 transition-opacity duration-200 z-20"
                   )}
                   onPointerDown={(e) => e.stopPropagation()}
                   onClick={(e) => e.stopPropagation()} // Prevent tab switching when clicking menu
               >
                   <EditTabPopover
                       initialTitle={label}
                       onUpdate={onUpdate}
                       onDelete={onDelete}
                       onMove={onMove}
                       canMoveLeft={canMoveLeft}
                       canMoveRight={canMoveRight}
                   >
                       <div 
                           role="button"
                           tabIndex={0}
                           className="flex items-center justify-center text-default-400 hover:text-primary transition-colors outline-none cursor-pointer w-5 h-5"
                           onKeyDown={(e) => {
                               if (e.key === 'Enter' || e.key === ' ') {
                                   e.preventDefault();
                                   e.stopPropagation();
                                   // Popover trigger handles click, so we simulate it if needed, 
                                   // but Trigger usually wraps children. 
                                   // Let's hope HeroUI Trigger works with div.
                               }
                           }}
                       >
                           <EllipsisVertical size={16} />
                       </div>
                   </EditTabPopover>
               </div>
            )}
         </div>
      </div>
   );
};
