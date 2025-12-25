'use client';

import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useAppLoader } from '@/app/AppLoader';
import { createLogger } from '@/utils/logger/Logger';
import { supabase } from '@/utils/supabase/supabaseClient';
import { Folder, Task, Project } from '@/app/types';
import { globalStorage } from '@/utils/storage';
import { toast } from 'react-hot-toast';
import {
   DndContext,
   DragEndEvent,
   DragOverlay,
   DragStartEvent,
   DropAnimation,
   KeyboardSensor,
   PointerSensor,
   closestCorners,
   defaultDropAnimationSideEffects,
   useDroppable,
   useSensor,
   useSensors,
} from '@dnd-kit/core';
import {
   SortableContext,
   arrayMove,
   sortableKeyboardCoordinates,
   verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button, Tab, Tabs, Chip } from '@heroui/react';
import { Plus, FolderPlus } from 'lucide-react';
import { TaskRow } from '@/app/components/TaskRow';
import { clsx } from 'clsx';

const logger = createLogger('ProjectScreen');

const DroppableTabTitle = ({ folder, count }: { folder: Folder; count: number }) => {
   const { setNodeRef, isOver } = useDroppable({
      id: `folder-${folder.id}`,
      data: { type: 'folder', folder }
   });

   return (
      <div
         ref={setNodeRef}
         className={clsx(
            'flex items-center gap-2 px-2 py-1 rounded transition-colors',
            isOver ? 'bg-primary-100 text-primary ring-2 ring-primary ring-inset' : ''
         )}
      >
         {folder.title}
         <Chip size="sm" variant="flat" className="h-5 min-w-5 px-1 text-[10px]">
            {count}
         </Chip>
      </div>
   );
};

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
}

export const ProjectScreen = ({ project, isActive, onReady }: ProjectScreenProps) => {
   const [folders, setFolders] = useState<Folder[]>([]);
   const [tasks, setTasks] = useState<Task[]>([]);
   const [selectedFolderId, setSelectedFolderId] = useState<string>('');
   const [isDataLoaded, setIsDataLoaded] = useState(false);
   const [activeId, setActiveId] = useState<string | null>(null);
   const { setLoading } = useAppLoader();
   
   const loadStartedRef = useRef(false);

   useEffect(() => {
       if (isDataLoaded || loadStartedRef.current) return;

       const load = async () => {
           loadStartedRef.current = true;
           
           if (isActive) {
               logger.start(`Loading active project: ${project.title}`);
           } else {
               logger.info(`Starting background load: ${project.title}`);
           }
           
           await loadData();
           
           if (isActive) {
               logger.success(`Active project loaded: ${project.title}`);
               // toast.success(`${project.title} loaded`, {
                  toast.success(`Данные загружены!`, {
                   id: 'project-loaded', 
                   position: 'bottom-center'
               });
           } else {
               logger.success(`Background project loaded: ${project.title}`);
           }
           
           onReady(); 
       };

       load();
   }, [isActive, project.id, isDataLoaded]); // Removed setLoading to avoid loops, it's stable

   const loadData = async () => {
      try {
         const projectId = project.id;
         
         const { data: foldersData, error: foldersError } = await supabase
            .from('folders')
            .select('*')
            .eq('project_id', projectId)
            .order('sort_order');

         if (foldersError) throw foldersError;
         setFolders(foldersData || []);

         if (foldersData && foldersData.length > 0) {
            const savedFolderId = globalStorage.getItem(`active_folder_${projectId}`);
            const folderExists = savedFolderId ? foldersData.find((f: any) => f.id === savedFolderId) : null;
            
            setSelectedFolderId(folderExists ? savedFolderId! : foldersData[0].id);
         }

         const { data: tasksData, error: tasksError } = await supabase
            .from('tasks')
            .select('*, folders!inner(project_id)')
            .eq('folders.project_id', projectId)
            .order('sort_order');

         if (tasksError) throw tasksError;
         
         const cleanTasks = (tasksData || []).map((t: any) => {
             const { folders, ...task } = t;
             return task as Task;
         });
         
         setTasks(cleanTasks);
         setIsDataLoaded(true);

      } catch (err) {
         logger.error(`Failed to load data for project ${project.title}`, err);
      }
   };

   // --- Actions ---
   const handleAddTask = async () => {
      if (!selectedFolderId) return;

      const currentFolderTasks = tasks.filter(t => t.folder_id === selectedFolderId);
      const newOrder = currentFolderTasks.length > 0 
         ? Math.max(...currentFolderTasks.map(t => t.sort_order)) + 1 
         : 0;

      const tempId = crypto.randomUUID();
      const newTask: Task = {
         id: tempId,
         folder_id: selectedFolderId,
         content: '',
         sort_order: newOrder,
         is_completed: false,
         created_at: new Date().toISOString(),
         updated_at: new Date().toISOString(),
         isNew: true
      };

      setTasks(prev => [newTask, ...prev]);

      try {
         const { data, error } = await supabase
            .from('tasks')
            .insert({
               folder_id: selectedFolderId,
               content: '',
               sort_order: newOrder
            })
            .select()
            .single();

         if (error) throw error;
         setTasks(prev => prev.map(t => t.id === tempId ? data : t));
      } catch (err) {
         logger.error('Failed to create task', err);
         setTasks(prev => prev.filter(t => t.id !== tempId));
      }
   };

   const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
      setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      const task = tasks.find(t => t.id === id);
      if (task?.isNew) return;

      try {
         const { error } = await supabase
            .from('tasks')
            .update(updates)
            .eq('id', id);
         if (error) throw error;
      } catch (err) {
         logger.error('Failed to update task', err);
      }
   };

   const handleDeleteTask = async (id: string) => {
      const oldTasks = [...tasks];
      setTasks(prev => prev.filter(t => t.id !== id));
      try {
         const { error } = await supabase
            .from('tasks')
            .delete()
            .eq('id', id);
         if (error) throw error;
      } catch (err) {
         logger.error('Failed to delete task', err);
         setTasks(oldTasks);
      }
   };

   const handleAddFolder = async () => {
       const title = prompt('Folder Name:');
       if (!title) return;

       const newOrder = folders.length > 0 
          ? Math.max(...folders.map(f => f.sort_order)) + 1 
          : 0;
       
       const tempId = crypto.randomUUID();
       const newFolder = {
           id: tempId,
           project_id: project.id,
           title,
           sort_order: newOrder,
           created_at: new Date().toISOString(),
           updated_at: new Date().toISOString(),
       };
       
       setFolders(prev => [...prev, newFolder]);
       
       try {
           const { data, error } = await supabase
            .from('folders')
            .insert({
                project_id: project.id,
                title,
                sort_order: newOrder
            })
            .select()
            .single();
            if (error) throw error;
            setFolders(prev => prev.map(f => f.id === tempId ? data : f));
            setSelectedFolderId(data.id);
       } catch (err) {
           logger.error('Failed to create folder', err);
           setFolders(prev => prev.filter(f => f.id !== tempId));
       }
   };

   const sensors = useSensors(
      useSensor(PointerSensor),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
   );

   const handleDragStart = (event: DragStartEvent) => {
      setActiveId(event.active.id as string);
   };

   const handleDragEnd = async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);
      if (!over) return;
      const activeTaskId = active.id as string;
      
      if (over.id.toString().startsWith('folder-')) {
         const targetFolderId = over.id.toString().replace('folder-', '');
         const task = tasks.find(t => t.id === activeTaskId);
         if (task && task.folder_id !== targetFolderId) {
            const updatedTask = { ...task, folder_id: targetFolderId };
            setTasks(prev => prev.map(t => t.id === activeTaskId ? updatedTask : t));
            try {
                await supabase.from('tasks').update({ folder_id: targetFolderId }).eq('id', activeTaskId);
            } catch(err) {
                logger.error('Failed to move task folder', err);
            }
         }
         return;
      }

      if (active.id !== over.id) {
         const currentFolderTasks = tasks.filter(t => t.folder_id === selectedFolderId);
         const oldIndex = currentFolderTasks.findIndex(t => t.id === active.id);
         const newIndex = currentFolderTasks.findIndex(t => t.id === over.id);

         if (oldIndex !== -1 && newIndex !== -1) {
             const newSorted = arrayMove(currentFolderTasks, oldIndex, newIndex);
             const updates = newSorted.map((t, index) => ({ id: t.id, sort_order: index }));
             
             setTasks(prev => {
                 const otherTasks = prev.filter(t => t.folder_id !== selectedFolderId);
                 const updatedCurrentTasks = newSorted.map((t, idx) => ({ ...t, sort_order: idx }));
                 return [...otherTasks, ...updatedCurrentTasks];
             });

             try {
                 await Promise.all(updates.map(u => 
                     supabase.from('tasks').update({ sort_order: u.sort_order }).eq('id', u.id)
                 ));
             } catch(err) {
                 logger.error('Failed to reorder tasks', err);
             }
         }
      }
   };

   const filteredTasks = useMemo(() => {
      return tasks
         .filter(t => t.folder_id === selectedFolderId)
         .sort((a, b) => (a.sort_order - b.sort_order));
   }, [tasks, selectedFolderId]);

   const getFolderTaskCount = (folderId: string) => {
       return tasks.filter(t => t.folder_id === folderId).length;
   };

   if (!isDataLoaded) {
       return null;
   }

   return (
      <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
         <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">{project.title}</h1>
            <Button 
                color="primary" 
                startContent={<FolderPlus size={18} />}
                variant="ghost"
                onPress={handleAddFolder}
            >
                New Folder
            </Button>
         </div>

         <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
         >
            <Tabs
               selectedKey={selectedFolderId}
               onSelectionChange={(key) => {
                   const newId = key as string;
                   setSelectedFolderId(newId);
                   globalStorage.setItem(`active_folder_${project.id}`, newId);
               }}
               variant="underlined"
               color="primary"
               classNames={{
                  tabList: "gap-6 w-full relative rounded-none p-0 ",
                  cursor: "w-full bg-primary",
                  tab: "max-w-fit px-0 h-12",
                  tabContent: "group-data-[selected=true]:text-primary"
               }}
            >
               {folders.map((folder) => (
                  <Tab
                     key={folder.id}
                     title={
                        <DroppableTabTitle 
                            folder={folder} 
                            count={getFolderTaskCount(folder.id)} 
                        />
                     }
                  />
               ))}
            </Tabs>

            <div className="mt-6 flex-grow flex flex-col min-h-0">
                {selectedFolderId ? (
                   <>
                      <div className="flex-grow overflow-y-auto pr-2 pb-10">
                         <SortableContext
                            items={filteredTasks.map(t => t.id)}
                            strategy={verticalListSortingStrategy}
                         >
                            <div className="flex flex-col gap-2">
                               {filteredTasks.map((task) => (
                                  <TaskRow
                                     key={task.id}
                                     task={task}
                                     onUpdate={handleUpdateTask}
                                     onDelete={handleDeleteTask}
                                  />
                               ))}
                               {filteredTasks.length === 0 && (
                                   <div className="text-center py-10 text-default-400">
                                       No tasks in this folder.
                                   </div>
                               )}
                            </div>
                         </SortableContext>
                      </div>
                   </>
                ) : (
                    <div className="text-center py-20 text-default-400">
                        Create a folder to start adding tasks.
                    </div>
                )}
            </div>

            <DragOverlay dropAnimation={dropAnimationConfig}>
               {activeId ? (
                  <TaskRow
                     task={tasks.find(t => t.id === activeId)!}
                     onUpdate={() => {}}
                     onDelete={() => {}}
                     isOverlay
                  />
               ) : null}
            </DragOverlay>
         </DndContext>
      </div>
   );
};
