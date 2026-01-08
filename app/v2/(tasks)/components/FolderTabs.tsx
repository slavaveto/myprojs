import React from 'react';
import { Folder } from '@/app/types';
import { Button, Chip } from '@heroui/react';
import { Plus, EllipsisVertical, Info } from 'lucide-react';
import { clsx } from 'clsx';
import { motion, LayoutGroup } from 'framer-motion';
import { FolderFormPopover } from './misc/FolderFormPopover';
// import { useDroppable } from '@dnd-kit/core'; // DnD later
// import { CreateItemPopover } from '@/app/(main)/components/CreateItem'; // TODO: Move to v2
// import { EditFolderPopover } from '@/app/(main)/components/EditFolder'; // TODO: Move to v2

// --- Single Tab Component ---
interface FolderTabProps {
   folder: Folder;
   count?: number;
   isActive: boolean;
   onClick: () => void;
   underlineLayoutId: string; // Renamed for clarity
   onUpdate?: (title: string) => void;
   onDelete?: () => void;
   isDragging?: boolean;
   isOver?: boolean;
   orientation?: 'horizontal' | 'vertical';
   showZeroCount?: boolean;
}

export const FolderTab = ({
   folder,
   count = 0,
   isActive,
   onClick,
   underlineLayoutId,
   onUpdate,
   onDelete,
   isDragging,
   isOver,
   orientation = 'horizontal',
   showZeroCount = false,
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
            orientation === 'horizontal'
               ? 'px-1 h-[40px] min-w-fit'
               : 'w-full min-h-[40px] px-3 py-2 justify-between',
            // 1. Dragging state (highest priority for cursor/bg)
            isDragging && 'cursor-grabbing bg-default-100 ring-1 ring-primary/30',

            // 2. Hover/Drop state (when dragging a task over)
            !isDragging &&
               isOver &&
               'bg-primary/10 text-primary cursor-pointer border-dashed border-primary',

            // 3. Active state (allow active styles even when dragging)
            !isOver && isActive && 'text-primary font-medium cursor-pointer',

            // 4. Default state
            !isDragging &&
               !isOver &&
               !isActive &&
               'text-default-500 hover:text-default-700 cursor-pointer',

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
                  'transition-opacity duration-200',
                  onUpdate && onDelete && !isDragging && 'group-hover/tab:opacity-0'
               )}
            >
               {(count > 0 || showZeroCount) && (
                  <div
                     className={clsx(
                        'h-5.5 min-w-5.5 px-1 mt-[1px] rounded-full flex items-center justify-center text-[12px] relative z-10',
                        isActive
                           ? count > 0
                              ? 'bg-primary/20 text-primary font-bold'
                              : 'bg-primary/20 text-default-500 font-normal'
                           : count > 0
                             ? 'bg-default-100 text-primary font-bold'
                             : 'bg-default-100 text-default-500'
                     )}
                  >
                     {count}
                  </div>
               )}
            </div>

            {/* Action Button - hidden by default, visible on hover */}
            {onUpdate && onDelete && !isDragging && (
               <div
                  className={clsx(
                     'absolute inset-0 flex items-center justify-center',
                     'opacity-0 group-hover/tab:opacity-100 transition-opacity duration-200 z-20'
                  )}
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={(e) => e.stopPropagation()}
               >
                  <FolderFormPopover
                     mode="edit"
                     initialTitle={folder.title}
                     onSubmit={onUpdate}
                     onDelete={onDelete}
                     trigger={
                         <Button isIconOnly size="sm" variant="flat" className="!w-6 !h-6 !min-w-6 p-0 hover:text-primary hover:bg-primary/10">
                            <EllipsisVertical size={16} />
                         </Button>
                     }
                  />
               </div>
            )}
         </div>

         {/* Active Indicator (Underline) with Framer Motion - Only Horizontal */}
         {isActive && !isDragging && orientation === 'horizontal' && (
            <motion.div
               layoutId={underlineLayoutId}
               className="absolute bottom-0 left-0 w-full h-[2px] bg-primary z-0"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
         )}

         {/* Active Indicator (Left Border) - Only Vertical */}
         {isActive && !isDragging && orientation === 'vertical' && (
            <motion.div
               layoutId={`${underlineLayoutId}-vertical`}
               className="absolute left-0 top-0 bottom-0 w-[3px] bg-primary z-0 rounded-l-lg"
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               transition={{ type: 'spring', stiffness: 500, damping: 30 }}
            />
         )}
      </div>
   );
};

// --- List Component ---
interface FolderTabsProps {
   folders: Folder[];
   folderCounts?: Record<string, number>;
   hasRemote?: boolean;
   activeFolderId: string | null;
   onSelectFolder: (folderId: string) => void;
   onToggleRemote?: (type: 'ui' | 'users' | 'logs' | 'tables' | 'info') => void;
   activeRemoteTab?: 'ui' | 'users' | 'logs' | 'tables' | 'info' | null;
   // Local Props
   onCreateFolder?: (title: string) => void;
   onUpdateFolder?: (folderId: string, title: string) => void;
   onDeleteFolder?: (folderId: string) => void;

   orientation?: 'horizontal' | 'vertical';
   layoutIdPrefix: string;
   // UI Props (was Remote)
   uiFolders?: Folder[];
   uiFolderCounts?: Record<string, number>;
   activeUiFolderId?: string | null;
   onSelectUiFolder?: (folderId: string) => void;
   onCreateUiFolder?: (title: string) => void;
   onUpdateUiFolder?: (folderId: string, title: string) => void;
   onDeleteUiFolder?: (folderId: string) => void;

   // Info Props (Satellite)
   infoFolders?: Folder[];
   infoFolderCounts?: Record<string, number>;
   activeInfoFolderId?: string | null;
   onSelectInfoFolder?: (folderId: string) => void;
   onCreateInfoFolder?: (title: string) => void;
   onUpdateInfoFolder?: (folderId: string, title: string) => void;
   onDeleteInfoFolder?: (folderId: string) => void;
}

export const FolderTabs = ({
   folders,
   folderCounts = {},
   activeFolderId,
   onSelectFolder,
   onCreateFolder,
   orientation = 'horizontal',
   layoutIdPrefix,
   hasRemote,
   onToggleRemote,
   activeRemoteTab,
   // Destructure new props
   uiFolders = [],
   uiFolderCounts = {},
   activeUiFolderId,
   onSelectUiFolder,
   onCreateUiFolder,
   onUpdateUiFolder,
   onDeleteUiFolder,

   // Info Destructure
   infoFolders = [],
   infoFolderCounts = {},
   activeInfoFolderId,
   onSelectInfoFolder,
   onCreateInfoFolder,
   onUpdateInfoFolder,
   onDeleteInfoFolder,

   onUpdateFolder,
   onDeleteFolder,
}: FolderTabsProps) => {
   // Simple horizontal layout for now matching v1 horizontal
   return (
      <div className="flex items-center w-full px-6 pl-2 py-1 bg-background/50 flex-none z-10 border-b border-default-200 backdrop-blur-sm sticky top-0 justify-between">
         {/* LEFT SIDE: Project Folders (Scrollable) */}
         <div className="flex-1 overflow-hidden flex items-center min-w-0 mr-2">
            <div
               className="flex-grow overflow-x-auto scrollbar-hide flex items-center gap-2 no-scrollbar pl-4"
               style={{
                  maskImage: 'linear-gradient(to right, black calc(100% - 50px), transparent 100%)',
                  WebkitMaskImage:
                     'linear-gradient(to right, black calc(100% - 50px), transparent 100%)',
               }}
            >
               {folders.map((folder, index) => (
                  <FolderTab
                     key={folder.id}
                     folder={folder}
                     count={folderCounts[folder.id] || 0}
                     isActive={activeFolderId === folder.id && !activeRemoteTab}
                     underlineLayoutId={`${layoutIdPrefix}-main-underline`} // Explicit unique ID
                     onClick={() => onSelectFolder(folder.id)}
                     orientation={orientation}
                     showZeroCount={true} // Show count for project folders too
                     onUpdate={
                        onUpdateFolder ? (title) => onUpdateFolder(folder.id, title) : undefined
                     }
                     onDelete={onDeleteFolder ? () => onDeleteFolder(folder.id) : undefined}
                  />
               ))}

               {/* Create Folder Button (Moved inside scrollable area) */}
               {onCreateFolder && (
                  <div className="flex-shrink-0 ml-1">
                     <FolderFormPopover
                        mode="create"
                        onSubmit={onCreateFolder}
                        trigger={
                           <Button
                              isIconOnly
                              variant="flat"
                              size="sm"
                              color="success"
                              className="bg-transparent hover:bg-success/20 text-success"
                           >
                              <Plus size={20} />
                           </Button>
                        }
                     />
                  </div>
               )}
            </div>
         </div>

         {/* RIGHT SIDE: Remote Folders & Toggles */}
         <div className="flex-none flex items-center gap-2 ml-2">
            {/* 1. Remote Folders Container (With Background) */}
            {(activeRemoteTab === 'ui' || activeRemoteTab === 'info') && (
               <div
                  className={clsx(
                     'flex items-center gap-2 rounded-lg px-2 pl-4 transition-colors',
                     activeRemoteTab === 'ui'
                        ? 'bg-purple-100/50'
                        : activeRemoteTab === 'info'
                          ? 'bg-orange-100/50'
                          : 'bg-default-100/50'
                  )}
               >
                  {/* Show UI Folders ONLY if UI tab is active */}
                  {activeRemoteTab === 'ui' && (
                     <LayoutGroup id={`${layoutIdPrefix}-ui-scope`}>
                        <motion.div
                           layout
                           className="flex items-center gap-2"
                           style={{ isolation: 'isolate', position: 'relative' }}
                        >
                           {uiFolders.map((folder) => (
                              <FolderTab
                                 key={folder.id}
                                 folder={folder}
                                 count={uiFolderCounts[folder.id] || 0}
                                 isActive={activeUiFolderId === folder.id}
                                 underlineLayoutId={`${layoutIdPrefix}-ui-underline`} // Explicit unique ID
                                 onClick={() => onSelectUiFolder?.(folder.id)}
                                 orientation={orientation}
                                 showZeroCount={true}
                                 onUpdate={
                                    onUpdateUiFolder
                                       ? (title) => onUpdateUiFolder(folder.id, title)
                                       : undefined
                                 }
                                 onDelete={
                                    onDeleteUiFolder ? () => onDeleteUiFolder(folder.id) : undefined
                                 }
                              />
                           ))}

                           {/* Create UI Folder Button */}
                           {onCreateUiFolder && (
                              <div className="flex-shrink-0 ml-1">
                                 <FolderFormPopover
                                    mode="create"
                                    onSubmit={onCreateUiFolder}
                                    trigger={
                                       <Button
                                          isIconOnly
                                          variant="flat"
                                          size="sm"
                                          color="secondary"
                                          className="bg-transparent hover:bg-secondary/20 text-secondary"
                                       >
                                          <Plus size={20} />
                                       </Button>
                                    }
                                 />
                              </div>
                           )}
                        </motion.div>
                     </LayoutGroup>
                  )}

                  {/* Show Info Folders ONLY if Info tab is active */}
                  {activeRemoteTab === 'info' && (
                     <LayoutGroup id={`${layoutIdPrefix}-info-scope`}>
                        <motion.div
                           layout
                           className="flex items-center gap-2"
                           style={{ isolation: 'isolate', position: 'relative' }}
                        >
                           {infoFolders.map((folder) => (
                              <FolderTab
                                 key={folder.id}
                                 folder={folder}
                                 count={infoFolderCounts[folder.id] || 0}
                                 isActive={activeInfoFolderId === folder.id}
                                 underlineLayoutId={`${layoutIdPrefix}-info-underline`} // Explicit unique ID
                                 onClick={() => onSelectInfoFolder?.(folder.id)}
                                 orientation={orientation}
                                 showZeroCount={true}
                                 onUpdate={
                                    onUpdateInfoFolder
                                       ? (title) => onUpdateInfoFolder(folder.id, title)
                                       : undefined
                                 }
                                 onDelete={
                                    onDeleteInfoFolder
                                       ? () => onDeleteInfoFolder(folder.id)
                                       : undefined
                                 }
                              />
                           ))}

                           {/* Create Info Folder Button */}
                           {onCreateInfoFolder && (
                              <div className="flex-shrink-0 ml-1">
                                 <FolderFormPopover
                                    mode="create"
                                    onSubmit={onCreateInfoFolder}
                                    trigger={
                                       <Button
                                          isIconOnly
                                          variant="flat"
                                          size="sm"
                                          color="warning"
                                          className="bg-transparent hover:bg-warning/20 text-orange-700"
                                       >
                                          <Plus size={20} />
                                       </Button>
                                    }
                                 />
                              </div>
                           )}
                        </motion.div>
                     </LayoutGroup>
                  )}
               </div>
            )}

            {/* 2. Toggles (No Background) */}
            <div className="flex items-center gap-2 ml-4 pl-4 border-l border-default-200">
               {hasRemote && (
                  <>
                     <button
                        onClick={() => onToggleRemote?.('info')}
                        className={clsx(
                           'flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border border-transparent cursor-pointer',
                           activeRemoteTab === 'info'
                              ? 'bg-orange-100 text-orange-700 border-orange-200'
                              : 'text-default-500 hover:text-default-700 hover:bg-default-100'
                        )}
                     >
                        <span>Info</span>
                     </button>
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
                              ? 'bg-blue-100 text-blue-700 border-blue-200'
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
         </div>
      </div>
   );
};
