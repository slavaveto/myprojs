'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { globalStorage } from '@/utils/storage';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { UIElement } from '@/utils/providers/localization/types';
import { Input, Button, Tabs, Tab, useDisclosure, Chip, Spinner } from '@heroui/react';
import { clsx } from 'clsx';
import { Plus as IconPlus, RefreshCw as IconRefresh, Search as IconSearch } from 'lucide-react';
import { EditItemModal } from './components/EditItemModal';
import { SortableRow } from './components/SortableRow';

import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { useLocalizActions } from '@/app/admin/tabs/hooks/useLocalizActions';
import { localizationService } from '@/app/admin/_services/localizationService';
import { AdminUserMenu } from '@/app/admin/AdminUserMenu';

// DnD Imports
import {
   DndContext,
   KeyboardSensor,
   PointerSensor,
   useSensor,
   useSensors,
   DragEndEvent,
   DragStartEvent,
   DragOverlay,
   defaultDropAnimationSideEffects,
   useDroppable,
   pointerWithin,
   DropAnimation,
} from '@dnd-kit/core';
import {
   arrayMove,
   SortableContext,
   sortableKeyboardCoordinates,
   verticalListSortingStrategy,
} from '@dnd-kit/sortable';

import { useUser } from '@clerk/nextjs';
import { usePermission } from '@/app/admin/_services/usePermission';
import { PERMISSIONS } from '@/app/admin/_services/acl';

const logger = createLogger('AdminLocalization');


const TABS = [
   { id: 'entry', label: 'Entry Screen' },
   { id: 'room', label: 'Room Screen' },
   { id: 'misc', label: 'Misc' },
];

const DroppableTabTitle = ({ id, label, count }: { id: string; label: string; count: number }) => {
   const { setNodeRef, isOver } = useDroppable({
      id: `tab-${id}`,
   });

   return (
      <div
         ref={setNodeRef}
         className={clsx(
            'flex items-center gap-2 px-2 py-1 rounded transition-colors',
            isOver ? 'bg-primary-100 text-primary' : ''
         )}
      >
         {label}
         <Chip size="sm" variant="flat" className="h-5 min-w-5 px-1 text-[10px]">
            {count}
         </Chip>
      </div>
   );
};

const dropAnimationConfig: DropAnimation = {
   sideEffects: defaultDropAnimationSideEffects({
      styles: {
         active: {
            opacity: '0.4',
         },
      },
   }),
};

interface LocalizScreenProps {
   onReady?: () => void;
   isActive: boolean;
   canLoad?: boolean;
   texts: {
      saveLoading: string;
      saveSuccess: string;
      refreshLoading: string;
      refreshSuccess: string;
   };
   showToast?: boolean;
}

export const LocalizScreen = ({ onReady, isActive, canLoad, texts, showToast = true }: LocalizScreenProps) => {
   const { supabase } = useSupabase();
   const { user, isLoaded } = useUser();
   const { can, isLoading: isPermissionLoading } = usePermission();
   const [items, setItems] = useState<UIElement[]>([]);

   // Actions Hook
   const {
      createItem,
      deleteItem,
      updateItem,
      moveItem,
      updateSortOrders: saveSortOrders,
      isCreating,
      isDeleting,
      isUpdating,
   } = useLocalizActions();

   const [isLoading, setIsLoading] = useState(false);

   // Search State
   const [searchQuery, setSearchQuery] = useState('');
   const [searchResults, setSearchResults] = useState<UIElement[]>([]);
   const [isSearchOpen, setIsSearchOpen] = useState(false);
   const searchRef = React.useRef<HTMLDivElement>(null);

   // Search Logic
   useEffect(() => {
      if (!searchQuery || searchQuery.length < 2) {
         setSearchResults([]);
         setIsSearchOpen(false);
         return;
      }

      const lowerQuery = searchQuery.toLowerCase();
      // Search across ALL items
      const matches = items
         .filter(
            (item) =>
               item.item_id.toLowerCase().includes(lowerQuery) ||
               item.ru?.toLowerCase().includes(lowerQuery) ||
               item.uk?.toLowerCase().includes(lowerQuery) ||
               item.en?.toLowerCase().includes(lowerQuery)
         )
         .slice(0, 10); // Limit results

      setSearchResults(matches);
      setIsSearchOpen(matches.length > 0);
   }, [searchQuery, items]);

   // Click outside search
   useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
         if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
            setIsSearchOpen(false);
         }
      };
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
   }, []);

   const handleSearchResultClick = (item: UIElement) => {
      // 1. Switch Tab if needed
      const targetTab = item.tab_id || 'misc';
      const isMisc =
         !item.tab_id || item.tab_id === 'misc' || !TABS.find((t) => t.id === item.tab_id);

      const newTab = isMisc ? 'misc' : targetTab;

      if (selectedTab !== newTab) {
         handleTabChange(newTab);
      }

      // 2. Highlight
      setHighlightedItemId(item.item_id);

      // 3. Clear highlight after delay
      setTimeout(() => {
         setHighlightedItemId(null);
      }, 3000);

      // 4. Close search
      setIsSearchOpen(false);
      setSearchQuery('');
   };

   const getHighlightedText = (text: string, highlight: string) => {
      if (!text) return null;
      if (!highlight.trim()) return <span>{text}</span>;

      const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const parts = text.split(new RegExp(`(${escapedHighlight})`, 'gi'));
      return (
         <span>
            {parts.map((part, i) =>
               part.toLowerCase() === highlight.toLowerCase() ? (
                  <span
                     key={i}
                     className="bg-yellow-200 dark:bg-yellow-800 text-foreground font-semibold"
                  >
                     {part}
                  </span>
               ) : (
                  <span key={i}>{part}</span>
               )
            )}
         </span>
      );
   };

   // Modal state
   const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
   const [editingItem, setEditingItem] = useState<UIElement | null>(null);

   const [selectedTab, setSelectedTab] = useState<string>('entry');
   const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
   const [activeId, setActiveId] = useState<string | null>(null);
   const [dropAnimation, setDropAnimation] = useState<DropAnimation | null>(dropAnimationConfig);

   // Hook for manual refresh
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

   // Хук для отслеживания статуса любых операций сохранения
   const { execute: executeSave, status: saveStatus, error: saveError } = useAsyncAction({
      useToast: showToast,
      minDuration: 800,
      successDuration: 2000,
      loadingMessage: texts.saveLoading,
      successMessage: texts.saveSuccess,
      errorMessage: (err) => `Error: ${err.message}`
   });

   const isRefreshing = refreshStatus !== 'idle';
   const badgeStatus = isRefreshing ? refreshStatus : saveStatus;
   const badgeError = refreshStatus === 'error' ? refreshError?.message : saveError?.message;

   const loadingText = isRefreshing ? texts.refreshLoading : texts.saveLoading;
   const successText = isRefreshing ? texts.refreshSuccess : texts.saveSuccess;

   const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, {
         coordinateGetter: sortableKeyboardCoordinates,
      })
   );

   useEffect(() => {
      const savedTab = globalStorage.getItem('admin_loc_tab');
      if (savedTab && TABS.find((t) => t.id === savedTab)) {
         setSelectedTab(savedTab);
      }
   }, []);

   const handleTabChange = (key: string) => {
      setSelectedTab(key);
      globalStorage.setItem('admin_loc_tab', key);
   };

   const loadData = async (isManualRefresh = false) => {
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
   };

   useEffect(() => {
      if (canLoad) {
          loadData(false);
      }
   }, [user, canLoad]);

   const filteredItems = useMemo(() => {
      let currentTabItems: UIElement[] = [];

      if (selectedTab === 'misc') {
         currentTabItems = items.filter(
            (item) =>
               !item.tab_id || item.tab_id === 'misc' || !TABS.find((t) => t.id === item.tab_id)
         );
      } else {
         currentTabItems = items.filter((item) => item.tab_id === selectedTab);
      }

      currentTabItems.sort((a, b) => {
         if (a.isNew && !b.isNew) return -1;
         if (!a.isNew && b.isNew) return 1;
         return (a.sort_order || 0) - (b.sort_order || 0);
      });

      return currentTabItems;
   }, [items, selectedTab, highlightedItemId]);

   const handleAddNew = () => {
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

   const handleEdit = (item: UIElement) => {
      setEditingItem(item);
      onOpen();
   };

   const handleMove = async (item: UIElement, newTabId: string) => {
      if (item.tab_id === newTabId) return;

      // Optimistic logic helpers
      const currentTabItems = items.filter((i) =>
         newTabId === 'misc' ? !i.tab_id || i.tab_id === 'misc' : i.tab_id === newTabId
      );

      let newSortOrder = 0;
      if (currentTabItems.length > 0) {
         const minOrder = Math.min(...currentTabItems.map((i) => i.sort_order || 0));
         newSortOrder = minOrder - 1;
      }

      // Optimistic update
      const oldState = [...items];
      setItems((prev) =>
         prev.map((i) =>
            i.item_id === item.item_id ? { ...i, tab_id: newTabId, sort_order: newSortOrder } : i
         )
      );

      handleTabChange(newTabId);
      setHighlightedItemId(item.item_id);

      setTimeout(() => {
         setHighlightedItemId(null);
      }, 3000);

      try {
         await executeSave(async () => {
             await moveItem(item.item_id, newTabId, newSortOrder);
         });
      } catch (err) {
         setItems(oldState); // Rollback
         logger.error('Failed to move item', err);
         alert('Failed to move item');
      }
   };

   const handleUpdateField = async (itemIdOrTempId: string, field: string, newValue: string) => {
      const itemIndex = items.findIndex((i) => (i._tempId || i.item_id) === itemIdOrTempId);
      if (itemIndex === -1) return;

      const item = items[itemIndex];
      const updatedItem = { ...item, [field]: newValue };

      // 1. Optimistic Update
      const oldState = [...items];
      setItems((prev) => {
         const newItems = [...prev];
         newItems[itemIndex] = updatedItem;
         return newItems;
      });

      // 2. If it's a NEW item - just wait
      if (item.isNew) return;

      // 3. Normal Update
      try {
         // Duplicate check (READ only, so keeping it here is fine)
         if (field === 'item_id') {
            if (item.item_id === newValue) return;

            const exists = items.find((i) => i.item_id === newValue && i !== item);
            if (exists) throw new Error(`ID "${newValue}" already exists locally`);

            const dbExists = await localizationService.checkIdExists(supabase, newValue);
            if (dbExists) throw new Error(`ID "${newValue}" already exists in DB`);
         }

         await executeSave(async () => {
             // TS Check: field is dynamic string, cast it
             await updateItem(item.item_id, { [field]: newValue } as any);
         });

         if (field === 'item_id') {
            if (highlightedItemId === item.item_id) setHighlightedItemId(newValue);
         }
      } catch (err: any) {
         setItems(oldState); // Rollback
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

         // Finalize state (remove isNew, _tempId)
         setItems((prev) =>
            prev.map((i) => (i._tempId === tempId ? { ...i, isNew: false, _tempId: undefined } : i))
         );
      } catch (err: any) {
         alert(err.message);
         // Keep isNew so user can try again or fix
      }
   };

   const handleCancelNewItem = (tempId: string) => {
      setItems((prev) => prev.filter((i) => i._tempId !== tempId));
   };

   const handleRowBlur = async (item: UIElement) => {
      if (item.isNew) {
         if (item.item_id.trim() && item._tempId) {
            await saveNewItem(item, item._tempId);
         } else if (item._tempId) {
            handleCancelNewItem(item._tempId);
         }
      }
   };

   const handleDelete = async (itemId: string) => {
      const oldState = [...items];
      setItems((prev) => prev.filter((i) => i.item_id !== itemId));

      try {
         await executeSave(async () => {
             await deleteItem(itemId);
         });
      } catch (err) {
         setItems(oldState); // Rollback
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

   const handleSaveModal = async (formData: Partial<UIElement>) => {
      if (!editingItem || !formData.item_id) return;

      const payload = {
         ru: formData.ru || '',
         uk: formData.uk || '',
         en: formData.en || '',
      };

      const oldState = [...items];
      setItems((prevItems) =>
         prevItems.map((i) => (i.item_id === formData.item_id ? { ...i, ...payload } : i))
      );

      try {
         await executeSave(async () => {
             // TS Check: formData.item_id is checked above
             await updateItem(formData.item_id!, payload);
         });
      } catch (err) {
         setItems(oldState);
         alert('Failed to save changes');
      }
   };

   const getTabCount = (tabId: string) => {
      if (tabId === 'misc') {
         return items.filter(
            (item) =>
               !item.tab_id || item.tab_id === 'misc' || !TABS.find((t) => t.id === item.tab_id)
         ).length;
      }
      return items.filter((item) => item.tab_id === tabId).length;
   };

   const validateItemId = (id: string) => {
      if (!id.trim()) return 'ID cannot be empty';
      if (!/^[a-zA-Z0-9_-]+$/.test(id)) return 'Only Latin letters, numbers, "-" and "_" allowed';
      const exists = items.some((i) => i.item_id === id && !i.isNew);
      return exists ? 'ID already exists' : null;
   };

   const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
      setDropAnimation(dropAnimationConfig);
   };

   const handleDragEnd = async (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && over.id.toString().startsWith('tab-')) {
         setDropAnimation(null);
      }

      setActiveId(null);

      if (!over) return;

      if (over.id.toString().startsWith('tab-')) {
         const targetTabId = over.id.toString().replace('tab-', '');
         const itemId = active.id as string;
         const item = items.find((i) => (i._tempId || i.item_id) === itemId);

         if (item && item.tab_id !== targetTabId) {
            handleMove(item, targetTabId);
         }
         return;
      }

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
            const newFiltered = arrayMove(currentTabItems, oldIndex, newIndex);

            const updates = newFiltered.map((item, index) => ({
               ...item,
               sort_order: index + 1,
            }));

            const updatedKeys = new Set(updates.map((u) => u._tempId || u.item_id));
            const otherItems = items.filter(
               (item) => !updatedKeys.has(item._tempId || item.item_id)
            );
            const finalItems = [...otherItems, ...updates];

            setItems(finalItems);

            const savedUpdates = updates
               .filter((u) => !u.isNew)
               .map((u) => ({ item_id: u.item_id, sort_order: u.sort_order! }));
            if (savedUpdates.length > 0) {
               try {
                  await executeSave(async () => {
                      await saveSortOrders(savedUpdates);
                  });
               } catch (err) {
                  logger.error('Failed to update sort order', err);
               }
            }
         }
      }
   };

   if (isPermissionLoading) return null;

   if (!can(PERMISSIONS.MANAGE_LOCALIZATION)) {
      return <div className="p-8 text-center text-red-500">Доступ запрещен</div>;
   }

   return (
         <div className="h-full flex flex-col ">
            <div className="grid grid-cols-[250px_1fr_250px] items-center pb-4 min-h-[60px] gap-4">
               <h1 className="tab-title">Localization Manager</h1>

               {/* Search Bar */}
               <div className="w-full max-w-md mx-auto relative" ref={searchRef}>
                  <Input
                     placeholder="Search keys or translations..."
                     startContent={<IconSearch className="text-default-400" size={18} />}
                     value={searchQuery}
                     onValueChange={setSearchQuery}
                     size="sm"
                     isClearable
                     onClear={() => setSearchQuery('')}
                     classNames={{
                        inputWrapper: 'bg-default-100',
                     }}
                  />

                  {isSearchOpen && (
                     <div className="absolute top-full left-0 right-0 mt-1 bg-content1 rounded-medium shadow-large border border-default-200 z-50 overflow-hidden max-h-[400px] overflow-y-auto">
                        {searchResults.map((item) => (
                           <button
                              key={item.item_id}
                              className="w-full text-left px-3 py-2 hover:bg-default-100 transition-colors border-b border-default-100 last:border-0 flex flex-col gap-0.5"
                              onClick={() => handleSearchResultClick(item)}
                           >
                              <div className="flex items-center gap-2 text-xs text-default-500">
                                 <span className="font-bold text-primary">
                                    {getHighlightedText(item.item_id, searchQuery)}
                                 </span>
                                 <span className="text-default-300">•</span>
                                 <Chip size="sm" variant="flat" className="h-5 px-2 text-xs">
                                    {item.tab_id || 'misc'}
                                 </Chip>
                              </div>
                              <div className="text-sm font-medium w-full text-foreground truncate mt-1">
                                 <span className="text-default-400 mr-1">RU:</span>{' '}
                                 {getHighlightedText(item.ru, searchQuery)}
                              </div>
                              {item.uk && (
                                 <div className="text-sm font-medium w-full text-foreground truncate mt-0.5">
                                    <span className="text-default-400 mr-1">UK:</span>{' '}
                                    {getHighlightedText(item.uk, searchQuery)}
                                 </div>
                              )}
                              {item.en && (
                                 <div className="text-sm font-medium w-full text-foreground truncate mt-0.5">
                                    <span className="text-default-400 mr-1">EN:</span>{' '}
                                    {getHighlightedText(item.en, searchQuery)}
                                 </div>
                              )}
                           </button>
                        ))}
                     </div>
                  )}
               </div>

               <div className="flex items-center gap-3 justify-self-end">
                  <div className="w-[140px] flex justify-end">
                     <StatusBadge
                        status={badgeStatus}
                        errorMessage={badgeError}
                        loadingText={loadingText}
                        successText={successText}
                     />
                  </div>

                  <div className="flex gap-2 items-center">
                     <Button
                        isIconOnly
                        variant="flat"
                        onPress={() => loadData(true)}
                        isLoading={isLoading}
                        className="shadow-lg bg-background/80 backdrop-blur-md border border-default-200"
                     >
                        <IconRefresh size={16} />
                     </Button>

                     <AdminUserMenu />
                  </div>
               </div>
            </div>

            <DndContext
               sensors={sensors}
               collisionDetection={pointerWithin}
               onDragStart={handleDragStart}
               onDragEnd={handleDragEnd}
            >
               <Tabs
                  selectedKey={selectedTab}
                  onSelectionChange={(key) => handleTabChange(key as string)}
                  color="primary"
                  variant="underlined"
                  aria-label="Localization Tabs"
               >
                  {TABS.map((tab) => (
                     <Tab
                        key={tab.id}
                        title={
                           <DroppableTabTitle
                              id={tab.id}
                              label={tab.label}
                              count={getTabCount(tab.id)}
                           />
                        }
                     />
                  ))}
               </Tabs>

               <div className="flex-grow overflow-auto mt-4 ">
                  <div className="grid grid-cols-[200px_1fr_1fr_1fr_120px] gap-1 py-2 bg-default-100 border border-default-300 rounded-lg font-bold text-small text-default-600 items-center mb-2">
                     <div className="flex items-center justify-between pl-2 pr-2">
                        Item ID
                        <Button
                           size="sm"
                           color="success"
                           variant="flat"
                           className="h-6 min-w-0 px-2 text-tiny"
                           onPress={handleAddNew}
                           startContent={<IconPlus size={14} />}
                        >
                           Add
                        </Button>
                     </div>
                     <div className="pl-2 border-l border-default-300">RU</div>
                     <div className="pl-2 border-l border-default-300">UK</div>
                     <div className="pl-2 border-l border-default-300">EN</div>
                     <div className="text-center pr-2 border-l border-default-300">Actions</div>
                  </div>

                  <SortableContext
                     items={filteredItems.map((i) => i._tempId || i.item_id)}
                     strategy={verticalListSortingStrategy}
                  >
                     <div className="flex flex-col gap-1 pb-20">
                        {filteredItems.map((item) => (
                           <SortableRow
                              key={item._tempId || item.item_id}
                              item={item}
                              highlightedItemId={highlightedItemId}
                              selectedTab={selectedTab}
                              onUpdateField={handleUpdateField}
                              onValidateId={validateItemId}
                              onMove={handleMove}
                              onEdit={handleEdit}
                              onDelete={handleDelete}
                              tabs={TABS}
                              onRowBlur={handleRowBlur}
                              onCancel={
                                 item.isNew ? () => handleCancelNewItem(item._tempId!) : undefined
                              }
                              onToggleSection={handleToggleSection}
                           />
                        ))}

                        {!isLoading && filteredItems.length === 0 && (
                           <div className="p-8 text-center text-default-500 border border-dashed border-default-300 rounded-lg">
                              No items in this tab
                           </div>
                        )}
                     </div>
                  </SortableContext>
               </div>

               <DragOverlay dropAnimation={dropAnimation}>
                  {activeId ? (
                     <div className="w-full">
                        {(() => {
                           const item = items.find((i) => (i._tempId || i.item_id) === activeId);
                           if (!item) return null;
                           return (
                              <SortableRow
                                 item={item}
                                 highlightedItemId={null}
                                 selectedTab={selectedTab}
                                 onUpdateField={() => {}} // Disabled during drag
                                 onValidateId={validateItemId}
                                 onMove={() => {}}
                                 onEdit={() => {}}
                                 onDelete={() => {}}
                                 tabs={TABS}
                                 isOverlay
                                 onToggleSection={handleToggleSection}
                              />
                           );
                        })()}
                     </div>
                  ) : null}
               </DragOverlay>
            </DndContext>

            <EditItemModal
               isOpen={isOpen}
               onClose={onClose}
               onSave={handleSaveModal}
               item={editingItem}
               tabs={TABS}
               defaultTab={selectedTab}
            />
         </div>
   );
};
