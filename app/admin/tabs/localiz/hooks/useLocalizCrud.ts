import { useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from '@clerk/nextjs';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { UIElement } from '@/utils/providers/localization/types';
import { createLogger } from '@/utils/logger/Logger';
import { localizationService } from '@/app/admin/_services/localizationService';
import { useLocalizActions } from '@/app/admin/tabs/hooks/useLocalizActions';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { TABS } from '../constants';

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
    const [items, setItems] = useState<UIElement[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const {
        createItem,
        deleteItem,
        updateItem,
        moveItem: apiMoveItem,
        updateSortOrders: apiUpdateSortOrders,
        isCreating,
        isDeleting,
        isUpdating,
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
            const data = await localizationService.getAllItems(supabase);
            setItems(data);
            logger.success('Localization data loaded', { count: data.length });
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

    // -- CRUD Операции --

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

    // Метод для обновления порядка (вызывается из DnD)
    const updateLocalItems = useCallback((newItems: UIElement[]) => {
        setItems(newItems);
    }, []);
    
    // Метод перемещения (вызывается из DnD или напрямую)
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

    return {
        items,
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
        
        status: {
            isRefreshing: refreshStatus !== 'idle',
            refreshStatus,
            refreshError,
            saveStatus,
            saveError,
        }
    };
};

