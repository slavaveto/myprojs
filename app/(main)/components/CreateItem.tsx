'use client';

import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent, Button, Input, PopoverProps } from '@heroui/react';
import { clsx } from 'clsx';
import { Check } from 'lucide-react';

const COLORS = [
    { name: 'Blue', value: '#3b82f6' },      // blue-500
    { name: 'Green', value: '#22c55e' },     // green-500
    { name: 'Orange', value: '#f97316' },    // orange-500
    { name: 'Red', value: '#ef4444' },       // red-500
    { name: 'Purple', value: '#a855f7' },    // purple-500
    { name: 'Cyan', value: '#06b6d4' },      // cyan-500
    { name: 'Pink', value: '#ec4899' },      // pink-500
    { name: 'Gray', value: '#6b7280' },      // gray-500
];

export interface CreateItemPopoverProps {
    children: React.ReactNode;
    title: string;
    inputPlaceholder?: string;
    onCreate: (value: string, color?: string) => Promise<void> | void;
    placement?: PopoverProps['placement'];
    withColorPicker?: boolean;
}

export const CreateItemPopover = ({ 
    children, 
    title, 
    inputPlaceholder, 
    onCreate, 
    placement = "bottom",
    withColorPicker = false
}: CreateItemPopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [value, setValue] = useState('');
    const [selectedColor, setSelectedColor] = useState(COLORS[0].value);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!value.trim()) return;

        setIsLoading(true);
        try {
            await onCreate(value, withColorPicker ? selectedColor : undefined);
            setIsOpen(false);
            setValue('');
            if (withColorPicker) setSelectedColor(COLORS[0].value);
        } catch (err) {
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Popover 
            isOpen={isOpen} 
            onOpenChange={(open) => {
                setIsOpen(open);
                if (open) {
                    setValue(''); 
                    if (withColorPicker) setSelectedColor(COLORS[0].value);
                }
            }}
            placement={placement}
            showArrow ={false}
            offset={10}
            classNames={{
                content: "p-0"
            }}
        >
            <PopoverTrigger>
                {children}
            </PopoverTrigger>
            <PopoverContent>
                <div className="px-3 py-3 w-[280px]">
                    <p className="text-small font-bold text-foreground mb-2">
                        {title}
                    </p>
                    <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
                        <Input 
                            autoFocus
                            size="sm"
                            variant="bordered"
                            placeholder={inputPlaceholder}
                            value={value}
                            onValueChange={setValue}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault(); 
                                    handleSubmit();
                                }
                            }}
                        />

                        {withColorPicker && (
                            <div className="flex flex-wrap gap-2 justify-between px-1">
                                {COLORS.map((color) => (
                                    <button
                                        key={color.value}
                                        type="button"
                                        onClick={() => setSelectedColor(color.value)}
                                        className={clsx(
                                            "w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center outline-none ring-offset-1 ring-offset-content1",
                                            selectedColor === color.value && "ring-2 ring-primary scale-110"
                                        )}
                                        style={{ backgroundColor: color.value }}
                                        title={color.name}
                                    >
                                        {selectedColor === color.value && (
                                            <Check size={14} className="text-white drop-shadow-sm" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div className="flex gap-2 justify-end pt-1">
                            <Button size="sm" variant="light" onPress={() => setIsOpen(false)}>
                                Cancel
                            </Button>
                            <Button 
                                size="sm" 
                                color="success"
                                className="text-white"
                                type="submit" 
                                isLoading={isLoading}
                                isDisabled={!value.trim()}
                            >
                                Save
                            </Button>
                        </div>
                    </form>
                </div>
            </PopoverContent>
        </Popover>
    );
};
