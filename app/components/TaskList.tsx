'use client';

import React, { useState } from 'react';
import { Task } from '@/app/types';
import { TaskRow } from '@/app/TaskRow';
import { UiRow } from '@/app/components/remote/UiRow'; // Import UiRow
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { AnimatePresence } from 'framer-motion';
import { Dropdown, DropdownTrigger, DropdownMenu } from '@heroui/react';
import { TaskMenuItems } from '@/app/components/TaskContextMenu';
import { UiContextMenu } from '@/app/components/remote/UiContextMenu'; // Import UiContextMenu

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
    onSelectTask?: (taskId: string) => void;
    selectedTaskId?: string | null;
    isUiProject?: boolean; // NEW PROP
}

export const TaskList = ({ tasks, onUpdateTask, onDeleteTask, isEmpty, highlightedTaskId, onAddGap, onInsertTask, onInsertNote, projectColor, projectsStructure, onMoveTask, currentProjectId, onSelectTask, selectedTaskId, isUiProject }: TaskListProps) => {
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

    const allAreGaps = React.useMemo(() => {
        return unpinnedTasks.length > 0 && unpinnedTasks.every(t => t.task_type === 'gap');
    }, [unpinnedTasks]);

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

        // Second pass: Map tasks with colors and counts AND FILTER CLOSED GROUPS
        return unpinnedTasks.reduce((acc: any[], task) => {
            // Determine parent group status
            let isParentClosed = false;
            if (task.group_id) {
                // Find parent group in the FULL unpinned list (or use cache/lookup if optimization needed)
                // Since tasks are flat list, parent is likely 'above' or just search by ID.
                const parentGroup = unpinnedTasks.find(t => t.id === task.group_id);
                if (parentGroup && parentGroup.is_closed) {
                    isParentClosed = true;
                }
            }

            if (isParentClosed) {
                // If it's a GAP, allow it to be shown
                if (task.task_type !== 'gap') {
                    // Skip rendering this task
                    return acc;
                }
            }

            if (task.task_type === 'group') {
                currentGroupColor = task.group_color || '#3b82f6';
                acc.push({ 
                   task, 
                   activeGroupColor: null,
                   groupCount: groupCounts[task.id] || 0
                });
            } else if (task.task_type === 'gap') {
                currentGroupColor = null;
                acc.push({ task, activeGroupColor: null, isLastStandingGap: allAreGaps });
            } else {
                // Use explicit group_id for styling if available
                let effectiveGroupColor = null;
                
                if (task.group_id) {
                    // If task has explicit parent, use its color
                    const parent = unpinnedTasks.find(t => t.id === task.group_id);
                    if (parent) {
                        effectiveGroupColor = parent.group_color || '#3b82f6';
                    }
                } 
                
                acc.push({ task, activeGroupColor: effectiveGroupColor });
            }
            
            return acc;
        }, []);
    }, [unpinnedTasks, allAreGaps]);

    // Find group color for active task
    const activeTaskInfo = tasksWithGroupInfo.find(t => t.task.id === menuState.taskId);
    const isInsideGroup = !!activeTaskInfo?.activeGroupColor;


    // Validation helper for UiRow
    const validateItemId = React.useCallback((id: string) => {
        if (!id.trim()) return 'ID cannot be empty';
        if (!/^[a-zA-Z0-9_-]+$/.test(id)) return 'Only Latin letters, numbers, "-" and "_" allowed';
        
        // Check existence in CURRENT list
        // Note: This checks against already loaded tasks. 
        // If duplicates exist across folders (should not happen if ID is unique per project?), 
        // we might need broader check, but usually uniqueness is per list/table.
        // Assuming item_id must be unique within the project? Or folder?
        // Let's assume global uniqueness within loaded tasks for now (which is per folder usually).
        // Wait, standard tasks don't have item_id. Only UI tasks.
        
        const exists = tasks.some(t => t.item_id === id && !t.isNew); // Exclude self if new?
        // Actually we need to exclude SELF by ID, not just isNew.
        // But validateItemId takes a string 'id' (the value).
        // We can't easily exclude "current row" unless we pass current row ID to validator factory.
        // BUT, UiRow calls this validator with the VALUE.
        
        // Correction: The validator in LocalizScreen checks:
        // const exists = items.some((i) => i.item_id === id && !i.isNew);
        // This means it prevents entering an ID that belongs to an EXISTING SAVED item.
        // It doesn't check against other drafts.
        
        return exists ? 'ID already exists' : null;
    }, [tasks]);

    return (
        <div className="w-full pr-0 pb-10">
             {/* INVISIBLE SPACER for double click area */}
             <div className="h-px w-full" />

             {/* RENDER LIST: Switch between TaskRow and UiRow */}
             <div className="flex flex-col gap-[3px] min-h-[50px] outline-none">
                  {/* Pinned Tasks (Only for standard mode for now, or adapt UI row for pinned?) */}
                  {/* Assuming UI mode doesn't rely heavily on pinned tasks yet, or use standard logic if needed. */}
                  {/* Actually, let's keep pinned logic simple: render pinned items first. */}
                  
                  {pinnedTasks.length > 0 && (
                     <div className="flex flex-col gap-[3px] mb-6 pb-2 outline-none">
                         {pinnedTasks.map(task => (
                             isUiProject ? (
                                 <UiRow
                                     key={task.id}
                                     task={task}
                                     onUpdate={onUpdateTask}
                                     onDelete={onDeleteTask}
                                     isHighlighted={highlightedTaskId === task.id}
                                     onSelect={() => onSelectTask?.(task.id)}
                                     isSelected={selectedTaskId === task.id}
                                     onOpenMenu={handleOpenMenu}
                                     onValidateId={validateItemId}
                                 />
                             ) : (
                                 <TaskRow 
                                     key={task.id}
                                     task={task}
                                     onUpdate={onUpdateTask}
                                     onDelete={onDeleteTask}
                                     isHighlighted={highlightedTaskId === task.id}
                                     projectColor={projectColor}
                                     onOpenMenu={handleOpenMenu}
                                 />
                             )
                         ))}
                     </div>
                  )}

                  <SortableContext
                    items={unpinnedTasks.map(t => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                      <AnimatePresence initial={false}>
                          {tasksWithGroupInfo.map(({ task, activeGroupColor, groupCount, isLastStandingGap }, index) => (
                             isUiProject ? (
                                 <UiRow
                                    key={task._tempId || task.id}
                                    task={task}
                                    onUpdate={onUpdateTask}
                                    onDelete={onDeleteTask}
                                    isHighlighted={highlightedTaskId === task.id}
                                    onSelect={() => onSelectTask?.(task.id)}
                                    isSelected={selectedTaskId === task.id}
                                    onOpenMenu={handleOpenMenu}
                                    onValidateId={validateItemId}
                                 />
                             ) : (
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
                                    isLastStandingGap={isLastStandingGap}
                                    onSelect={() => onSelectTask?.(task.id)}
                                    isSelected={selectedTaskId === task.id}
                                 />
                             )
                          ))}
                      </AnimatePresence>
                  </SortableContext>
                  
                  {isEmpty && (
                       <div className="text-center py-10 text-default-400">
                           {isUiProject ? 'No UI elements in this screen.' : 'No tasks in this folder.'}
                       </div>
                   )}
             </div>

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
                      {isUiProject ? (
                          UiContextMenu({
                              task: activeTask,
                              onUpdate: onUpdateTask,
                              onDelete: onDeleteTask,
                              onAddGap: () => {
                                  const index = tasks.findIndex(t => t.id === activeTask.id);
                                  if (index !== -1 && onAddGap) onAddGap(index); 
                              },
                              onInsertTask: (position) => {
                                  const index = tasks.findIndex(t => t.id === activeTask.id);
                                  if (index !== -1 && onInsertTask) {
                                      onInsertTask(position === 'above' ? index : index + 1);
                                  }
                              },
                              isInsideGroup: isInsideGroup,
                              closeMenu: closeMenu
                          })
                      ) : (
                          TaskMenuItems({
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
                          })
                      )}
                   </DropdownMenu>
                </Dropdown>
             )}
        </div>
    );
};
