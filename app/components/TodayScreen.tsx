'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { taskService } from '@/app/_services/taskService';
import { clsx } from 'clsx';
import { CheckCircle2, Trash2, Folder as FolderIcon, RefreshCw, GripVertical, RotateCcw, Calendar, Star } from 'lucide-react';
import { Spinner, Chip, Button, Switch, Select, SelectItem, Checkbox } from '@heroui/react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { useGlobalPersistentState } from '@/utils/storage';
import { AnimatePresence, motion } from 'framer-motion';
import { loadingService } from '@/app/_services/loadingService';
import { EditableCell } from './EditableCell';

const logger = createLogger('TodayScreen');

interface TodayScreenProps {
    globalStatus?: string;
    canLoad?: boolean;
    isActive?: boolean;
    onRestoreTask?: (task: any) => void;
}

// Visual clone of TaskRow for Today items
const TodayTaskRow = ({ task, onUpdate, onDelete }: { task: any, onUpdate: (id: string, updates: any) => void, onDelete: (id: string) => void }) => {
    return (
        <motion.div
            layout
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className={clsx(
                'group px-1 flex justify-between min-h-[30px] items-center rounded-lg border border-default-300 bg-content1 transition-colors outline-none overflow-hidden mb-[0px]',
                'hover:bg-default-50'
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
                            task.is_completed && "text-default-400 line-through"
                        )}
                    />
                    
                    {/* Metadata line (hidden per user request) */}
                    <div className="hidden flex items-center gap-2 text-xs text-default-400 mt-0.5">
                        {task.folders?.projects && (
                            <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                                <div 
                                    className="w-1.5 h-1.5 rounded-full" 
                                    style={{ backgroundColor: task.folders.projects.color || '#3b82f6' }}
                                />
                                <span className="truncate max-w-[100px]">{task.folders.projects.title}</span>
                            </div>
                        )}
                        <span className="opacity-50">/</span>
                        <div className="flex items-center gap-1 opacity-70 hover:opacity-100 transition-opacity">
                            <FolderIcon size={10} />
                            <span className="truncate max-w-[100px]">{task.folders?.title || "Unknown Folder"}</span>
                        </div>
                    </div>
                </div>
             </div>

             {/* Actions */}
             <div className="p-0 text-center relative flex justify-center items-center gap-0">
                 {/* Remove from Today button */}
                 <button
                    onClick={() => onUpdate(task.id, { is_today: false })}
                    className="opacity-100 p-[2px] text-warning cursor-pointer hover:bg-warning/10 rounded transition-all outline-none"
                    aria-label="Remove from Today"
                    title="Remove from Today"
                 >
                     <Star size={16} fill="currentColor" />
                 </button>

                {/* <button
                    onClick={() => onDelete(task.id)}
                    className="opacity-0 p-[2px] group-hover:opacity-100 text-default-400 cursor-pointer hover:text-danger hover:bg-danger/10 rounded transition-all"
                    aria-label="Delete task"
                    title="Delete"
                >
                    <Trash2 size={16} />
                </button> */}
             </div>
        </motion.div>
    );
}

export const TodayScreen = ({ globalStatus = 'idle', canLoad = true, isActive = false }: TodayScreenProps) => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true); // Initial load (full screen)
    const [isRefreshing, setIsRefreshing] = useState(false); // Refresh (button spin)
    const [isLoaded, setIsLoaded] = useState(false);
    
    // Persistent filters (if needed in future, currently none specific to Today like timeFilter)
    // const [showCompleted, setShowCompleted] = useGlobalPersistentState<boolean>('today_show_completed', true);

    const fetchTasks = async (showSpinner = true) => {
        // If we shouldn't load, just return. 
        if (!canLoad && showSpinner) return;

        if (showSpinner) {
            setIsLoading(true);
            loadingService.logSystemTabStart('Today');
        } else {
            setIsRefreshing(true);
            logger.info('Refreshing today tasks...');
        }

        try {
            // Fetch tasks where is_today = true
            const data = await taskService.getTodayTasks();
            
            // Artificial delay for better UX (optional, matching DoneScreen)
            await new Promise(resolve => setTimeout(resolve, 500));
            
            setTasks(data || []);
            loadingService.logSystemTabFinish('Today', data?.length || 0);
            setIsLoaded(true);
        } catch (err) {
            logger.error('Failed to load today tasks', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        // Fetch if allowed to load AND (it's active OR first load)
        if (canLoad && isActive) {
            logger.info('TodayScreen became active, fetching...');
            // Don't show full spinner if already loaded, just refresh icon spin
            fetchTasks(!isLoaded);
        } else if (canLoad && !isLoaded) {
            // Initial background load
            fetchTasks(true);
        }
    }, [canLoad, isActive]); 

    const handleUpdate = async (id: string, updates: any) => {
        // Optimistic update
        setTasks(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));

        // If removing from today, filter out
        if (updates.is_today === false) {
             setTasks(prev => prev.filter(t => t.id !== id));
        }

        try {
            await taskService.updateTask(id, updates);
        } catch (err) {
            logger.error('Failed to update task', err);
            fetchTasks(false); // Revert on error
        }
    };

    const handleDelete = async (id: string) => {
        // Optimistic update
        setTasks(prev => prev.filter(t => t.id !== id));

        try {
            await taskService.deleteTask(id); // Soft delete
        } catch (err) {
            logger.error('Failed to delete task', err);
            fetchTasks(false);
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Spinner label="Loading today's tasks..." />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-center mb-4 min-h-[40px]">

                <h1 className="tab-title">
                    <Star className="text-warning" fill="currentColor" />
                    Today
                </h1>
                
                <div className="flex items-center gap-4">
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
                        No tasks for today.
                    </div>
                ) : (
                    <div className="flex flex-col gap-[6px]">
                        <AnimatePresence initial={false} mode="popLayout">
                            {tasks.map((task) => (
                                <TodayTaskRow 
                                    key={task.id} 
                                    task={task} 
                                    onUpdate={handleUpdate}
                                    onDelete={handleDelete}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

