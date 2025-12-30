'use client';

import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useDisclosure, Button } from '@heroui/react';
import { Plus as IconPlus, RefreshCw as IconRefresh } from 'lucide-react';
import { createLogger } from '@/utils/logger/Logger';
import { globalStorage } from '@/utils/storage';
import { UIElement } from '@/utils/providers/localization/types';
import { EditItemModal } from './components/EditItemModal';
import { SortableRow } from './components/SortableRow';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { AdminUserMenu } from '@/app/admin/AdminUserMenu';
import { usePermission } from '@/app/admin/_services/usePermission';
import { PERMISSIONS } from '@/app/admin/_services/acl';
import { LayoutGroup } from 'framer-motion';

// DnD Imports
import { DndContext, pointerWithin, DragOverlay } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

// Refactored Imports
import { AdminTabTitle } from './components/AdminTabTitle';
import { AdminCreatePopover } from './components/AdminCreatePopover';
import { useLocalizCrud } from './hooks/useLocalizCrud';
import { useLocalizDnD } from './hooks/useLocalizDnD';

import { LocalizSearch } from './components/LocalizSearch';

const logger = createLogger('AdminLocalization');

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
   const { can, isLoading: isPermissionLoading } = usePermission();

   // -- 1. CRUD Logic Hook --
   const {
      items,
      tabs,
      isLoading,
      loadData,
      handleAddNew,
      handleInsert, 
      handleUpdateField,
      saveNewItem,
      handleCancelNewItem,
      handleDelete,
      handleToggleSection,
      updateLocalItems,
      moveItemToTab,
      saveSortOrders,
      
      // Tab Actions
      handleAddTab,
      handleUpdateTab,
      handleDeleteTab,
      handleMoveTab,
      
      executeSave,
      status
   } = useLocalizCrud({ canLoad: !!canLoad, onReady, showToast, texts });

   // Keep items in ref to avoid stale closures in event handlers
   const itemsRef = useRef(items);
   useEffect(() => {
       itemsRef.current = items;
   }, [items]);

   // -- 2. UI State --
   const [selectedTab, setSelectedTab] = useState<string>('entry');
   const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);

   // Modal state
   const { isOpen, onOpen, onClose } = useDisclosure();
   const [editingItem, setEditingItem] = useState<UIElement | null>(null);

   // -- 3. DnD Logic Hook --
   const {
      sensors,
      activeId,
      dropAnimation,
      handleDragStart,
      handleDragEnd
   } = useLocalizDnD({
      items,
      tabs, 
      selectedTab,
      onUpdateItems: updateLocalItems,
      onSaveSortOrders: saveSortOrders,
      onMoveToTab: moveItemToTab,
      executeSave
   });

   // -- 4. Tabs Logic --
   useEffect(() => {
      const savedTab = globalStorage.getItem('admin_loc_tab');
      if (savedTab && tabs.find((t) => t.id === savedTab)) {
         setSelectedTab(savedTab);
      } else if (tabs.length > 0 && (!savedTab || !tabs.find((t) => t.id === savedTab))) {
          setSelectedTab(tabs[0].id);
      }
   }, [tabs]); 

   const handleTabChange = (key: string) => {
      setSelectedTab(key);
      globalStorage.setItem('admin_loc_tab', key);
   };

   const handleSearchResultClick = (item: UIElement) => {
      const targetTab = item.tab_id || 'misc';
      const isMisc = !item.tab_id || item.tab_id === 'misc' || !tabs.find((t) => t.id === item.tab_id);
      const newTab = isMisc ? 'misc' : targetTab;

      if (selectedTab !== newTab) {
         handleTabChange(newTab);
      }

      setHighlightedItemId(item.item_id);
      setTimeout(() => setHighlightedItemId(null), 3000);
   };

   // -- 6. Helpers --
   const filteredItems = useMemo(() => {
      let currentTabItems: UIElement[] = [];

      if (selectedTab === 'misc') {
         currentTabItems = items.filter(
            (item) =>
               !item.tab_id || item.tab_id === 'misc' || !tabs.find((t) => t.id === item.tab_id)
         );
      } else {
         currentTabItems = items.filter((item) => item.tab_id === selectedTab);
      }

      // Исправленная сортировка: только по sort_order (новые встают куда надо)
      currentTabItems.sort((a, b) => {
         return (a.sort_order || 0) - (b.sort_order || 0);
      });

      return currentTabItems;
   }, [items, selectedTab, tabs]);

   const getTabCount = (tabId: string) => {
      if (tabId === 'misc') {
         return items.filter(
            (item) =>
               !item.tab_id || item.tab_id === 'misc' || !tabs.find((t) => t.id === item.tab_id)
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

   // -- 7. Handlers --
   const handleEdit = (item: UIElement) => {
      setEditingItem(item);
      onOpen();
   };

   const handleSaveModal = async (formData: Partial<UIElement>) => {
      if (!editingItem || !formData.item_id) return;

      const payload = {
         ru: formData.ru || '',
         uk: formData.uk || '',
         en: formData.en || '',
      };

      await handleUpdateField(formData.item_id, 'ru', payload.ru);
      await handleUpdateField(formData.item_id, 'uk', payload.uk);
      await handleUpdateField(formData.item_id, 'en', payload.en);
   };

   const handleRowBlur = async (item: UIElement) => {
      // Use setTimeout to allow state updates from child components (EditableCell) to propagate to itemsRef
      setTimeout(async () => {
        const freshItem = itemsRef.current.find(i => 
            (i._tempId && i._tempId === item._tempId) || (i.item_id === item.item_id)
        );

        if (!freshItem) return;

        if (freshItem.isNew) {
            // Safety Check: If item was just created (< 500ms), ignore blur to allow focus to settle
            const timestamp = parseInt(freshItem._tempId?.split('_')[1] || '0');
            if (Date.now() - timestamp < 500) return;

            if (freshItem.item_id && freshItem.item_id.trim() && freshItem._tempId) {
                await saveNewItem(freshItem, freshItem._tempId);
            } else if (freshItem._tempId) {
               // Only cancel if it's truly empty after the delay
               handleCancelNewItem(freshItem._tempId);
            }
        }
      }, 100);
   };
   
   const handleMoveWrapper = async (item: UIElement, newTabId: string) => {
       await moveItemToTab(item, newTabId, (id) => {
           setHighlightedItemId(id);
           setTimeout(() => setHighlightedItemId(null), 3000);
           handleTabChange(newTabId);
       });
   };
   
   const handleUpdateWrapper = async (id: string, field: string, value: string) => {
       await handleUpdateField(id, field, value, (newId) => {
           if (highlightedItemId === id) setHighlightedItemId(newId);
       });
   };

   // -- Render --
   if (isPermissionLoading) return null;
   if (!can(PERMISSIONS.MANAGE_LOCALIZATION)) {
      return <div className="p-8 text-center text-red-500">Доступ запрещен</div>;
   }

   const badgeStatus = status.isRefreshing ? status.refreshStatus : status.saveStatus;
   const badgeError = status.refreshStatus === 'error' ? status.refreshError?.message : status.saveError?.message;
   const loadingText = status.isRefreshing ? texts.refreshLoading : texts.saveLoading;
   const successText = status.isRefreshing ? texts.refreshSuccess : texts.saveSuccess;

   return (
      <div className="h-full flex flex-col ">
         <div className="grid grid-cols-[250px_1fr_250px] items-center pb-4 min-h-[60px] gap-4">
            <h1 className="tab-title">Localization Manager</h1>

            {/* Search Bar */}
            <LocalizSearch items={items} onSelect={handleSearchResultClick} />

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
                     size="sm"
                     color="success"
                     isLoading={isLoading}
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
             <LayoutGroup id="admin-tabs">
                <div className="flex items-end gap-2 mb-2 w-full">
                    <div className="flex-grow overflow-x-auto scrollbar-hide flex items-center gap-2 pb-1">
                        {tabs.map((tab, index) => (
                            <AdminTabTitle
                                key={tab.id}
                                id={tab.id}
                                label={tab.label}
                                count={getTabCount(tab.id)}
                                isActive={selectedTab === tab.id}
                                onClick={() => handleTabChange(tab.id)}
                                onUpdate={handleUpdateTab ? (title) => handleUpdateTab(tab.id, title) : undefined}
                                onDelete={handleDeleteTab ? () => handleDeleteTab(tab.id) : undefined}
                                onMove={handleMoveTab ? (direction) => handleMoveTab(tab.id, direction) : undefined}
                                canMoveLeft={index > 0}
                                canMoveRight={index < tabs.length - 1}
                            />
                        ))}
                    </div>
                    
                    <div className="pb-1 pl-2">
                        <AdminCreatePopover 
                            title="New Tab"
                            inputPlaceholder="Tab Name"
                            onCreate={handleAddTab}
                        >
                            <Button 
                                isIconOnly
                                size="sm"
                                color="success"
                                variant="flat" 
                                className=""
                                title="Add Tab"
                            >
                                <IconPlus size={20} />
                            </Button>
                        </AdminCreatePopover>
                    </div>
                </div>
            </LayoutGroup>

            <div className="flex-grow overflow-auto mt-2 ">
               <div className="grid grid-cols-[200px_1fr_1fr_1fr_120px] gap-1 py-2 bg-default-100 border border-default-300 rounded-lg font-bold text-small text-default-600 items-center mb-2">
                  <div className="flex items-center justify-between pl-2 pr-2">
                     Item ID
                     <Button
                        size="sm"
                        color="success"
                        variant="flat"
                        className="h-6 min-w-0 px-2 text-tiny"
                        onPress={() => handleAddNew(selectedTab)}
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
                           onUpdateField={handleUpdateWrapper}
                           onValidateId={validateItemId}
                           onMove={handleMoveWrapper}
                           onEdit={handleEdit}
                           onDelete={handleDelete}
                           onInsert={handleInsert} // <-- NEW
                           tabs={tabs}
                           onRowBlur={handleRowBlur}
                           onCancel={item.isNew ? () => handleCancelNewItem(item._tempId!) : undefined}
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
                              onUpdateField={() => {}}
                              onValidateId={validateItemId}
                              onMove={() => {}}
                              onEdit={() => {}}
                              onDelete={() => {}}
                              tabs={tabs}
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
            tabs={tabs}
            defaultTab={selectedTab}
         />
      </div>
   );
};
