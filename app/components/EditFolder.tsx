'use client';

import React, { useState, useEffect } from 'react';
import { Popover, PopoverTrigger, PopoverContent, Button, Input, PopoverProps } from '@heroui/react';
import { Trash2, ArrowLeft, ArrowRight } from 'lucide-react';
import { DeleteConfirmationModal } from '@/app/components/DeleteModal';

interface EditFolderPopoverProps {
    children: React.ReactNode;
    initialTitle: string;
    onUpdate: (title: string) => Promise<void> | void;
    onDelete: () => Promise<void> | void;
    onMove?: (direction: 'left' | 'right') => void;
    canMoveLeft?: boolean;
    canMoveRight?: boolean;
    placement?: PopoverProps['placement'];
}

export const EditFolderPopover = ({ 
    children, 
    initialTitle, 
    onUpdate, 
    onDelete,
    onMove,
    canMoveLeft = true,
    canMoveRight = true,
    placement = "bottom"
}: EditFolderPopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const [title, setTitle] = useState(initialTitle);
    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    useEffect(() => {
        setTitle(initialTitle);
    }, [initialTitle]);

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            setTitle(initialTitle);
            setIsDeleting(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!title.trim()) return;

        setIsLoading(true);
        try {
            await onUpdate(title);
            setIsOpen(false);
        } catch (err) {
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDeleteClick = () => {
        setIsOpen(false); 
        setIsDeleteModalOpen(true);
    };

    const handleConfirmDelete = async () => {
        setIsDeleting(true); 
        try {
            await onDelete();
        } catch (err) {
            console.error(err);
            setIsDeleting(false);
        }
    };

    return (
        <>
            <Popover 
                isOpen={isOpen} 
                onOpenChange={handleOpenChange}
                placement={placement}
                showArrow={false}
                offset={10}
                classNames={{
                    content: "p-0"
                }}
            >
                <PopoverTrigger>
                    {children}
                </PopoverTrigger>
                <PopoverContent>
                    <div className="px-3 py-3 w-[300px]">
                        <p className="text-small font-bold text-foreground mb-2">
                            Edit Folder
                        </p>
                        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
                            <Input 
                                autoFocus
                                size="sm"
                                variant="bordered"
                                label="Name"
                                placeholder="Folder Name"
                                value={title}
                                onValueChange={setTitle}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault(); 
                                        handleSubmit();
                                    }
                                }}
                            />

                            <div className="flex gap-2 justify-between pt-2 border-t border-divider mt-1">
                                <div className="flex gap-1">
                                    <Button 
                                        size="sm" 
                                        color="danger" 
                                        variant="light" 
                                        isIconOnly
                                        onPress={handleDeleteClick}
                                        isLoading={isDeleting}
                                        isDisabled={isLoading}
                                        title="Delete Folder"
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                    
                                    {onMove && (
                                        <>
                                            <Button
                                                size="sm"
                                                variant="light"
                                                isIconOnly
                                                onPress={() => onMove('left')}
                                                isDisabled={!canMoveLeft}
                                                title="Move Left"
                                            >
                                                <ArrowLeft size={18} />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="light"
                                                isIconOnly
                                                onPress={() => onMove('right')}
                                                isDisabled={!canMoveRight}
                                                title="Move Right"
                                            >
                                                <ArrowRight size={18} />
                                            </Button>
                                        </>
                                    )}
                                </div>

                                <div className="flex gap-2">
                                    <Button size="sm" variant="light" onPress={() => setIsOpen(false)} isDisabled={isDeleting || isLoading}>
                                        Cancel
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        color="primary"
                                        type="submit" 
                                        isLoading={isLoading}
                                        isDisabled={!title.trim() || isDeleting}
                                    >
                                        Save
                                    </Button>
                                </div>
                            </div>
                        </form>
                    </div>
                </PopoverContent>
            </Popover>

            <DeleteConfirmationModal 
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleConfirmDelete}
                entityName={initialTitle}
                entityType="folder"
                title="Delete Folder"
                description="This will also delete all tasks inside this folder."
            />
        </>
    );
};

