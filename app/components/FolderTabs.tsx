'use client';

import React from 'react';
import { Folder } from '@/app/types';
import { Button, Chip } from '@heroui/react';
import { Plus, EllipsisVertical } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useSortable, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
    // DnD props
    attributes?: any;
    listeners?: any;
    setNodeRef?: (node: HTMLElement | null) => void;
    style?: React.CSSProperties;
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
    attributes,
    listeners,
    setNodeRef,
    style,
    isDragging,
    isOver
}: FolderTabProps) => {
    return (
       <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          onClick={onClick}
          className={clsx(
             'group/tab relative flex items-center gap-2 pl-1 h-[40px] select-none transition-colors min-w-fit outline-none rounded-lg border-2 border-transparent',
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
          
          {/* Action Button */}
          {onUpdate && onDelete && !isDragging && (
              <div 
                  className={clsx(
                      "opacity-0 group-hover/tab:opacity-100 transition-opacity z-20 ml-0",
                      "flex items-center"
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
              >
                  <EditFolderPopover
                      initialTitle={folder.title}
                      onUpdate={onUpdate}
                      onDelete={onDelete}
                  >
                      <button 
                          type="button"
                          className=" flex items-center justify-center text-default-400 hover:text-primary transition-colors outline-none cursor-pointer"
                      >
                          <EllipsisVertical size={14} />
                      </button>
                  </EditFolderPopover>
              </div>
          )}

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


// --- Sortable Wrapper ---
const SortableFolderTab = (props: FolderTabProps) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
        // isOver - we don't use DndKit's native isOver because it triggers when dragging folders too.
        // We rely solely on props.isOver which is controlled by ProjectScreen for tasks only.
    } = useSortable({
        id: `folder-${props.folder.id}`,
        data: { type: 'folder', folder: props.folder }
    });

    const style = {
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.3 : 1,
        zIndex: isDragging ? 10 : 1,
    };

    return (
        <FolderTab 
            {...props}
            attributes={attributes}
            listeners={listeners}
            setNodeRef={setNodeRef}
            style={style}
            isDragging={isDragging}
            isOver={props.isOver} 
        />
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
    getTaskCount,
    projectId,
    hoveredFolderId
}: FolderTabsProps) => {
    return (
        <div className="flex items-end gap-2 w-full ">
           <div className="flex-grow overflow-x-auto scrollbar-hide flex items-center gap-2">
               <SortableContext 
                    items={folders.map(f => `folder-${f.id}`)}
                    strategy={horizontalListSortingStrategy}
               >
                   {folders.map((folder) => (
                         <SortableFolderTab 
                            key={folder.id}
                            folder={folder}
                            count={getTaskCount(folder.id)}
                            isActive={selectedFolderId === folder.id}
                            layoutIdPrefix={`project-${projectId}`}
                            onClick={() => onSelect(folder.id)}
                            isOver={hoveredFolderId === `folder-${folder.id}`}
                            onUpdate={onUpdateFolder ? (title) => onUpdateFolder(folder.id, title) : undefined}
                            onDelete={onDeleteFolder ? () => onDeleteFolder(folder.id) : undefined}
                         />
                   ))}
               </SortableContext>
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
