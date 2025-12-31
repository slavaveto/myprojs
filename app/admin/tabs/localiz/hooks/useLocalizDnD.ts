import { useState, useRef, useMemo } from 'react';
import {
   DragEndEvent,
   DragStartEvent,
   DragOverEvent,
   DropAnimation,
   PointerSensor,
   KeyboardSensor,
   useSensor,
   useSensors,
   defaultDropAnimationSideEffects,
   CollisionDetection,
   closestCenter,
   pointerWithin,
} from '@dnd-kit/core';
import {
   arrayMove,
   sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { UIElement, LocalizTab } from '@/utils/providers/localization/types';
import { createLogger } from '@/utils/logger/Logger';
import { globalStorage } from '@/utils/storage';

const logger = createLogger('UseLocalizDnD');

// Moved from constants.ts
const dropAnimationConfig: DropAnimation = {
    sideEffects: defaultDropAnimationSideEffects({
       styles: {
          active: {
             opacity: '0.4',
          },
       },
    }),
 };

interface UseLocalizDnDProps {
    items: UIElement[];
    tabs: LocalizTab[];
    selectedTab: string;
    setSelectedTab: (id: string) => void;
    onUpdateItems: (items: UIElement[]) => void;
    onSaveSortOrders: (updates: { item_id: string; sort_order: number }[]) => Promise<void>;
    onMoveToTab: (item: UIElement, tabId: string) => Promise<void>;
    executeSave: (fn: () => Promise<void>) => Promise<void>;
}

export const useLocalizDnD = ({ 
    items, 
    tabs,
    selectedTab, 
    setSelectedTab,
    onUpdateItems, 
    onSaveSortOrders, 
    onMoveToTab, 
    executeSave 
}: UseLocalizDnDProps) => {
    // --- Local UI State for DnD (Visuals only) ---
    const [activeId, setActiveId] = useState<string | null>(null);
    const [dropAnimation, setDropAnimation] = useState<DropAnimation | null>(dropAnimationConfig);
    
    // Hover / Tab Switching Logic
    const [isOverTab, setIsOverTab] = useState(false);
    const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
    
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hoveredTabIdRef = useRef<string | null>(null);
    const isDraggingRef = useRef(false);
    
    // Store initial state of the dragged item to prevent unnecessary saves
    const initialDragStateRef = useRef<{ tabId: string; index: number } | null>(null);

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: {
                delay: 0,
                tolerance: 0,
            },
        }),
        useSensor(KeyboardSensor, {
           coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const customCollisionDetection: CollisionDetection = (args) => {
        const pointerCollisions = pointerWithin(args);

        // 1. Check tab headers
        const tabCollision = pointerCollisions.find(c => c.id.toString().startsWith('tab-'));
        
        if (tabCollision) {
            const tabIdFull = tabCollision.id.toString();
            
            // Handle tab switch timer logic
            if (hoveredTabIdRef.current !== tabIdFull) {
                hoveredTabIdRef.current = tabIdFull;
                
                setTimeout(() => {
                    if (isDraggingRef.current) {
                        setHoveredTabId(tabIdFull);
                    }
                }, 0);
                
                if (hoverTimeoutRef.current) {
                    clearTimeout(hoverTimeoutRef.current);
                    hoverTimeoutRef.current = null;
                }

                const targetId = tabIdFull.replace('tab-', '');
                if (targetId !== selectedTab) {
                    hoverTimeoutRef.current = setTimeout(() => {
                        setSelectedTab(targetId);
                        
                        // Move active item to the new tab immediately (to the top)
                        if (isDraggingRef.current) {
                             onUpdateItems(items.map(item => {
                                const itemId = item._tempId || item.item_id;
                                if (itemId === activeId) {
                                     const targetItems = items.filter(t => t.tab_id === targetId);
                                     const minOrder = targetItems.length > 0 
                                         ? Math.min(...targetItems.map(t => t.sort_order || 0)) 
                                         : 0;

                                     return {
                                         ...item,
                                         tab_id: targetId,
                                         sort_order: minOrder - 1000, 
                                     };
                                }
                                return item;
                             }));
                        }
                    }, 300);
                }
            }
            return [tabCollision];
        }
        
        // Reset if left tab area
        if (hoveredTabIdRef.current) {
             hoveredTabIdRef.current = null;
             setTimeout(() => setHoveredTabId(null), 0);
             if (hoverTimeoutRef.current) {
                clearTimeout(hoverTimeoutRef.current);
                hoverTimeoutRef.current = null;
             }
        }

        // 2. Use pointerWithin for list items (Restore original behavior)
        return pointerWithin(args);
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        setDropAnimation(dropAnimationConfig);
        isDraggingRef.current = true;

        const itemId = event.active.id as string;
        const item = items.find(i => (i._tempId || i.item_id) === itemId);
        if (item) {
            initialDragStateRef.current = {
                tabId: item.tab_id || 'misc',
                index: item.sort_order || 0
            };
        }
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        const overId = over?.id;

        // Update isOverTab state
        const tabOverId = hoveredTabIdRef.current;
        const isOverTabNode = !!tabOverId; 
        if (isOverTab !== isOverTabNode) {
           setIsOverTab(isOverTabNode);
        }

        if (!overId || active.id === overId) return;

        const activeIdString = active.id as string;
        const overIdString = overId as string;

        if (activeIdString.startsWith('tab-') || overIdString.startsWith('tab-')) return;

        const activeItem = items.find(t => (t._tempId || t.item_id) === activeIdString);
        if (!activeItem) return;

        // Only handle Cross-tab movement here (if needed instantly)
        // But since we use timer for tab switch, we might not need this unless dragging over a LIST ITEM in another tab directly?
        // But if tab switched, we are in that tab.
        
        // If we are in the SAME tab, we SKIP reordering here to restore original behavior 
        // (let SortableContext handle visual, handleDragEnd handle logic)
        // UNLESS the user really wants "project-like" live reordering.
        // But since it's broken, let's revert to DragEnd sorting.
        
        // Check if we need to switch item's tab if we dragged it over a list item in another tab (rare case if tab didn't switch?)
        // The timer handles the switch.
        
        // So for now: EMPTY DragOver for same-list sorting.
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        
        setActiveId(null);
        setIsOverTab(false); 
        setHoveredTabId(null);
        isDraggingRef.current = false;
        hoveredTabIdRef.current = null;
        
        if (over && over.id.toString().startsWith('tab-')) {
           setDropAnimation(null);
        }

        if (hoverTimeoutRef.current) {
            clearTimeout(hoverTimeoutRef.current);
            hoverTimeoutRef.current = null;
        }

        const activeIdString = active.id as string;
        if (activeIdString.startsWith('tab-')) return;

        const activeItem = items.find(t => (t._tempId || t.item_id) === activeIdString);
        if (!activeItem) return;

        // 1. Drop on Tab
        if (over && over.id.toString().startsWith('tab-')) {
           const targetTabId = over.id.toString().replace('tab-', '');
           if (activeItem.tab_id !== targetTabId) {
              await onMoveToTab(activeItem, targetTabId);
           }
           return;
        }

        // 2. Sorting / Reordering
        // Capture logic from original handleDragEnd
        if (over && active.id !== over.id) {
             const currentTabItems = items
              .filter((item) => {
                 if (selectedTab === 'misc') {
                    return !item.tab_id || item.tab_id === 'misc' || !tabs.find(t => t.id === item.tab_id);
                 }
                 return item.tab_id === selectedTab;
              })
              .sort((a, b) => {
                 if (a.isNew && !b.isNew) return -1;
                 if (!a.isNew && b.isNew) return 1;
                 return (a.sort_order || 0) - (b.sort_order || 0);
              });
  
           const oldIndex = currentTabItems.findIndex((i) => (i._tempId || i.item_id) === active.id);
           const newIndex = currentTabItems.findIndex((i) => (i._tempId || i.item_id) === over.id);
  
           if (oldIndex !== -1 && newIndex !== -1) {
              // Calculate new order locally
              const newFiltered = arrayMove(currentTabItems, oldIndex, newIndex);
              
              // Map to full items list
              const updates = newFiltered.map((item, index) => ({
                 ...item,
                 sort_order: index + 1,
              }));
              
              const updatedKeys = new Set(updates.map((u) => u._tempId || u.item_id));
              const otherItems = items.filter(
                 (item) => !updatedKeys.has(item._tempId || item.item_id)
              );
              
              // Optimistic update
              const finalItems = [...otherItems, ...updates];
              onUpdateItems(finalItems);
              
              // Save to DB
              const dbUpdates = updates
                 .filter((u) => !u.isNew)
                 .map((u) => ({ item_id: u.item_id, sort_order: u.sort_order! }));
              
              // Also check if we need to save tab change (if we switched tab via timer)
              // If activeItem.tab_id !== initialDragStateRef (if we had it), we would save.
              // But here updates contains the items with NEW tab_id (if they were updated in state).
              // Wait, handleDragOver is empty now, so activeItem.tab_id is NOT updated in state yet?
              // YES IT IS. The timer updates it!
              
              // So activeItem in 'items' has the new tab_id.
              // We just need to ensure that change is persisted.
              // onSaveSortOrders only saves order.
              
              // We need to call onMoveToTab if tab changed.
              const startState = initialDragStateRef.current;
              initialDragStateRef.current = null;
              
              const startTabId = startState?.tabId;
              const endTabId = activeItem.tab_id || 'misc'; // This comes from items, which was updated by timer
              
              const tabChanged = (startTabId !== endTabId) && 
                                    !((startTabId === 'misc' || !startTabId) && endTabId === 'misc');
              
              try {
                  await executeSave(async () => {
                     if (tabChanged && activeItem.item_id) {
                         await onMoveToTab(activeItem, endTabId);
                     }
                     if (dbUpdates.length > 0) {
                         await onSaveSortOrders(dbUpdates);
                     }
                  });
              } catch (err) {
                 logger.error('Failed to update sort order', err);
              }
           }
        }
    };

    return {
        sensors,
        activeId,
        dropAnimation,
        customCollisionDetection,
        hoveredTabId,
        handleDragStart,
        handleDragOver,
        handleDragEnd
    };
};
