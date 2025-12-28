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

import { TaskRow } from '@/app/TaskRow';
import { FolderTabs, FolderTab } from '@/app/components/FolderTabs';
import { TaskList } from '@/app/components/TaskList';
import { ActionStatus } from '@/utils/supabase/useAsyncAction';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { EditProjectPopover } from '@/app/components/EditProject';
import { useProjectData } from '@/app/components/hooks/useProjectData';
import { useProjectDnD } from '@/app/components/hooks/useProjectDnD';
import { GlobalSearch, NavigationTarget } from '@/app/components/GlobalSearch';
import FlowPage from '@/app/docs/page'; // Reuse our existing FlowPage component

import { Layout, CheckSquare } from 'lucide-react'; // Add icons for switch

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
    onNavigate?: (target: NavigationTarget) => void;
}

export const ProjectScreen = (props: ProjectScreenProps) => {
   const { project, onNavigate } = props;
   
   // View Mode State: 'tasks' | 'docs'
   const [viewMode, setViewMode] = React.useState<'tasks' | 'docs'>('tasks');
   
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
         <div className="flex-grow w-full max-w-5xl mx-auto flex flex-col px-[50px] py-6 min-h-0">
             <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-5 min-h-[40px] gap-4">
            <div className="flex items-center gap-3 justify-self-start">
                <div 
                    className="w-5 h-5 rounded-full flex-shrink-0 shadow-sm border border-white/10" 
                    style={{ backgroundColor: project.color || '#3b82f6' }}
                />
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

                {/* View Switcher */}
                <Button
                    size="sm"
                    variant="flat"
                    color="primary"
                    startContent={viewMode === 'tasks' ? <Layout size={16} /> : <CheckSquare size={16} />}
                    onPress={() => setViewMode(prev => prev === 'tasks' ? 'docs' : 'tasks')}
                >
                    {viewMode === 'tasks' ? 'Docs' : 'Tasks'}
                </Button>

                
            </div>
         </div>

         {viewMode === 'docs' ? (
             <div className="flex-grow w-full h-full overflow-hidden bg-white rounded-xl border border-default-200 mt-2">
                 <FlowPage projectLocalPath={project.local_path} />
             </div>
         ) : (
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

                <div className="mt-6 flex-grow flex flex-col min-h-0 overflow-y-auto overflow-x-hidden">
                    {selectedFolderId ? (
                       <TaskList  
                            key={selectedFolderId}
                            tasks={filteredTasks}
                            onUpdateTask={handleUpdateTask}
                            onDeleteTask={handleDeleteTask}
                            isEmpty={filteredTasks.length === 0}
                            highlightedTaskId={highlightedTaskId}
                            onAddGap={handleAddGap} 
                            projectColor={project.color} 
                            projectsStructure={projectsStructure}
                            onMoveTask={handleMoveTask}
                            currentProjectId={project.id}
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
                           <FolderTab 
                              folder={folders.find(f => `folder-${f.id}` === activeId)!}
                              count={getFolderTaskCount(activeId.replace('folder-', ''))}
                              isActive={selectedFolderId === activeId.replace('folder-', '')}
                              isDragging={true}
                              layoutIdPrefix="overlay" 
                              onClick={() => {}}
                           />
                       ) : (
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
         )}
         </div>
      </div>
   );
};
