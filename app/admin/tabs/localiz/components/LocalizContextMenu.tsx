'use client';

import React, { useState } from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { UIElement } from '@/utils/providers/localization/types';

export interface LocalizContextMenuProps {
   children: React.ReactNode;
   item: UIElement;
   onInsertAbove?: () => void;
   onInsertBelow?: () => void;
   onDelete?: () => void;
}

export const LocalizContextMenu = ({
   children,
   item,
   onInsertAbove,
   onInsertBelow,
   onDelete,
}: LocalizContextMenuProps) => {
   const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

   const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();
      
      if (typeof document !== 'undefined') {
         document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
         document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
         document.body.click();
      }

      if (document.activeElement instanceof HTMLElement) {
         document.activeElement.blur();
      }

      e.stopPropagation(); // Stop propagation to prevent conflict with other context menus
      
      setMenuPos({ x: e.clientX, y: e.clientY });
   };

   const handleClose = () => setMenuPos(null);

   return (
      <div onContextMenu={handleContextMenu} className="contents">
         {children}
         <Dropdown 
            isOpen={!!menuPos} 
            onOpenChange={(open) => { if (!open) setMenuPos(null); }} 
            placement="bottom-start" 
            triggerScaleOnOpen={false}
         >
            <DropdownTrigger>
               <div style={{ position: 'fixed', left: menuPos?.x ?? 0, top: menuPos?.y ?? 0, width: 0, height: 0, pointerEvents: 'none', zIndex: 9999 }} />
            </DropdownTrigger>
            <DropdownMenu aria-label="Item Actions">
               <DropdownItem 
                  key="insert-above" 
                  startContent={<ArrowUp size={16} className="text-default-400" />}
                  onPress={() => { onInsertAbove?.(); handleClose(); }}
               >
                  Insert Above
               </DropdownItem>
               <DropdownItem 
                  key="insert-below" 
                  startContent={<ArrowDown size={16} className="text-default-400" />}
                  onPress={() => { onInsertBelow?.(); handleClose(); }}
               >
                  Insert Below
               </DropdownItem>
               <DropdownItem key="sep-1" className="h-px bg-default-200 p-0 my-1 pointer-events-none" textValue="separator" />
               <DropdownItem 
                  key="delete" 
                  className="text-danger" 
                  color="danger" 
                  startContent={<Trash2 size={16} />} 
                  onPress={() => { onDelete?.(); handleClose(); }}
               >
                  Delete
               </DropdownItem>
            </DropdownMenu>
         </Dropdown>
      </div>
   );
};

