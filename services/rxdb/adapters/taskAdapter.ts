import { MyDatabase } from '../db';
import { Task } from '@/app/types';

export class RxTaskAdapter {
    constructor(private db: MyDatabase, private userId: string) {}

    // Чтение (для совместимости, если вдруг понадобится)
    async getTasks(projectId: string): Promise<Task[]> {
        // Чтобы получить задачи проекта, нужно сначала найти папки проекта
        // Так как в задачах нет project_id.
        // Но здесь мы не можем легко сделать join.
        // Однако, хук useTaskData обычно работает в контексте уже загруженных папок?
        // Нет, getTasks(projectId) подразумевает получение ВСЕХ задач проекта.
        
        // 1. Получаем ID папок проекта
        const folders = await this.db.folders.find({
            selector: {
                project_id: projectId,
                is_deleted: { $ne: true }
            }
        }).exec();
        
        const folderIds = folders.map(f => f.id);
        
        // 2. Получаем задачи
        if (folderIds.length === 0) return [];
        
        const tasks = await this.db.tasks.find({
            selector: {
                folder_id: { $in: folderIds },
                is_deleted: { $ne: true }
            }
        }).exec(); // Сортировку сделаем в памяти хука или тут? Хук сортирует.

        return tasks.map(t => t.toJSON()) as Task[];
    }

    async createTask(folderId: string, content: string, sortOrder: number): Promise<Task> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const doc = await this.db.tasks.insert({
            id,
            user_id: this.userId,
            folder_id: folderId,
            content,
            sort_order: sortOrder,
            is_completed: false,
            is_deleted: false,
            created_at: now,
            updated_at: now,
            task_type: 'task',
            is_closed: false,
            is_today: false,
            // остальные поля null по умолчанию
        });
        return doc.toJSON() as Task;
    }

    async updateTask(id: string, updates: Partial<Task>): Promise<void> {
        const doc = await this.db.tasks.findOne(id).exec();
        if (doc) {
            await doc.patch({
                ...updates,
                updated_at: new Date().toISOString()
            });
        }
    }

    async deleteTask(id: string): Promise<void> {
        const doc = await this.db.tasks.findOne(id).exec();
        if (doc) {
            await doc.patch({
                is_deleted: true,
                updated_at: new Date().toISOString()
            });
        }
    }

    async updateTaskOrder(updates: { id: string, sort_order: number, group_id?: string | null }[]): Promise<void> {
        await Promise.all(updates.map(async (u) => {
            const doc = await this.db.tasks.findOne(u.id).exec();
            if (doc) {
                // Check if changes are needed to avoid unnecessary updates
                const currentSort = doc.sort_order;
                const currentGroup = doc.group_id; // RxDB returns null for undefined/null fields if consistent with schema
                
                const isSortChanged = currentSort !== u.sort_order;
                // Strict check for group_id: if undefined in update, we ignore it. If null/string, we compare.
                // Note: doc.group_id might be null or string. u.group_id might be null or string.
                const isGroupChanged = u.group_id !== undefined && currentGroup !== u.group_id;
                
                if (isSortChanged || isGroupChanged) {
                    const patchData: any = {
                        updated_at: new Date().toISOString()
                    };
                    
                    if (isSortChanged) patchData.sort_order = u.sort_order;
                    if (isGroupChanged) patchData.group_id = u.group_id;
                    
                    await doc.patch(patchData);
                }
            }
        }));
    }
    
    async moveTaskToFolder(taskId: string, folderId: string): Promise<void> {
        const doc = await this.db.tasks.findOne(taskId).exec();
        if (doc) {
            await doc.patch({
                folder_id: folderId,
                updated_at: new Date().toISOString()
            });
        }
    }
}

