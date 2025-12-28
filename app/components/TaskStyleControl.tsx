'use client';

import React from 'react';
import { 
   Dropdown, 
   DropdownTrigger, 
   DropdownMenu, 
   DropdownItem 
} from '@heroui/react';
import { 
   Type, 
   Bold, 
   X 
} from 'lucide-react';
import { clsx } from 'clsx';
import { Task } from '../types';

interface TaskStyleControlProps {
   task: Task | any;
   onUpdate: (id: string, updates: any) => void;
}

export const TaskStyleControl = ({ task, onUpdate }: TaskStyleControlProps) => {
   return (
       <Dropdown placement="bottom-start" className="min-w-0 w-auto">
          <DropdownTrigger>
             <button
                className={clsx(
                   'p-[2px] cursor-pointer rounded transition-all outline-none opacity-0 group-hover:opacity-100 text-default-300 hover:text-foreground',
                   task.title_text_style && 'opacity-0 text-foreground'
                )}
                aria-label="Text Style"
                onClick={(e) => e.stopPropagation()} 
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
                         document.body.click(); // Close dropdown
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
                         document.body.click();
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
                         document.body.click();
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
                         document.body.click();
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
   );
};

