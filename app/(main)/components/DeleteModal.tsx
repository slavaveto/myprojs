'use client';

import React, { useState } from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button, Input } from '@heroui/react';
import { AlertTriangle } from 'lucide-react';

interface DeleteConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => Promise<void> | void;
    entityName: string; // Название удаляемого элемента (например, имя проекта)
    entityType: 'project' | 'folder' | 'task';
    title?: string;
    description?: string;
}

export const DeleteConfirmationModal = ({
    isOpen,
    onClose,
    onConfirm,
    entityName,
    entityType,
    title = 'Confirm Deletion',
    description
}: DeleteConfirmationModalProps) => {
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Сброс при открытии
    React.useEffect(() => {
        if (isOpen) {
            setInputValue('');
            setIsLoading(false);
        }
    }, [isOpen]);

    const handleConfirm = async () => {
        setIsLoading(true);
        try {
            await onConfirm();
            onClose();
        } catch (error) {
        } finally {
            setIsLoading(false);
        }
    };

    const isInputMatch = inputValue === entityName;
    const requiresInput = entityType === 'project'; // Ввод имени нужен только для проектов (пока)

    return (
        <Modal 
            isOpen={isOpen} 
            onOpenChange={(open) => !open && onClose()}
            placement="center"
            backdrop="blur"
        >
            <ModalContent>
                <ModalHeader className="flex flex-col gap-1 text-danger">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={24} />
                        {title}
                    </div>
                </ModalHeader>
                <ModalBody>
                    <p className="text-default-500">
                        Are you sure you want to delete the {entityType} <span className="font-bold text-foreground">"{entityName}"</span>?
                    </p>
                    
                    {description && (
                         <p className="text-default-500 text-sm mt-2">
                            {description}
                        </p>
                    )}

                    {entityType === 'project' && !description && (
                        <p className="text-default-500 text-sm mt-2">
                            This action cannot be undone. All folders will be permanently deleted. Tasks will be moved to archive.
                        </p>
                    )}

                    {requiresInput && (
                        <div className="mt-4">
                            <label className="text-xs font-medium text-default-500 mb-1 block">
                                Please type <span className="font-bold select-all">{entityName}</span> to confirm:
                            </label>
                            <Input
                                value={inputValue}
                                onValueChange={setInputValue}
                                placeholder={entityName}
                                variant="bordered"
                                color="danger"
                                autoFocus
                            />
                        </div>
                    )}
                </ModalBody>
                <ModalFooter>
                    <Button variant="light" onPress={onClose} isDisabled={isLoading}>
                        Cancel
                    </Button>
                    <Button 
                        color="danger" 
                        onPress={handleConfirm}
                        isLoading={isLoading}
                        isDisabled={requiresInput ? !isInputMatch : false}
                    >
                        Delete
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
};

