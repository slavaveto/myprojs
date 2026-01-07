import React, { useEffect, useState } from 'react';
import { useQuery } from '@powersync/react';
import { Task } from '@/app/types';
import { Button, Textarea } from '@heroui/react';
import { X } from 'lucide-react';
import { usePowerSync } from '@/app/_services/powerSync/PowerSyncProvider';

interface DetailsPanelProps {
    taskId: string | null;
}

export const DetailsPanel = ({ taskId }: DetailsPanelProps) => {
    const powerSync = usePowerSync();
    
    // 1. Load Task Data (only if ID exists)
    const { data: taskData } = useQuery(
        taskId ? `SELECT * FROM tasks WHERE id = ?` : '',
        taskId ? [taskId] : []
    );
    const task: Task | undefined = taskData?.[0];

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
            console.log('Saving task details...', { title, notes });
            await powerSync.execute(
                `UPDATE tasks SET content = ?, task_notes = ?, updated_at = datetime('now') WHERE id = ?`,
                [title, notes, taskId]
            );
        }
    };

    if (!taskId) {
        return (
            <div className="w-[400px] flex-shrink-0 border-l border-default-200 bg-content1 flex flex-col items-center justify-center text-default-400 z-20">
                Select a task to view details
            </div>
        );
    }

    if (!task) {
        return (
            <div className="w-[400px] flex-shrink-0 border-l border-default-200 bg-content1 flex flex-col items-center justify-center text-default-400 z-20">
                Loading...
            </div>
        );
    }

    return (
        <div className="w-[400px] flex-shrink-0 border-l border-default-200 bg-content1 flex flex-col h-full z-20">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-default-200/50 min-h-[48px]">
                <span className="text-xs font-bold text-default-400 uppercase tracking-wider">Details</span>
                {/* No Close Button */}
            </div>

            {/* Content Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-6">
                
                {/* Title Editor */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-default-500">Task</label>
                    <Textarea
                        minRows={1}
                        maxRows={4}
                        variant="faded"
                        size="lg"
                        value={title}
                        onValueChange={setTitle}
                        onBlur={handleSave}
                        className="text-lg font-bold"
                        placeholder="Task title"
                    />
                </div>

                {/* Notes Editor */}
                <div className="space-y-1 flex-1 flex flex-col">
                    <label className="text-xs font-medium text-default-500">Notes</label>
                    <Textarea
                        minRows={10}
                        variant="bordered"
                        value={notes}
                        onValueChange={setNotes}
                        onBlur={handleSave}
                        placeholder="Add details, notes, links..."
                        className="flex-1"
                    />
                </div>

                <div className="text-[10px] text-default-300 font-mono text-center">
                    ID: {taskId}
                </div>
            </div>
        </div>
    );
};

