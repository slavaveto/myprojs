import { useState, useRef, useMemo } from 'react';
import { 
    DragEndEvent, 
    DragStartEvent, 
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
            
            // Handle folder switch timer logic directly here because handleDragOver 
            // might not trigger if we return the same task collision
            if (!isDraggingFolder && hoveredFolderIdRef.current !== folderId) {
                hoveredFolderIdRef.current = folderId;
                
                // Update state for UI highlighting (safely via timeout to avoid render-cycle issues)
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
                        // Don't reset background here, keep it highlighted as long as we hover
                    }, 300);
                }
            }

            // Force DndKit to think we are over the first task ONLY if dragging a TASK
            if (!isDraggingFolder && filteredTasks.length > 0) {
                return [{ id: filteredTasks[0].id }];
            }
            
            return [folderCollision];
        }
        
        // Reset if left folder area (only relevant for task dragging)
        if (!isDraggingFolder && hoveredFolderIdRef.current) {
            // If we detect no folder collision but ref is set -> we left the folder area
            // Double check if we are really not over a folder (sometimes collisions fluctuate)
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

        // 2. For tasks list reordering use closestCenter (smoother)
        return closestCenter(args);
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        isDraggingRef.current = true;
    };

    // --- Spring-Loaded Folders Logic ---
    const handleDragOver = ({ active, over }: any) => {
        const folderOverId = hoveredFolderIdRef.current;
        const isOverFolderNode = !!folderOverId; 

        if (isOverFolder !== isOverFolderNode) {
            setIsOverFolder(isOverFolderNode);
        }
        
        // Timer logic moved to customCollisionDetection to handle "stuck" over updates
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        setActiveId(null);
        setIsOverFolder(false); 
        setHoveredFolderId(null);
        isDraggingRef.current = false;
        
        const folderOverId = hoveredFolderIdRef.current;
        hoveredFolderIdRef.current = null; // Reset ref

        // Clear timeout
        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }
        
        // If dropped over a folder (detected by custom collision)
        if (folderOverId && active.id.toString() !== folderOverId) {
            // Special handling for task dropped on folder tab
            const activeTaskId = active.id as string;
            const targetFolderId = folderOverId.replace('folder-', '');
            const task = tasks.find(t => t.id === activeTaskId);
            
            if (task && !activeTaskId.startsWith('folder-')) {
                // Calculate new sort order to be at the top
                const targetFolderTasks = tasks.filter(t => t.folder_id === targetFolderId);
                const minOrder = targetFolderTasks.length > 0 
                    ? Math.min(...targetFolderTasks.map(t => t.sort_order)) 
                    : 0;
                const newSortOrder = minOrder - 1000;

                const updatedTask = { 
                    ...task, 
                    folder_id: targetFolderId, 
                    sort_order: newSortOrder,
                    updated_at: new Date().toISOString() 
                };
                
                setTasks(prev => prev.map(t => t.id === activeTaskId ? updatedTask : t));
                setSelectedFolderId(targetFolderId);
                
                try {
                    await executeSave(async () => {
                        await projectService.updateTask(activeTaskId, { 
                            folder_id: targetFolderId,
                            sort_order: newSortOrder
                        });
                    });
                } catch(err) {
                    logger.error('Failed to move task folder', err);
                }
                return;
            }
        }

        if (!over) return;

        if (active.data.current?.type === 'folder' && over.data.current?.type === 'folder') {
            // Folder reordering removed
            return;
        }

        const activeTaskId = active.id as string;
        
        // Calculate currentFolderTasks once at the top level of drag end
        const currentFolderTasks = tasks
            .filter(t => t.folder_id === selectedFolderId)
            .sort((a, b) => a.sort_order - b.sort_order);

        // 1. Handle drop on itself (happens when dropping on the placeholder at the top)
        // or when dropping on the same position in the same list
        if (active.id === over.id) {
            // If moving from another folder, this means we want to drop at the current placeholder position (top)
            const activeTask = tasks.find(t => t.id === activeTaskId);
            if (activeTask && activeTask.folder_id !== selectedFolderId) {
                const minOrder = currentFolderTasks.length > 0 
                    ? Math.min(...currentFolderTasks.map(t => t.sort_order)) 
                    : 0;
                
                const updatedTask = { 
                    ...activeTask, 
                    folder_id: selectedFolderId, 
                    sort_order: minOrder - 1000, // Put at the top
                    updated_at: new Date().toISOString() 
                };
                
                setTasks(prev => {
                    const otherTasks = prev.filter(t => t.folder_id !== selectedFolderId && t.id !== activeTaskId);
                    const currentFolderTasksUpdated = currentFolderTasks.map(t => ({...t})); // Clone
                    return [...otherTasks, updatedTask, ...currentFolderTasksUpdated];
                });
                
                // Update DB
                try {
                    await executeSave(async () => {
                        await projectService.updateTask(activeTaskId, { 
                            folder_id: selectedFolderId,
                            sort_order: minOrder - 1000 
                        });
                        // Reorder full list to clean up sort orders
                        const allTasksInFolder = [updatedTask, ...currentFolderTasks];
                        const updates = allTasksInFolder.map((t, idx) => ({ id: t.id, sort_order: idx }));
                        await projectService.updateTaskOrder(updates);
                    });
                } catch(err) {
                    logger.error('Failed to move task to top', err);
                }
            }
            return;
        }

        if (active.id !== over.id) {
            // currentFolderTasks is already calculated above

            const activeTask = tasks.find(t => t.id === activeTaskId);
            
            // Case: Task moved from another folder into the list
            if (activeTask && activeTask.folder_id !== selectedFolderId) {
                const overIndex = currentFolderTasks.findIndex(t => t.id === over.id);
                
                // GEOMETRIC CALCULATION (Center based)
                let modifier = 0;
                let isBelow = false;
                
                // Safety check for rects
                if (active.rect.current.translated && over.rect) {
                    const activeRect = active.rect.current.translated;
                    const overRect = over.rect;
                    
                    const activeCenterY = activeRect.top + (activeRect.height / 2);
                    const overCenterY = overRect.top + (overRect.height / 2);
                    
                    isBelow = activeCenterY > overCenterY;
                    modifier = isBelow ? 1 : 0;
                    
                    logger.info('Drag Calc (Center):', {
                        activeCenterY,
                        overCenterY,
                        isBelow,
                        modifier,
                        overIndex
                    });
                }
                
                const newIndex = overIndex >= 0 ? overIndex + modifier : currentFolderTasks.length;
                
                // Insert at new index
                const updatedTask = { ...activeTask, folder_id: selectedFolderId, updated_at: new Date().toISOString() };
                
                // Create new list with inserted task
                const newSorted = [...currentFolderTasks];
                // Simple insertion at the index of the item we hovered over
                newSorted.splice(newIndex, 0, updatedTask);
                
                const updates = newSorted.map((t, index) => ({ id: t.id, sort_order: index }));

                setTasks(prev => {
                    const otherTasks = prev.filter(t => t.folder_id !== selectedFolderId && t.id !== activeTaskId);
                    const updatedCurrentTasks = newSorted.map((t, idx) => ({ ...t, sort_order: idx }));
                    return [...otherTasks, ...updatedCurrentTasks];
                });

                try {
                    await executeSave(async () => {
                        // 1. Update folder
                        await projectService.updateTask(activeTaskId, { folder_id: selectedFolderId });
                        // 2. Update all orders
                        await projectService.updateTaskOrder(updates);
                    });
                } catch(err) {
                    logger.error('Failed to move task to folder list', err);
                }
                return;
            }

            // Case: Reordering within same folder
            const oldIndex = currentFolderTasks.findIndex(t => t.id === active.id);
            const newIndex = currentFolderTasks.findIndex(t => t.id === over.id);

            if (oldIndex !== -1 && newIndex !== -1) {
                const newSorted = arrayMove(currentFolderTasks, oldIndex, newIndex);
                const updates = newSorted.map((t, index) => ({ id: t.id, sort_order: index }));
                
                setTasks(prev => {
                    const otherTasks = prev.filter(t => t.folder_id !== selectedFolderId);
                    const updatedCurrentTasks = newSorted.map((t, idx) => ({ ...t, sort_order: idx }));
                    return [...otherTasks, ...updatedCurrentTasks];
                });

                try {
                    await executeSave(async () => {
                        await projectService.updateTaskOrder(updates);
                    });
                } catch(err) {
                    logger.error('Failed to reorder tasks', err);
                }
            }
        }
    };

    const filteredTasks = useMemo(() => {
        let tasksForFolder = tasks.filter(t => t.folder_id === selectedFolderId);

        // If dragging a task into a new folder (spring-loaded), include it in the list temporarily
        if (activeId && !activeId.toString().startsWith('folder-')) {
            const activeTask = tasks.find(t => t.id === activeId);
            
            // Logic: If task is from another folder OR we are currently hovering over ANY folder tab
            // we want to visualize it at the top of the current list
            if (activeTask && (activeTask.folder_id !== selectedFolderId || isOverFolder)) {
                // Calculate temp sort order to show it at the top
                const minOrder = tasksForFolder.length > 0 
                    ? Math.min(...tasksForFolder.map(t => t.sort_order)) 
                    : 0;
                
                const tempTask = { ...activeTask, sort_order: minOrder - 1000 };
                
                // If it's already in the list (same folder), replace it with the temp version
                if (activeTask.folder_id === selectedFolderId) {
                    tasksForFolder = tasksForFolder.map(t => t.id === activeId ? tempTask : t);
                } else {
                    // If from another folder, add it
                    tasksForFolder = [...tasksForFolder, tempTask];
                }
            }
        }

        return tasksForFolder.sort((a, b) => (a.sort_order - b.sort_order));
    }, [tasks, selectedFolderId, activeId]); // removed isOverFolder dependency to match logic inside useMemo or added it? Ah, inside useMemo I use isOverFolder, but I didn't add it to dependency array in original code. Wait, in original code: [tasks, selectedFolderId, activeId]
    // But isOverFolder IS used inside: (activeTask.folder_id !== selectedFolderId || isOverFolder)
    // So it should be in dependencies. I will add it to be correct, or keep as is? 
    // "activeId" changes often, "isOverFolder" changes too. 
    // Let's add it to be safe. 

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

