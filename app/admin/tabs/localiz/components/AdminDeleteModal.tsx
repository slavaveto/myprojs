'use client';

import React from 'react';
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, Button } from '@heroui/react';
import { AlertTriangle } from 'lucide-react';

interface AdminDeleteModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title?: string;
    description?: string;
    entityName?: string;
    isDeleting?: boolean;
}

export const AdminDeleteModal = ({ 
    isOpen, 
    onClose, 
    onConfirm, 
    title = 'Confirm Deletion', 
    description = 'Are you sure you want to delete this item? This action cannot be undone.',
    entityName,
    isDeleting = false
}: AdminDeleteModalProps) => {
    return (
        <Modal 
            isOpen={isOpen} 
            onOpenChange={onClose}
            backdrop="blur"
        >
            <ModalContent>
                {(onClose) => (
                    <>
                        <ModalHeader className="flex flex-col gap-1 items-center pt-8">
                            <div className="p-3 bg-danger-50 rounded-full mb-2">
                                <AlertTriangle className="w-8 h-8 text-danger" />
                            </div>
                            <span className="text-xl font-semibold text-center">
                                {title}
                            </span>
                        </ModalHeader>
                        <ModalBody className="text-center px-8">
                            <p className="text-default-500">
                                {description}
                            </p>
                            {entityName && (
                                <p className="text-default-700 font-bold mt-2 break-all">
                                    "{entityName}"
                                </p>
                            )}
                        </ModalBody>
                        <ModalFooter className="flex justify-center gap-4 pb-8">
                            <Button 
                                variant="light" 
                                onPress={onClose}
                                isDisabled={isDeleting}
                            >
                                Cancel
                            </Button>
                            <Button 
                                color="danger" 
                                onPress={onConfirm}
                                isLoading={isDeleting}
                            >
                                Delete
                            </Button>
                        </ModalFooter>
                    </>
                )}
            </ModalContent>
        </Modal>
    );
};

