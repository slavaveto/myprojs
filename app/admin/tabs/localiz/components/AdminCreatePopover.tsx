'use client';

import React, { useState } from 'react';
import { Popover, PopoverTrigger, PopoverContent, Input, Button, PopoverProps } from '@heroui/react';

interface AdminCreatePopoverProps {
    children: React.ReactNode;
    onCreate: (value: string) => Promise<void> | void;
    title?: string;
    inputPlaceholder?: string;
    placement?: PopoverProps['placement'];
}

export const AdminCreatePopover = ({ 
    children, 
    onCreate, 
    title = "Create New Item", 
    inputPlaceholder = "Enter name",
    placement = "bottom"
}: AdminCreatePopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [value, setValue] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            setValue(""); 
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!value.trim()) return;

        setIsLoading(true);
        try {
            await onCreate(value);
            setIsOpen(false);
            setValue("");
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Popover 
            isOpen={isOpen} 
            onOpenChange={handleOpenChange}
            placement={placement}
            showArrow
            offset={10}
        >
            <PopoverTrigger>
                {children}
            </PopoverTrigger>
            <PopoverContent>
                <div className="px-1 py-2 w-[240px]">
                    <p className="text-small font-bold text-foreground mb-2 px-1">
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
                            isDisabled={isLoading}
                        />
                        <div className="flex justify-end gap-2">
                             <Button size="sm" variant="light" onPress={() => setIsOpen(false)} isDisabled={isLoading}>
                                Cancel
                             </Button>
                             <Button size="sm" color="primary" type="submit" isLoading={isLoading} isDisabled={!value.trim()}>
                                Create
                             </Button>
                        </div>
                    </form>
                </div>
            </PopoverContent>
        </Popover>
    );
};

