'use client';

import React from 'react';
import { Folder } from '@/app/types';
import { Button, Chip } from '@heroui/react';
import { Plus } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';

// --- Single Tab Component ---
interface FolderTabProps {
    folder: Folder;
    count: number;
    isActive: boolean;
    onClick: () => void;
    layoutIdPrefix: string;
}

export const FolderTab = ({ folder, count, isActive, onClick, layoutIdPrefix }: FolderTabProps) => {
    return (
       <div
          onClick={onClick}
          className={clsx(
             'group relative flex items-center gap-2 px-3 h-[40px] cursor-pointer select-none transition-colors min-w-fit outline-none',
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
          {isActive && (
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
               {folders.map((folder) => (
                     <FolderTab 
                        key={folder.id}
                        folder={folder}
                        count={getTaskCount(folder.id)}
                        isActive={selectedFolderId === folder.id}
                        layoutIdPrefix={`project-${projectId}`}
                        onClick={() => onSelect(folder.id)}
                     />
               ))}
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

