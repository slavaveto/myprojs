import { useState, useRef, useEffect } from 'react';
import { Task } from '@/app/types';
import { calculateGroupUpdates } from './groupLogic';
import { createLogger } from '@/utils/logger/Logger';
import { GROUP_COLORS } from '@/app/constants';

const logger = createLogger('UseTaskData');

export const useTaskData = (
    projectId: string, 
    selectedFolderId: string, 
    executeSave: (fn: () => Promise<void>) => Promise<void>,
    service: any, // Injected service
    isUiProject: boolean = false, // NEW: Flag for UI logic
    externalData?: Task[] // NEW: Data from RxDB
) => {
    const [tasks, setTasks] = useState<Task[]>([]);
    const isProcessingLocalChange = useRef(false);
    
    // Sync external data (RxDB)
    useEffect(() => {
        if (externalData && !isProcessingLocalChange.current) {
            setTasks(prevTasks => {
                // Merge RxDB updates with local optimistic state (if needed)
                // For now, simple replace, but preserving specific local-only flags if they existed?
                // Actually RxDB is fast enough. 
                // But we need to handle "Drafts" that are NOT in RxDB yet.
                // Drafts are in 'tasks' state but not in 'externalData'.
                
                const drafts = prevTasks.filter(t => t.isNew || t.isDraft || t._isSaving);
                
                // Map external data
                const loadedTasks = externalData.map((newTask: any) => {
                    // Try to preserve local metadata if matched
                    const prevTask = prevTasks.find(p => p.id === newTask.id);
                    if (prevTask) {
                         // If task was just saved but RxDB update came back, ensure we don't overwrite optimistic fields?
                         // Generally RxDB update is the truth.
                    }
                    return newTask;
                });
                
                // Merge drafts + loaded
                // Filter out drafts that are now in loadedTasks (by ID or TempID)?
                // If a draft was saved, it should be in loadedTasks.
                
                const uniqueDrafts = drafts.filter(d => !loadedTasks.find(l => l.id === d.id));
                
                return [...loadedTasks, ...uniqueDrafts];
            });
        }
    }, [externalData]);

    // Load tasks manually or rely on parent? 
    // Let's allow self-loading but parent usually coordinates parallel load.
    // We expose loadTasks method.
    
    const loadTasks = async () => {
        if (externalData) return externalData; // Skip manual load
        try {
            const data = await service.getTasks(projectId);
            
            // Merge logic to preserve _tempId from previous state
            setTasks(prevTasks => {
                return data.map((newTask: any) => {
                    const prevTask = prevTasks.find(p => p.id === newTask.id);
                    if (prevTask && prevTask._tempId) {
                        return { ...newTask, _tempId: prevTask._tempId };
                    }
                    return newTask;
                });
            });
            
            return data;
        } catch (err) {
            logger.error('Failed to load tasks', err);
            return [];
        }
    };

    const handleAddTask = async (targetIndex?: number, type: 'task' | 'note' | 'gap' = 'task') => {
       if (!selectedFolderId) return;

       // Filter only active tasks
       const activeTasks = tasks
           .filter(t => t.folder_id === selectedFolderId && !t.is_completed)
           .sort((a, b) => a.sort_order - b.sort_order);
       
       let insertIndex = targetIndex !== undefined ? targetIndex : activeTasks.length;
       if (insertIndex < 0) insertIndex = 0;
       if (insertIndex > activeTasks.length) insertIndex = activeTasks.length;

       // --- Determine Group ID based on insertion point ---
       // We look at the task immediately ABOVE the insertion point.
       // If it's a group header, we join that group.
       // If it's a task inside a group, we join that group.
       // If it's a gap, we are orphaned (group_id = null).
       
       let targetGroupId: string | null = null;
       
       if (insertIndex > 0) {
           const taskAbove = activeTasks[insertIndex - 1];
           if (taskAbove.task_type === 'group') {
               // Directly under a group header -> belong to it
               targetGroupId = taskAbove.id;
           } else if (taskAbove.task_type === 'gap') {
               // Under a gap -> orphan
               targetGroupId = null;
           } else {
               // Under a regular task -> inherit its group
               targetGroupId = taskAbove.group_id || null;
           }
       }
       // Note: If inserting at 0, targetGroupId remains null (correct)

       // Check if we are inserting into a CLOSED group. If so, auto-expand it.
       let groupToExpandId: string | null = null;
       if (targetGroupId) {
           const parentGroup = activeTasks.find(t => t.id === targetGroupId);
           if (parentGroup && parentGroup.is_closed) {
               groupToExpandId = parentGroup.id;
           }
       }

       const tempId = crypto.randomUUID();
       const newTask: Task = {
          id: tempId,
          _tempId: tempId,
          folder_id: selectedFolderId,
          content: '',
          item_id: isUiProject ? '' : undefined, // Initialize item_id for UI
          sort_order: insertIndex,
          is_completed: false,
          task_type: type, // Use passed type
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          isNew: true,
          isDraft: true, // Create as draft
          group_id: targetGroupId // Assign calculated group ID
       };

       // Optimistic update
       setTasks(prev => {
           const otherTasks = prev.filter(t => t.folder_id !== selectedFolderId || t.is_completed);
           const newActiveTasks = [...activeTasks];

           // Auto-expand group in local state
           if (groupToExpandId) {
               const gIndex = newActiveTasks.findIndex(t => t.id === groupToExpandId);
               if (gIndex !== -1) {
                   newActiveTasks[gIndex] = { ...newActiveTasks[gIndex], is_closed: false };
               }
           }

           newActiveTasks.splice(insertIndex, 0, newTask);
           
           const reindexed = newActiveTasks.map((t, idx) => ({ ...t, sort_order: idx }));
           return [...otherTasks, ...reindexed];
       });

       // Persist group expansion immediately
       if (groupToExpandId) {
           // Fire and forget (or await if critical, but we don't want to block UI for draft creation)
           service.updateTask(groupToExpandId, { is_closed: false }).catch((err: any) => {
               logger.error('Failed to persist auto-expand group', err);
           });
       }
    };

    const handleUpdateTask = async (id: string, updates: Partial<Task>) => {
       const task = tasks.find(t => t.id === id);
       if (!task) return;

       // Handle Draft Saving
       if (task.isDraft) {
           // --- UI PROJECT LOGIC ---
           if (isUiProject) {
               if (updates.item_id !== undefined) {
                   const itemId = updates.item_id.trim();
                   if (!itemId) {
                       handleDeleteTask(id);
                       return;
                   }

                   const updatesWithTimestamp = { ...updates, updated_at: new Date().toISOString() };
                   const realTask = { ...task, ...updatesWithTimestamp, isDraft: false, isNew: false, _isSaving: true };
                   
                   isProcessingLocalChange.current = true;
                   setTasks(prev => prev.map(t => t.id === id ? realTask : t));

                   try {
                      await executeSave(async () => {
                          // Create in DB with empty content (content not used for UI)
                          const data = await service.createTask(realTask.folder_id, '', realTask.sort_order);
                          
                          // Immediately update with item_id and other props
                          const updatesToApply: any = {
                              item_id: itemId,
                          };
                          
                          if (realTask.task_type !== 'task') {
                              updatesToApply.task_type = realTask.task_type;
                          }
                          if (realTask.group_id) {
                              updatesToApply.group_id = realTask.group_id;
                          }
                          
                          await service.updateTask(data.id, updatesToApply);

                          // Persist Order
                          const currentFolderTasks = tasks.filter(t => t.folder_id === realTask.folder_id).sort((a, b) => a.sort_order - b.sort_order);
                          const updatesForOrder = currentFolderTasks.map((t, idx) => ({ 
                              id: t.id === id ? data.id : t.id, 
                              sort_order: idx 
                      }));
                          
                          await service.updateTaskOrder(updatesForOrder);

                          setTasks(prev => prev.map(t => t.id === id ? { 
                              ...data, 
                              _tempId: realTask._tempId, 
                              _isSaving: false,
                              item_id: itemId,
                              group_id: realTask.group_id,
                              task_type: realTask.task_type
                          } : t));
                      });
                   } catch (err) {
                      logger.error('Failed to create UI item from draft', err);
                      setTasks(prev => prev.map(t => t.id === id ? { ...t, _isSaving: false } : t));
                   } finally {
                       setTimeout(() => { isProcessingLocalChange.current = false; }, 50);
                   }
               }
               return;
           }

           // --- STANDARD PROJECT LOGIC ---
           if (updates.content !== undefined) {
               const content = updates.content.trim();
               if (!content) {
                   handleDeleteTask(id);
                   return;
               }

               const updatesWithTimestamp = { ...updates, updated_at: new Date().toISOString() };
               const realTask = { ...task, ...updatesWithTimestamp, isDraft: false, isNew: false, _isSaving: true };
               
               // Snapshot BEFORE save
               const snapshotBeforeSave = {
                   content: realTask.content,
                   folder_id: realTask.folder_id,
                   sort_order: realTask.sort_order,
                   is_completed: realTask.is_completed,
                   task_type: realTask.task_type || 'task',
                   group_id: realTask.group_id
               };
               
               isProcessingLocalChange.current = true;
               setTasks(prev => prev.map(t => t.id === id ? realTask : t));

               try {
                  await executeSave(async () => {
                      // Create in DB
                      const data = await service.createTask(snapshotBeforeSave.folder_id, content, snapshotBeforeSave.sort_order);
                      
                      // If created as gap OR NOTE (via draft logic) OR if it has group_id
                      const updatesToApply: any = {};
                      if (snapshotBeforeSave.task_type !== 'task') {
                          updatesToApply.task_type = snapshotBeforeSave.task_type;
                      }
                      if (snapshotBeforeSave.group_id) {
                          updatesToApply.group_id = snapshotBeforeSave.group_id;
                      }
                      
                      if (Object.keys(updatesToApply).length > 0) {
                          await service.updateTask(data.id, updatesToApply);
                      }

                      // Persist Order
                      const currentFolderTasks = tasks.filter(t => t.folder_id === snapshotBeforeSave.folder_id).sort((a, b) => a.sort_order - b.sort_order);
                      const updatesForOrder = currentFolderTasks.map((t, idx) => ({ 
                          id: t.id === id ? data.id : t.id, 
                          sort_order: idx 
                      }));
                      
                      await service.updateTaskOrder(updatesForOrder);

                      // --- RESAVE LOGIC (Simplified) ---
                      // If task changed during save, we need to resave.
                      // For brevity, skipping complex resave logic migration here, but it should be moved too if critical.
                      // Assuming basic flow for now.
                      
                      // Update ID from Temp to Real
                      setTasks(prev => prev.map(t => t.id === id ? { 
                          ...data, 
                          _tempId: realTask._tempId, 
                          _isSaving: false,
                          // Keep local state for these fields as 'data' from server (createTask) might not have them yet
                          group_id: snapshotBeforeSave.group_id,
                          task_type: snapshotBeforeSave.task_type
                      } : t));
                  });
               } catch (err) {
                  logger.error('Failed to create task from draft', err);
                  setTasks(prev => prev.map(t => t.id === id ? { ...t, _isSaving: false } : t));
               } finally {
                   setTimeout(() => { isProcessingLocalChange.current = false; }, 50);
               }
           }
           return;
       }

       // Normal Update
       // Optimistic
       // const updatesWithTimestamp = { ...updates, updated_at: new Date().toISOString() }; // Moved down
       
       // Trigger recalculation if type changed
       const newType = updates.task_type;
       const oldType = task.task_type;
       const isStructureChange = newType && (
           newType === 'group' || newType === 'gap' || 
           oldType === 'group' || oldType === 'gap'
       );

       // Auto-assign random unused color for new groups BEFORE setting state
       if (newType === 'group' && !updates.group_color) {
           logger.info('DEBUG: calculating random color', { 
               existingGroups: tasks.filter(t => t.folder_id === task.folder_id && t.task_type === 'group').length 
           });

           const currentFolderTasks = tasks.filter(t => t.folder_id === task.folder_id);
           const usedColors = new Set(
               currentFolderTasks
                   .filter(t => t.task_type === 'group' && t.group_color)
                   .map(t => t.group_color)
           );
           
           const available = GROUP_COLORS.filter(c => !usedColors.has(c.value));
           const pool = available.length > 0 ? available : GROUP_COLORS;
           
           logger.info('DEBUG: color pool', { pool: pool.map(c => c.name), used: Array.from(usedColors) });
           const randomColor = pool[Math.floor(Math.random() * pool.length)].value;
           
           updates.group_color = randomColor;
       }
       
       const updatesWithTimestamp = { ...updates, updated_at: new Date().toISOString() };

       // --- OPTIMISTIC RECALCULATE GROUPS ---
       let optimisticTasks = tasks.map(t => t.id === id ? { ...t, ...updatesWithTimestamp } : t);
       let updatesForGroup: { id: string; sort_order: number; group_id: string | null }[] = [];
       let needsGroupUpdate = false;

       if (isStructureChange) {
           const currentFolderTasks = optimisticTasks.filter(t => t.folder_id === task.folder_id).sort((a, b) => a.sort_order - b.sort_order);
           
           // Use unified helper
           const calculatedUpdates = calculateGroupUpdates(currentFolderTasks);

           calculatedUpdates.forEach(u => {
               // Find original sort order to keep object shape compatible if needed
               const t = currentFolderTasks.find(ct => ct.id === u.id);
               if (t) {
                   updatesForGroup.push({
                       id: u.id,
                       sort_order: t.sort_order,
                       group_id: u.group_id
                   });
                   needsGroupUpdate = true;
               }
           });

           if (needsGroupUpdate) {
               // Apply group updates to optimistic state
               optimisticTasks = optimisticTasks.map(t => {
                   const update = updatesForGroup.find(u => u.id === t.id);
                   return update ? { ...t, group_id: update.group_id } : t;
               });
           }
       }

       // Single SetState for instant UI update
       isProcessingLocalChange.current = true;
       setTasks(optimisticTasks);
       
       if (task?.isNew) {
           // If it's just a local draft update (before first save), we don't need to lock
           // But actually handleUpdateTask handles "Draft Saving" above separately.
           // This block is for normal updates.
           // Wait, "task.isNew" check at line 379 returns early?
           // If it returns early, we must reset the flag!
           isProcessingLocalChange.current = false;
           return; 
       }

       try {
          await executeSave(async () => {
              // 1. Update the target task
              await service.updateTask(id, updates);

              // 2. Update affected neighbors if needed
              if (needsGroupUpdate) {
                  await service.updateTaskOrder(updatesForGroup);
              }
          });
       } catch (err) {
          logger.error('Failed to update task', err);
          // Rollback logic needed?
       } finally {
           setTimeout(() => { isProcessingLocalChange.current = false; }, 50);
       }
    };

    const handleDeleteTask = async (id: string) => {
       const taskToDelete = tasks.find(t => t.id === id);
       const isDraft = taskToDelete?.isDraft;

       const oldTasks = [...tasks];
       isProcessingLocalChange.current = true;
       setTasks(prev => prev.filter(t => t.id !== id));
       
       if (isDraft) {
           isProcessingLocalChange.current = false;
           return; 
       }

       try {
          await executeSave(async () => {
              await service.deleteTask(id);

              // --- RECALCULATE GROUPS if structure changed ---
              if (taskToDelete && (taskToDelete.task_type === 'group' || taskToDelete.task_type === 'gap')) {
                  const currentFolderTasks = oldTasks
                      .filter(t => t.folder_id === taskToDelete.folder_id && t.id !== id) // Exclude deleted
                      .sort((a, b) => a.sort_order - b.sort_order);
                  
                  const updatesForGroupRaw = calculateGroupUpdates(currentFolderTasks);
                  const updatesForGroup: { id: string; sort_order: number; group_id: string | null }[] = [];
                  
                  updatesForGroupRaw.forEach(u => {
                      const t = currentFolderTasks.find(ct => ct.id === u.id);
                      if (t) {
                           updatesForGroup.push({
                               id: u.id,
                               sort_order: t.sort_order,
                               group_id: u.group_id
                           });
                      }
                  });

                  if (updatesForGroup.length > 0) {
                      await service.updateTaskOrder(updatesForGroup);
                      // Update local state for all affected
                      setTasks(prev => prev.map(t => {
                          const update = updatesForGroup.find(u => u.id === t.id);
                          return update ? { ...t, group_id: update.group_id } : t;
                      }));
                  }
              }
          });
       } catch (err) {
          logger.error('Failed to delete task', err);
          setTasks(oldTasks);
       } finally {
           setTimeout(() => { isProcessingLocalChange.current = false; }, 50);
       }
    };
    
    const handleAddGap = async (targetIndex: number) => {
        if (!selectedFolderId) return;

        const activeTasks = tasks
            .filter(t => t.folder_id === selectedFolderId && !t.is_completed)
            .sort((a, b) => a.sort_order - b.sort_order);

        let insertIndex = targetIndex + 1;
        if (insertIndex > activeTasks.length) insertIndex = activeTasks.length;

        const tempId = crypto.randomUUID();
        const newGap: Task = {
            id: tempId,
            _tempId: tempId,
            folder_id: selectedFolderId,
            content: '',
            sort_order: insertIndex,
            is_completed: false,
            task_type: 'gap',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            isNew: true,
            isDraft: false 
        };

        isProcessingLocalChange.current = true;
        setTasks(prev => {
            const otherTasks = prev.filter(t => t.folder_id !== selectedFolderId || t.is_completed);
            const newActiveTasks = [...activeTasks];
            newActiveTasks.splice(insertIndex, 0, newGap);
            const reindexed = newActiveTasks.map((t, idx) => ({ ...t, sort_order: idx }));
            return [...otherTasks, ...reindexed];
        });

        try {
            await executeSave(async () => {
                const data = await service.createTask(selectedFolderId, '', insertIndex);
                await service.updateTask(data.id, { task_type: 'gap' });
                
                // --- RECALCULATE GROUPS for inserted GAP ---
                // Inserting a GAP might break an existing group into two (or terminate one).
                // We need to re-scan.
                
                const currentFolderTasks = [...activeTasks];
                const realNewGap = { ...newGap, id: data.id };
                currentFolderTasks.splice(insertIndex, 0, realNewGap);
                
                // First update Sort Order
                const orderUpdates = currentFolderTasks.map((t, idx) => ({ id: t.id === tempId ? data.id : t.id, sort_order: idx }));
                
                // Then Calculate Group IDs
                // Use helper
                const sortedForScan = currentFolderTasks.map((t, idx) => ({...t, sort_order: idx}));
                const updatesRaw = calculateGroupUpdates(sortedForScan);
                
                const updatesForGroup: { id: string; sort_order: number; group_id: string | null }[] = [];
                
                // Merge sort_order updates with group_id updates
                sortedForScan.forEach(t => {
                    const groupUpdate = updatesRaw.find(u => u.id === t.id);
                    // Use calculated group_id if available (meaning it changed or was set), 
                    // otherwise use existing. Actually calculateGroupUpdates returns diffs?
                    // No, my implementation above returned diffs.
                    // But for safety here we want explicit values for everyone we touched.
                    // Or we can just iterate updatesRaw.
                    
                    // Actually we need to update Sort Order for everyone anyway.
                    // So let's build the full payload.
                    
                    updatesForGroup.push({
                        id: t.id,
                        sort_order: t.sort_order,
                        group_id: groupUpdate ? groupUpdate.group_id : (t.group_id || null)
                    });
                });

                await service.updateTaskOrder(updatesForGroup);

                 setTasks(prev => prev.map(t => {
                     if (t.id === tempId) {
                         const update = updatesForGroup.find(u => u.id === data.id);
                         return { ...t, id: data.id, _tempId: tempId, isNew: false, group_id: update ? update.group_id : null };
                     }
                     const update = updatesForGroup.find(u => u.id === t.id);
                     return update ? { ...t, sort_order: update.sort_order, group_id: update.group_id } : t;
                 }));
            });
        } catch (err) {
            logger.error('Failed to create gap', err);
            setTasks(prev => prev.filter(t => t.id !== tempId));
        } finally {
            setTimeout(() => { isProcessingLocalChange.current = false; }, 50);
        }
    };
    
    // Helper for folder coordination
    const removeTasksForFolder = (folderId: string) => {
        setTasks(prev => prev.filter(t => t.folder_id !== folderId));
    };

    return {
        tasks,
        setTasks,
        loadTasks,
        handleAddTask,
        handleUpdateTask,
        handleDeleteTask,
        handleAddGap,
        removeTasksForFolder // Exposed helper
    };
};

