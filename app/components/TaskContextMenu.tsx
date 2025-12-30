'use client';

import React, { useState } from 'react';
import { Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSection } from '@heroui/react';
import {
   Trash2,
   Type,
   Bold,
   X,
   MoveRight,
   ArrowRight,
   Folder as FolderIcon,
   Check,
   Star, ArrowDown, ArrowUp
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
   onInsertTask?: (position: 'above' | 'below') => void;
   onInsertNote?: (position: 'above' | 'below') => void;
   onMove?: (taskId: string, projectId: string, folderId: string) => void;
   projectsStructure?: any[];
   isInsideGroup?: boolean;
   currentProjectId?: string;
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

type MenuItemType = 
   | 'today' | 'styles' | 'separator' 
   | 'makeGroup' | 'makeNote' | 'revertToTask' | 'groupColor'
   | 'insertAbove' | 'insertBelow' | 'insertGap'
   | 'insertNoteAbove' | 'insertNoteBelow'
   | 'move' | 'delete';

interface TaskMenuItemsProps extends Omit<TaskContextMenuProps, 'children'> {
   closeMenu?: () => void;
}

export const TaskMenuItems = ({
   task,
   items = { delete: true },
   onDelete,
   onUpdate,
   onAddGap,
   onInsertTask,
   onInsertNote,
   onMove,
   projectsStructure = [],
   isInsideGroup = false,
   currentProjectId,
   closeMenu,
}: TaskMenuItemsProps) => {
   const isGroup = task.task_type === 'group';
   const isNote = task.task_type === 'note';
   const isGap = task.task_type === 'gap';
   const currentGroupColor = task.group_color || '#3b82f6';
   const handleClose = () => closeMenu?.();

   // --- CONFIGURATION ---
   const getMenuLayout = (): MenuItemType[] => {
      // 1. Gaps, Groups, Notes (Custom configs later)
      if (isGap) return [
         'insertAbove', 
            'insertBelow', 
            'separator', 
            'delete'];

      // TODO: Config for Group Header
      if (isGroup) return [
         'revertToTask', 
         'separator', 
         'groupColor', 
         'separator', 
         'insertBelow', 
         'separator', 
         'delete']; 

      // TODO: Config for Note
      if (isNote) return [
         'revertToTask', 
         'styles',
         'separator', 
         'insertNoteAbove',
          'insertNoteBelow',
         'separator', 
         'delete'];

      // 2. Regular Tasks (isGroup=false, isNote=false, isGap=false)
      if (isInsideGroup) {
         // Task Inside Group
         return [
            'today', 
            'styles', 
            'separator', 
            'insertAbove', 
            'insertBelow', 
            'separator', 
            'insertGap', 
            'separator', 
            'delete'
         ];
      } else {
         // Root Task
         return [
            'today', 
            'styles', 
            'separator', 
            'makeGroup', 
            'makeNote', 
            'separator', 
            'insertAbove', 
            'insertBelow', 
            'separator', 
            'insertGap', 
            'separator', 
            'move', 
            'separator', 
            'delete'
         ];
      }
   };

   const menuLayout = getMenuLayout();

   // --- RENDERERS ---
   const renderItem = (type: MenuItemType, index: number) => {
      switch (type) {
         case 'separator':
            // Using a divider item or just a visual separator
            // DropdownSection can be used but it wraps items. 
            // Simple Divider:
            return <DropdownItem key={`sep-${index}`} className="h-px bg-default-200 p-0 my-1 pointer-events-none" textValue="separator" />;
         
         case 'today':
            if (!items.today) return null;
            return (
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
            );

         case 'styles':
            if (!items.styles) return null;
            return (
                <DropdownItem
                   key="styles"
                   isReadOnly
                   className="cursor-default opacity-100 data-[hover=true]:bg-transparent p-1 w-fit min-w-0"
                   textValue="Style Options"
                >
                   <div className="flex flex-wrap gap-1">
                      <button type="button" onClick={(e) => { e.stopPropagation(); onUpdate?.(task.id, { title_text_style: task.title_text_style === 'bold' ? null : 'bold' }); handleClose(); }} className={clsx('w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors', task.title_text_style === 'bold' && 'bg-default-300 text-foreground')} title="Bold"><Bold size={16} /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); onUpdate?.(task.id, { title_text_style: task.title_text_style === 'red' ? null : 'red' }); handleClose(); }} className={clsx('w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-danger', task.title_text_style === 'red' && 'bg-danger/20')} title="Red"><Type size={16} /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); onUpdate?.(task.id, { title_text_style: task.title_text_style === 'red-bold' ? null : 'red-bold' }); handleClose(); }} className={clsx('w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-danger font-bold', task.title_text_style === 'red-bold' && 'bg-danger/20')} title="Red Bold"><Bold size={16} /></button>
                      <button type="button" onClick={(e) => { e.stopPropagation(); onUpdate?.(task.id, { title_text_style: null }); handleClose(); }} className="w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-default-400" title="Reset"><X size={16} /></button>
                   </div>
                </DropdownItem>
            );

         case 'groupColor':
            // Using items.makeGroup as permission flag, or allow always if in layout
            if (!items.makeGroup) return null;
            return (
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
            );

         case 'makeGroup':
            if (!items.makeGroup) return null;
            return (
               <DropdownItem key="make-group" onPress={() => { onUpdate?.(task.id, { task_type: 'group', group_color: '#3b82f6' }); handleClose(); }}>
                  Make As Group
               </DropdownItem>
            );

         case 'makeNote':
            // Check if items.makeGroup is allowed (usually controls all transforms) or we need specific prop
            if (!items.makeGroup) return null; 
            return (
               <DropdownItem key="make-note" onPress={() => { onUpdate?.(task.id, { task_type: 'note' }); handleClose(); }}>
                  Make As Note
               </DropdownItem>
            );

         case 'revertToTask':
             if (!items.makeGroup) return null;
             return (
                <DropdownItem key="revert-task" onPress={() => { onUpdate?.(task.id, { task_type: 'task', group_color: null }); handleClose(); }}>
                   Revert To Task
                </DropdownItem>
             );

         case 'insertAbove':
            if (!onInsertTask) return null;
            return (
               <DropdownItem key="insert-above" onPress={() => { onInsertTask('above'); handleClose(); }} endContent={<ArrowUp size={14} className="text-default-400" />}>
                  Insert Task Above
               </DropdownItem>
            );

         case 'insertBelow':
            if (!onInsertTask) return null;
            return (
               <DropdownItem key="insert-below" onPress={() => { onInsertTask('below'); handleClose(); }} endContent={<ArrowDown size={14} className="text-default-400" />}>
                  Insert Task Below
               </DropdownItem>
            );

         case 'insertNoteAbove':
            if (!onInsertNote) return null;
            return (
               <DropdownItem key="insert-note-above" onPress={() => { onInsertNote('above'); handleClose(); }} endContent={<ArrowUp size={14} className="text-default-400" />}>
                  Insert Note Above
               </DropdownItem>
            );

         case 'insertNoteBelow':
            if (!onInsertNote) return null;
            return (
               <DropdownItem key="insert-note-below" onPress={() => { onInsertNote('below'); handleClose(); }} endContent={<ArrowDown size={14} className="text-default-400" />}>
                  Insert Note Below
               </DropdownItem>
            );

         case 'insertGap':
            if (!items.makeGap || !onAddGap) return null;
            return (
               <DropdownItem key="make-gap" onPress={() => { onAddGap(); handleClose(); }} endContent={<ArrowDown size={14} className="text-default-400" />}>
                  Insert Gap Below
               </DropdownItem>
            );

         case 'move':
            if (!items.move || projectsStructure.length === 0) return null;
            return (
                <DropdownItem
                   key="move-menu"
                   isReadOnly
                   className="p-0 opacity-100 data-[hover=true]:bg-transparent cursor-default overflow-visible"
                   textValue="Move to Project"
                >
                   <div className="relative group/move w-full">
                      <div className="flex items-center justify-between px-2 py-1.5 rounded-small hover:bg-default-100 cursor-default transition-colors w-full">
                         <div className="flex items-center gap-2"><span>Move to...</span></div>
                         <ArrowRight size={14} className="text-default-400" />
                      </div>
                      <div className="absolute right-[100%] top-[-4px] mr-1 w-[200px] hidden group-hover/move:flex flex-col bg-content1 rounded-medium shadow-small border-small border-default-200 p-1 z-50 overflow-visible">
                         {projectsStructure.map((project) => {
                            const isCurrentProject = currentProjectId ? String(project.id) === String(currentProjectId) : String(project.id) === String(task.project_id);
                            return (
                               <div key={project.id} className={clsx('relative group/project w-full', isCurrentProject && 'opacity-50 pointer-events-none')}>
                                  <div className="flex items-center justify-between px-2 py-1.5 rounded-small hover:bg-default-100 cursor-default transition-colors w-full">
                                     <div className="flex items-center gap-2">
                                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: project.color || '#3b82f6' }} />
                                        <span className="text-small truncate max-w-[140px]">{project.title}</span>
                                     </div>
                                     {project.folders && project.folders.length > 0 && !isCurrentProject && (<ArrowRight size={12} className="text-default-400" />)}
                                  </div>
                                  {project.folders && project.folders.length > 0 && !isCurrentProject && (
                                     <div className="absolute left-[100%] top-[-4px] ml-1 w-[180px] hidden group-hover/project:flex flex-col bg-content1 rounded-medium shadow-small border-small border-default-200 p-1 z-50">
                                        {project.folders.map((folder: any) => (
                                           <button key={folder.id} onClick={(e) => { e.stopPropagation(); document.body.click(); onMove?.(task.id, project.id, folder.id); }} className="flex items-center gap-2 px-2 py-1.5 rounded-small hover:bg-default-100 cursor-pointer transition-colors w-full text-left outline-none">
                                              <FolderIcon size={14} className="text-default-400" />
                                              <span className="text-small truncate">{folder.title}</span>
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
            );

         case 'delete':
            if (!items.delete) return null;
            return (
               <DropdownItem key="delete" className="text-danger" color="danger" startContent={<Trash2 size={16} />} onPress={() => { onDelete?.(task.id); handleClose(); }}>
                  {task.task_type === 'gap' ? 'Delete Gap' : isGroup ? 'Delete Group' : 'Delete Task'}
               </DropdownItem>
            );

         default:
            return null;
      }
   };

   return (
      <>
         {menuLayout.map((item, index) => renderItem(item, index))}
      </>
   );
};

export const TaskContextMenu = (props: TaskContextMenuProps) => {
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
      e.stopPropagation();
      setMenuPos({ x: e.clientX, y: e.clientY });
   };

   return (
      <div onContextMenu={handleContextMenu} className="contents">
         {props.children}
         <Dropdown isOpen={!!menuPos} onOpenChange={(open) => { if (!open) setMenuPos(null); }} placement="bottom-start" triggerScaleOnOpen={false}>
            <DropdownTrigger>
               <div style={{ position: 'fixed', left: menuPos?.x ?? 0, top: menuPos?.y ?? 0, width: 0, height: 0, pointerEvents: 'none', zIndex: 9999 }} />
            </DropdownTrigger>
            <DropdownMenu aria-label="Task Actions" className="overflow-visible">
               {TaskMenuItems({ ...props, closeMenu: () => setMenuPos(null) })}
            </DropdownMenu>
         </Dropdown>
      </div>
   );
};
