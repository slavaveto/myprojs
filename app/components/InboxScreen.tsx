'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createLogger } from '@/utils/logger/Logger';
import { taskService } from '@/app/_services/taskService';
import { clsx } from 'clsx';
import { CheckCircle2, Trash2, Folder as FolderIcon, RefreshCw, GripVertical, RotateCcw, Calendar, Inbox, Plus, Bold, Type, Star, X } from 'lucide-react';
import { Spinner, Chip, Button, Switch, Select, SelectItem, Checkbox, Dropdown, DropdownTrigger, DropdownMenu, DropdownItem } from '@heroui/react';
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { useGlobalPersistentState } from '@/utils/storage';
import { AnimatePresence, motion } from 'framer-motion';
import { CreateItemPopover } from '@/app/components/CreateItem';
import { loadingService } from '@/app/_services/loadingService';
import { EditableCell } from './EditableCell';

const logger = createLogger('InboxScreen');

interface InboxScreenProps {
    globalStatus?: string;
    canLoad?: boolean;
    isActive?: boolean;
}

// Visual clone of TaskRow for Inbox items
const InboxTaskRow = ({ task, onUpdate, onDelete }: { task: any, onUpdate: (id: string, updates: any) => void, onDelete: (id: string) => void }) => {
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
                 <Dropdown placement="bottom-start" className="min-w-0 w-auto">
                    <DropdownTrigger>
                       <button
                          className={clsx(
                             'p-[2px] cursor-pointer rounded transition-all outline-none opacity-0 group-hover:opacity-100 text-default-300 hover:text-foreground',
                             task.title_text_style && 'opacity-0 text-foreground'
                          )}
                          aria-label="Text Style"
                       >
                          <Type size={16} />
                       </button>
                    </DropdownTrigger>
                    <DropdownMenu
                       aria-label="Text Style Selection"
                       variant="flat"
                       className="p-0 min-w-0 w-fit"
                    >
                       <DropdownItem
                          key="style-row"
                          isReadOnly
                          className="cursor-default opacity-100 data-[hover=true]:bg-transparent p-1 w-fit min-w-0"
                          textValue="Style Options"
                       >
                          <div className="flex flex-wrap gap-1">
                             <button
                                type="button"
                                onClick={(e) => {
                                   e.stopPropagation();
                                   onUpdate(task.id, { title_text_style: 'bold' });
                                }}
                                className={clsx(
                                   'w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors',
                                   task.title_text_style === 'bold' &&
                                      'bg-default-300 text-foreground'
                                )}
                                title="Bold"
                             >
                                <Bold size={16} />
                             </button>
                             <button
                                type="button"
                                onClick={(e) => {
                                   e.stopPropagation();
                                   onUpdate(task.id, { title_text_style: 'red' });
                                }}
                                className={clsx(
                                   'w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-danger',
                                   task.title_text_style === 'red' && 'bg-danger/20'
                                )}
                                title="Red"
                             >
                                <Type size={16} />
                             </button>
                             <button
                                type="button"
                                onClick={(e) => {
                                   e.stopPropagation();
                                   onUpdate(task.id, { title_text_style: 'red-bold' });
                                }}
                                className={clsx(
                                   'w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-danger font-bold',
                                   task.title_text_style === 'red-bold' && 'bg-danger/20'
                                )}
                                title="Red Bold"
                             >
                                <Bold size={16} />
                             </button>
                             <button
                                type="button"
                                onClick={(e) => {
                                   e.stopPropagation();
                                   onUpdate(task.id, { title_text_style: null });
                                }}
                                className={clsx(
                                   'w-7 h-7 rounded hover:bg-default-200 flex items-center justify-center transition-colors text-default-400'
                                )}
                                title="Reset"
                             >
                                <X size={16} />
                             </button>
                          </div>
                       </DropdownItem>
                    </DropdownMenu>
                 </Dropdown>

                 {/* Today Button */}
                 <button
                    onClick={() => onUpdate(task.id, { is_today: !task.is_today })}
                    className={clsx(
                       'p-[2px] cursor-pointer rounded transition-all outline-none',
                       task.is_today
                          ? 'opacity-100 text-warning'
                          : 'opacity-0 group-hover:opacity-100 text-default-300 hover:text-warning'
                    )}
                    aria-label="Toggle Today"
                 >
                    <Star size={16} fill={task.is_today ? 'currentColor' : 'none'} />
                 </button>

                {/* Delete Button */}
                <button
                    onClick={() => onDelete(task.id)}
                    className="opacity-0 p-[2px] group-hover:opacity-100 text-default-400 cursor-pointer hover:text-danger hover:bg-danger/10 rounded transition-all"
                    aria-label="Delete task"
                    title="Delete"
                >
                    <Trash2 size={16} />
                </button>
             </div>
        </motion.div>
    );
}

export const InboxScreen = ({ globalStatus = 'idle', canLoad = true, isActive = false }: InboxScreenProps) => {
    const [tasks, setTasks] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    
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
            await taskService.updateTask(id, updates);
        } catch (err) {
            logger.error('Failed to update task', err);
            fetchTasks(false);
        }
    };

    const handleDelete = async (id: string) => {
        setTasks(prev => prev.filter(t => t.id !== id));

        try {
            await taskService.deleteTask(id);
        } catch (err) {
            logger.error('Failed to delete task', err);
            fetchTasks(false);
        }
    };

    const handleCreateTask = async (title: string) => {
        try {
             // Create task with no folder (null)
             const newTask = await taskService.createTask(null, title, 0); // 0 = sort order (top)
             
             // Optimistic add to top
             setTasks(prev => [newTask, ...prev]);
             
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
            <div className="flex justify-between items-center mb-4 min-h-[40px]">
                
                <h1 className="tab-title">
                    <Inbox className="text-primary" />
                    Inbox
                </h1>
                
                <div className="flex items-center gap-4">
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
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

