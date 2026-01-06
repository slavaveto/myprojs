'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { clsx } from 'clsx';
import { Task } from '../../types';

interface TaskTodayControlProps {
   task: Task | any;
   onUpdate: (id: string, updates: any) => void;
}

export const TaskTodayControl = ({ task, onUpdate }: TaskTodayControlProps) => {
   return (
      <button
         onClick={(e) => {
            e.stopPropagation();
            onUpdate(task.id, { is_today: !task.is_today });
         }}
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
   );
};

