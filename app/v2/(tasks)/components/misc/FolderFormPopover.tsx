import React, { useState, useEffect } from 'react';
import { Popover, PopoverTrigger, PopoverContent, Button, Input } from '@heroui/react';
import { Trash } from 'lucide-react';

interface FolderFormPopoverProps {
    mode: 'create' | 'edit';
    initialTitle?: string;
    onSubmit: (title: string) => void;
    onDelete?: () => void;
    trigger: React.ReactNode;
}

export const FolderFormPopover = ({ mode, initialTitle = '', onSubmit, onDelete, trigger }: FolderFormPopoverProps) => {
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
                    
                    {mode === 'edit' && onDelete && (
                        <Button 
                            isIconOnly
                            size="sm" 
                            color="danger" 
                            variant="flat"
                            onPress={() => {
                                if (confirm('Are you sure you want to delete this folder?')) {
                                    onDelete();
                                    setIsOpen(false);
                                }
                            }}
                            className="min-w-8"
                        >
                            <Trash size={16} /> 
                        </Button>
                    )}

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

