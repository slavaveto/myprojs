import { useState, useRef, useMemo } from 'react';
import { 
    DragEndEvent, 
    DragStartEvent, 
    DragOverEvent,
    KeyboardSensor, 
    PointerSensor, 
    closestCenter, 
    pointerWithin, 
    useSensor, 
    useSensors, 
    CollisionDetection 
} from '@dnd-kit/core';
import { 
    arrayMove, 
    sortableKeyboardCoordinates 
} from '@dnd-kit/sortable';
import { calculateGroupUpdates } from './groupLogic';
import { Project, Task, Folder } from '@/app/types';
import { createLogger } from '@/utils/logger/Logger';
import { globalStorage } from '@/utils/storage';
import { taskService } from '@/app/_services/taskService';

const logger = createLogger('ProjectScreenDnD');

interface UseProjectDnDProps {
    project: Project;
    tasks: Task[];
    setTasks: React.Dispatch<React.SetStateAction<Task[]>>;
    folders: Folder[];
    selectedFolderId: string;
    setSelectedFolderId: (id: string) => void;
    executeSave: (action: () => Promise<void>) => Promise<void>;
}

export const useProjectDnD = ({
    project,
    tasks,
    setTasks,
    folders,
    selectedFolderId,
    setSelectedFolderId,
    executeSave // This will be executeQuickSave passed from parent
}: UseProjectDnDProps) => {
    // --- Local UI State for DnD (Visuals only) ---
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isOverFolder, setIsOverFolder] = useState(false);
    const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
    
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hoveredFolderIdRef = useRef<string | null>(null);
    const isDraggingRef = useRef(false);
    
    // Store initial state of the dragged item to prevent unnecessary saves
    const initialDragStateRef = useRef<{ folderId: string; index: number } | null>(null);
    const draggedGapIdRef = useRef<string | null>(null); // Track gap associated with dragged group

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                delay: 0,
                tolerance: 0,
            },
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const customCollisionDetection: CollisionDetection = (args) => {
        const { active } = args;
        
        // Prevent groups from being dragged into other folders
        // Ensure ID comparison is safe (String)
        const activeTask = tasks.find(t => t.id === String(active.id));
        if (activeTask && activeTask.task_type === 'group') {
             // Filter out folder drop zones from collision candidates to strictly prevent interaction
             const filteredArgs = {
                 ...args,
                 droppableContainers: args.droppableContainers.filter(
                     c => !c.id.toString().startsWith('folder-')
                 )
             };
             return closestCenter(filteredArgs);
        }

        const isDraggingFolder = active.id.toString().startsWith('folder-');

        // 1. Check folder tabs with pointerWithin
        const pointerCollisions = pointerWithin(args);
        const folderCollision = pointerCollisions.find(c => c.id.toString().startsWith('folder-'));
        
        if (folderCollision) {
            const folderId = folderCollision.id.toString();
            
            // Handle folder switch timer logic
            if (!isDraggingFolder && hoveredFolderIdRef.current !== folderId) {
                hoveredFolderIdRef.current = folderId;
                
                // Update state for UI highlighting
                setTimeout(() => {
                    if (isDraggingRef.current) {
                        setHoveredFolderId(folderId);
                    }
                }, 0);
                
                if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                    hoverTimeoutRef.current = null;
                }

                const targetId = folderId.replace('folder-', '');
                if (targetId !== selectedFolderId) {
                    hoverTimeoutRef.current = setTimeout(() => {
                        setSelectedFolderId(targetId);
                        globalStorage.setItem(`active_folder_${project.id}`, targetId);
                        
                        // Move active task to the new folder immediately (to the top)
                        if (isDraggingRef.current) {
                             setTasks(prev => {
                                 const activeTask = prev.find(t => t.id === active.id);
                                 if (!activeTask) return prev;
                                 
                                 // Calculate min order in target folder
                                 const targetTasks = prev.filter(t => t.folder_id === targetId);
                                 const minOrder = targetTasks.length > 0 
                                     ? Math.min(...targetTasks.map(t => t.sort_order)) 
                                     : 0;
                                     
                                 const updatedTask = {
                                     ...activeTask,
                                     folder_id: targetId,
                                     sort_order: minOrder - 1000, // Top
                                     updated_at: new Date().toISOString()
                                 };
                                 
                                 return prev.map(t => t.id === active.id ? updatedTask : t);
                             });
                        }
                    }, 300);
                }
            }

            // If we are over a folder, return it as collision. 
            // We DON'T force return task collision here anymore, we handle folder switch logic above
            // and let DndContext know we are over a folder.
            return [folderCollision];
        }
        
        // Reset if left folder area
        if (!isDraggingFolder && hoveredFolderIdRef.current) {
            const stillOverFolder = pointerCollisions.some(c => c.id.toString().startsWith('folder-'));
            
            if (!stillOverFolder) {
                hoveredFolderIdRef.current = null;
                setTimeout(() => {
                    setHoveredFolderId(null);
                }, 0);

                if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                    hoverTimeoutRef.current = null;
                }
            }
        }

        // 2. For tasks list reordering use closestCenter
        return closestCenter(args);
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        isDraggingRef.current = true;
        draggedGapIdRef.current = null;

        const task = tasks.find(t => t.id === event.active.id);
        if (task) {
            initialDragStateRef.current = {
                folderId: task.folder_id,
                index: task.sort_order
            };

            // If dragging a group, check if there's a GAP immediately after it (or its children)
            if (task.task_type === 'group') {
                const folderTasks = tasks
                    .filter(t => t.folder_id === task.folder_id)
                    .sort((a, b) => a.sort_order - b.sort_order);
                
                const taskIndex = folderTasks.findIndex(t => t.id === task.id);
                if (taskIndex !== -1) {
                    // Find end of group block
                    let nextIndex = taskIndex + 1;
                    while (nextIndex < folderTasks.length) {
                        const next = folderTasks[nextIndex];
                        
                        if (next.group_id === task.id) {
                            nextIndex++; // Skip child task/note
                        } else {
                            // Found something not in group (could be a GAP, or another task/group)
                            if (next.task_type === 'gap') {
                                draggedGapIdRef.current = next.id;
                            }
                            break; 
                        }
                    }
                }
            }
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        const overId = over?.id;

        // Update isOverFolder state based on ref from collision detection
        const folderOverId = hoveredFolderIdRef.current;
        const isOverFolderNode = !!folderOverId; 
        if (isOverFolder !== isOverFolderNode) {
           setIsOverFolder(isOverFolderNode);
        }

        if (!overId || active.id === overId) return;

        const activeIdString = active.id as string;
        const overIdString = overId as string;

        // Skip if dragging folder
        if (activeIdString.startsWith('folder-')) return;

        const activeTask = tasks.find(t => t.id === activeIdString);
        if (!activeTask) return;

        // 1. Cross-folder movement: If task is not in current folder, move it immediately
        if (activeTask.folder_id !== selectedFolderId) {
            setTasks((prev) => {
                const activeTaskIndex = prev.findIndex(t => t.id === activeIdString);
                if (activeTaskIndex === -1) return prev; // Should not happen

                // Find tasks in the target folder to determine order
                const targetFolderTasks = prev
                    .filter(t => t.folder_id === selectedFolderId)
                    .sort((a, b) => a.sort_order - b.sort_order);

                let newSortOrder = 0;
                
                // If we are over a task in the target folder, use its order
                const overTask = prev.find(t => t.id === overIdString);
                if (overTask && overTask.folder_id === selectedFolderId) {
                     // We just take the overTask's sort_order. 
                     // The arrayMove logic in the next step (Same folder reordering) will handle precise positioning
                     // relative to this item (above/below).
                     newSortOrder = overTask.sort_order;
                } else {
                    // Put at the end if empty or not over a task
                    // BUT wait, if we are here via customCollisionDetection/timer, we already put it at the top.
                    // This logic handles dragOver on the LIST itself. 
                    // Let's keep it consistent: if we drag over list but not over specific task, append? 
                    // Or keep top? If it's already top from timer, this might override it if we are not careful.
                    
                    // If we just switched folder via timer, task is already at top.
                    // If we drag over the list container, maybe we should respect current position?
                    
                    newSortOrder = targetFolderTasks.length > 0 
                        ? targetFolderTasks[targetFolderTasks.length - 1].sort_order + 1 
                        : 0;
                }

                // Create new state with updated folder and order
                const newTasks = [...prev];
                newTasks[activeTaskIndex] = {
                    ...newTasks[activeTaskIndex],
                    folder_id: selectedFolderId,
                    sort_order: newSortOrder,
                    updated_at: new Date().toISOString()
                };
                
                return newTasks;
            });
            return;
        }

        // 2. Reordering within the same folder (Standard DndKit logic)
        const overTask = tasks.find(t => t.id === overIdString);
        if (overTask && overTask.folder_id === selectedFolderId) {
            const currentTasks = tasks
                .filter(t => t.folder_id === selectedFolderId)
                .sort((a, b) => a.sort_order - b.sort_order);
            
            const oldIndex = currentTasks.findIndex(t => t.id === activeIdString);
            const newIndex = currentTasks.findIndex(t => t.id === overIdString);

            if (oldIndex !== newIndex) {
                const newOrdered = arrayMove(currentTasks, oldIndex, newIndex);
                
                // Normalize sort orders based on new array index
                // This ensures the sort_order field matches the visual order
                const orderMap = new Map<string, number>();
                newOrdered.forEach((t, idx) => orderMap.set(t.id, idx));

                setTasks((prev) => {
                    return prev.map(t => {
                        if (orderMap.has(t.id)) {
                            return { ...t, sort_order: orderMap.get(t.id)! };
                        }
                        return t;
                    });
                });
            }
        }
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setIsOverFolder(false); 
        setHoveredFolderId(null);
        isDraggingRef.current = false;
        hoveredFolderIdRef.current = null;

        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }

        const activeIdString = active.id as string;
        
        // Handle folder sorting (if needed, but currently we focus on tasks)
        if (activeIdString.startsWith('folder-')) {
            return;
        }

        // --- Save Changes to DB ---
        // The state (tasks) is already updated in handleDragOver.
        // We just need to persist the new folder_id and sort_orders for the current folder.
        
        const activeTaskForSave = tasks.find(t => t.id === activeIdString);
        if (!activeTaskForSave) return;

        // Optimization: Check if anything actually changed
        // We compare current state of activeTask with initial state
        // Note: activeTask is already updated in state via handleDragOver
        if (initialDragStateRef.current) {
            const { folderId: oldFolderId, index: oldIndex } = initialDragStateRef.current;
            // Use fresh filtered list for check
            const currentFolderTasksForCheck = tasks
                .filter(t => t.folder_id === selectedFolderId)
                .sort((a, b) => a.sort_order - b.sort_order);
            
            // Find current index in the filtered list to be sure about visual order
            const currentIndex = currentFolderTasksForCheck.findIndex(t => t.id === activeIdString);
            
            if (activeTaskForSave.folder_id === oldFolderId && activeTaskForSave.sort_order === oldIndex) {
                logger.info('Drag ended with no changes, skipping save');
                initialDragStateRef.current = null;
                return;
            }
        }
        
        initialDragStateRef.current = null;

        // Filter tasks in the destination folder (which is now selectedFolderId for the active task)
        const currentFolderTasks = tasks
            .filter(t => t.folder_id === selectedFolderId)
            .sort((a, b) => a.sort_order - b.sort_order);

        // Filter tasks in the destination folder
        // Use 'let' or unique name to avoid conflict if redeclared (it was declared above for check)
        const currentFolderTasksForUpdate = tasks
            .filter(t => t.folder_id === selectedFolderId)
            .sort((a, b) => a.sort_order - b.sort_order);

        // --- REHYDRATE LIST LOGIC ---
        // We need to reconstruct the FULL list including hidden children of closed groups
        // in the correct order relative to the new visual order.
        
        // Step 1: Separate items into Visible (Groups/Gaps/Orphans/Tasks in Open Groups) and Hidden (Tasks in Closed Groups).
        const visibleItems: Task[] = [];
        const hiddenChildrenMap = new Map<string, Task[]>(); // groupId -> children[]
        
        // We need a robust way to know if a task is hidden.
        // We can look up parents.
        
        const groupMap = new Map<string, Task>();
        currentFolderTasksForUpdate.forEach(t => {
            if (t.task_type === 'group') groupMap.set(t.id, t);
        });
        
        currentFolderTasksForUpdate.forEach(t => {
            if (t.group_id) {
                const parent = groupMap.get(t.group_id);
                if (parent && parent.is_closed) {
                    // Hidden child
                    const kids = hiddenChildrenMap.get(parent.id) || [];
                    kids.push(t);
                    hiddenChildrenMap.set(parent.id, kids);
                    return;
                }
            }
            visibleItems.push(t);
        });
        
        // Step 2: 'visibleItems' now contains the items in their *current database order*, minus hidden ones.
        // BUT the active task has a new sort_order from dragOver.
        // We need to sort 'visibleItems' by their current sort_order to reflect the drag result.
        visibleItems.sort((a, b) => a.sort_order - b.sort_order);
        
        // Step 3: Reconstruct full list
        const finalFlatList: Task[] = [];
        
        visibleItems.forEach(item => {
            finalFlatList.push(item);
            
            // If this item is a closed group, immediately append its hidden children
            if (item.task_type === 'group' && item.is_closed) {
                const children = hiddenChildrenMap.get(item.id);
                if (children) {
                    // Sort children by their original order (to preserve internal order)
                    children.sort((a, b) => a.sort_order - b.sort_order);
                    finalFlatList.push(...children);
                }
            }
        });
        
        // Now 'finalFlatList' is the correct sequence.
        
        // --- AUTO-GAP LOGIC FOR CLOSED GROUPS ---
        // If we dragged a CLOSED group, and it landed on top of other tasks,
        // we must insert a GAP to prevent those tasks from merging into the closed group.
        
        let gapToInsert: Task | null = null;
        const activeTaskForGap = tasks.find(t => t.id === activeIdString);
        
        if (activeTaskForGap && activeTaskForGap.task_type === 'group' && activeTaskForGap.is_closed) {
            // Find where the group block ends in finalFlatList
            const groupIndex = finalFlatList.findIndex(t => t.id === activeIdString);
            if (groupIndex !== -1) {
                // Determine how many children this group has
                let blockEndIndex = groupIndex;
                for (let i = groupIndex + 1; i < finalFlatList.length; i++) {
                    if (finalFlatList[i].group_id === activeIdString) {
                        blockEndIndex = i;
                    } else {
                        break;
                    }
                }
                
                // OPTION 1: Move Existing Gap
                if (draggedGapIdRef.current) {
                    const existingGapIndex = finalFlatList.findIndex(t => t.id === draggedGapIdRef.current);
                    if (existingGapIndex !== -1) {
                        // Move it to blockEndIndex + 1 (the end of the newly positioned group block)
                        const [gap] = finalFlatList.splice(existingGapIndex, 1);
                        
                        // Recalculate blockEndIndex because splice might have shifted indices
                        const newGroupIndex = finalFlatList.findIndex(t => t.id === activeIdString);
                        let newBlockEndIndex = newGroupIndex;
                         for (let i = newGroupIndex + 1; i < finalFlatList.length; i++) {
                            if (finalFlatList[i].group_id === activeIdString) {
                                newBlockEndIndex = i;
                            } else {
                                break;
                            }
                        }
                        
                        finalFlatList.splice(newBlockEndIndex + 1, 0, gap);
                        logger.info('Moved existing gap with dragged group');
                    }
                } 
                // OPTION 2: Create New Gap (Only if we didn't have one)
                else {
                    // Check what comes after the group block
                    if (blockEndIndex < finalFlatList.length - 1) {
                        const nextTask = finalFlatList[blockEndIndex + 1];
                        // If next task is a regular task/note, we need a separator
                        if (nextTask && (nextTask.task_type === 'task' || nextTask.task_type === 'note')) {
                            // Create a temporary GAP
                            const gapId = crypto.randomUUID();
                            gapToInsert = {
                                id: gapId,
                                folder_id: selectedFolderId,
                                content: '',
                                sort_order: 0, // Will be recalculated
                                is_completed: false,
                                task_type: 'gap',
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString(),
                                isNew: true,
                                isDraft: false
                            } as Task;
                            
                            // Insert gap into the list
                            finalFlatList.splice(blockEndIndex + 1, 0, gapToInsert);
                            logger.info('Auto-inserting gap after closed group drag');
                        }
                    }
                }
            }
        }

        // Step 4: Recalculate Group IDs and Sort Orders for everyone
        const sortedTasks = finalFlatList; // Use this reconstructed list
        
        // Use unified helper for group calculations
        const groupUpdates = calculateGroupUpdates(sortedTasks);
        
        const tasksToUpdate = sortedTasks.map((t, index) => {
             // Find if group ID needs update
             const groupUpdate = groupUpdates.find(u => u.id === t.id);
             // Default to keeping old if no update, but helper returns full diffs? No, helper returns calculated.
             // Wait, helper logic might override "hidden" logic optimization?
             // "Optimization: If t is hidden (part of closed group), it MUST belong to that group."
             // My helper logic doesn't know about hidden status, it just calculates based on linear order.
             // BUT since we rehydrated the list correctly (Group -> Children -> Gap/Task), 
             // the helper will correctly assign children to the group above them.
             // So the optimization is actually redundant if the order is correct!
             // And we ensured order is correct in Step 3.
             
             const newGroupId = groupUpdate ? groupUpdate.group_id : (t.task_type === 'task' || t.task_type === 'note' ? t.group_id : null); 
             // If calculateGroupUpdates didn't return an update, it means no change? 
             // No, my implementation of calculateGroupUpdates ONLY returns items that CHANGED.
             // So if it's not in array, newGroupId = t.group_id.
             
             // Check if changed
             const isGroupIdChanged = t.group_id !== newGroupId;
             const isSortOrderChanged = t.sort_order !== index;
             
             return {
            id: t.id, 
                 sort_order: index,
                 group_id: newGroupId,
                 shouldUpdate: isGroupIdChanged || isSortOrderChanged
             };
        });

        const updatesForOrder = tasksToUpdate.map(t => ({ id: t.id, sort_order: t.sort_order, group_id: t.group_id }));
        
        // Find update for active task to send specific DB update (though updateTaskOrder handles all, updateTask is specific)
        const activeTaskUpdate = tasksToUpdate.find(u => u.id === activeIdString);
        
        // Update local state FULLY to match calculations
        setTasks(prev => {
            // Update existing tasks
            const updated = prev.map(t => {
                const update = tasksToUpdate.find(u => u.id === t.id);
                if (update) {
                    return { ...t, sort_order: update.sort_order, group_id: update.group_id };
                }
                return t;
            });
            
            // Append new GAP if created
            if (gapToInsert) {
                // Find gap update to get final props
                const gapUpdate = tasksToUpdate.find(u => u.id === gapToInsert!.id);
                if (gapUpdate) {
                    // Update gap object with final calculated values
                    gapToInsert.sort_order = gapUpdate.sort_order;
                    gapToInsert.group_id = gapUpdate.group_id;
                    // Add to state
                    updated.push(gapToInsert);
                }
            }
            
            return updated;
        });

        try {
            await executeSave(async () => {
                // Execute updates in parallel
                const promises: Promise<any>[] = [];

                // 0. Create Auto-Gap if needed
                if (gapToInsert) {
                    const gapUpdate = tasksToUpdate.find(u => u.id === gapToInsert!.id);
                    if (gapUpdate) {
                        promises.push(
                            taskService.createTask(selectedFolderId, '', gapUpdate.sort_order)
                                .then(created => taskService.updateTask(created.id, { task_type: 'gap' }))
                        );
                    }
                }

                // 1. Update order for ALL tasks in the folder AND their group_id
                const updatesForExisting = updatesForOrder.filter(u => !gapToInsert || u.id !== gapToInsert.id);
                promises.push(taskService.updateTaskOrder(updatesForExisting));

                // 2. If active task changed folder, we still need updateTask for folder_id
                if (activeTaskUpdate && activeTaskForSave.folder_id !== selectedFolderId) {
                     promises.push(taskService.updateTask(activeIdString, { 
                        folder_id: selectedFolderId,
                    }));
                }
                
                await Promise.all(promises);
            });
        } catch (err) {
            logger.error('Failed to save drag changes', err);
            // In case of error, you might want to reload data or show toast
        }
    };

    // Simplify filteredTasks - no more "temp" logic needed
    const filteredTasks = useMemo(() => {
        return tasks
            .filter(t => t.folder_id === selectedFolderId && !t.is_completed)
            .sort((a, b) => a.sort_order - b.sort_order);
    }, [tasks, selectedFolderId]);

    return {
        activeId,
        isOverFolder,
        hoveredFolderId,
        sensors,
        customCollisionDetection,
        handleDragStart,
        handleDragOver,
        handleDragEnd,
        filteredTasks
    };
};
