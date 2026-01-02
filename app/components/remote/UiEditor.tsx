'use client';

import React, { useState, useEffect } from 'react';
import { Task } from '@/app/types';
import { Input, Textarea, Button } from '@heroui/react';
import { Save, Sparkles, Loader2 } from 'lucide-react';
import { translateText } from '@/app/components/remote/actions';
import { clsx } from 'clsx';

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

    const [isTranslating, setIsTranslating] = useState(false);
    const [isTranslatingUk, setIsTranslatingUk] = useState(false);
    const [isTranslatingEn, setIsTranslatingEn] = useState(false);

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

    const handleTranslate = async (targetLang?: 'uk' | 'en') => {
        const textToTranslate = localState.ru;
        if (!textToTranslate) return;
        
        if (targetLang === 'uk' && isTranslatingUk) return;
        if (targetLang === 'en' && isTranslatingEn) return;
        if (!targetLang && isTranslating) return;

        if (targetLang === 'uk') setIsTranslatingUk(true);
        else if (targetLang === 'en') setIsTranslatingEn(true);
        else setIsTranslating(true);
        
        try {
            const result = await translateText(textToTranslate, targetLang);
            
            if (result.error) {
                console.error(`Translation failed: ${result.error}`);
                // Could show toast here if we had access to it, or just alert/log
                return;
            }

            const updates: Partial<Task> = {};
            if (result.uk) {
                updates.uk = result.uk;
                setLocalState(prev => ({ ...prev, uk: result.uk! }));
            }
            if (result.en) {
                updates.en = result.en;
                setLocalState(prev => ({ ...prev, en: result.en! }));
            }

            if (Object.keys(updates).length > 0) {
                onUpdate(task.id, updates);
            }

        } catch (error) {
            console.error(error);
        } finally {
            if (targetLang === 'uk') setIsTranslatingUk(false);
            else if (targetLang === 'en') setIsTranslatingEn(false);
            else setIsTranslating(false);
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
                
                {/* Russian (Source) */}
                <div className="flex flex-col gap-1 relative group/ru">
                    <span className="text-xs font-semibold text-default-600">Russian (RU - Source)</span>
                    <Textarea
                        minRows={2}
                        value={localState.ru}
                        onValueChange={(val) => handleChange('ru', val)}
                        onBlur={() => handleBlur('ru')}
                        placeholder="Текст на русском..."
                        variant="faded"
                    />
                    {/* Translate All Button */}
                    {localState.ru && (
                        <div className="absolute right-1 top-6 z-10">
                            <Button
                                isIconOnly
                                size="sm"
                                variant="light"
                                className="text-default-400 hover:text-warning"
                                onPress={() => handleTranslate()}
                                isLoading={isTranslating}
                                title="Translate to all languages"
                            >
                                {!isTranslating && <Sparkles size={16} />}
                            </Button>
                        </div>
                    )}
                </div>

                {/* English */}
                <div className="flex flex-col gap-1 relative group/en">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-default-600">English (EN)</span>
                    </div>
                    <div className="relative">
                        <Textarea
                            minRows={2}
                            value={localState.en}
                            onValueChange={(val) => handleChange('en', val)}
                            onBlur={() => handleBlur('en')}
                            placeholder="English text..."
                            variant="faded"
                        />
                         {/* Translate EN Button */}
                         {localState.ru && (
                            <div className="absolute right-1 top-1 z-10">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    className="text-default-400 hover:text-warning"
                                    onPress={() => handleTranslate('en')}
                                    isLoading={isTranslatingEn}
                                    title="Translate from RU to EN"
                                >
                                    {!isTranslatingEn && <Sparkles size={16} />}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Ukrainian */}
                <div className="flex flex-col gap-1 relative group/uk">
                    <div className="flex justify-between items-center">
                        <span className="text-xs font-semibold text-default-600">Ukrainian (UK)</span>
                    </div>
                    <div className="relative">
                        <Textarea
                            minRows={2}
                            value={localState.uk}
                            onValueChange={(val) => handleChange('uk', val)}
                            onBlur={() => handleBlur('uk')}
                            placeholder="Текст українською..."
                            variant="faded"
                        />
                        {/* Translate UK Button */}
                        {localState.ru && (
                            <div className="absolute right-1 top-1 z-10">
                                <Button
                                    isIconOnly
                                    size="sm"
                                    variant="light"
                                    className="text-default-400 hover:text-warning"
                                    onPress={() => handleTranslate('uk')}
                                    isLoading={isTranslatingUk}
                                    title="Translate from RU to UK"
                                >
                                    {!isTranslatingUk && <Sparkles size={16} />}
                                </Button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

