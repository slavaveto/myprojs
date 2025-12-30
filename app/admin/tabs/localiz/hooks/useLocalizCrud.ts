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

            setItems((prev) =>
                prev.map((i) => (i._tempId === tempId ? { ...i, isNew: false, _tempId: undefined } : i))
            );
        } catch (err: any) {
            alert(err.message);
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
                
                // Потом обновляем элементы в базе (это может быть долго, если их много)
                // Оптимизация: одним запросом обновить все items где tab_id = X
                // Но у нас нет такого метода в сервисе пока. Будем перебирать или добавим batch update.
                // Для простоты пока оставим как есть: элементы станут "визуально" в misc, 
                // но в базе у них останется старый tab_id. 
                // А, стоп! Если tab_id нет в списке tabs, они АВТОМАТИЧЕСКИ попадают в misc!
                // Так что обновлять элементы в базе НЕ ОБЯЗАТЕЛЬНО!
                // Logic: items.filter(i => ... !tabs.find(t => t.id === item.tab_id))
                // Значит, достаточно просто удалить таб из конфига!
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
