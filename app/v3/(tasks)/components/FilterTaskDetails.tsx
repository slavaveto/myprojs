import React, { useEffect, useState } from 'react';
import { useQuery } from '@powersync/react';
import { Textarea } from '@heroui/react';
import { usePowerSyncV3 } from '@/app/_services_v3/Provider';

// Minimal Task Type for Details (Can be extended for Filter specifics like Project Selector)
interface FilterTaskDetailsData {
    id: string;
    content: string;
    task_notes: string;
    updated_at: string;
    project_id?: string; // Potential future use
}

interface FilterTaskDetailsProps {
    taskId: string | null;
}

export const FilterTaskDetails = ({ taskId }: FilterTaskDetailsProps) => {
    const powerSync = usePowerSyncV3();
    
    // 1. Load Task Data (only if ID exists)
    const { data: taskData } = useQuery(
        taskId ? `SELECT * FROM tasks WHERE id = ?` : '',
        taskId ? [taskId] : []
    );
    const task: FilterTaskDetailsData | undefined = taskData?.[0];

    // Local state for editing
    const [title, setTitle] = useState('');
    const [notes, setNotes] = useState('');

    // Sync local state
    useEffect(() => {
        if (task) {
            setTitle(task.content || '');
            setNotes(task.task_notes || '');
        } else {
            setTitle('');
            setNotes('');
        }
    }, [task]);

    // Save Handler
    const handleSave = async () => {
        if (!task || !powerSync || !taskId) return;
        
        if (title !== task.content || notes !== task.task_notes) {
            await powerSync.execute(
                `UPDATE tasks SET content = ?, task_notes = ?, updated_at = datetime('now') WHERE id = ?`,
                [title, notes, taskId]
            );
        }
    };

    if (!taskId) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-default-400 z-20">
                <span className="text-sm">Выберите задачу для просмотра</span>
            </div>
        );
    }

    if (!task) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-default-400 z-20">
                <span className="text-sm">Загрузка...</span>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col z-20">
            {/* Header - Filter Specific (Maybe add Project Badge here later) */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-default-200/50 bg-yellow-50/10">
                <span className="text-xs font-bold text-default-400 uppercase tracking-wider">Детали (Фильтр)</span>
            </div>

            {/* Content Form */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* Title Editor */}
                <div className="space-y-2">
                    <label className="text-xs font-medium text-default-500">Задача</label>
                    <Textarea
                        minRows={1}
                        maxRows={4}
                        variant="faded"
                        size="lg"
                        value={title}
                        onValueChange={setTitle}
                        onBlur={handleSave}
                        classNames={{
                            input: "text-lg font-bold"
                        }}
                        placeholder="Заголовок задачи"
                    />
                </div>

                {/* Notes Editor */}
                <div className="space-y-2 flex-1 flex flex-col">
                    <label className="text-xs font-medium text-default-500">Заметки</label>
                    <Textarea
                        minRows={10}
                        variant="bordered"
                        value={notes}
                        onValueChange={setNotes}
                        onBlur={handleSave}
                        placeholder="Добавить детали, заметки, ссылки..."
                        className="flex-1"
                    />
                </div>

                <div className="text-[10px] text-default-300 font-mono text-center pt-4">
                    ID: {taskId}
                </div>
            </div>
        </div>
    );
};

