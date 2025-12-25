'use client';

import React from 'react';
import { Folder } from '@/app/types';
import { Button, Chip } from '@heroui/react';
import { Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
import { useSortable, SortableContext, horizontalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

// --- Single Tab Component ---
interface FolderTabProps {
    folder: Folder;
    count: number;
    isActive: boolean;
    onClick: () => void;
    layoutIdPrefix: string;
    // DnD props
    attributes?: any;
    listeners?: any;
    setNodeRef?: (node: HTMLElement | null) => void;
    style?: React.CSSProperties;
    isDragging?: boolean;
}

export const FolderTab = ({ 
    folder, 
    count, 
    isActive, 
    onClick, 
    layoutIdPrefix,
    attributes,
    listeners,
    setNodeRef,
    style,
    isDragging
}: FolderTabProps) => {
    return (
       <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          onClick={onClick}
          className={clsx(
             'group relative flex items-center gap-2 px-3 h-[40px] select-none transition-colors min-w-fit outline-none rounded-lg',
             isDragging ? 'cursor-grabbing bg-default-100  ' : 'cursor-pointer',
             isActive ? 'text-primary font-medium' : 'text-default-500 hover:text-default-700'
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
        />
    );
};

// --- List Component ---
interface FolderTabsProps {
    folders: Folder[];
    selectedFolderId: string;
    onSelect: (folderId: string) => void;
    onAddFolder: () => void;
    getTaskCount: (folderId: string) => number;
    projectId: string;
}

export const FolderTabs = ({ 
    folders, 
    selectedFolderId, 
    onSelect, 
    onAddFolder, 
    getTaskCount,
    projectId
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
                         />
                   ))}
               </SortableContext>
           </div>
           <Button 
               isIconOnly 
               variant="flat" 
               size="sm" 
               color="success"
               onPress={onAddFolder}
               className="mb-1"
           >
               <Plus size={20} />
           </Button>
        </div>
    );
};

