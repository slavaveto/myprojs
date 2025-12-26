'use client';

import React, { useEffect, useState } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { projectService } from '@/app/_services/projectService';
import { clsx } from 'clsx';
import { CheckCircle2, Trash2, Folder as FolderIcon, RefreshCw } from 'lucide-react';
import { Spinner, Chip, Button, Switch, Select, SelectItem } from '@heroui/react';
import { format } from 'date-fns';
import { useGlobalPersistentState } from '@/utils/storage';

const logger = createLogger('DoneScreen');

interface DoneScreenProps {
    globalStatus?: string;
    canLoad?: boolean;
    isActive?: boolean;
}

const TIME_RANGES = [
    { key: 'all', label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'hour', label: 'Last Hour' },
];

export const DoneScreen = ({ globalStatus = 'idle', canLoad = true, isActive = false }: DoneScreenProps) => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    
    // Persistent filters
    const [showDeleted, setShowDeleted] = useGlobalPersistentState<boolean>('done_show_deleted', false);
    const [timeFilter, setTimeFilter] = useGlobalPersistentState<string>('done_time_filter', 'all');

    const fetchTasks = async () => {
        setIsLoading(true);
        logger.start('Loading done tasks...');
        try {
            const data = await projectService.getDoneTasks(showDeleted, timeFilter);
            setTasks(data || []);
            logger.success('Done tasks loaded', { count: data?.length });
            setIsLoaded(true);
        } catch (err) {
            logger.error('Failed to load done tasks', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        // Fetch if allowed to load AND (it's active OR filters changed)
        // If background loading is allowed (canLoad=true), we still want to refresh when it becomes active
        if (canLoad && isActive) {
            logger.info('DoneScreen became active, fetching...');
            fetchTasks();
        } else if (canLoad && !isLoaded) {
            // Initial background load
            fetchTasks();
        }
    }, [canLoad, isActive, showDeleted, timeFilter]); // Re-fetch on filter change or tab activation

    return (
        <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-center mb-4 min-h-[40px]">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="text-success" />
                    Done {showDeleted && "& Deleted"}
                </h1>
                
                <div className="flex items-center gap-4">
                    <Select 
                        size="sm"
                        selectedKeys={[timeFilter]}
                        onChange={(e) => setTimeFilter(e.target.value)}
                        className="w-[200px]"
                        aria-label="Time Range"
                        disallowEmptySelection
                    >
                        {TIME_RANGES.map((range) => (
                            <SelectItem key={range.key}>
                                {range.label}
                            </SelectItem>
                        ))}
                    </Select>

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

                    <Button 
                        isIconOnly
                        size="sm" 
                        variant="flat" 
                        color="success" 
                        onPress={fetchTasks}
                        isLoading={isLoading}
                    >
                        <RefreshCw size={18} className={clsx(isLoading && "animate-spin")} />
                    </Button>
                </div>
            </div>

            <div className="flex-grow overflow-y-auto pr-0">
                {isLoading && !isLoaded ? (
                    <div className="flex justify-center py-20">
                        <Spinner size="lg" color="primary" />
                    </div>
                ) : tasks.length === 0 ? (
                    <div className="text-center py-20 text-default-400">
                        No completed or deleted tasks found.
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {tasks.map((task) => (
                            <div 
                                key={task.id}
                                className={clsx(
                                    "p-3 rounded-lg border flex items-center gap-3 transition-colors",
                                    task.is_deleted 
                                        ? "bg-danger/5 border-danger/20" 
                                        : "bg-success/5 border-success/20"
                                )}
                            >
                                <div className="flex-shrink-0">
                                    {task.is_deleted ? (
                                        <div className="w-8 h-8 rounded-full bg-danger/10 flex items-center justify-center text-danger">
                                            <Trash2 size={16} />
                                        </div>
                                    ) : (
                                        <div className="w-8 h-8 rounded-full bg-success/10 flex items-center justify-center text-success">
                                            <CheckCircle2 size={16} />
                                        </div>
                                    )}
                                </div>
                                
                                <div className="flex-grow min-w-0">
                                    <div className={clsx("text-sm font-medium", task.is_deleted ? "text-danger" : "text-foreground line-through decoration-default-400")}>
                                        {task.content || "Empty task"}
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-default-400 mt-1">
                                        {task.folders?.projects && (
                                            <div className="flex items-center gap-1">
                                                <div 
                                                    className="w-2 h-2 rounded-full" 
                                                    style={{ backgroundColor: task.folders.projects.color || '#3b82f6' }}
                                                />
                                                <span>{task.folders.projects.title}</span>
                                            </div>
                                        )}
                                        <span>/</span>
                                        <div className="flex items-center gap-1">
                                            <FolderIcon size={12} />
                                            <span>{task.folders?.title || "Unknown Folder"}</span>
                                        </div>
                                        <span className="ml-auto">
                                            {format(new Date(task.updated_at), 'MMM d, HH:mm')}
                                        </span>
                                    </div>
                                </div>
                                
                                <div>
                                    <Chip size="sm" variant="flat" color={task.is_deleted ? "danger" : "success"}>
                                        {task.is_deleted ? "Deleted" : "Done"}
                                    </Chip>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

