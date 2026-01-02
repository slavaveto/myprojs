'use client';

import React from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { Project } from '@/app/types';
import { globalStorage } from '@/utils/storage';
import { clsx } from 'clsx';
import { EllipsisVertical } from 'lucide-react';
import { Button, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import {
   DndContext,
   DragOverlay,
   DropAnimation,
   defaultDropAnimationSideEffects,
} from '@dnd-kit/core';

import { TaskRow } from '@/app/TaskRow';
import { FolderTabs, FolderTab } from '@/app/components/FolderTabs';
import { TaskList } from '@/app/components/TaskList';
import { ActionStatus } from '@/utils/supabase/useAsyncAction';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { EditProjectPopover } from '@/app/components/EditProject';
import { useProjectData } from '@/app/components/hooks/useProjectData';
import { useProjectDnD } from '@/app/components/hooks/useProjectDnD';
import { GlobalSearch, NavigationTarget } from '@/app/components/GlobalSearch';

import { RichTextProvider } from '@/app/components/RichTextProvider';
import { NoteEditor } from '@/app/components/NoteEditor';
import { UiEditor } from '@/app/components/remote/UiEditor'; // Import UI Editor
import { UiRow } from '@/app/components/remote/UiRow';

const logger = createLogger('ProjectScreen');

const dropAnimationConfig: DropAnimation = {
   sideEffects: defaultDropAnimationSideEffects({
      styles: {
         active: { opacity: '0.4' },
      },
   }),
};

interface ProjectScreenProps {
    project: Project;
    isActive: boolean;
    onReady: () => void;
    globalStatus?: ActionStatus;
    canLoad?: boolean;
    onUpdateProject: (updates: { title?: string; proj_color?: string; is_highlighted?: boolean; hasUi?: boolean; hasDocs?: boolean }) => void;
    onDeleteProject: () => void;
    onNavigate?: (target: NavigationTarget) => void;
    hasUiSatellite?: boolean;
    hasDocsSatellite?: boolean;
    hideHeader?: boolean;
}

export const ProjectScreen = (props: ProjectScreenProps) => {
   const { project, onNavigate, hasUiSatellite, hasDocsSatellite, hideHeader } = props;
   
   // 1. Data Management Hook
   const {
       folders,
       tasks,
       setTasks,
       setFolders,
       selectedFolderId,
       setSelectedFolderId,
       displayStatus, // Use displayStatus calculated in hook
       saveError,
       executeSave,
       executeQuickSave,
       handleAddTask,
       handleUpdateTask,
       handleDeleteTask,
       handleAddFolder,
       handleUpdateFolder,
       handleDeleteFolder,
       handleMoveFolder,
       handleEditProject,
       handleRemoveProject,
       getFolderTaskCount,
       highlightedTaskId,
       handleAddGap,
       quickSaveStatus, // Exported from hook
       projectsStructure,
       handleMoveTask
   } = useProjectData(props);

   // 2. Drag and Drop Hook
   const {
       activeId,
       hoveredFolderId,
       sensors,
       customCollisionDetection,
       handleDragStart,
       handleDragOver,
       handleDragEnd,
       filteredTasks
   } = useProjectDnD({
       project,
       tasks,
       setTasks,
       folders,
       selectedFolderId,
       setSelectedFolderId,
       executeSave: executeQuickSave // Use quick save for DnD
   });

   const [bgMenuPos, setBgMenuPos] = React.useState<{ x: number; y: number } | null>(null);
   const [selectedTaskId, setSelectedTaskId] = React.useState<string | null>(null);
   const selectedTask = React.useMemo(() => tasks.find(t => t.id === selectedTaskId), [tasks, selectedTaskId]);

   const handleBackgroundContextMenu = (e: React.MouseEvent) => {
       e.preventDefault();
       if ((e.target as HTMLElement).closest('[data-task-row], button, input, a, [role="button"]')) {
           return;
       }
       
       // Force close other menus (like task menu)
       document.body.click();
       
       const x = e.clientX;
       const y = e.clientY;

       // Delay opening to allow other menus (and this one) to close properly first
       setTimeout(() => {
           setBgMenuPos({ x, y });
       }, 10);
   };

   const handleDoubleClick = (e: React.MouseEvent<HTMLDivElement>) => {
       // Ignore if clicked on interactive elements (buttons, inputs)
       if ((e.target as HTMLElement).closest('button, input, [role="button"], [data-task-row]')) return;

       // Find all rendered task rows within this component
       const container = e.currentTarget;
       const taskElements = Array.from(container.querySelectorAll('[data-task-row]'));
       
       const clickY = e.clientY;
       let insertIndex = taskElements.length;
       
       for (let i = 0; i < taskElements.length; i++) {
           const rect = taskElements[i].getBoundingClientRect();
           const centerY = rect.top + rect.height / 2;
           
           if (clickY < centerY) {
               insertIndex = i;
               break;
           }
       }
       
       handleAddTask(insertIndex);
   };

   // Use displayStatus calculated in hook or locally if needed. 
   // Actually displayStatus is already returned from useProjectData correctly now?
   // Wait, I see I removed it from destructuring in my previous failed tool call?
   // Let's check what I have in destructuring.
   // I have displayStatus in destructuring in line 58.
   // So I should NOT redeclare it here.
   
   // Removing the redeclaration:
   
   const isDocsLayout = project.proj_type === 'docs';
   const isUiProject = project.proj_type === 'ui';

   return (
    <RichTextProvider>
      <div 
          className={clsx(
            "h-full w-full overflow-hidden flex flex-col",
            activeId ? "cursor-grabbing *:[cursor:grabbing]" : ""
          )}
          onClick={(e) => {
              const target = e.target as HTMLElement;
              // Reset selection if clicking outside of a task and outside of the right details panel
              if (!target.closest('[data-task-row]') && !target.closest('.right-panel')) {
                  setSelectedTaskId(null);
              }
          }}
      >
         {/* HEADER SECTION (Full Width) */}
         {!hideHeader && (
             <div className="flex-none px-6 py-4 border-b border-default-200 bg-background z-10 flex flex-col gap-4">
                 {/* Title Row */}
                 <div className="grid grid-cols-[1fr_auto_1fr] items-center min-h-[40px] gap-4">
                    <div className="flex items-center gap-2 justify-self-start pl-1">
                        <div 
                            className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm border border-white/10" 
                            style={{ backgroundColor: project.proj_color || '#3b82f6' }}
                        />
                        <h1 className="text-2xl font-bold truncate">{project.title}</h1>
                        <EditProjectPopover  
                            initialTitle={project.title}
                            initialColor={project.proj_color}
                            initialIsHighlighted={project.is_highlighted || false}
                            onUpdate={handleEditProject}
                            onDelete={handleRemoveProject}
                            isSatellite={project.proj_type === 'ui' || project.proj_type === 'docs'}
                            hasUiSatellite={hasUiSatellite}
                            hasDocsSatellite={hasDocsSatellite}
                            isPersonal={project.proj_type === 'personal'}
                        >
                            <Button isIconOnly size="sm" variant="light" className="text-default-400 hover:text-default-600">
                                <EllipsisVertical size={18} />
                            </Button>
                        </EditProjectPopover>
                    </div>
                    
                    <div className="w-full max-w-[240px] justify-self-center">
                        {onNavigate && (
                            <GlobalSearch 
                                onNavigate={onNavigate} 
                                currentProjectId={project.id}
                                currentFolderId={selectedFolderId}
                            />
                        )}
                    </div>

                    <div className="flex items-center gap-2 justify-self-end">
                        <StatusBadge 
                            status={displayStatus}
                            loadingText="Saving..."
                            successText="Saved"
                            errorMessage={saveError?.message}
                        />
                    </div>
                 </div>
            </div>
         )}

        {/* DND CONTEXT WRAPPER */}
         <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
         >
             {/* SPLIT VIEW CONTENT (Main Container) */}
             <div className="flex flex-grow min-h-0 overflow-hidden">
                {isDocsLayout ? (
                    // --- VERTICAL LAYOUT (Docs) ---
                    <>
                        <div className="w-[240px] flex-shrink-0 border-r border-default-200 bg-default-50 flex flex-col min-h-0">
                           <div className="flex-grow p-4 overflow-y-auto">
                                <FolderTabs 
                                    folders={folders}
                                    selectedFolderId={selectedFolderId}
                                    onSelect={(id) => {
                                        setSelectedFolderId(id);
                                        globalStorage.setItem(`active_folder_${project.id}`, id);
                                    }}
                                    onAddFolder={handleAddFolder}
                                    onUpdateFolder={handleUpdateFolder}
                                    onDeleteFolder={handleDeleteFolder}
                                    onMoveFolder={handleMoveFolder}
                                    getTaskCount={getFolderTaskCount}
                                    projectId={project.id}
                                    hoveredFolderId={hoveredFolderId}
                                    orientation="vertical"
                                />
                           </div>
                        </div>

                        <div 
                            className="flex-grow flex flex-col min-h-0 overflow-y-auto overflow-x-hidden bg-background"
                            onDoubleClick={handleDoubleClick}
                            onContextMenu={handleBackgroundContextMenu}
                        >
                             <div className="flex-grow px-6 py-4 pt-2">
                                {selectedFolderId ? (
                                   <TaskList  
                                        key={selectedFolderId}
                                        tasks={filteredTasks}
                                        onUpdateTask={handleUpdateTask}
                                        onDeleteTask={handleDeleteTask}
                                        isEmpty={filteredTasks.length === 0}
                                        highlightedTaskId={highlightedTaskId}
                                        onAddGap={handleAddGap} 
                                        onInsertTask={handleAddTask} 
                                        onInsertNote={(index: number) => handleAddTask(index, 'note')}
                                        projectColor={project.proj_color} 
                                        projectsStructure={projectsStructure}
                                        onMoveTask={handleMoveTask}
                                        currentProjectId={project.id}
                                        onSelectTask={setSelectedTaskId}
                                        selectedTaskId={selectedTaskId}
                                   />
                                ) : (
                                    <div className="text-center py-20 text-default-400">
                                        Select a folder to view tasks.
                                    </div>
                                )}
                             </div>
                        </div>
                    </>
                ) : (
                    // --- HORIZONTAL LAYOUT (Standard) ---
                    <div className="flex-grow flex flex-col min-h-0">
                        {/* Folder Tabs Row */}
                        <div className="px-6 py-2  bg-background/50 flex-none z-10">
                             <FolderTabs 
                                folders={folders}
                                selectedFolderId={selectedFolderId}
                                onSelect={(id) => {
                                    setSelectedFolderId(id);
                                    globalStorage.setItem(`active_folder_${project.id}`, id);
                                }}
                                onAddFolder={handleAddFolder}
                                onUpdateFolder={handleUpdateFolder}
                                onDeleteFolder={handleDeleteFolder}
                                onMoveFolder={handleMoveFolder}
                                getTaskCount={getFolderTaskCount}
                                projectId={project.id}
                                hoveredFolderId={hoveredFolderId}
                            />
                        </div>

                        {/* Task List Scrollable Area */}
                        <div 
                            className="flex-grow flex flex-col min-h-0 overflow-y-auto overflow-x-hidden"
                            onDoubleClick={handleDoubleClick}
                            onContextMenu={handleBackgroundContextMenu}
                        >
                             <div className="flex-grow px-6 py-4 pt-2">
                                {selectedFolderId ? (
                                   <TaskList  
                                        key={selectedFolderId}
                                        tasks={filteredTasks}
                                        onUpdateTask={handleUpdateTask}
                                        onDeleteTask={handleDeleteTask}
                                        isEmpty={filteredTasks.length === 0}
                                        highlightedTaskId={highlightedTaskId}
                                        onAddGap={handleAddGap} 
                                        onInsertTask={handleAddTask} 
                                        onInsertNote={(index: number) => handleAddTask(index, 'note')}
                                        projectColor={project.proj_color} 
                                        projectsStructure={projectsStructure}
                                        onMoveTask={handleMoveTask}
                                        currentProjectId={project.id}
                                        onSelectTask={setSelectedTaskId}
                                        selectedTaskId={selectedTaskId}
                                        isUiProject={isUiProject}
                                   />
                                ) : (
                                    <div className="text-center py-20 text-default-400">
                                        {isUiProject ? 'Create a screen (folder) to start adding elements.' : 'Create a folder to start adding tasks.'}
                                    </div>
                                )}
                             </div>
                        </div>
                    </div>
                )}

                {/* RIGHT COLUMN: Task Details */}
                <div className="w-[500px] flex-shrink-0 border-l border-default-200 bg-content2/50 p-6 overflow-y-auto transition-all h-full right-panel">
                    {selectedTask ? (
                         isUiProject ? (
                             <UiEditor 
                                task={selectedTask}
                                onUpdate={handleUpdateTask}
                             />
                         ) : (
                             <div className="flex flex-col gap-6">
                                 <h2 className="text-xl font-bold break-words leading-tight">
                                    {selectedTask.content.replace(/<[^>]*>/g, '')}
                                 </h2>
                                 
                                 <div className="flex flex-col gap-2 flex-grow min-h-0">
                                    <label className="text-xs font-semibold text-default-400 uppercase tracking-wider">
                                        Notes
                                    </label>
                                    <div className="flex-grow min-h-[200px] bg-background rounded-lg border border-default-200 shadow-sm p-4 overflow-y-auto cursor-text"
                                         onClick={(e) => {
                                             // Focus editor container if clicked outside
                                             const editorDiv = e.currentTarget.querySelector('.ProseMirror') as HTMLElement;
                                             if (editorDiv) editorDiv.focus();
                                         }}
                                    >
                                         <NoteEditor 
                                            id={`task-notes-${selectedTask.id}`}
                                            value={selectedTask.task_notes || ''}
                                            onSave={(val) => handleUpdateTask(selectedTask.id, { task_notes: val })}
                                            placeholder="Add notes..."
                                            className="min-h-[180px]"
                                         />
                                    </div>
                                 </div>
                             </div>
                         )
                     ) : (
                         <div className="h-full flex items-center justify-center text-default-400">
                             Select an item to view details
                         </div>
                     )}
                </div>
             </div>

            {/* Background Context Menu */}
            <Dropdown 
                isOpen={!!bgMenuPos} 
                onOpenChange={(open) => { if (!open) setBgMenuPos(null); }}
                placement="bottom-start"
                triggerScaleOnOpen={false}
            >
                <DropdownTrigger>
                    <div style={{ position: 'fixed', left: bgMenuPos?.x ?? 0, top: bgMenuPos?.y ?? 0, width: 0, height: 0, pointerEvents: 'none' }} />
                </DropdownTrigger>
                <DropdownMenu aria-label="Background Actions">
                    <DropdownItem key="create-task" onPress={() => handleAddTask()}>
                        Create Task
                    </DropdownItem>
                    <DropdownItem key="create-note" onPress={() => handleAddTask(undefined, 'note')}>
                        Create Note
                    </DropdownItem>
                </DropdownMenu>
            </Dropdown>

            <DragOverlay dropAnimation={dropAnimationConfig}>
               {activeId ? (
                   activeId.startsWith('folder-') ? (
                       <FolderTab 
                          folder={folders.find(f => `folder-${f.id}` === activeId)!}
                          count={getFolderTaskCount(activeId.replace('folder-', ''))}
                          isActive={selectedFolderId === activeId.replace('folder-', '')}
                          isDragging={true}
                          layoutIdPrefix="overlay" 
                          onClick={() => {}}
                       />
                   ) : (
                      isUiProject ? (
                          <UiRow
                             task={tasks.find(t => t.id === activeId)!}
                             onUpdate={() => {}}
                             onDelete={() => {}}
                             isOverlay
                          />
                      ) : (
                          <TaskRow
                             task={tasks.find(t => t.id === activeId)!}
                             onUpdate={() => {}}
                             onDelete={() => {}}
                             isOverlay
                          />
                      )
                   )
               ) : null}
            </DragOverlay>
         </DndContext>
      </div>
    </RichTextProvider>
   );
};
