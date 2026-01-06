import { Task } from "@/app/types";

interface TaskUpdate {
    id: string;
    sort_order: number;
    group_id?: string | null;
}

/**
 * Compares current tasks state with desired new state (order/group)
 * and returns only the updates that are actually needed.
 * 
 * @param currentTasks The full list of tasks in their CURRENT state (from DB/RxDB perspective, or previous optimistic state)
 * @param updates The proposed updates (usually from re-indexing 0..N)
 * @returns Filtered array of updates where sort_order or group_id actually changed
 */
export function getRealTaskUpdates(
    currentTasks: Task[],
    updates: TaskUpdate[]
): TaskUpdate[] {
    return updates.filter(update => {
        const originalTask = currentTasks.find(t => t.id === update.id);
        
        // If task is not found (e.g. new task not yet in state?), we should probably update it.
        // But usually currentTasks includes the optimistic new task if we call this after setTasks.
        if (!originalTask) return true;

        const isSortChanged = originalTask.sort_order !== update.sort_order;
        const isGroupChanged = update.group_id !== undefined && originalTask.group_id !== update.group_id;

        return isSortChanged || isGroupChanged;
    });
}

