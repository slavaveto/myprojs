'use client';

import React, { useEffect, useState } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { projectService } from '@/app/_services/projectService';
import { clsx } from 'clsx';
import { CheckCircle2, Trash2, Folder as FolderIcon, RefreshCw } from 'lucide-react';
import { Spinner, Chip, Button } from '@heroui/react';
import { format } from 'date-fns';

const logger = createLogger('DoneScreen');

interface DoneScreenProps {
    globalStatus?: string;
    canLoad?: boolean;
}

export const DoneScreen = ({ globalStatus = 'idle', canLoad = true }: DoneScreenProps) => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    const fetchTasks = async () => {
        setIsLoading(true);
        logger.start('Loading done tasks...');
        try {
            const data = await projectService.getDoneTasks();
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
        if (canLoad && !isLoaded) {
            fetchTasks();
        }
    }, [canLoad, isLoaded]);

    return (
        <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
            <div className="flex justify-between items-center mb-4 min-h-[40px]">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <CheckCircle2 className="text-success" />
                    Done & Deleted
                </h1>
                
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

