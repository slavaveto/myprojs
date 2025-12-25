'use client';

import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent, Button, Input, PopoverProps } from '@heroui/react';

interface CreateItemPopoverProps {
    children: React.ReactNode;
    title: string;
    inputPlaceholder?: string;
    onCreate: (value: string) => Promise<void> | void;
    placement?: PopoverProps['placement'];
}

export const CreateItemPopover = ({ children, title, inputPlaceholder, onCreate, placement = "bottom" }: CreateItemPopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [value, setValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!value.trim()) return;

        setIsLoading(true);
        try {
            await onCreate(value);
            setIsOpen(false);
            setValue('');
        } catch (err) {
            console.error(err);
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
                    setValue(''); // Clear on open (or keep draft?) let's clear for now
                }
            }}
            placement={placement}
            showArrow
            offset={10}
            classNames={{
                content: "p-0"
            }}
        >
            <PopoverTrigger>
                {children}
            </PopoverTrigger>
            <PopoverContent>
                <div className="px-3 py-3 w-[260px]">
                    <p className="text-small font-bold text-foreground mb-2">
                        {title}
                    </p>
                    <form className="flex flex-col gap-2" onSubmit={handleSubmit}>
                        <Input 
                            autoFocus
                            size="sm"
                            variant="bordered"
                            placeholder={inputPlaceholder}
                            value={value}
                            onValueChange={setValue}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault(); // Prevent default form submit which might reload
                                    handleSubmit();
                                }
                            }}
                        />
                        <div className="flex gap-2 justify-end mt-1">
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

