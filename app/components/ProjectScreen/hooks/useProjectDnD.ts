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
import { Project, Task, Folder } from '@/app/types';
import { createLogger } from '@/utils/logger/Logger';
import { globalStorage } from '@/utils/storage';
import { projectService } from '@/app/_services/projectService';

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
    executeSave
}: UseProjectDnDProps) => {
    // --- Local UI State for DnD (Visuals only) ---
    const [activeId, setActiveId] = useState<string | null>(null);
    const [isOverFolder, setIsOverFolder] = useState(false);
    const [hoveredFolderId, setHoveredFolderId] = useState<string | null>(null);
    
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hoveredFolderIdRef = useRef<string | null>(null);
    const isDraggingRef = useRef(false);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                delay: 0,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const customCollisionDetection: CollisionDetection = (args) => {
        const { active } = args;
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
        
        const activeTask = tasks.find(t => t.id === activeIdString);
        if (!activeTask) return;

        // Filter tasks in the destination folder (which is now selectedFolderId for the active task)
        const currentFolderTasks = tasks
            .filter(t => t.folder_id === selectedFolderId)
            .sort((a, b) => a.sort_order - b.sort_order);

        // Prepare updates for DB
        const updates = currentFolderTasks.map((t, index) => ({ 
            id: t.id, 
            sort_order: index 
        }));

        try {
            await executeSave(async () => {
                // 1. If folder changed, update the task specifically
                // (Although updatedTask is already in 'updates', we might want to ensure folder_id is sent)
                // But updateTaskOrder usually only updates sort_order. 
                // So we should check if we need to update folder_id explicitly.
                
                // We don't have "previous folder id" here easily available unless we store it.
                // But we can just update the active task's folder_id to be safe.
                
                await projectService.updateTask(activeIdString, { 
                    folder_id: selectedFolderId,
                    // We also send sort_order here, but the bulk update below will fix all orders
                });

                // 2. Update order for ALL tasks in the folder to ensure consistency
                await projectService.updateTaskOrder(updates);
            });
        } catch (err) {
            logger.error('Failed to save drag changes', err);
            // In case of error, you might want to reload data or show toast
        }
    };

    // Simplify filteredTasks - no more "temp" logic needed
    const filteredTasks = useMemo(() => {
        return tasks
            .filter(t => t.folder_id === selectedFolderId)
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
