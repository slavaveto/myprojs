'use client';

import React from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { Project } from '@/app/types';
import { globalStorage } from '@/utils/storage';
import { clsx } from 'clsx';
import { EllipsisVertical } from 'lucide-react';
import { Button } from '@heroui/react';

import {
   DndContext,
   DragOverlay,
   DropAnimation,
   defaultDropAnimationSideEffects,
} from '@dnd-kit/core';

import { TaskRow } from '@/app/components/TaskRow';
import { FolderTabs, FolderTab } from '@/app/components/FolderTabs';
import { TaskList } from '@/app/components/TaskList';
import { ActionStatus } from '@/utils/supabase/useAsyncAction';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { EditProjectPopover } from '@/app/components/EditProject';
import { useProjectData } from '@/app/components/hooks/useProjectData';
import { useProjectDnD } from '@/app/components/hooks/useProjectDnD';

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
    onUpdateProject: (updates: { title?: string; color?: string }) => void;
    onDeleteProject: () => void;
}

export const ProjectScreen = (props: ProjectScreenProps) => {
   const { project } = props;
   
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
       quickSaveStatus // Exported from hook
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
   
   return (
      <div 
          className={clsx(
            "h-full w-full overflow-hidden flex flex-col",
            activeId ? "cursor-grabbing *:[cursor:grabbing]" : ""
          )}
          onDoubleClick={handleDoubleClick}
      >
         <div className="flex-grow w-full max-w-5xl mx-auto flex flex-col px-[50px] py-6">
             <div className="flex justify-between items-center mb-4 min-h-[40px]">
            <div className="flex items-center gap-1">
                <h1 className="text-2xl font-bold">{project.title}</h1>
                <EditProjectPopover 
                    initialTitle={project.title}
                    initialColor={project.color}
                    onUpdate={handleEditProject}
                    onDelete={handleRemoveProject}
                >
                    <Button isIconOnly size="sm" variant="light" className="text-default-400 hover:text-default-600">
                        <EllipsisVertical size={18} />
                    </Button>
                </EditProjectPopover>
            </div>
            
            <div className="flex items-center gap-2">
                <StatusBadge 
                    status={displayStatus}
                    loadingText="Saving..."
                    successText="Saved"
                    errorMessage={saveError?.message}
                />
            </div>
         </div>

         <DndContext
            sensors={sensors}
            collisionDetection={customCollisionDetection}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
         >
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

            <div className="mt-6 flex-grow flex flex-col min-h-0">
                {selectedFolderId ? (
                   <TaskList 
                        key={selectedFolderId}
                        tasks={filteredTasks}
                        onUpdateTask={handleUpdateTask}
                        onDeleteTask={handleDeleteTask}
                        isEmpty={filteredTasks.length === 0}
                        highlightedTaskId={highlightedTaskId}
                        onAddGap={handleAddGap} // Pass down
                   />
                ) : (
                    <div className="text-center py-20 text-default-400">
                        Create a folder to start adding tasks.
                    </div>
                )}
            </div>

            <DragOverlay dropAnimation={dropAnimationConfig}>
               {activeId ? (
                   activeId.startsWith('folder-') ? (
                       // Dragging a folder - Use visual component
                       <FolderTab 
                          folder={folders.find(f => `folder-${f.id}` === activeId)!}
                          count={getFolderTaskCount(activeId.replace('folder-', ''))}
                          isActive={selectedFolderId === activeId.replace('folder-', '')}
                          isDragging={true}
                          layoutIdPrefix="overlay" 
                          onClick={() => {}}
                       />
                   ) : (
                       // Dragging a task
                      <TaskRow
                         task={tasks.find(t => t.id === activeId)!}
                         onUpdate={() => {}}
                         onDelete={() => {}}
                         isOverlay
                      />
                   )
               ) : null}
            </DragOverlay>
         </DndContext>
         </div>
      </div>
   );
};
