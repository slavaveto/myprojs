'use client';

import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Button, Popover, PopoverTrigger, PopoverContent, Tooltip, Checkbox } from '@heroui/react';
import { GripVertical, Trash2 as IconTrash, Settings, ExternalLink, Heading, User, Shield } from 'lucide-react';
import { EditableCell } from '@/app/admin/tabs/components/EditableCell';
import clsx from 'clsx';
import Link from 'next/link';
import toast from 'react-hot-toast';

export interface Room {
   room_id: string;
   room_title: string;
   sort_order?: number;
   is_section?: boolean;
   isNew?: boolean;
   is_active?: boolean;
}

interface SortableRoomRowProps {
   item: Room;
   onUpdateId: (oldId: string, newId: string) => void;
   onUpdateTitle: (id: string, newTitle: string) => void;
   onDelete: (id: string) => void;
   onToggleSection: (item: Room) => void;
   onToggleActive: (item: Room) => void;
   isOverlay?: boolean;
   onCancel?: (item: Room) => void;
   onValidateId?: (id: string) => string | null;
   canEditId?: boolean;
}

export const SortableRoomRow = ({
   item,
   onUpdateId,
   onUpdateTitle,
   onDelete,
   onToggleSection,
   onToggleActive,
   isOverlay,
   onCancel,
   onValidateId,
   canEditId = true
}: SortableRoomRowProps) => {
   const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
   } = useSortable({ id: item.room_id });

   const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      opacity: isDragging ? 0.3 : 1,
   };

   const [isDeleteOpen, setIsDeleteOpen] = useState(false);

   const handleCopyUserLink = () => {
      navigator.clipboard.writeText(`https://meet.slavaveto.com/${item.room_id}`);
      toast.success('Ссылка для юзера скопирована');
   };

   const handleCopyAdminLink = () => {
      navigator.clipboard.writeText(`http://localhost:3403/${item.room_id}?admin=true`);
      toast.success('Ссылка для админа скопирована');
   };

   const handleKeyDown = (e: React.KeyboardEvent) => {
       if (e.key === 'Escape') {
           if (onCancel) {
               onCancel(item);
           }
       }
   };

   return (
      <div
         ref={setNodeRef}
         style={style}
         className={clsx(
            "group grid gap-1 items-center min-h-[32px] rounded-lg border border-default-300 bg-content1 transition-colors outline-none",
            item.is_section ? "grid-cols-[35px_1fr_200px]" : "grid-cols-[230px_1fr_40px_200px]",
            !isDragging && !isOverlay && "hover:bg-default-50",
            (isDragging || isOverlay) && "z-50 bg-content1 shadow-lg border-primary/50"
         )}
         onKeyDown={handleKeyDown}
         tabIndex={-1}
      >
         {/* Drag Handle & Room ID */}
         <div className={clsx("p-1 flex items-center h-full gap-2", item.is_section ? "pl-2" : "pl-2")}>
            <div 
               {...attributes} 
               {...listeners} 
               className="cursor-grab active:cursor-grabbing text-default-400 hover:text-default-600 outline-none p-0.5 hover:bg-default-100 rounded"
            >
               <GripVertical size={14} />
            </div>
            
            {!item.is_section && (
                <div className="font-mono text-xs flex items-center h-full min-w-0 flex-1">
                    {canEditId ? (
                        <EditableCell
                            value={item.room_id}
                            onSave={(val) => onUpdateId(item.room_id, val)}
                            onValidate={onValidateId ? (val) => val !== item.room_id ? onValidateId(val) : null : undefined}
                            className="font-mono text-xs font-bold text-primary truncate w-full"
                            isMultiline={false}
                        />
                    ) : (
                        <span 
                           className="font-mono text-xs font-bold text-default-500 truncate w-full px-1 cursor-not-allowed opacity-70"
                           title="Editing ID is disabled on Free plan"
                        >
                           {item.room_id}
                        </span>
                    )}
                </div>
            )}
         </div>

         {/* Room Title */}
         <div className={clsx(
             "p-1 h-full flex items-center w-full", 
             item.is_section ? "pl-0" : "px-2 border-l border-default-300"
         )}>
             <EditableCell
                value={item.room_title || ''}
                onSave={(val) => onUpdateTitle(item.room_id, val)}
                className={clsx("w-full", item.is_section ? "font-bold text-medium" : "font-medium text-base")}
                isMultiline={false}
                autoFocus={item.isNew}
             />
         </div>

         {/* Active Checkbox */}
         {!item.is_section && (
            <div className="flex items-center justify-center border-l border-default-300 h-full">
               <Checkbox 
                  isSelected={item.is_active !== false && item.is_active !== 'false'} 
                  onValueChange={() => onToggleActive(item)} 
                  size="sm" 
                  aria-label="Active"
                  classNames={{ wrapper: "m-0" }}
               />
            </div>
         )}

         {/* Actions */}
         <div className="p-1 pr-2 border-l border-default-300 h-full flex items-center justify-end gap-0">
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
                <>
                  <div className="w-[1px] h-4 bg-default-300 mx-2" />
                  <button
                     onClick={handleCopyUserLink}
                     className="text-default-400 active:opacity-50 hover:text-primary p-0.5 rounded hover:bg-default-100 transition-colors"
                     title="Скопировать ссылку для юзера"
                  >
                     <User size={16} />
                  </button>

                  <button
                     onClick={handleCopyAdminLink}
                     className="text-default-400 active:opacity-50 hover:text-warning p-0.5 rounded hover:bg-default-100 transition-colors"
                     title="Скопировать ссылку для админа (Localhost)"
                  >
                     <Shield size={16} />
                  </button>

                  <div className="w-[1px] h-4 bg-default-300 mx-2" />

                    <Link 
                    href={`/admin/${item.room_id}`} 
                    className="text-default-400 active:opacity-50 hover:text-primary p-0.5 rounded hover:bg-default-100 transition-colors"
                    >
                    <Settings size={16} />
                    </Link>
                    <Link 
                    href={`/${item.room_id}`} 
                    target="_blank" 
                    className="text-default-400 active:opacity-50 hover:text-primary p-0.5 rounded hover:bg-default-100 transition-colors"
                    >
                    <ExternalLink size={16} />
                    </Link>
                </>
            )}
            
            <div className="w-[1px] h-4 bg-default-300 mx-2" />
            
            <Popover 
               placement="left" 
               showArrow 
               offset={10} 
               isOpen={isDeleteOpen} 
               onOpenChange={setIsDeleteOpen}
            >
               <PopoverTrigger>
                  <span className="text-default-400 cursor-pointer active:opacity-50 hover:text-danger p-0.5 rounded hover:bg-danger-50 transition-colors">
                     <IconTrash size={16} />
                  </span>
               </PopoverTrigger>
               <PopoverContent>
                  <div className="px-1 py-2 w-[200px]">
                     <div className="text-small font-bold mb-2 text-danger">Delete Room?</div>
                     <div className="text-tiny text-default-500 mb-3">
                        Are you sure you want to delete <span className="font-mono font-bold text-foreground">{item.room_id}</span>?
                     </div>
                     <Button
                        size="sm"
                        color="danger"
                        onPress={() => {
                           setIsDeleteOpen(false);
                           onDelete(item.room_id);
                        }}
                        fullWidth
                     >
                        Confirm Delete
                     </Button>
                  </div>
               </PopoverContent>
            </Popover>
         </div>
      </div>
   );
};
