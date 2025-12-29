'use client';

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Tooltip, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, Popover, PopoverTrigger, PopoverContent, Chip } from '@heroui/react';
import { GripVertical, Trash2 as IconTrash, Edit as IconEdit, FolderInput as IconMoveToTab, Sparkles, Loader2, Heading } from 'lucide-react';
import { UIElement } from '@/utils/providers/localization/types';
import { EditableCell } from '@/app/admin/tabs/components/EditableCell';
import { clsx } from 'clsx';
import { translateText } from '@/app/admin/tabs/components/actions';

interface SortableRowProps {
   item: UIElement;
   onEdit: (item: UIElement) => void;
   onDelete: (id: string) => void;
   onUpdateField: (id: string, field: keyof UIElement, value: string) => void;
   highlightedItemId: string | null;
   tabs: { id: string; label: string }[];
   selectedTab: string;
   onMove: (item: UIElement, targetTabId: string) => void;
   isOverlay?: boolean;
   onValidateId?: (id: string) => string | null;
   onRowBlur?: (item: UIElement) => void;
   onCancel?: (item: UIElement) => void;
   onToggleSection: (item: UIElement) => void;
}

export const SortableRow = ({
   item,
   onEdit,
   onDelete,
   onUpdateField,
   highlightedItemId,
   tabs,
   selectedTab,
   onMove,
   isOverlay,
   onValidateId,
   onRowBlur,
   onCancel,
   onToggleSection
}: SortableRowProps) => {
   // Use tempId for sortable ID if item is new (no item_id yet)
   const sortableId = item._tempId || item.item_id;
   
   const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
   } = useSortable({ id: sortableId, data: item });

   const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      opacity: isDragging ? 0.3 : 1,
   };

   const [isDeleteOpen, setIsDeleteOpen] = useState(false);
   const [isTranslating, setIsTranslating] = useState(false);
   const [isTranslatingUk, setIsTranslatingUk] = useState(false);
   const [isTranslatingEn, setIsTranslatingEn] = useState(false);

   // Helper to pass the correct ID to update function
   const handleUpdate = (field: keyof UIElement, value: string) => {
       onUpdateField(sortableId, field, value);
   };

   const handleTranslate = async (targetLang?: 'uk' | 'en') => {
      const textToTranslate = item.ru;
      if (!textToTranslate) return;
      
      if (targetLang === 'uk' && isTranslatingUk) return;
      if (targetLang === 'en' && isTranslatingEn) return;
      if (!targetLang && isTranslating) return;

      if (targetLang === 'uk') setIsTranslatingUk(true);
      else if (targetLang === 'en') setIsTranslatingEn(true);
      else setIsTranslating(true);
      
      try {
         const result = await translateText(textToTranslate, targetLang);
         
         if (result.error) {
            alert(`Translation failed: ${result.error}`);
            return;
         }

         if (result.uk) handleUpdate('uk', result.uk);
         if (result.en) handleUpdate('en', result.en);
      } catch (error) {
      } finally {
         if (targetLang === 'uk') setIsTranslatingUk(false);
         else if (targetLang === 'en') setIsTranslatingEn(false);
         else setIsTranslating(false);
      }
   };

   const handleRowBlur = (e: React.FocusEvent) => {
      // Check if focus is moving to another element inside the row
      if (e.currentTarget.contains(e.relatedTarget as Node)) {
         return;
      }
      if (onRowBlur) {
         onRowBlur(item);
      }
   };

   const handleKeyDown = (e: React.KeyboardEvent) => {
       if (e.key === 'Escape') {
           if (onCancel) {
               onCancel(item);
           }
       }
   };

   // Scroll into view if highlighted
   React.useEffect(() => {
      if (highlightedItemId === item.item_id && nodeRef.current) {
         nodeRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
   }, [highlightedItemId, item.item_id]);

   // Create a local ref to combine with dnd-kit's setNodeRef
   const nodeRef = React.useRef<HTMLDivElement>(null);
   const setRefs = (element: HTMLDivElement) => {
      nodeRef.current = element;
      setNodeRef(element);
   };

   return (
      <div
         ref={setRefs}
         id={item.item_id} // Add ID for easier finding if needed
         style={style}
         className={clsx(
            "group grid gap-1 items-center min-h-[32px] rounded-lg border border-default-300 bg-content1 transition-colors outline-none",
            item.is_section ? "grid-cols-[35px_1fr_120px]" : "grid-cols-[200px_1fr_1fr_1fr_120px]",
            !isDragging && !isOverlay && "hover:bg-default-50",
            highlightedItemId === item.item_id ? "!bg-warning-100 dark:!bg-warning-900/30 border-warning" : "",
            (isDragging || isOverlay) && "z-50 bg-content1 shadow-lg border-primary/50"
         )}
         data-highlighted={highlightedItemId === item.item_id}
         onBlur={handleRowBlur}
         onKeyDown={handleKeyDown}
         tabIndex={-1}
      >
         <div className={clsx("p-1 pl-2 text-start relative whitespace-normal overflow-hidden")}>
            <div className={clsx("flex items-center gap-1")}>
               {/* Drag Handle */}
               <div 
                  {...attributes} 
                  {...listeners} 
                  className="cursor-grab active:cursor-grabbing text-default-400 hover:text-default-600 outline-none p-0.5 hover:bg-default-100 rounded"
               >
                  <GripVertical size={14} />
               </div>

               {!item.is_section && (
                <div className="flex flex-col min-w-0 w-full">
                    <EditableCell
                        value={item.item_id}
                        onSave={(val) => handleUpdate('item_id', val)}
                        onValidate={onValidateId ? (val) => val !== item.item_id ? onValidateId(val) : null : undefined}
                        isMultiline={false}
                        className="font-mono text-xs font-bold text-primary truncate"
                        autoFocus={item.isNew}
                    />
                    {item.tab_id && item.tab_id !== selectedTab && !item.isNew && (
                        <Chip size="sm" variant="flat" className="mt-0.5 text-[9px] h-3.5 w-fit px-1 min-h-0">
                            {item.tab_id}
                        </Chip>
                    )}
                </div>
               )}
            </div>
         </div>
         <div className={clsx(
             "p-1 text-start relative whitespace-normal flex items-center pr-6 group/ru",
             item.is_section ? "pl-0" : "border-l border-default-300"
         )}>
            <EditableCell
               value={item.ru}
               onSave={(val) => handleUpdate('ru', val)}
               isMultiline
               className={clsx(item.is_section && "font-bold text-medium w-full")}
            />
            {!item.is_section && item.ru && (
               <div className="absolute right-0.5 top-0 z-10 h-full flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                     isIconOnly
                     size="sm"
                     variant="light"
                     className="h-6 w-6 min-w-4 text-default-300 hover:text-warning transition-colors"
                     onPress={() => handleTranslate()}
                     isLoading={isTranslating}
                  >
                     {!isTranslating && <Sparkles size={14} />}
                  </Button>
               </div>
            )}
         </div>

         {!item.is_section && (
             <>
                <div className="p-1 text-start relative whitespace-normal border-l border-default-300 flex items-center group/uk pr-6">
                    {isTranslatingUk || (isTranslating && !item.uk) ? (
                    <div className="w-full flex justify-center py-1 opacity-50">
                        <Loader2 size={14} className="animate-spin text-default-400" />
                    </div>
                    ) : (
                    <>
                        <EditableCell
                            value={item.uk}
                            onSave={(val) => handleUpdate('uk', val)}
                            isMultiline
                        />
                        {item.ru && (
                            <div className="absolute right-0.5 top-0 z-10 h-full flex items-center opacity-0 group-hover/uk:opacity-100 transition-opacity">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    className="h-6 w-6 min-w-4 text-default-300 hover:text-warning transition-colors"
                                    onPress={() => handleTranslate('uk')}
                                    isLoading={isTranslatingUk}
                                >
                                    {!isTranslatingUk && <Sparkles size={14} />}
                                </Button>
                            </div>
                        )}
                    </>
                    )}
                </div>
                <div className="p-1 text-start relative whitespace-normal border-l border-default-300 flex items-center group/en pr-6">
                    {isTranslatingEn || (isTranslating && !item.en) ? (
                    <div className="w-full flex justify-center py-1 opacity-50">
                        <Loader2 size={14} className="animate-spin text-default-400" />
                    </div>
                    ) : (
                    <>
                        <EditableCell
                            value={item.en}
                            onSave={(val) => handleUpdate('en', val)}
                            isMultiline
                        />
                        {item.ru && (
                            <div className="absolute right-0.5 top-0 z-10 h-full flex items-center opacity-0 group-hover/en:opacity-100 transition-opacity">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    className="h-6 w-6 min-w-4 text-default-300 hover:text-warning transition-colors"
                                    onPress={() => handleTranslate('en')}
                                    isLoading={isTranslatingEn}
                                >
                                    {!isTranslatingEn && <Sparkles size={14} />}
                                </Button>
                            </div>
                        )}
                    </>
                    )}
                </div>
             </>
         )}

         <div className="p-1 text-end relative whitespace-normal border-l border-default-300 pr-2">
            {!item.isNew && (
                <div className="flex justify-end gap-1 items-center">
                
                <button
                    onClick={() => onToggleSection(item)}
                    className={clsx(
                        "p-0.5 rounded transition-colors",
                        item.is_section ? "text-primary" : "text-default-400 hover:text-primary hover:bg-default-100"
                    )}
                    title="Toggle Section"
                >
                    <Heading size={16} />
                </button>

                {!item.is_section && (
                    <Dropdown>
                        <DropdownTrigger>
                            <span className="text-lg text-default-400 cursor-pointer active:opacity-50 hover:text-primary p-0.5 rounded hover:bg-default-100 transition-colors">
                                <IconMoveToTab size={16} />
                            </span>
                        </DropdownTrigger>
                        <DropdownMenu aria-label="Move to tab">
                            {tabs.map((tab) => {
                                const isCurrent = tab.id === (item.tab_id || 'misc');
                                return (
                                <DropdownItem
                                    key={tab.id}
                                    onPress={!isCurrent ? () => onMove(item, tab.id) : undefined}
                                    isDisabled={isCurrent}
                                    className={isCurrent ? "opacity-50 cursor-default" : ""}
                                >
                                    <span className="font-normal">Move to </span>
                                    <span className="font-bold">{tab.label}</span>
                                </DropdownItem>
                                );
                            })}
                        </DropdownMenu>
                    </Dropdown>
                )}

                {!item.is_section && (
                    <span className="text-lg text-default-400 cursor-pointer active:opacity-50 hover:text-primary p-0.5 rounded hover:bg-default-100 transition-colors" onClick={() => onEdit(item)}>
                        <IconEdit size={16} />
                    </span>
                )}

                <Popover 
                    placement="left" 
                    showArrow 
                    offset={10} 
                    isOpen={isDeleteOpen} 
                    onOpenChange={setIsDeleteOpen}
                >
                    <PopoverTrigger>
                        <span className="text-lg text-default-400 cursor-pointer active:opacity-50 hover:text-danger p-0.5 rounded hover:bg-danger-50 transition-colors">
                            <IconTrash size={16} />
                        </span>
                    </PopoverTrigger>
                    <PopoverContent>
                        <div className="px-1 py-2 w-[200px]">
                            <div className="text-small font-bold mb-2 text-danger">Delete Item?</div>
                            <div className="text-tiny text-default-500 mb-3">
                            Are you sure you want to delete <span className="font-mono font-bold text-foreground">{item.item_id}</span>?
                            </div>
                            <Button
                            size="sm"
                            color="danger"
                            onPress={() => {
                                setIsDeleteOpen(false);
                                onDelete(item.item_id);
                            }}
                            fullWidth
                            >
                            Confirm Delete
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
                </div>
            )}
         </div>
      </div>
   );
};
