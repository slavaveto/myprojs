'use client';

import React, { useState } from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import {
   Trash2,
   Type,
   Bold,
   X,
   MoveRight,
   ArrowRight,
   Folder as FolderIcon,
   Check,
   Star,
} from 'lucide-react';
import { clsx } from 'clsx';
import { Task } from '../types';

export interface TaskContextMenuProps {
   children: React.ReactNode;
   task: Task | any;
   items?: {
      delete?: boolean;
      move?: boolean;
      makeGap?: boolean;
      makeGroup?: boolean;
      styles?: boolean;
      today?: boolean;
   };
   onDelete?: (id: string) => void;
   onUpdate?: (id: string, updates: any) => void;
   onAddGap?: () => void;
   onMove?: (taskId: string, projectId: string, folderId: string) => void;
   projectsStructure?: any[];
   isInsideGroup?: boolean;
   currentProjectId?: string; // Explicitly passed project context
}

// Group Colors Palette
const COLORS = [
   { name: 'Blue', value: '#3b82f6' },
   { name: 'Green', value: '#22c55e' },
   { name: 'Orange', value: '#f97316' },
   { name: 'Red', value: '#ef4444' },
   { name: 'Purple', value: '#a855f7' },
   { name: 'Cyan', value: '#06b6d4' },
   { name: 'Pink', value: '#ec4899' },
   { name: 'Gray', value: '#6b7280' },
];

interface TaskMenuItemsProps extends Omit<TaskContextMenuProps, 'children'> {
   closeMenu?: () => void;
}

export const TaskMenuItems = ({
   task,
   items = { delete: true },
   onDelete,
   onUpdate,
   onAddGap,
   onMove,
   projectsStructure = [],
   isInsideGroup = false,
   currentProjectId,
   closeMenu,
}: TaskMenuItemsProps) => {
   const isGroup = task.task_type === 'group';
   const currentGroupColor = task.group_color || '#3b82f6';
   const handleClose = () => closeMenu?.();

   return (
      <>
         {/* --- TODAY --- */}
         {items.today && !isGroup ? (
            <DropdownItem
               key="toggle-today"
               startContent={
                  <Star
                     size={16}
                     fill={task.is_today ? 'currentColor' : 'none'}
                     className={task.is_today ? 'text-warning' : 'text-default-500'}
                  />
               }
               onPress={() => {
                  onUpdate?.(task.id, { is_today: !task.is_today });
                  handleClose();
               }}
            >
               {task.is_today ? 'Remove from Today' : 'Add to Today'}
            </DropdownItem>
         ) : null}

         {/* --- TEXT STYLES --- */}
         {items.styles && !isGroup ? (
            <DropdownItem
               key="styles"
               isReadOnly
               className="cursor-default opacity-100 data-[hover=true]:bg-transparent p-1 w-fit min-w-0"
               textValue="Style Options"
            >
               <div className="flex flex-wrap gap-1">
                  <button
                     type="button"
                     onClick={(e) => {
                        e.stopPropagation();
                        const newStyle = task.title_text_style === 'bold' ? null : 'bold';
                        onUpdate?.(task.id, { title_text_style: newStyle });
                        handleClose();
                     }}
                     className={clsx(
                        'w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors',
                        task.title_text_style === 'bold' && 'bg-default-300 text-foreground'
                     )}
                     title="Bold"
                  >
                     <Bold size={16} />
                  </button>
                  <button
                     type="button"
                     onClick={(e) => {
                        e.stopPropagation();
                        const newStyle = task.title_text_style === 'red' ? null : 'red';
                        onUpdate?.(task.id, { title_text_style: newStyle });
                        handleClose();
                     }}
                     className={clsx(
                        'w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-danger',
                        task.title_text_style === 'red' && 'bg-danger/20'
                     )}
                     title="Red"
                  >
                     <Type size={16} />
                  </button>
                  <button
                     type="button"
                     onClick={(e) => {
                        e.stopPropagation();
                        const newStyle = task.title_text_style === 'red-bold' ? null : 'red-bold';
                        onUpdate?.(task.id, { title_text_style: newStyle });
                        handleClose();
                     }}
                     className={clsx(
                        'w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-danger font-bold',
                        task.title_text_style === 'red-bold' && 'bg-danger/20'
                     )}
                     title="Red Bold"
                  >
                     <Bold size={16} />
                  </button>
                  <button
                     type="button"
                     onClick={(e) => {
                        e.stopPropagation();
                        onUpdate?.(task.id, { title_text_style: null });
                        handleClose();
                     }}
                     className="w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-default-400"
                     title="Reset"
                  >
                     <X size={16} />
                  </button>
               </div>
            </DropdownItem>
         ) : null}

         {/* --- GROUP / GAP --- */}
         {items.makeGroup ? (
            isGroup ? (
               <DropdownItem
                  key="revert-task"
               
                  onPress={() => {
                     onUpdate?.(task.id, {
                        task_type: 'task',
                        group_color: null as any,
                     });
                     handleClose();
                  }}
               >
                  Revert To Task
               </DropdownItem>
            ) : !isInsideGroup ? (
               <DropdownItem
                  key="make-group"
                  onPress={() => {
                     onUpdate?.(task.id, {
                        task_type: 'group',
                        group_color: '#3b82f6',
                     });
                     handleClose();
                  }}
               >
                  Make As Group
               </DropdownItem>
            ) : null
         ) : null}

         {items.makeGroup && isGroup ? (
            <DropdownItem
               key="group-color"
               isReadOnly
               className="cursor-default opacity-100"
               textValue="Group Color"
            >
               <div className="flex flex-col gap-2 py-1">
                  <span className="text-tiny text-default-500 font-semibold">Group Color</span>
                  <div className="flex flex-wrap gap-1">
                     {COLORS.map((color) => (
                        <button
                           key={color.value}
                           type="button"
                           onClick={(e) => {
                              e.stopPropagation();
                              onUpdate?.(task.id, { group_color: color.value });
                              // don't close menu to allow trying colors
                           }}
                           className={clsx(
                              'w-5 h-5 rounded-full cursor-pointer transition-transform hover:scale-110 flex items-center justify-center outline-none ',
                              currentGroupColor.toLowerCase() === color.value.toLowerCase() &&
                                 'ring-0 ring-primary scale-110'
                           )}
                           style={{ backgroundColor: color.value }}
                           title={color.name}
                        >
                           {currentGroupColor.toLowerCase() === color.value.toLowerCase() && (
                              <Check size={12} className="text-white drop-shadow-sm" />
                           )}
                        </button>
                     ))}
                  </div>
               </div>
            </DropdownItem>
         ) : null}

         {items.makeGap ? (
            <DropdownItem
               key="make-gap"
               onPress={() => {
                  onAddGap?.();
                  handleClose();
               }}
            >
               Make Gap Below
            </DropdownItem>
         ) : null}

         {/* --- MOVE TO PROJECT --- */}
         {items.move && !isGroup && projectsStructure.length > 0 ? (
            <DropdownItem
               key="move-menu"
               isReadOnly
               className="p-0 opacity-100 data-[hover=true]:bg-transparent cursor-default overflow-visible"
               textValue="Move to Project"
            >
               <div className="relative group/move w-full">
                  <div className="flex items-center justify-between px-2 py-1.5 rounded-small hover:bg-default-100 cursor-default transition-colors w-full">
                     <div className="flex items-center gap-2">
                        {/* <MoveRight size={16} className="text-default-500" /> */}
                        <span>Move to...</span>
                     </div>
                     <ArrowRight size={14} className="text-default-400" />
                  </div>

                  {/* Project List */}
                  <div className="absolute right-[100%] top-[-4px] mr-1 w-[200px] hidden group-hover/move:flex flex-col bg-content1 rounded-medium shadow-small border-small border-default-200 p-1 z-50 overflow-visible">
                     {projectsStructure.map((project) => {
                        // Check passed context ID first, then fallback to task property (if exists)
                        const isCurrentProject = currentProjectId
                           ? String(project.id) === String(currentProjectId)
                           : String(project.id) === String(task.project_id);

                        return (
                           <div
                              key={project.id}
                              className={clsx(
                                 'relative group/project w-full',
                                 isCurrentProject && 'opacity-50 pointer-events-none'
                              )}
                           >
                              <div className="flex items-center justify-between px-2 py-1.5 rounded-small hover:bg-default-100 cursor-default transition-colors w-full">
                                 <div className="flex items-center gap-2">
                                    <div
                                       className="w-2 h-2 rounded-full"
                                       style={{ backgroundColor: project.color || '#3b82f6' }}
                                    />
                                    <span className="text-small truncate max-w-[140px]">
                                       {project.title}
                                    </span>
                                 </div>
                                 {project.folders &&
                                    project.folders.length > 0 &&
                                    !isCurrentProject && (
                                       <ArrowRight size={12} className="text-default-400" />
                                    )}
                              </div>

                              {/* Folder List */}
                              {project.folders &&
                                 project.folders.length > 0 &&
                                 !isCurrentProject && (
                                    <div className="absolute left-[100%] top-[-4px] ml-1 w-[180px] hidden group-hover/project:flex flex-col bg-content1 rounded-medium shadow-small border-small border-default-200 p-1 z-50">
                                       {project.folders.map((folder: any) => (
                                          <button
                                             key={folder.id}
                                             onClick={(e) => {
                                                e.stopPropagation();
                                                document.body.click(); // Close menus
                                                onMove?.(task.id, project.id, folder.id);
                                             }}
                                             className="flex items-center gap-2 px-2 py-1.5 rounded-small hover:bg-default-100 cursor-pointer transition-colors w-full text-left outline-none"
                                          >
                                             <FolderIcon size={14} className="text-default-400" />
                                             <span className="text-small truncate">
                                                {folder.title}
                                             </span>
                                          </button>
                                       ))}
                                    </div>
                                 )}
                           </div>
                        );
                     })}
                  </div>
               </div>
            </DropdownItem>
         ) : null}

         {/* --- DELETE --- */}
         {items.delete ? (
            <DropdownItem
               key="delete"
               className="text-danger"
               color="danger"
               startContent={<Trash2 size={16} />}
               onPress={() => {
                  onDelete?.(task.id);
                  handleClose();
               }}
            >
               {task.task_type === 'gap' ? 'Delete Gap' : isGroup ? 'Delete Group' : 'Delete Task'}
            </DropdownItem>
         ) : null}
      </>
   );
};

export const TaskContextMenu = (props: TaskContextMenuProps) => {
   const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null);

   const handleContextMenu = (e: React.MouseEvent) => {
      e.preventDefault();

      // Force close other menus (emulate click outside)
      // HeroUI listens for mousedown/pointerdown to close overlays
      if (typeof document !== 'undefined') {
         document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
         document.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
         document.body.click();
      }

      // Remove focus from input if any (prevents keyboard from popping up or cursor blinking)
      if (document.activeElement instanceof HTMLElement) {
         document.activeElement.blur();
      }
      e.stopPropagation();
      setMenuPos({ x: e.clientX, y: e.clientY });
   };

   return (
      <div onContextMenu={handleContextMenu} className="contents">
         {props.children}

         <Dropdown
            isOpen={!!menuPos}
            onOpenChange={(open) => {
               if (!open) setMenuPos(null);
            }}
            placement="bottom-start"
            triggerScaleOnOpen={false}
         >
            <DropdownTrigger>
               <div
                  style={{
                     position: 'fixed',
                     left: menuPos?.x ?? 0,
                     top: menuPos?.y ?? 0,
                     width: 0,
                     height: 0,
                     pointerEvents: 'none',
                     zIndex: 9999,
                  }}
               />
            </DropdownTrigger>
            <DropdownMenu aria-label="Task Actions" className="overflow-visible">
               {TaskMenuItems({ ...props, closeMenu: () => setMenuPos(null) })}
            </DropdownMenu>
         </Dropdown>
      </div>
   );
};
