'use client';

import React, { useState, useEffect } from 'react';
import { Task } from '@/app/types';
import { Input, Textarea, Button } from '@heroui/react';
import { Save } from 'lucide-react';

interface UiEditorProps {
    task: Task;
    onUpdate: (id: string, updates: Partial<Task>) => void;
}

export const UiEditor = ({ task, onUpdate }: UiEditorProps) => {
    // Local state for inputs to avoid stuttering during typing if update is slow
    const [localState, setLocalState] = useState({
        item_id: task.item_id || '',
        ru: task.ru || '',
        en: task.en || '',
        uk: task.uk || '',
    });

    // Update local state when task prop changes (e.g. selection changed)
    useEffect(() => {
        setLocalState({
            item_id: task.item_id || '',
            ru: task.ru || '',
            en: task.en || '',
            uk: task.uk || '',
        });
    }, [task.id, task.item_id, task.ru, task.en, task.uk]);

    const handleChange = (field: keyof typeof localState, value: string) => {
        setLocalState(prev => ({ ...prev, [field]: value }));
    };

    const handleBlur = (field: keyof typeof localState) => {
        // Only trigger update if value changed from props
        const currentValue = localState[field];
        const propValue = task[field] || '';
        
        if (currentValue !== propValue) {
            onUpdate(task.id, { [field]: currentValue });
        }
    };

    return (
        <div className="flex flex-col gap-6 h-full">
            <div className="flex flex-col gap-1">
                <label className="text-xs font-bold text-default-500 uppercase tracking-wider">Item ID (Key)</label>
                <Input 
                    value={localState.item_id}
                    onValueChange={(val) => handleChange('item_id', val)}
                    onBlur={() => handleBlur('item_id')}
                    placeholder="e.g. btn_save_profile"
                    variant="bordered"
                    classNames={{
                        input: "font-mono text-sm font-semibold text-purple-700"
                    }}
                />
                <p className="text-[10px] text-default-400">Unique identifier for this UI element.</p>
            </div>

            <div className="flex flex-col gap-4">
                <label className="text-xs font-bold text-default-500 uppercase tracking-wider border-b border-default-200 pb-2">
                    Localization
                </label>
                
                <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-default-600">English (Default)</span>
                    <Textarea
                        minRows={1}
                        value={localState.en}
                        onValueChange={(val) => handleChange('en', val)}
                        onBlur={() => handleBlur('en')}
                        placeholder="English text..."
                        variant="faded"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-default-600">Russian (RU)</span>
                    <Textarea
                        minRows={1}
                        value={localState.ru}
                        onValueChange={(val) => handleChange('ru', val)}
                        onBlur={() => handleBlur('ru')}
                        placeholder="Текст на русском..."
                        variant="faded"
                    />
                </div>

                <div className="flex flex-col gap-1">
                    <span className="text-xs font-semibold text-default-600">Ukrainian (UK)</span>
                    <Textarea
                        minRows={1}
                        value={localState.uk}
                        onValueChange={(val) => handleChange('uk', val)}
                        onBlur={() => handleBlur('uk')}
                        placeholder="Текст українською..."
                        variant="faded"
                    />
                </div>
            </div>
        </div>
    );
};

