'use client';

import React from 'react';
import { Folder } from '@/app/types';
import { Button, Chip } from '@heroui/react';
import { Plus, EllipsisVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useDroppable } from '@dnd-kit/core';
import { CreateItemPopover } from '@/app/components/CreateItem';
import { EditFolderPopover } from '@/app/components/EditFolder';

// --- Single Tab Component ---
interface FolderTabProps {
    folder: Folder;
    count: number;
    isActive: boolean;
    onClick: () => void;
    layoutIdPrefix: string;
    onUpdate?: (title: string) => void;
    onDelete?: () => void;
    onMove?: (direction: 'left' | 'right') => void;
    canMoveLeft?: boolean;
    canMoveRight?: boolean;
    isDragging?: boolean;
    isOver?: boolean;
}

export const FolderTab = ({ 
    folder, 
    count, 
    isActive, 
    onClick, 
    layoutIdPrefix,
    onUpdate,
    onDelete,
    onMove,
    canMoveLeft,
    canMoveRight,
    isDragging,
    isOver
}: FolderTabProps) => {
    const { setNodeRef } = useDroppable({
        id: `folder-${folder.id}`,
        data: { type: 'folder', folder }
    });

    return (
       <div
          ref={setNodeRef}
          onClick={onClick}
          className={clsx(
             'group/tab relative flex items-center gap-1 px-1 h-[40px] select-none transition-colors min-w-fit outline-none rounded-lg border-2 border-transparent',
             // 1. Dragging state (highest priority for cursor/bg)
             isDragging && 'cursor-grabbing bg-default-100 ring-1 ring-primary/30',
             
             // 2. Hover/Drop state (when dragging a task over)
             !isDragging && isOver && 'bg-primary/10 text-primary cursor-pointer border-dashed border-primary',
             
             // 3. Active state (allow active styles even when dragging)
             !isOver && isActive && 'text-primary font-medium cursor-pointer',
             
             // 4. Default state
             !isDragging && !isOver && !isActive && 'text-default-500 hover:text-default-700 cursor-pointer'
          )}
       >
          <span className="relative z-10">{folder.title}</span>

          <div className="relative flex items-center justify-center min-w-[20px] -mt-[1px] h-5">
              {/* Chip - visible by default, hidden on hover if actions exist */}
              <div 
                  className={clsx(
                      "transition-opacity duration-200",
                      (onUpdate && onDelete && !isDragging) && "group-hover/tab:opacity-0"
                  )}
              >
                  <Chip 
                      size="sm" 
                      variant="flat" 
                      className={clsx(
                          "h-5 min-w-5 px-1 text-[10px] relative z-10",
                          isActive ? "bg-primary/20 text-primary" : "bg-default-100 text-default-500"
                      )}
                  >
                     {count}
                  </Chip>
              </div>

              {/* Action Button - hidden by default, visible on hover */}
              {onUpdate && onDelete && !isDragging && (
                  <div 
                      className={clsx(
                          "absolute inset-0 flex items-center justify-center",
                          "opacity-0 group-hover/tab:opacity-100 transition-opacity duration-200 z-20"
                      )}
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={(e) => e.stopPropagation()}
                  >
                      <EditFolderPopover
                          initialTitle={folder.title}
                          onUpdate={onUpdate}
                          onDelete={onDelete}
                          onMove={onMove}
                          canMoveLeft={canMoveLeft}
                          canMoveRight={canMoveRight}
                      >
                          <button 
                              type="button"
                              className="flex items-center justify-center text-default-400 hover:text-primary transition-colors outline-none cursor-pointer"
                          >
                              <EllipsisVertical size={16} />
                          </button>
                      </EditFolderPopover>
                  </div>
              )}
          </div>
          
          {/* Action Button */}
          

          {/* Active Indicator (Underline) with Framer Motion */}
          {isActive && !isDragging && (
              <motion.div 
                  layoutId={`${layoutIdPrefix}-underline`}
                  className="absolute bottom-0 left-0 w-full h-[2px] bg-primary z-0"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
          )}
       </div>
    );
};

// --- List Component ---
interface FolderTabsProps {
    folders: Folder[];
    selectedFolderId: string;
    onSelect: (folderId: string) => void;
    onAddFolder: (name: string, color?: string) => Promise<void> | void;
    onUpdateFolder?: (id: string, name: string) => Promise<void> | void;
    onDeleteFolder?: (id: string) => Promise<void> | void;
    onMoveFolder?: (id: string, direction: 'left' | 'right') => void;
    getTaskCount: (folderId: string) => number;
    projectId: string;
    hoveredFolderId?: string | null;
}

export const FolderTabs = ({ 
    folders, 
    selectedFolderId, 
    onSelect, 
    onAddFolder, 
    onUpdateFolder,
    onDeleteFolder,
    onMoveFolder,
    getTaskCount,
    projectId,
    hoveredFolderId
}: FolderTabsProps) => {
    return (
        <div className="flex items-end gap-2 w-full ">
           <div className="flex-grow overflow-x-auto scrollbar-hide flex items-center gap-2">
               {folders.map((folder, index) => (
                     <FolderTab 
                        key={folder.id}
                        folder={folder}
                        count={getTaskCount(folder.id)}
                        isActive={selectedFolderId === folder.id}
                        layoutIdPrefix={`project-${projectId}`}
                        onClick={() => onSelect(folder.id)}
                        isOver={hoveredFolderId === `folder-${folder.id}`}
                        onUpdate={onUpdateFolder ? (title) => onUpdateFolder(folder.id, title) : undefined}
                        onDelete={onDeleteFolder ? () => onDeleteFolder(folder.id) : undefined}
                        onMove={onMoveFolder ? (direction) => onMoveFolder(folder.id, direction) : undefined}
                        canMoveLeft={index > 0}
                        canMoveRight={index < folders.length - 1}
                     />
               ))}
           </div>
           <CreateItemPopover 
               title="New Folder" 
               inputPlaceholder="Folder Name"
               onCreate={onAddFolder}
               placement="top-end"
               
           >
               <Button 
                   isIconOnly 
                   variant="flat" 
                   size="sm" 
                   color="success"
                   className="mb-1"
               >
                   <Plus size={20} />
               </Button>
           </CreateItemPopover>
        </div>
    );
};
