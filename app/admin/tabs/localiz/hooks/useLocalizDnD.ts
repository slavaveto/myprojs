import { useState, useRef, useEffect } from 'react';
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

const logger = createLogger('UseLocalizDnD');

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
    onMoveToTab: (item: UIElement, tabId: string, cb?: (id: string) => void, sortOrder?: number) => Promise<void>;
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
    // --- Refs for fresh state access in DnD callbacks ---
    const itemsRef = useRef(items);
    const selectedTabRef = useRef(selectedTab);
    const onUpdateItemsRef = useRef(onUpdateItems);
    const onMoveToTabRef = useRef(onMoveToTab);
    const onSaveSortOrdersRef = useRef(onSaveSortOrders);
    const executeSaveRef = useRef(executeSave);

    // Keep refs updated
    useEffect(() => {
        itemsRef.current = items;
        selectedTabRef.current = selectedTab;
        onUpdateItemsRef.current = onUpdateItems;
        onMoveToTabRef.current = onMoveToTab;
        onSaveSortOrdersRef.current = onSaveSortOrders;
        executeSaveRef.current = executeSave;
    }); // Update on every render

    // --- Local UI State ---
    const [activeId, setActiveId] = useState<string | null>(null);
    const [dropAnimation, setDropAnimation] = useState<DropAnimation | null>(dropAnimationConfig);
    
    // Hover / Tab Switching Logic
    const [isOverTab, setIsOverTab] = useState(false);
    const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
    
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const hoveredTabIdRef = useRef<string | null>(null);
    const isDraggingRef = useRef(false);
    
    // Store initial state
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
            
            // Handle tab switch timer
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
                if (targetId !== selectedTabRef.current) {
                    hoverTimeoutRef.current = setTimeout(() => {
                        setSelectedTab(targetId);
                        
                        // Optimistic update via ref
                        if (isDraggingRef.current) {
                             const currentItems = itemsRef.current;
                             onUpdateItemsRef.current(currentItems.map(item => {
                                const itemId = item._tempId || item.item_id;
                                if (itemId === args.active.id) {
                                     const targetItems = currentItems.filter(t => t.tab_id === targetId);
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

        // 2. Use closestCenter for list items (Magnetic feel)
        return closestCenter(args);
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        setDropAnimation(dropAnimationConfig);
        isDraggingRef.current = true;

        const itemId = event.active.id as string;
        const item = itemsRef.current.find(i => (i._tempId || i.item_id) === itemId);
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

        // Note: We removed manual sort logic here to rely on dnd-kit visual sorting (SortableContext)
        // and avoid "jumping" issues.
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        
        // Reset states
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

        // USE REFS for fresh data
        const currentItems = itemsRef.current;
        const activeItem = currentItems.find(t => (t._tempId || t.item_id) === activeIdString);
        if (!activeItem) return;

        // 1. Drop on Tab (Directly)
        if (over && over.id.toString().startsWith('tab-')) {
           const targetTabId = over.id.toString().replace('tab-', '');
           if (activeItem.tab_id !== targetTabId) {
              await onMoveToTabRef.current(activeItem, targetTabId);
           }
           return;
        }

        // 2. Sorting / Reordering
        if (over && active.id !== over.id) {
             const selectedTabVal = selectedTabRef.current;
             
             const currentTabItems = currentItems
              .filter((item) => {
                 if (selectedTabVal === 'misc') {
                    return !item.tab_id || item.tab_id === 'misc' || !tabs.find(t => t.id === item.tab_id);
                 }
                 return item.tab_id === selectedTabVal;
              })
              .sort((a, b) => {
                 if (a.isNew && !b.isNew) return -1;
                 if (!a.isNew && b.isNew) return 1;
                 return (a.sort_order || 0) - (b.sort_order || 0);
              });
  
           const oldIndex = currentTabItems.findIndex((i) => (i._tempId || i.item_id) === active.id);
           const newIndex = currentTabItems.findIndex((i) => (i._tempId || i.item_id) === over.id);
  
           if (oldIndex !== -1 && newIndex !== -1) {
              // Calculate new order
              const newFiltered = arrayMove(currentTabItems, oldIndex, newIndex);
              
              const updates = newFiltered.map((item, index) => ({
                 ...item,
                 sort_order: index + 1,
              }));
              
              const updatedKeys = new Set(updates.map((u) => u._tempId || u.item_id));
              const otherItems = currentItems.filter(
                 (item) => !updatedKeys.has(item._tempId || item.item_id)
              );
              
              // Optimistic update
              const finalItems = [...otherItems, ...updates];
              onUpdateItemsRef.current(finalItems);
              
              // Determine changes
              const startState = initialDragStateRef.current;
              initialDragStateRef.current = null;
              
              const startTabId = startState?.tabId;
              const endTabId = activeItem.tab_id || 'misc'; 
              
              const tabChanged = (startTabId !== endTabId) && 
                                    !((startTabId === 'misc' || !startTabId) && endTabId === 'misc');
              
              const dbUpdates = updates
                 .filter((u) => !u.isNew)
                 .map((u) => ({ item_id: u.item_id, sort_order: u.sort_order! }));

              try {
                  await executeSaveRef.current(async () => {
                     // 1. If tab changed, update it (and its pos)
                     if (tabChanged && activeItem.item_id) {
                         const activeUpdate = updates.find(u => u.item_id === activeItem.item_id);
                         const newSortOrder = activeUpdate ? Math.round(activeUpdate.sort_order!) : undefined;
                         
                         await onMoveToTabRef.current(activeItem, endTabId, undefined, newSortOrder);
                     }
                     
                     // 2. Update everyone's sort order (excluding active if we just moved it to avoid race, or just all)
                     // This ensures everyone ends up in the right spot visually and physically
                     const cleanUpdates = dbUpdates
                        .map(u => ({
                             item_id: u.item_id,
                             sort_order: Math.round(u.sort_order!) // Ensure integer
                         }));
    
                     if (cleanUpdates.length > 0) {
                         await onSaveSortOrdersRef.current(cleanUpdates);
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
