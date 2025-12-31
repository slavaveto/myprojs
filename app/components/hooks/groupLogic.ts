import { Task } from '@/app/types';

export interface GroupUpdate {
    id: string;
    group_id: string | null;
}

/**
 * Scans a sorted list of tasks and calculates the correct group_id for each task
 * based on the presence of 'group' and 'gap' items.
 * 
 * Logic:
 * - 'group' starts a new group context.
 * - 'gap' ends a group context (but belongs to the group above it).
 * - 'task'/'note' inherit the current group context.
 */
export const calculateGroupUpdates = (sortedTasks: Task[]): GroupUpdate[] => {
    let currentGroupId: string | null = null;
    const updates: GroupUpdate[] = [];

    sortedTasks.forEach(t => {
        let myNewGroupId: string | null = null;
        
        // 1. Determine group for THIS task
        if (t.task_type === 'task' || t.task_type === 'note') {
            myNewGroupId = currentGroupId;
        } else if (t.task_type === 'gap') {
             // Gap is the tail of the group above it
             myNewGroupId = currentGroupId; 
        } else {
            // Group header itself doesn't have a parent
            myNewGroupId = null;
        }

        // 2. Update context for NEXT tasks
        if (t.task_type === 'group') {
            currentGroupId = t.id;
        } else if (t.task_type === 'gap') {
            currentGroupId = null;
        }
        
        // Check if changed
        if (t.group_id !== myNewGroupId) {
            updates.push({
                id: t.id,
                group_id: myNewGroupId
            });
        }
    });

    return updates;
};

