import { MyDatabase } from '../db';
import { Folder } from '@/app/types';

export class RxFolderAdapter {
    constructor(private db: MyDatabase) {}

    // Чтение (обычно не используется для реактивности, но нужно для совместимости)
    async getFolders(projectId: string): Promise<Folder[]> {
        const docs = await this.db.folders.find({
            selector: {
                project_id: projectId,
                is_deleted: { $ne: true }
            },
            sort: [{ sort_order: 'asc' }]
        }).exec();
        return docs.map(d => d.toJSON()) as Folder[];
    }

    async createFolder(projectId: string, title: string, sortOrder: number): Promise<Folder> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        const doc = await this.db.folders.insert({
            id,
            project_id: projectId,
            title,
            sort_order: sortOrder,
            created_at: now,
            updated_at: now,
            is_deleted: false
        });
        return doc.toJSON() as Folder;
    }

    async updateFolder(id: string, updates: Partial<Folder>): Promise<void> {
        const doc = await this.db.folders.findOne(id).exec();
        if (doc) {
            await doc.patch({
                ...updates,
                updated_at: new Date().toISOString()
            });
        }
    }

    async deleteFolder(id: string): Promise<void> {
        const doc = await this.db.folders.findOne(id).exec();
        if (doc) {
            // Soft Delete
            await doc.patch({
                is_deleted: true,
                updated_at: new Date().toISOString()
            });
            
            // Также нужно пометить задачи как удаленные? 
            // В оригинальном сервисе мы удаляли задачи.
            // Но в RxDB это можно сделать реактивно или вручную.
            // Сделаем вручную для надежности.
            const tasks = await this.db.tasks.find({
                selector: { folder_id: id }
            }).exec();
            
            await Promise.all(tasks.map(t => t.patch({
                is_deleted: true,
                updated_at: new Date().toISOString()
            })));
        }
    }

    async updateFolderOrder(updates: { id: string, sort_order: number }[]): Promise<void> {
        // RxDB bulk update? Or sequential.
        // Sequential is safer for now.
        await Promise.all(updates.map(async (u) => {
            const doc = await this.db.folders.findOne(u.id).exec();
            if (doc) {
                await doc.patch({
                    sort_order: u.sort_order,
                    updated_at: new Date().toISOString()
                });
            }
        }));
    }
}

