'use client';

import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Chip } from '@heroui/react';
import { EllipsisVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { EditTabPopover } from './EditTabPopover';

interface AdminTabTitleProps {
   id: string;
   label: string;
   count: number;
   isActive: boolean;
   onClick: () => void;
   layoutIdPrefix?: string; // Для анимации подчеркивания
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
    onClick,
    layoutIdPrefix = 'admin-tabs',
    onUpdate,
    onDelete,
    onMove,
    canMoveLeft,
    canMoveRight
}: AdminTabTitleProps) => {
   // Пока оставляем Droppable, чтобы можно было кидать файлы на таб (если понадобится)
   const { isOver, setNodeRef } = useDroppable({
      id: `tab-${id}`,
      data: { type: 'tab', tabId: id }
   });

   const isSystemTab = id === 'misc'; 

   return (
      <div 
         ref={setNodeRef}
         onClick={onClick}
         className={clsx(
            "group/tab relative flex items-center gap-2 px-3 h-[40px] select-none transition-colors min-w-fit outline-none rounded-t-lg cursor-pointer",
            // Drag over state
            isOver && "bg-primary/10 text-primary border-dashed border-primary",
            
            // Active state
            !isOver && isActive && "text-primary font-medium",
            
            // Default state
            !isOver && !isActive && "text-default-500 hover:text-default-700 hover:bg-default-100"
         )}
      >
         <span className="relative z-10">{label}</span>
         
         <div className="relative flex items-center justify-center min-w-[20px] h-5">
            {/* Chip */}
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

            {/* Menu Button */}
            {!isSystemTab && onUpdate && onDelete && (
               <div 
                   className={clsx(
                       "absolute inset-0 flex items-center justify-center",
                       "opacity-0 group-hover/tab:opacity-100 transition-opacity duration-200 z-20"
                   )}
                   onPointerDown={(e) => e.stopPropagation()}
                   onClick={(e) => e.stopPropagation()} 
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
                               }
                           }}
                       >
                           <EllipsisVertical size={16} />
                       </div>
                   </EditTabPopover>
               </div>
            )}
         </div>

         {/* Active Indicator (Underline) */}
         {isActive && !isOver && (
              <motion.div 
                  layoutId={`${layoutIdPrefix}-underline`}
                  className="absolute bottom-0 left-0 w-full h-[2px] bg-primary z-0"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
         )}
      </div>
   );
};
