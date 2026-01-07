import React from 'react';
import { Folder } from '@/app/types';
import { Button, Chip } from '@heroui/react';
import { Plus, EllipsisVertical, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { motion } from 'framer-motion';
// import { useDroppable } from '@dnd-kit/core'; // DnD later
// import { CreateItemPopover } from '@/app/(main)/components/CreateItem'; // TODO: Move to v2
// import { EditFolderPopover } from '@/app/(main)/components/EditFolder'; // TODO: Move to v2

// --- Single Tab Component ---
interface FolderTabProps {
    folder: Folder;
    count?: number; 
    isActive: boolean;
    onClick: () => void;
    layoutIdPrefix: string; // Mandatory
    onUpdate?: (title: string) => void;
    onDelete?: () => void;
    isDragging?: boolean;
    isOver?: boolean;
    orientation?: 'horizontal' | 'vertical';
}

export const FolderTab = ({ 
    folder, 
    count = 0, 
    isActive, 
    onClick, 
    layoutIdPrefix,
    onUpdate,
    onDelete,
    isDragging,
    isOver,
    orientation = 'horizontal'
}: FolderTabProps) => {
    // DnD disabled for now
    // const { setNodeRef } = useDroppable({
    //     id: `folder-${folder.id}`,
    //     data: { type: 'folder', folder }
    // });

    return (
       <div
        //   ref={setNodeRef}
          onClick={onClick}
          className={clsx(
             'group/tab relative flex items-center gap-2 select-none transition-colors outline-none rounded-lg border-2 border-transparent',
             orientation === 'horizontal' ? 'px-1 h-[40px] min-w-fit' : 'w-full min-h-[40px] px-3 py-2 justify-between',
             // 1. Dragging state (highest priority for cursor/bg)
             isDragging && 'cursor-grabbing bg-default-100 ring-1 ring-primary/30',
             
             // 2. Hover/Drop state (when dragging a task over)
             !isDragging && isOver && 'bg-primary/10 text-primary cursor-pointer border-dashed border-primary',
             
             // 3. Active state (allow active styles even when dragging)
             !isOver && isActive && 'text-primary font-medium cursor-pointer',
             
             // 4. Default state
             !isDragging && !isOver && !isActive && 'text-default-500 hover:text-default-700 cursor-pointer',
             
             // Vertical active bg
             orientation === 'vertical' && isActive && !isOver && !isDragging && 'bg-primary/10'
          )}
       >
          <span className="relative z-10 flex-grow min-w-0 flex items-center gap-1">
             {folder.title.toLowerCase() === 'info' && <Info size={16} className="flex-shrink-0" />}
             <span className="truncate">{folder.title}</span>
          </span>

          <div className="relative flex items-center justify-center min-w-[20px] -mt-[1px] h-5 flex-shrink-0">
              {/* Chip - visible by default, hidden on hover if actions exist */}
              <div 
                  className={clsx(
                      "transition-opacity duration-200",
                      (onUpdate && onDelete && !isDragging) && "group-hover/tab:opacity-0"
                  )}
              >
                  {count > 0 && (
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
                  )}
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
                      {/* Placeholder for EditFolderPopover */}
                      <button 
                          type="button"
                          className="flex items-center justify-center text-default-400 hover:text-primary transition-colors outline-none cursor-pointer"
                          onClick={() => console.log('Edit Folder', folder.id)}
                      >
                          <EllipsisVertical size={16} />
                      </button>
                  </div>
              )}
          </div>
          
          {/* Active Indicator (Underline) with Framer Motion - Only Horizontal */}
          {isActive && !isDragging && orientation === 'horizontal' && (
              <motion.div 
                  layoutId={`${layoutIdPrefix}-underline`}
                  className="absolute bottom-0 left-0 w-full h-[2px] bg-primary z-0"
                  initial={false}
                  transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
          )}
          
          {/* Active Indicator (Left Border) - Only Vertical */}
           {isActive && !isDragging && orientation === 'vertical' && (
              <motion.div 
                  layoutId={`${layoutIdPrefix}-left-border`}
                  className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary z-0 rounded-l-lg"
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
    folderCounts?: Record<string, number>;
    hasUiSatellite?: boolean;
    activeFolderId: string | null;
    onSelectFolder: (folderId: string) => void;
    onToggleRemote?: (type: 'ui' | 'users' | 'logs' | 'tables') => void;
    activeRemoteTab?: 'ui' | 'users' | 'logs' | 'tables' | null;
    onCreateFolder?: () => void;
    orientation?: 'horizontal' | 'vertical';
    layoutIdPrefix: string; // Mandatory now
}

export const FolderTabs = ({ 
    folders, 
    folderCounts = {},
    activeFolderId, 
    onSelectFolder, 
    onCreateFolder,
    orientation = 'horizontal',
    layoutIdPrefix,
    hasUiSatellite,
    onToggleRemote,
    activeRemoteTab
}: FolderTabsProps) => {

    const RemoteProjsZone = () => {
        if (!hasUiSatellite) return null;

        return (
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-default-200">
                {hasUiSatellite && (
                    <>
                        <button
                            onClick={() => onToggleRemote?.('ui')}
                            className={clsx(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-transparent cursor-pointer',
                                activeRemoteTab === 'ui'
                                    ? 'bg-purple-100 text-purple-700 border-purple-200'
                                    : 'text-default-500 hover:text-default-700 hover:bg-default-100'
                            )}
                        >
                            <span>UI</span>
                        </button>
                        <button
                            onClick={() => onToggleRemote?.('users')}
                            className={clsx(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-transparent cursor-pointer',
                                activeRemoteTab === 'users'
                                    ? 'bg-orange-100 text-orange-700 border-orange-200'
                                    : 'text-default-500 hover:text-default-700 hover:bg-default-100'
                            )}
                        >
                            <span>Users</span>
                        </button>
                        <button
                            onClick={() => onToggleRemote?.('logs')}
                            className={clsx(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-transparent cursor-pointer',
                                activeRemoteTab === 'logs'
                                    ? 'bg-gray-100 text-gray-700 border-gray-200'
                                    : 'text-default-500 hover:text-default-700 hover:bg-default-100'
                            )}
                        >
                            <span>Logs</span>
                        </button>
                        <button
                            onClick={() => onToggleRemote?.('tables')}
                            className={clsx(
                                'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-transparent cursor-pointer',
                                activeRemoteTab === 'tables'
                                    ? 'bg-green-100 text-green-700 border-green-200'
                                    : 'text-default-500 hover:text-default-700 hover:bg-default-100'
                            )}
                        >
                            <span>Tables</span>
                        </button>
                    </>
                )}
            </div>
        );
    };

    // Simple horizontal layout for now matching v1 horizontal
    return (
        <div className="flex items-center w-full px-6 pl-2 py-2 bg-background/50 flex-none z-10 border-b border-default-200 backdrop-blur-sm sticky top-0">
           <div className="flex-grow overflow-x-auto scrollbar-hide flex items-center gap-2 no-scrollbar pl-4">
               {folders.map((folder, index) => (
                     <FolderTab 
                        key={folder.id}
                        folder={folder}
                        count={folderCounts[folder.id] || 0} 
                        isActive={activeFolderId === folder.id && !activeRemoteTab}
                        layoutIdPrefix={layoutIdPrefix} // Pass unique prefix down
                        onClick={() => onSelectFolder(folder.id)}
                        orientation={orientation}
                        onUpdate={() => {}} 
                        onDelete={() => {}}
                     />
               ))}

               {/* Create Folder Button (Moved inside scrollable area) */}
               <div className="flex-shrink-0 ml-1">
                   <Button 
                       isIconOnly 
                       variant="flat" 
                       size="sm" 
                       color="success"
                       onClick={onCreateFolder}
                       className="bg-transparent hover:bg-success/20 text-success"
                   >
                       <Plus size={20} />
                   </Button>
               </div>
           </div>
           
           <RemoteProjsZone />
        </div>
    );
};
