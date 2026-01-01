'use client';

import React, { useState, useEffect } from 'react';
import { Popover, PopoverTrigger, PopoverContent, Button, Input, PopoverProps, Checkbox } from '@heroui/react';
import { clsx } from 'clsx';
import { Check, Trash2 } from 'lucide-react';
import { DeleteConfirmationModal } from '@/app/components/DeleteModal';

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

interface EditProjectPopoverProps {
    children: React.ReactNode;
    initialTitle: string;
    initialColor: string;
    initialShowDocs: boolean;
    initialIsHighlighted: boolean;
    // Updated signature to include modules
    onUpdate: (title: string, color: string, showDocs: boolean, isHighlighted: boolean, hasUi: boolean, hasDocs: boolean) => Promise<void> | void;
    onDelete: () => Promise<void> | void;
    placement?: PopoverProps['placement'];
    isSatellite?: boolean; 
    hasUiSatellite?: boolean;
    hasDocsSatellite?: boolean;
}

export const EditProjectPopover = ({ 
    children, 
    initialTitle,
    initialColor,
    initialShowDocs = false,
    initialIsHighlighted = false,
    onUpdate,
    onDelete,
    placement = "bottom-end",
    isSatellite = false,
    hasUiSatellite = false,
    hasDocsSatellite = false,
}: EditProjectPopoverProps) => {
    const [isOpen, setIsOpen] = useState(false);
    
    // Form State
    const [title, setTitle] = useState(initialTitle);
    const [selectedColor, setSelectedColor] = useState(initialColor);
    const [showDocs, setShowDocs] = useState(initialShowDocs);
    const [isHighlighted, setIsHighlighted] = useState(initialIsHighlighted);
    
    // Modules State
    const [hasUi, setHasUi] = useState(hasUiSatellite);
    const [hasDocs, setHasDocs] = useState(hasDocsSatellite);

    const [isLoading, setIsLoading] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [isModified, setIsModified] = useState(false);

    // Reset state when popover opens or props change
    useEffect(() => {
        if (isOpen) {
            setTitle(initialTitle);
            setSelectedColor(initialColor || COLORS[0].value);
            setShowDocs(initialShowDocs);
            setIsHighlighted(initialIsHighlighted);
            setHasUi(hasUiSatellite);
            setHasDocs(hasDocsSatellite);
            setIsModified(false);
        }
    }, [isOpen, initialTitle, initialColor, initialShowDocs, initialIsHighlighted, hasUiSatellite, hasDocsSatellite]);

    // Track modifications for Save button state
    useEffect(() => {
        const isChanged = 
            title !== initialTitle || 
            selectedColor !== initialColor || 
            isHighlighted !== initialIsHighlighted ||
            hasUi !== hasUiSatellite ||
            hasDocs !== hasDocsSatellite;
            
        setIsModified(isChanged);
    }, [title, selectedColor, isHighlighted, hasUi, hasDocs, initialTitle, initialColor, initialIsHighlighted, hasUiSatellite, hasDocsSatellite]);


    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        if (open) {
            setIsDeleting(false);
        }
    };

    const handleSubmit = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!title.trim()) return;
        if (!isModified) return;

        setIsLoading(true);
        try {
            await onUpdate(title, selectedColor, showDocs, isHighlighted, hasUi, hasDocs);
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
                showArrow ={false}
                offset={10}
                classNames={{
                    content: "p-0"
                }}
            >
                <PopoverTrigger>
                    {children}
                </PopoverTrigger>
                <PopoverContent >
                    <div className="px-3 py-3 w-[280px]">
                        <p className="text-small font-bold text-foreground mb-2">
                            Edit Project
                        </p>
                        <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
                            <Input 
                                autoFocus
                                size="sm"
                                variant="bordered"
                                label="Name"
                                placeholder="Project Name"
                                value={title}
                                onValueChange={setTitle}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault(); 
                                        handleSubmit();
                                    }
                                }}
                            />

                            <div className="flex flex-col gap-1.5">
                                {!isSatellite && (
                                    <>
                                        <span className="text-tiny text-default-500">Color</span>
                                        <div className="flex flex-wrap gap-2 justify-between px-1">
                                            {COLORS.map((color) => (
                                                <button
                                                    key={color.value}
                                                    type="button"
                                                    onClick={() => setSelectedColor(color.value)}
                                                    className={clsx(
                                                        "w-6 h-6 rounded-full transition-transform hover:scale-110 flex items-center justify-center outline-none ring-offset-1 ring-offset-content1",
                                                        selectedColor?.toLowerCase() === color.value.toLowerCase() && "ring-2 ring-primary scale-110"
                                                    )}
                                                    style={{ backgroundColor: color.value }}
                                                    title={color.name}
                                                >
                                                    {selectedColor?.toLowerCase() === color.value.toLowerCase() && (
                                                        <Check size={14} className="text-white drop-shadow-sm" />
                                                    )}
                                                </button>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                            
                            {!isSatellite && (
                                <div className="px-1 flex flex-col gap-2">
                            

                                    <Checkbox 
                                        isSelected={isHighlighted} 
                                        onValueChange={setIsHighlighted}
                                        size="sm"
                                        color="secondary"
                                    >
                                        Highlight Project
                                    </Checkbox>
                                </div>
                            )}

                            {/* Modules Section */}
                            {!isSatellite && (
                                <div className="px-1 flex flex-col gap-2 pt-2 border-t border-divider mt-1">
                                    <span className="text-tiny text-default-500 font-semibold uppercase">Modules</span>
                                    <Checkbox 
                                        isSelected={hasUi} 
                                        onValueChange={setHasUi}
                                        size="sm"
                                        color="secondary"
                                        classNames={{ label: "text-small" }}
                                    >
                                        Enable UI Project
                                    </Checkbox>
                                    <Checkbox 
                                        isSelected={hasDocs} 
                                        onValueChange={setHasDocs}
                                        size="sm"
                                        color="warning"
                                        classNames={{ label: "text-small" }}
                                    >
                                        Enable Docs Project
                                    </Checkbox>
                                </div>
                            )}

                            <div className="flex gap-2 justify-between pt-2 border-t border-divider mt-1">
                                {!isSatellite ? (
                                    <Button 
                                        size="sm" 
                                        color="danger" 
                                        variant="light" 
                                        isIconOnly
                                        onPress={handleDeleteClick}
                                        isLoading={isDeleting}
                                        isDisabled={isLoading}
                                        title="Delete Project"
                                    >
                                        <Trash2 size={18} />
                                    </Button>
                                ) : (
                                    <div /> // Spacer if delete button is hidden
                                )}

                                <div className="flex gap-2">
                                    <Button size="sm" variant="light" onPress={() => setIsOpen(false)} isDisabled={isDeleting || isLoading}>
                                        Cancel
                                    </Button>
                                    <Button 
                                        size="sm" 
                                        color="primary"
                                        type="submit" 
                                        isLoading={isLoading}
                                        isDisabled={!title.trim() || isDeleting || !isModified}
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
                entityType="project"
                title="Delete Project"
            />
        </>
    );
};
