import React from 'react';
import { useDroppable } from '@dnd-kit/core';
import { Chip } from '@heroui/react';
import { clsx } from 'clsx';

export const DroppableTabTitle = ({ id, label, count }: { id: string; label: string; count: number }) => {
   const { setNodeRef, isOver } = useDroppable({
      id: `tab-${id}`,
   });

   return (
      <div
         ref={setNodeRef}
         className={clsx(
            'flex items-center gap-2 px-2 py-1 rounded transition-colors',
            isOver ? 'bg-primary-100 text-primary' : ''
         )}
      >
         {label}
         <Chip size="sm" variant="flat" className="h-5 min-w-5 px-1 text-[10px]">
            {count}
         </Chip>
      </div>
   );
};

