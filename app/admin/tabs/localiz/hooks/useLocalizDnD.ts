import { useState } from 'react';
import {
   DragEndEvent,
   DragStartEvent,
   DropAnimation,
   PointerSensor,
   KeyboardSensor,
   useSensor,
   useSensors,
} from '@dnd-kit/core';
import {
   arrayMove,
   sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { UIElement } from '@/utils/providers/localization/types';
import { createLogger } from '@/utils/logger/Logger';
import { TABS, dropAnimationConfig } from '../constants';

const logger = createLogger('UseLocalizDnD');

interface UseLocalizDnDProps {
    items: UIElement[];
    selectedTab: string;
    onUpdateItems: (items: UIElement[]) => void;
    onSaveSortOrders: (updates: { item_id: string; sort_order: number }[]) => Promise<void>;
    onMoveToTab: (item: UIElement, tabId: string) => Promise<void>;
    executeSave: (fn: () => Promise<void>) => Promise<void>;
}

export const useLocalizDnD = ({ 
    items, 
    selectedTab, 
    onUpdateItems, 
    onSaveSortOrders, 
    onMoveToTab, 
    executeSave 
}: UseLocalizDnDProps) => {
    const [activeId, setActiveId] = useState<string | null>(null);
    const [dropAnimation, setDropAnimation] = useState<DropAnimation | null>(dropAnimationConfig);

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, {
           coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(event.active.id as string);
        setDropAnimation(dropAnimationConfig);
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;

        // Если бросили на таб (анимация отключается)
        if (over && over.id.toString().startsWith('tab-')) {
           setDropAnimation(null);
        }
  
        setActiveId(null);
  
        if (!over) return;
  
        // 1. Дроп на Таб
        if (over.id.toString().startsWith('tab-')) {
           const targetTabId = over.id.toString().replace('tab-', '');
           const itemId = active.id as string;
           const item = items.find((i) => (i._tempId || i.item_id) === itemId);
  
           if (item && item.tab_id !== targetTabId) {
              await onMoveToTab(item, targetTabId);
           }
           return;
        }
  
        // 2. Сортировка внутри списка
        if (active.id !== over.id) {
           const currentTabItems = items
              .filter((item) => {
                 if (selectedTab === 'misc') {
                    return (
                       !item.tab_id ||
                       item.tab_id === 'misc' ||
                       !TABS.find((t) => t.id === item.tab_id)
                    );
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
              // Переставляем элементы
              const newFiltered = arrayMove(currentTabItems, oldIndex, newIndex);
  
              // Пересчитываем sort_order
              const updates = newFiltered.map((item, index) => ({
                 ...item,
                 sort_order: index + 1,
              }));
  
              // Создаем новый массив items, заменяя обновленные элементы
              const updatedKeys = new Set(updates.map((u) => u._tempId || u.item_id));
              const otherItems = items.filter(
                 (item) => !updatedKeys.has(item._tempId || item.item_id)
              );
              const finalItems = [...otherItems, ...updates];
  
              // Обновляем локальный стейт
              onUpdateItems(finalItems);
  
              // Сохраняем в БД
              const savedUpdates = updates
                 .filter((u) => !u.isNew)
                 .map((u) => ({ item_id: u.item_id, sort_order: u.sort_order! }));
                 
              if (savedUpdates.length > 0) {
                 try {
                    await executeSave(async () => {
                        await onSaveSortOrders(savedUpdates);
                    });
                 } catch (err) {
                    logger.error('Failed to update sort order', err);
                 }
              }
           }
        }
    };

    return {
        sensors,
        activeId,
        dropAnimation,
        handleDragStart,
        handleDragEnd
    };
};

