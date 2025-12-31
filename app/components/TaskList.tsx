'use client';

import React, { useState } from 'react';
import { Task } from '@/app/types';
import { TaskRow } from '@/app/TaskRow';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence } from 'framer-motion';
import { Dropdown, DropdownTrigger, DropdownMenu } from '@heroui/react';
import { TaskMenuItems } from '@/app/components/TaskContextMenu';

interface TaskListProps {
    tasks: Task[];
    onUpdateTask: (id: string, updates: Partial<Task>) => void;
    onDeleteTask: (id: string) => void;
    isEmpty: boolean;
    highlightedTaskId?: string | null;
    onAddGap?: (index: number) => void;
    onInsertTask?: (index: number) => void; 
    onInsertNote?: (index: number) => void; // New prop for notes
    projectColor?: string;
    projectsStructure?: any[];
    onMoveTask?: (taskId: string, projectId: string, folderId: string) => void;
    currentProjectId?: string;
}

export const TaskList = ({ tasks, onUpdateTask, onDeleteTask, isEmpty, highlightedTaskId, onAddGap, onInsertTask, onInsertNote, projectColor, projectsStructure, onMoveTask, currentProjectId }: TaskListProps) => {
    // Global Menu State
    const [menuState, setMenuState] = useState<{
       taskId: string | null;
       x: number;
       y: number;
       isOpen: boolean;
    }>({ taskId: null, x: 0, y: 0, isOpen: false });

    const handleOpenMenu = (taskId: string, e: React.MouseEvent | React.TouchEvent) => {
       // e.preventDefault(); // Optional, depending on if we want to block default context menu everywhere
       
       let clientX, clientY;
       
       if ('touches' in e) {
          clientX = e.touches[0].clientX;
          clientY = e.touches[0].clientY;
       } else {
          clientX = (e as React.MouseEvent).clientX;
          clientY = (e as React.MouseEvent).clientY;
       }

       // For button clicks, we might want to align differently, but using click coordinates is fine for now
       setMenuState({
          taskId,
          x: clientX,
          y: clientY,
          isOpen: true
       });
    };

    const closeMenu = () => {
       setMenuState(prev => ({ ...prev, isOpen: false }));
    };

    const activeTask = menuState.taskId ? tasks.find(t => t.id === menuState.taskId) : null;
    
    // Determine active group color for the menu context if needed
    // But TaskMenuItems calculates "isInsideGroup" logic? 
    // Wait, TaskMenuItems needs "isInsideGroup". 
    // Let's find the active group color for the active task.
    // Logic from loop below:
    let activeTaskGroupColor: string | null = null;
    if (activeTask && !activeTask.is_pinned) {
        // We need to find the group above it.
        // This is expensive to calculate every render, but okay for just one open menu.
        // Actually, let's reuse the logic we already have for the list.
    }
    
    const pinnedTasks = React.useMemo(() => tasks.filter(t => t.is_pinned), [tasks]);
    const unpinnedTasks = React.useMemo(() => tasks.filter(t => !t.is_pinned), [tasks]);

    const tasksWithGroupInfo = React.useMemo(() => {
        let currentGroupColor: string | null = null;
        // First pass: Calculate group counts
        const groupCounts: Record<string, number> = {};
        let currentGroupId: string | null = null;

        unpinnedTasks.forEach(task => {
            if (task.task_type === 'group') {
                currentGroupId = task.id;
                groupCounts[currentGroupId] = 0;
            } else if (task.task_type === 'gap') {
                currentGroupId = null;
            } else if (currentGroupId) {
                groupCounts[currentGroupId]++;
            }
        });

        // Second pass: Map tasks with colors and counts
        return unpinnedTasks.map(task => {
            if (task.task_type === 'group') {
                currentGroupColor = task.group_color || '#3b82f6';
                return { 
                   task, 
                   activeGroupColor: null,
                   groupCount: groupCounts[task.id] || 0
                };
            }
            if (task.task_type === 'gap') {
                currentGroupColor = null;
                return { task, activeGroupColor: null };
            }
            return { task, activeGroupColor: currentGroupColor };
        });
    }, [unpinnedTasks]);

    // Find group color for active task
    const activeTaskInfo = tasksWithGroupInfo.find(t => t.task.id === menuState.taskId);
    const isInsideGroup = !!activeTaskInfo?.activeGroupColor;


    return (
        <div className="w-full pr-0 pb-10">
             {pinnedTasks.length > 0 && (
                 <div className="flex flex-col gap-[3px] mb-6 pb-2  outline-none">
                     {pinnedTasks.map(task => (
                         <TaskRow 
                             key={task.id}
                             task={task}
                             onUpdate={onUpdateTask}
                             onDelete={onDeleteTask}
                             isHighlighted={highlightedTaskId === task.id}
                             projectColor={projectColor}
                             onOpenMenu={handleOpenMenu}
                             // Pinned tasks are not draggable, so onAddGap is not needed here or behaves differently
                         />
                     ))}
                 </div>
             )}

             <SortableContext
                items={unpinnedTasks.map(t => t.id)}
                strategy={verticalListSortingStrategy}
             >
               <div className="flex flex-col gap-[3px] min-h-[50px] outline-none">
                  <AnimatePresence initial={false}>
                      {tasksWithGroupInfo.map(({ task, activeGroupColor, groupCount }, index) => (
                         <TaskRow
                            key={task._tempId || task.id}
                            task={task}
                            onUpdate={onUpdateTask}
                            onDelete={onDeleteTask}
                            isHighlighted={highlightedTaskId === task.id}
                            onAddGap={() => onAddGap?.(index)}
                            projectColor={projectColor}
                            activeGroupColor={activeGroupColor}
                            projectsStructure={projectsStructure}
                            onMove={onMoveTask}
                            currentProjectId={currentProjectId}
                            onOpenMenu={handleOpenMenu}
                            isMenuOpen={menuState.isOpen && menuState.taskId === task.id}
                            groupCount={groupCount}
                         />
                      ))}
                  </AnimatePresence>
                  {isEmpty && (
                       <div className="text-center py-10 text-default-400">
                           No tasks in this folder.
                       </div>
                   )}
                </div>
             </SortableContext>
             {/* Invisible spacer to prevent selecting last task text on double click below list */}
             <div className="h-px w-full" />

             {/* GLOBAL MENU */}
             {activeTask && (
                <Dropdown
                   isOpen={menuState.isOpen}
                   onOpenChange={(open) => {
                      if (!open) closeMenu();
                   }}
                   placement="bottom-start"
                   triggerScaleOnOpen={false}
                >
                   <DropdownTrigger>
                      <div
                         style={{
                            position: 'fixed',
                            left: menuState.x,
                            top: menuState.y,
                            width: 0,
                            height: 0,
                            pointerEvents: 'none',
                            zIndex: 9999, // Ensure it's on top
                         }}
                      />
                   </DropdownTrigger>
                   <DropdownMenu aria-label="Task Actions" className="overflow-visible">
                      {TaskMenuItems({
                         task: activeTask,
                         onUpdate: onUpdateTask,
                         onDelete: onDeleteTask,
                         onAddGap: () => {
                             // Find index in the FULL list of tasks (filtered by folder), not just unpinned
                             const index = tasks.findIndex(t => t.id === activeTask.id);
                             if (index !== -1 && onAddGap) onAddGap(index); 
                         },
                         onInsertTask: (position) => {
                             // Find index in the FULL list of tasks
                             const index = tasks.findIndex(t => t.id === activeTask.id);
                             if (index !== -1 && onInsertTask) {
                                 onInsertTask(position === 'above' ? index : index + 1);
                             }
                         },
                         onInsertNote: (position) => {
                             const index = tasks.findIndex(t => t.id === activeTask.id);
                             if (index !== -1 && onInsertNote) {
                                 onInsertNote(position === 'above' ? index : index + 1);
                             }
                         },
                         onMove: onMoveTask,
                         projectsStructure: projectsStructure,
                         isInsideGroup: isInsideGroup,
                         currentProjectId: currentProjectId,
                         items: {
                            delete: true,
                            makeGap: true,
                            makeGroup: true,
                            makeNote: true,
                            today: true,
                            move: true,
                            styles: true
                         },
                         closeMenu: closeMenu
                      })}
                   </DropdownMenu>
                </Dropdown>
             )}
        </div>
    );
};
