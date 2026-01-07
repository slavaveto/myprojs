import React, { useState, useEffect } from 'react';
import { Popover, PopoverTrigger, PopoverContent, Button, Input } from '@heroui/react';

interface FolderFormPopoverProps {
    mode: 'create' | 'edit';
    initialTitle?: string;
    onSubmit: (title: string) => void;
    trigger: React.ReactNode;
}

export const FolderFormPopover = ({ mode, initialTitle = '', onSubmit, trigger }: FolderFormPopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState(initialTitle);

    // Update title if initialTitle changes (e.g. for edit mode)
    useEffect(() => {
        if (isOpen) {
            setTitle(initialTitle);
        }
    }, [isOpen, initialTitle]);

    const handleSubmit = (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!title.trim()) return;
        
        onSubmit(title);
        setIsOpen(false);
        if (mode === 'create') setTitle('');
    };

    return (
        <Popover 
            isOpen={isOpen} 
            onOpenChange={setIsOpen} 
            placement="bottom-start"
            shouldFlip
        >
            <PopoverTrigger>
                {trigger}
            </PopoverTrigger>
            <PopoverContent className="p-2">
                <form onSubmit={handleSubmit} className="flex gap-2 w-[240px]">
                    <Input
                        size="sm"
                        value={title}
                        onValueChange={setTitle}
                        placeholder={mode === 'create' ? "New Folder Name" : "Folder Name"}
                        autoFocus
                        variant="bordered"
                        classNames={{
                            input: "text-small",
                        }}
                    />
                    <Button 
                        size="sm" 
                        color="primary" 
                        type="submit"
                        isDisabled={!title.trim()}
                        className="min-w-fit px-3 font-medium"
                    >
                        {mode === 'create' ? 'Add' : 'Save'}
                    </Button>
                </form>
            </PopoverContent>
        </Popover>
    );
};

