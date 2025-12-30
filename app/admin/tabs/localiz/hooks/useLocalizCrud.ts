import { useState, useEffect, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { UIElement, LocalizTab } from '@/utils/providers/localization/types';
import { createLogger } from '@/utils/logger/Logger';
import { localizationService } from '@/app/admin/_services/localizationService';
import { useLocalizActions } from '@/app/admin/tabs/hooks/useLocalizActions';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { arrayMove } from '@dnd-kit/sortable';

const logger = createLogger('UseLocalizCrud');

interface UseLocalizCrudProps {
    canLoad?: boolean;
    onReady?: () => void;
    showToast?: boolean;
    texts: {
        saveLoading: string;
        saveSuccess: string;
        refreshLoading: string;
        refreshSuccess: string;
    };
}

export const useLocalizCrud = ({ canLoad, onReady, showToast = true, texts }: UseLocalizCrudProps) => {
    const { supabase } = useSupabase();
    const { user } = useUser();
    
    // State
    const [items, setItems] = useState<UIElement[]>([]);
    const [tabs, setTabs] = useState<LocalizTab[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const {
        createItem,
        deleteItem,
        updateItem,
        moveItem: apiMoveItem,
        updateSortOrders: apiUpdateSortOrders,
    } = useLocalizActions();

    // -- Загрузка данных --
    const {
        execute: executeRefresh,
        status: refreshStatus,
        error: refreshError,
    } = useAsyncAction({
        minDuration: 1000,
        useToast: showToast,
        loadingMessage: texts.refreshLoading,
        successMessage: texts.refreshSuccess,
        errorMessage: 'Ошибка обновления',
    });

    const loadData = useCallback(async (isManualRefresh = false) => {
        if (!user) return;

        setIsLoading(true);
        logger.start('Loading localization data');

        const fetchLoc = async () => {
            const { items: loadedItems, tabs: loadedTabs } = await localizationService.getAllItems(supabase);
            
            setItems(loadedItems);
            setTabs(loadedTabs);
            
            logger.success('Localization data loaded', { 
                itemsCount: loadedItems.length, 
                tabsCount: loadedTabs.length 
            });
        };

        if (isManualRefresh) {
            await executeRefresh(fetchLoc).catch((err) => {
                logger.error('Failed to load localization data', err);
            });
        } else {
            try {
                await fetchLoc();
            } catch (err) {
                logger.error('Background load failed', err);
            }
        }

        setIsLoading(false);

        if (onReady) {
            setTimeout(() => onReady(), 0);
        }
    }, [user, supabase, executeRefresh, onReady]);

    useEffect(() => {
        if (canLoad) {
            loadData(false);
        }
    }, [canLoad, loadData]);

    // -- Сохранение (обертка) --
    const { execute: executeSave, status: saveStatus, error: saveError } = useAsyncAction({
        useToast: showToast,
        minDuration: 800,
        successDuration: 2000,
        loadingMessage: texts.saveLoading,
        successMessage: texts.saveSuccess,
        errorMessage: (err) => `Error: ${err.message}`
    });

    // -- CRUD Операции с Элементами --

    const handleAddNew = (selectedTab: string) => {
        const tempId = `new_${Date.now()}`;
        const currentTabItems = items.filter((i) =>
             selectedTab === 'misc' ? !i.tab_id || i.tab_id === 'misc' : i.tab_id === selectedTab
        );

        let newSortOrder = 0;
        if (currentTabItems.length > 0) {
            const minOrder = Math.min(...currentTabItems.map((i) => i.sort_order || 0));
            newSortOrder = minOrder - 1;
        }

        const newItem: UIElement = {
            item_id: '',
            ru: '',
            uk: '',
            en: '',
            tab_id: selectedTab,
            sort_order: newSortOrder,
            updated_at: new Date().toISOString(),
            isNew: true,
            _tempId: tempId,
        };

        setItems((prev) => [newItem, ...prev]);
    };

    const handleInsert = async (targetItemId: string, position: 'above' | 'below') => {
        const targetIndex = items.findIndex(i => (i._tempId || i.item_id) === targetItemId);
        if (targetIndex === -1) return;

        const targetItem = items[targetIndex];
        const tabId = targetItem.tab_id || 'misc';
        
        // 1. Get current items in tab, sorted by order
        const currentTabItems = items.filter((i) =>
             tabId === 'misc' ? !i.tab_id || i.tab_id === 'misc' : i.tab_id === tabId
        ).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));

        const targetInTabIdx = currentTabItems.findIndex(i => (i._tempId || i.item_id) === targetItemId);
        const insertIndex = position === 'above' ? targetInTabIdx : targetInTabIdx + 1;

        const tempId = `new_${Date.now()}`;
        const newItem: UIElement = {
            item_id: '',
            ru: '',
            uk: '',
            en: '',
            tab_id: tabId,
            sort_order: 0, // Will be set by reindex
            updated_at: new Date().toISOString(),
            isNew: true,
            _tempId: tempId,
        };

        // 2. Insert and Reindex
        const newTabItems = [...currentTabItems];
        newTabItems.splice(insertIndex, 0, newItem);
        
        // Reindex all items in this tab
        const reindexedTabItems = newTabItems.map((item, index) => ({
            ...item,
            sort_order: index
        }));

        // 3. Merge back into global items list
        const otherItems = items.filter(i => 
            tabId === 'misc' ? (i.tab_id && i.tab_id !== 'misc') : i.tab_id !== tabId
        );
        
        setItems([...otherItems, ...reindexedTabItems]);

        // 4. Save order for EXISTING items immediately (background)
        // We filter out the new item (it will be saved later via saveNewItem)
        const updates = reindexedTabItems
            .filter(i => !i.isNew)
            .map(i => ({ item_id: i.item_id, sort_order: i.sort_order }));
            
        if (updates.length > 0) {
            try {
                 await executeSave(async () => {
                     await apiUpdateSortOrders(updates);
                 });
            } catch (err) {
                logger.error('Failed to reorder items', err);
            }
        }
    };

    const handleUpdateField = async (itemIdOrTempId: string, field: string, newValue: string, highlightCallback?: (newId: string) => void) => {
        const itemIndex = items.findIndex((i) => (i._tempId || i.item_id) === itemIdOrTempId);
        if (itemIndex === -1) return;

        const item = items[itemIndex];
        const updatedItem = { ...item, [field]: newValue };

        // Optimistic
        const oldState = [...items];
        setItems((prev) => {
            const newItems = [...prev];
            newItems[itemIndex] = updatedItem;
            return newItems;
        });

        if (item.isNew) return;

        try {
            if (field === 'item_id') {
                if (item.item_id === newValue) return;
                const exists = items.find((i) => i.item_id === newValue && i !== item);
                if (exists) throw new Error(`ID "${newValue}" already exists locally`);
                const dbExists = await localizationService.checkIdExists(supabase, newValue);
                if (dbExists) throw new Error(`ID "${newValue}" already exists in DB`);
            }

            await executeSave(async () => {
                await updateItem(item.item_id, { [field]: newValue } as any);
            });

            if (field === 'item_id' && highlightCallback) {
                 highlightCallback(newValue);
            }
        } catch (err: any) {
            setItems(oldState);
            alert(err.message || 'Failed to update field');
        }
    };

    const saveNewItem = async (item: UIElement, tempId: string) => {
        try {
            logger.info('Saving new item', item);
            await executeSave(async () => {
                await createItem({
                    item_id: item.item_id,
                    ru: item.ru,
                    uk: item.uk,
                    en: item.en,
                    tab_id: item.tab_id,
                    sort_order: item.sort_order,
                });
            });

            // Reload data to ensure sync with DB (especially for sort_order types and generated fields)
            await loadData();

        } catch (err: any) {
            logger.error('Failed to save item', err);
            console.error('Save Item Error:', err);
            alert(`Error saving: ${err.message}`);
        }
    };

    const handleCancelNewItem = (tempId: string) => {
        setItems((prev) => prev.filter((i) => i._tempId !== tempId));
    };

    const handleDelete = async (itemId: string) => {
        const oldState = [...items];
        setItems((prev) => prev.filter((i) => i.item_id !== itemId));

        try {
            await executeSave(async () => {
                await deleteItem(itemId);
            });
        } catch (err) {
            setItems(oldState);
            alert('Failed to delete item');
        }
    };
    
    const handleToggleSection = async (item: UIElement) => {
        const newIsSection = !item.is_section;
        const oldState = [...items];
  
        setItems((prev) =>
           prev.map((i) => (i.item_id === item.item_id ? { ...i, is_section: newIsSection } : i))
        );
  
        try {
           await executeSave(async () => {
               await updateItem(item.item_id, { is_section: newIsSection });
           });
        } catch (err) {
           setItems(oldState);
        }
     };

    const updateLocalItems = useCallback((newItems: UIElement[]) => {
        setItems(newItems);
    }, []);
    
    const moveItemToTab = async (item: UIElement, newTabId: string, highlightCallback?: (id: string) => void) => {
        if (item.tab_id === newTabId) return;

        const currentTabItems = items.filter((i) =>
            newTabId === 'misc' ? !i.tab_id || i.tab_id === 'misc' : i.tab_id === newTabId
        );

        let newSortOrder = 0;
        if (currentTabItems.length > 0) {
            const minOrder = Math.min(...currentTabItems.map((i) => i.sort_order || 0));
            newSortOrder = minOrder - 1;
        }

        const oldState = [...items];
        setItems((prev) =>
            prev.map((i) =>
                i.item_id === item.item_id ? { ...i, tab_id: newTabId, sort_order: newSortOrder } : i
            )
        );
        
        if (highlightCallback) highlightCallback(item.item_id);

        try {
            await executeSave(async () => {
                await apiMoveItem(item.item_id, newTabId, newSortOrder);
            });
        } catch (err) {
            setItems(oldState);
            logger.error('Failed to move item', err);
            alert('Failed to move item');
        }
    };

    // -- CRUD Операции с Табами --

    const handleAddTab = async (label: string) => {
        const newTabId = `tab_${Date.now()}`;
        const newOrder = tabs.length > 0 ? Math.max(...tabs.map(t => t.order || 0)) + 1 : 0;
        const newTab: LocalizTab = { id: newTabId, label, order: newOrder };

        const newTabs = [...tabs, newTab];
        setTabs(newTabs);

        try {
            await executeSave(async () => {
                await localizationService.saveTabsConfig(supabase, newTabs);
            });
        } catch (err) {
            logger.error('Failed to add tab', err);
            // Revert handled by state reload on error in real app, but here simplistic
        }
    };

    const handleUpdateTab = async (tabId: string, newLabel: string) => {
        const oldTabs = [...tabs];
        const newTabs = tabs.map(t => t.id === tabId ? { ...t, label: newLabel } : t);
        setTabs(newTabs);

        try {
            await executeSave(async () => {
                await localizationService.saveTabsConfig(supabase, newTabs);
            });
        } catch (err) {
            setTabs(oldTabs);
            logger.error('Failed to update tab', err);
        }
    };

    const handleDeleteTab = async (tabId: string) => {
        const oldTabs = [...tabs];
        const oldItems = [...items];

        // 1. Удаляем таб из списка
        const newTabs = tabs.filter(t => t.id !== tabId);
        setTabs(newTabs);

        // 2. Перемещаем элементы в 'misc'
        const newItems = items.map(i => i.tab_id === tabId ? { ...i, tab_id: 'misc' } : i);
        setItems(newItems);

        try {
            await executeSave(async () => {
                // Сначала сохраняем конфиг табов
                await localizationService.saveTabsConfig(supabase, newTabs);
            });
        } catch (err) {
            setTabs(oldTabs);
            setItems(oldItems);
            logger.error('Failed to delete tab', err);
        }
    };

    const handleMoveTab = async (tabId: string, direction: 'left' | 'right') => {
        const index = tabs.findIndex(t => t.id === tabId);
        if (index === -1) return;
        
        const newIndex = direction === 'left' ? index - 1 : index + 1;
        if (newIndex < 0 || newIndex >= tabs.length) return;

        const oldTabs = [...tabs];
        const newTabs = arrayMove(tabs, index, newIndex);
        
        // Обновляем order
        const tabsWithOrder = newTabs.map((t, i) => ({ ...t, order: i }));
        setTabs(tabsWithOrder);

        try {
            await executeSave(async () => {
                await localizationService.saveTabsConfig(supabase, tabsWithOrder);
            });
        } catch (err) {
            setTabs(oldTabs);
        }
    };

    return {
        items,
        tabs,
        isLoading,
        loadData,
        handleAddNew,
        handleInsert, // NEW
        handleUpdateField,
        saveNewItem,
        handleCancelNewItem,
        handleDelete,
        handleToggleSection,
        updateLocalItems,
        moveItemToTab,
        saveSortOrders: apiUpdateSortOrders,
        executeSave,
        
        // Tab Actions
        handleAddTab,
        handleUpdateTab,
        handleDeleteTab,
        handleMoveTab,
        
        status: {
            isRefreshing: refreshStatus !== 'idle',
            refreshStatus,
            refreshError,
            saveStatus,
            saveError,
        }
    };
};
