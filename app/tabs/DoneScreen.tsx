'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { taskService } from '@/app/_services/taskService';
import { clsx } from 'clsx';
import { CheckCircle2, Trash2, Folder as FolderIcon, RefreshCw, GripVertical, RotateCcw } from 'lucide-react';
import { Spinner, Chip, Button, Switch, Select, SelectItem, Checkbox } from '@heroui/react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { ru } from 'date-fns/locale';
import { loadingService } from '@/app/_services/loadingLogsService';
import { useGlobalPersistentState } from '@/utils/storage';
import { AnimatePresence, motion } from 'framer-motion';

const logger = createLogger('DoneScreen');

interface DoneScreenProps {
    globalStatus?: string;
    canLoad?: boolean;
    isActive?: boolean;
    onRestoreTask?: (task: any) => void;
}

const TIME_RANGES = [
    { key: 'all', label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'hour', label: 'Last Hour' },
];

const LIMIT_OPTIONS = [
    { key: '50', label: '50 items' },
    { key: '100', label: '100 items' },
    { key: '200', label: '200 items' },
    { key: '500', label: '500 items' },
];

// Visual clone of TaskRow for Done items
const DoneTaskRow = ({ task, onRestore, onDelete }: { task: any, onRestore: (t: any) => void, onDelete: (id: string) => void }) => {
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
                {task.is_deleted ? (
                    <div className="w-[16px] flex justify-center items-center text-danger" title="Deleted">
                        <Trash2 size={16} />
                    </div>
                ) : (
                    <Checkbox
                        isSelected={true} 
                        defaultSelected={true}
                        onValueChange={(isSelected) => {
                            if (!isSelected) {
                                onRestore(task);
                            }
                        }}
                        classNames={{
                            wrapper: 'after:bg-primary',
                        }}
                        className={clsx('p-0 m-0 text-center !w-[16px] mx-0')}
                        size="sm"
                    />
                )}

                <div className="flex-grow min-w-0 pl-1 mr-2 flex flex-col justify-center py-1">
                    <div 
                        className={clsx(
                            "rich-editor-cell !bg-transparent !p-0 select-text cursor-text",
                            !task.is_deleted && "text-default-400 ",
                            // Removed task.is_deleted && "text-danger" to keep text color normal for deleted items
                             task.is_deleted && "text-default-400" 
                        )}
                        dangerouslySetInnerHTML={{ __html: task.content || "Empty task" }}
                    />
                    
                    {/* Metadata line */}
                    {(task.folders?.projects || task.folders) && (
                        <div className="flex items-center gap-2 text-xs text-default-400 mt-0.5 opacity-70">
                            {task.folders?.projects && (
                                <div className="flex items-center gap-1">
                                    <div 
                                        className="w-1.5 h-1.5 rounded-full flex-shrink-0" 
                                        style={{ backgroundColor: task.folders.projects.proj_color || '#3b82f6' }}
                                    />
                                    <span className="truncate max-w-[120px]">{task.folders.projects.title}</span>
                                </div>
                            )}
                            {task.folders?.projects && task.folders?.title && (
                                <span className="opacity-50">/</span>
                            )}
                            {task.folders?.title && (
                                <div className="flex items-center gap-1">
                                    <FolderIcon size={10} className="flex-shrink-0" />
                                    <span className="truncate max-w-[120px]">{task.folders.title}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>
             </div>

             {/* Date Column */}
             <div className="text-[11px] text-default-400 whitespace-nowrap mr-3 tabular-nums opacity-70">
                {format(new Date(task.updated_at), 'd MMM HH:mm:ss', { locale: ru }).replace('.', '')}
             </div>

             {/* Actions */}
             <div className="p-0 text-center relative flex justify-center">
                {!task.is_deleted ? (
                    <button
                        onClick={() => onDelete(task.id)}
                        className="opacity-0 p-[2px] group-hover:opacity-100 text-default-400 cursor-pointer hover:text-danger hover:bg-danger/10 rounded transition-all"
                        aria-label="Delete task"
                        title="Delete"
                    >
                        <Trash2 size={16} />
                    </button>
                ) : (
                    <button
                        onClick={() => onRestore(task)}
                        className="opacity-0 p-[2px] group-hover:opacity-100 text-default-400 cursor-pointer hover:text-primary hover:bg-primary/10 rounded transition-all"
                        aria-label="Restore task"
                        title="Restore"
                    >
                        <RotateCcw size={16} />
                    </button>
                )}
             </div>
        </motion.div>
    );
}

export const DoneScreen = ({ globalStatus = 'idle', canLoad = true, isActive = false, onRestoreTask }: DoneScreenProps) => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true); // Initial load (full screen)
    const [isRefreshing, setIsRefreshing] = useState(false); // Refresh (button spin)
    const [isLoaded, setIsLoaded] = useState(false);
    
    // Persistent filters
    const [showDeleted, setShowDeleted] = useGlobalPersistentState<boolean>('done_show_deleted', false);
    const [timeFilter, setTimeFilter] = useGlobalPersistentState<string>('done_time_filter', 'all');
    const [limitFilter, setLimitFilter] = useGlobalPersistentState<string>('done_limit_filter', '200');

    const fetchTasks = async (showSpinner = true) => {
        // If we shouldn't load, just return. 
        if (!canLoad && showSpinner) return;

        if (showSpinner) {
            setIsLoading(true);
            loadingService.logSystemTabStart('Done');
        } else {
            setIsRefreshing(true);
            logger.info('Refreshing done tasks...');
        }

        try {
            const limit = parseInt(limitFilter) || 200;
            const [data] = await Promise.all([
                taskService.getDoneTasks(showDeleted, timeFilter, limit),
                new Promise(resolve => setTimeout(resolve, 1000)) // Min wait time for better UX
            ]);
            setTasks(data || []);
            loadingService.logSystemTabFinish('Done', data?.length || 0);
            setIsLoaded(true);
        } catch (err) {
            logger.error('Failed to load done tasks', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        // Fetch if allowed to load AND (it's active OR filters changed)
        if (canLoad && isActive) {
            logger.info('DoneScreen became active, fetching...');
            // Don't show full spinner if already loaded, just refresh icon spin
            fetchTasks(!isLoaded);
        } else if (canLoad && !isLoaded) {
            // Initial background load
            fetchTasks(true);
        }
    }, [canLoad, isActive, showDeleted, timeFilter, limitFilter]); // Re-fetch on filter change or tab activation

    const handleRestore = async (task: any) => {
        // Optimistic remove
        setTasks(prev => prev.filter(t => t.id !== task.id));
        
        try {
            // Update DB using special restore method (to put at top)
            await taskService.restoreTask(task.id);
            
            // Notify parent to switch context
            if (onRestoreTask) {
                // Short delay to allow exit animation to start/finish
                setTimeout(() => {
                    onRestoreTask(task);
                }, 300);
            }
        } catch (err) {
            logger.error('Failed to restore task', err);
            // Revert optimistic update (simplified, ideally re-fetch or insert back)
            fetchTasks(false); 
        }
    };

    const handleDelete = async (id: string) => {
        // Optimistic update: mark as deleted locally or remove if not showing deleted
        // If we show deleted, we update the item to appear deleted.
        // If we hide deleted, we remove it.
        
        if (!showDeleted) {
            setTasks(prev => prev.filter(t => t.id !== id));
        } else {
            setTasks(prev => prev.map(t => t.id === id ? { ...t, is_deleted: true } : t));
        }

        try {
            await taskService.deleteTask(id); // Soft delete (is_deleted = true)
        } catch (err) {
            logger.error('Failed to delete task', err);
            fetchTasks(false);
        }
    };

    const groupedTasks = useMemo(() => {
        const groups = {
            today: [] as any[],
            yesterday: [] as any[],
            thisWeek: [] as any[],
            thisMonth: [] as any[],
            older: [] as any[],
        };

        tasks.forEach(task => {
            const date = new Date(task.updated_at);
            if (isToday(date)) {
                groups.today.push(task);
            } else if (isYesterday(date)) {
                groups.yesterday.push(task);
            } else if (isThisWeek(date, { weekStartsOn: 1 })) { // Monday start
                groups.thisWeek.push(task);
            } else if (isThisMonth(date)) {
                groups.thisMonth.push(task);
            } else {
                groups.older.push(task);
            }
        });

        return groups;
    }, [tasks]);

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Spinner label="Loading done tasks..." />
            </div>
        );
    }

    const renderGroup = (title: string, groupTasks: any[]) => {
        if (groupTasks.length === 0) return null;
        return (
            <div key={title} className="mb-6">
                 <div className="text font-semibold text-default-400 uppercase tracking-wider mb-2 px-1">
                    {title}
                </div>
                <div className="flex flex-col gap-2">
                    <AnimatePresence initial={false} mode="popLayout">
                        {groupTasks.map((task) => (
                            <DoneTaskRow 
                                key={task.id} 
                                task={task} 
                                onRestore={handleRestore}
                                onDelete={handleDelete}
                            />
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-center mb-4 min-h-[40px]">
                <h1 className="tab-title">
                    <CheckCircle2 className="text-success" />
                    Done {showDeleted && "& Deleted"}
                </h1>
                
                <div className="flex items-center gap-4">
                    <Switch
                        size="sm"
                        isSelected={showDeleted}
                        onValueChange={setShowDeleted}
                        classNames={{
                            base: "flex-row-reverse gap-2",
                            label: "text-default-500 whitespace-nowrap"
                        }}
                    >
                        Show Deleted
                    </Switch>
                    
                    <Select 
                        size="sm"
                        selectedKeys={[timeFilter]}
                        onChange={(e) => setTimeFilter(e.target.value)}
                        className="w-[150px]"
                        aria-label="Time Range"
                        disallowEmptySelection
                        classNames={{
                            trigger: "cursor-pointer"
                          }}
                    >
                        {TIME_RANGES.map((range) => (
                            <SelectItem key={range.key}>
                                {range.label}
                            </SelectItem>
                        ))}
                    </Select>

                    <Select 
                        size="sm"
                        selectedKeys={[limitFilter]}
                        onChange={(e) => setLimitFilter(e.target.value)}
                        className="w-[150px]"
                        aria-label="Limit"
                        disallowEmptySelection
                        classNames={{
                            trigger: "cursor-pointer"
                          }}
                    >
                        {LIMIT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.key}>
                                {opt.label}
                            </SelectItem>
                        ))}
                    </Select>

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
                        No completed or deleted tasks found.
                    </div>
                ) : (
                    <>
                        {renderGroup('Today', groupedTasks.today)}
                        {renderGroup('Yesterday', groupedTasks.yesterday)}
                        {renderGroup('This Week', groupedTasks.thisWeek)}
                        {renderGroup('This Month', groupedTasks.thisMonth)}
                        {renderGroup('Older', groupedTasks.older)}
                    </>
                )}
            </div>
        </div>
    );
};
