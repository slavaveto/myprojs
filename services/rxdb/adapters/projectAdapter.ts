import { MyDatabase } from '../db';
import { Project } from '@/app/types';

export class RxProjectAdapter {
    constructor(private db: MyDatabase, private userId: string) {}

    // Чтение (обычно через подписку, но для совместимости)
    async getProjects(): Promise<Project[]> {
        const docs = await this.db.projects.find({
            selector: { is_deleted: { $ne: true } },
            sort: [{ sort_order: 'asc' }]
        }).exec();
        return docs.map(d => d.toJSON()) as Project[];
    }

    async getProject(id: string): Promise<Project | null> {
        const doc = await this.db.projects.findOne(id).exec();
        return doc ? (doc.toJSON() as Project) : null;
    }

    // В оригинале был getProjectsWithFolders - сложный запрос с джойном.
    // RxDB не умеет джойнить "в один объект" легко без плагинов populate.
    // Но для навигации нам нужна структура.
    // Однако в useProjectData.ts это используется для projectsStructure.
    // Возможно, стоит переписать тот кусок на реактивный подход или собрать вручную.
    async getProjectsWithFolders(): Promise<any[]> {
        const projects = await this.getProjects();
        const folders = await this.db.folders.find({
            selector: { is_deleted: { $ne: true } }
        }).exec();
        
        return projects.map(p => ({
            ...p,
            folders: folders
                .filter(f => f.project_id === p.id)
                .map(f => f.toJSON())
                .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
        }));
    }

    async createProject(title: string, color: string): Promise<Project> {
        const id = crypto.randomUUID();
        const now = new Date().toISOString();
        
        // Get max sort order
        const last = await this.db.projects.findOne({
            selector: {},
            sort: [{ sort_order: 'desc' }]
        }).exec();
        const sortOrder = last ? (last.sort_order || 0) + 1 : 0;

        const doc = await this.db.projects.insert({
            id,
            user_id: this.userId,
            title,
            proj_color: color,
            sort_order: sortOrder,
            is_highlighted: false,
            created_at: now,
            updated_at: now,
            is_deleted: false,
            // остальные null
        });
        return doc.toJSON() as Project;
    }

    async updateProject(id: string, updates: Partial<Project>): Promise<void> {
        const doc = await this.db.projects.findOne(id).exec();
        if (doc) {
            await doc.patch({
                ...updates,
                updated_at: new Date().toISOString()
            });
        }
    }

    async deleteProject(id: string): Promise<void> {
        const doc = await this.db.projects.findOne(id).exec();
        if (doc) {
            await doc.patch({
                is_deleted: true,
                updated_at: new Date().toISOString()
            });
            
            // Soft delete folders
            const folders = await this.db.folders.find({ selector: { project_id: id } }).exec();
            await Promise.all(folders.map(f => f.patch({ is_deleted: true, updated_at: new Date().toISOString() })));

            // Soft delete tasks (need to find folders first or use index?)
            // We found folders.
            const folderIds = folders.map(f => f.id);
            if (folderIds.length > 0) {
                const tasks = await this.db.tasks.find({ selector: { folder_id: { $in: folderIds } } }).exec();
                await Promise.all(tasks.map(t => t.patch({ is_deleted: true, updated_at: new Date().toISOString() })));
            }
        }
    }
    
    // UI projects logic (remote slug) - not implemented for local adapter usually,
    // but if needed:
    async getProjectSlug(parentId: string): Promise<string | null> {
        // Local projects don't have slugs usually, or stored in remote_proj_slug field
        const doc = await this.db.projects.findOne(parentId).exec();
        return doc && doc.remote_proj_slug ? doc.remote_proj_slug : null;
    }
}

