import React from 'react';
import { DropdownItem } from '@heroui/react';
import { 
    Trash2, 
    ArrowUp,
    ArrowDown
} from 'lucide-react';
import { Task } from '@/app/types';

interface UiContextMenuProps {
    task: Task;
    onUpdate: (id: string, updates: Partial<Task>) => void;
    onDelete: (id: string) => void;
    onAddGap: () => void;
    onInsertTask: (position: 'above' | 'below') => void;
    isInsideGroup?: boolean;
    closeMenu: () => void;
}

type MenuItemType = 
   | 'insertAbove' | 'insertBelow' | 'insertGap'
   | 'makeGroup' | 'revertToTask'
   | 'separator' 
   | 'delete';

export const UiContextMenu = ({
    task,
    onUpdate,
    onDelete,
    onAddGap,
    onInsertTask,
    isInsideGroup,
    closeMenu
}: UiContextMenuProps) => {
    
    const isGroup = task.task_type === 'group';
    const isGap = task.task_type === 'gap';

    // --- CONFIGURATION ---
    const getMenuLayout = (): MenuItemType[] => {
        if (isGap) return [
            'insertAbove', 
            'insertBelow', 
            'separator', 
            'delete'
        ];

        if (isGroup) return [
            'revertToTask', 
            'separator', 
            'insertBelow', // Insert item below group
            'separator', 
            'delete'
        ];

        if (isInsideGroup) return [
            'insertAbove', 
            'insertBelow', 
            'insertGap', 
            'separator', 
            'delete'
        ];

        // Root Item
        return [
            'makeGroup',
            'separator',
            'insertAbove',
            'insertBelow',
            'insertGap',
            'separator',
            'delete'
        ];
    };

    const handleClose = () => closeMenu();

    // --- RENDERERS ---
    const renderItem = (type: MenuItemType, index: number) => {
        switch (type) {
            case 'separator':
                return <DropdownItem key={`sep-${index}`} className="h-px bg-default-200 p-0 my-1 pointer-events-none" textValue="separator" />;

            case 'insertAbove':
                return (
                    <DropdownItem key="insert-above" onPress={() => { onInsertTask('above'); handleClose(); }} endContent={<ArrowUp size={14} className="text-default-400" />}>
                        Insert Item Above
                    </DropdownItem>
                );

            case 'insertBelow':
                return (
                    <DropdownItem key="insert-below" onPress={() => { onInsertTask('below'); handleClose(); }} endContent={<ArrowDown size={14} className="text-default-400" />}>
                        Insert Item Below
                    </DropdownItem>
                );

            case 'insertGap':
                return (
                    <DropdownItem key="make-gap" onPress={() => { onAddGap(); handleClose(); }} endContent={<ArrowDown size={14} className="text-default-400" />}>
                        Insert Gap Below
                    </DropdownItem>
                );

            case 'makeGroup':
                return (
                    <DropdownItem key="make-group" onPress={() => { onUpdate(task.id, { task_type: 'group', is_closed: false }); handleClose(); }}>
                        Make As Group
                    </DropdownItem>
                );

            case 'revertToTask':
                return (
                    <DropdownItem key="revert-task" onPress={() => { onUpdate(task.id, { task_type: 'task', group_color: undefined }); handleClose(); }}>
                        Revert To Item
                    </DropdownItem>
                );

            case 'delete':
                return (
                    <DropdownItem key="delete" className="text-danger" color="danger" startContent={<Trash2 size={16} />} onPress={() => { onDelete(task.id); handleClose(); }}>
                        {isGap ? 'Delete Gap' : isGroup ? 'Delete Group' : 'Delete Item'}
                    </DropdownItem>
                );

            default:
                return null;
        }
    };

    const menuLayout = getMenuLayout();

    // Remove consecutive separators or leading/trailing separators if any (simple cleanup)
    const cleanedLayout = menuLayout.reduce((acc: MenuItemType[], item) => {
        if (item === 'separator') {
            if (acc.length > 0 && acc[acc.length - 1] !== 'separator') {
                acc.push(item);
            }
        } else {
            acc.push(item);
        }
        return acc;
    }, []);
    
    if (cleanedLayout.length > 0 && cleanedLayout[cleanedLayout.length - 1] === 'separator') {
        cleanedLayout.pop();
    }

    return (
        <>
            {cleanedLayout.map((item, index) => renderItem(item, index))}
        </>
    );
};
