'use client';

import React from 'react';
import { Pin } from 'lucide-react';
import { clsx } from 'clsx';
import { Task } from '../types';

interface TaskPinControlProps {
   task: Task | any;
   onUpdate: (id: string, updates: any) => void;
}

export const TaskPinControl = ({ task, onUpdate }: TaskPinControlProps) => {
   return (
      <button
         onClick={(e) => {
            e.stopPropagation();
            onUpdate(task.id, { is_pinned: !task.is_pinned });
         }}
         className={clsx(
            'hidden p-[2px] cursor-pointer rounded transition-all outline-none',
            task.is_pinned
               ? 'opacity-100 text-primary rotate-45'
               : 'opacity-0 group-hover:opacity-100 text-default-300 hover:text-primary'
         )}
         aria-label="Toggle Pin"
      >
         <Pin size={16} fill={task.is_pinned ? 'currentColor' : 'none'} />
      </button>
   );
};

