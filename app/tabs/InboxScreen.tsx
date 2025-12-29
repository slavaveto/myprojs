'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { taskService } from '@/app/_services/taskService';
import { clsx } from 'clsx';
import { CheckCircle2, Trash2, Folder as FolderIcon, RefreshCw, GripVertical, RotateCcw, Calendar, Inbox, Plus, MoreVertical, MoveRight, ArrowRight } from 'lucide-react';
import { Spinner, Chip, Button, Switch, Select, SelectItem, Checkbox, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem, DropdownSection } from '@heroui/react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { useGlobalPersistentState, globalStorage } from '@/utils/storage';
import { AnimatePresence, motion } from 'framer-motion';
import { projectService } from '@/app/_services/projectService';
import { CreateItemPopover } from '@/app/components/CreateItem';
import { loadingService } from '@/app/_services/loadingLogsService';
import { EditableCell } from '../components/EditableCell';
import { TaskContextMenu, TaskMenuItems } from '../components/TaskContextMenu';
import { TaskStyleControl } from '../components/TaskStyleControl';
import { TaskTodayControl } from '../components/TaskTodayControl';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { GlobalSearch, NavigationTarget } from '@/app/components/GlobalSearch';

const logger = createLogger('InboxScreen');

interface InboxScreenProps {
    globalStatus?: string;
    canLoad?: boolean;
    isActive?: boolean;
    onMoveTask?: (taskId: string, projectId: string, folderId: string) => void;
    onNavigate?: (target: NavigationTarget) => void;
}

// Visual clone of TaskRow for Inbox items
const InboxTaskRow = ({ 
    task, 
    onUpdate, 
    onDelete, 
    projectsStructure,
    onMove,
    isHighlighted
}: { 
    task: any, 
    onUpdate: (id: string, updates: any) => void, 
    onDelete: (id: string) => void,
    projectsStructure: any[],
    onMove?: (taskId: string, projectId: string, folderId: string) => void,
    isHighlighted?: boolean
}) => {
    return (
        <TaskContextMenu
            task={task}
            onUpdate={onUpdate}
            onDelete={onDelete}
            onMove={onMove}
            projectsStructure={projectsStructure}
            items={{
                delete: true,
                move: true,
                styles: true,
                today: true
            }}
        >
            <motion.div
                layout
                initial={{ opacity: 0, height: 0 }}
                animate={{ 
                    opacity: 1, 
                    height: 'auto',
                    backgroundColor: isHighlighted ? 'var(--highlight-bg, rgba(250, 204, 21, 0.2))' : undefined
                }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className={clsx(
                    'group px-1 flex justify-between min-h-[30px] items-center rounded-lg border border-default-300 bg-content1 transition-colors outline-none overflow-hidden mb-[0px]',
                    'hover:bg-default-50',
                    isHighlighted && 'ring-2 ring-primary ring-opacity-50'
                )}
            >
                 <div className="flex flex-1 gap-2 flex-row items-center pl-2">
                    <Checkbox
                    isSelected={task.is_completed} 
                    onValueChange={(isSelected) => {
                         onUpdate(task.id, { is_completed: isSelected });
                    }}
                    classNames={{
                        wrapper: 'after:bg-primary',
                    }}
                    className={clsx('p-0 m-0 text-center !w-[16px] mx-0')}
                    size="sm"
                />

                <div className="flex-grow min-w-0 pl-1 mr-2 flex flex-col justify-center py-1">
                    <EditableCell
                        value={task.content}
                        onSave={(val) => onUpdate(task.id, { content: val })}
                        isMultiline
                        className={clsx(
                            "text-[16px] leading-normal break-words whitespace-pre-wrap",
                            task.is_completed && "text-default-400 line-through",
                            task.title_text_style === 'bold' && 'font-medium',
                            task.title_text_style === 'red' && 'text-danger',
                            task.title_text_style === 'red-bold' && 'text-danger font-medium'
                        )}
                    />
                </div>
             </div>

             {/* Actions */}
             <div className="p-0 text-center relative flex justify-center items-center gap-1">
                 
                 {/* Style Button */}
                 <TaskStyleControl task={task} onUpdate={onUpdate} />

                 {/* Today Button */}
                 <TaskTodayControl task={task} onUpdate={onUpdate} />

                {/* More Menu */}
                <Dropdown placement="bottom-end">
                    <DropdownTrigger>
                        <button
                            className="opacity-100 p-[0px] text-default-400 cursor-pointer hover:text-default-600 rounded transition-all outline-none"
                            aria-label="Task settings"
                        >
                            <MoreVertical size={16} />
                        </button>
                    </DropdownTrigger>
                    <DropdownMenu aria-label="Task Actions">
                        {TaskMenuItems({
                            task,
                            onUpdate,
                            onDelete,
                            onMove,
                            projectsStructure,
                            items: {
                                delete: true,
                                move: true,
                                today: true,
                                styles: true
                            }
                        })}
                    </DropdownMenu>
                </Dropdown>
             </div>
        </motion.div>
        </TaskContextMenu>
    );
}

export const InboxScreen = ({ globalStatus = 'idle', canLoad = true, isActive = false, onMoveTask, onNavigate }: InboxScreenProps) => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [projectsStructure, setProjectsStructure] = useState<any[]>([]);

    const [highlightedTaskId, setHighlightedTaskId] = useState<string | null>(null);

    // --- Check for highlighted task ---
    useEffect(() => {
        if (isActive && isLoaded) {
            const highlightKey = 'highlight_task_inbox';
            const taskIdToHighlight = globalStorage.getItem(highlightKey);

            if (taskIdToHighlight) {
                logger.info('Highlighting restored task', { taskId: taskIdToHighlight });
                setHighlightedTaskId(taskIdToHighlight);
                
                globalStorage.removeItem(highlightKey);

                setTimeout(() => {
                    setHighlightedTaskId(null);
                }, 2000);
            }
        }
    }, [isActive, isLoaded]);

    const { execute: executeSave, status: saveStatus, error: saveError } = useAsyncAction({
        useToast: false,
        minDuration: 800,
        successDuration: 2000,
        loadingMessage: 'Saving...',
        successMessage: 'Saved',
        errorMessage: 'Failed to save'
    });

    useEffect(() => {
        // Load projects structure for Move menu
        projectService.getProjectsWithFolders()
            .then(data => setProjectsStructure(data || []))
            .catch(err => logger.error('Failed to load projects structure', err));
    }, []);
    
    const fetchTasks = async (showSpinner = true) => {
        if (!canLoad && showSpinner) return;

        if (showSpinner) {
            setIsLoading(true);
            loadingService.logSystemTabStart('Inbox');
        } else {
            setIsRefreshing(true);
            logger.info('Refreshing inbox tasks...');
        }

        try {
            const data = await taskService.getInboxTasks();
            
            await new Promise(resolve => setTimeout(resolve, 500));
            
            setTasks(data || []);
            loadingService.logSystemTabFinish('Inbox', data?.length || 0);
            setIsLoaded(true);
        } catch (err) {
            logger.error('Failed to load inbox tasks', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (canLoad && isActive) {
            logger.info('InboxScreen became active, fetching...');
            fetchTasks(!isLoaded);
        } else if (canLoad && !isLoaded) {
            fetchTasks(true);
        }
    }, [canLoad, isActive]); 

    const handleUpdate = async (id: string, updates: any) => {
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

        if (updates.is_completed === true) {
             setTasks(prev => prev.filter(t => t.id !== id));
        }

        try {
            await executeSave(async () => {
                await taskService.updateTask(id, updates);
            });
        } catch (err) {
            logger.error('Failed to update task', err);
            fetchTasks(false);
        }
    };

    const handleDelete = async (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));

        try {
            await executeSave(async () => {
                await taskService.deleteTask(id);
            });
        } catch (err) {
            logger.error('Failed to delete task', err);
            fetchTasks(false);
        }
    };

    const handleMove = async (taskId: string, projectId: string, folderId: string) => {
        try {
            await executeSave(async () => {
                // 1. Update task in DB (move to top of target folder)
                await taskService.moveTaskToFolder(taskId, folderId);
            });
            
            // 2. Remove from local list (optimistic)
            setTasks(prev => prev.filter(t => t.id !== taskId));
            
            // 3. Trigger parent navigation
            onMoveTask?.(taskId, projectId, folderId);
            
            logger.success('Task moved to project');
        } catch (err) {
            logger.error('Failed to move task', err);
            fetchTasks(false); // Revert
        }
    };

    const handleCreateTask = async (title: string) => {
        try {
             let newTask: any;
             await executeSave(async () => {
                 // Create task with no folder (null)
                 newTask = await taskService.createTask(null, title, 0); // 0 = sort order (top)
             });
             
             if (newTask) {
                 // Optimistic add to top (or replace temp if we had one, but here we just append)
                 setTasks(prev => [newTask, ...prev]);
             }
             
             logger.success('Inbox task created');
        } catch (err) {
             logger.error('Failed to create inbox task', err);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Spinner label="Loading inbox..." />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
            <div className="grid grid-cols-[1fr_auto_1fr] items-center mb-4 min-h-[40px] gap-4">
                
                <h1 className="tab-title justify-self-start">
                    <Inbox className="text-primary" />
                    Inbox
                </h1>
                
                <div className="w-full max-w-[240px] justify-self-center">
                    {onNavigate && <GlobalSearch onNavigate={onNavigate} />}
                </div>

                <div className="flex items-center gap-4 justify-self-end">
                    <StatusBadge 
                        status={saveStatus}
                        errorMessage={saveError?.message}
                    />

                    <CreateItemPopover 
                        title="New Inbox Task" 
                        inputPlaceholder="Task content"
                        onCreate={handleCreateTask}
                        placement="bottom"
                    >
                        <Button isIconOnly size="sm" variant="flat" color="primary">
                            <Plus size={20} />
                        </Button>
                    </CreateItemPopover>

                    <Button 
                        isIconOnly
                        size="sm" 
                        variant="flat" 
                        color="success" 
                        onPress={() => fetchTasks(false)}
                        isLoading={isRefreshing}
                    >
                        <RefreshCw size={18} />
                    </Button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-0 pb-10">
                {tasks.length === 0 ? (
                    <div className="text-center py-20 text-default-400">
                        No tasks in Inbox.
                    </div>
                ) : (
                    <div className="flex flex-col gap-[6px]">
                        <AnimatePresence initial={false} mode="popLayout">
                            {tasks.map((task) => (
                                <InboxTaskRow 
                                    key={task.id} 
                                    task={task} 
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                    projectsStructure={projectsStructure}
                                    onMove={handleMove}
                                    isHighlighted={highlightedTaskId === task.id}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

