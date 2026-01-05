import { 
    createRxDatabase, 
    RxDatabase, 
    RxCollection, 
    addRxPlugin
} from 'rxdb';
import { getRxStorageDexie } from 'rxdb/plugins/storage-dexie';
import { RxDBDevModePlugin } from 'rxdb/plugins/dev-mode';
import { RxDBUpdatePlugin } from 'rxdb/plugins/update';
import { RxDBQueryBuilderPlugin } from 'rxdb/plugins/query-builder';
import { RxDBLeaderElectionPlugin } from 'rxdb/plugins/leader-election';
// @ts-ignore - rxdb-supabase types issue
import { replicateSupabase, SupabaseReplicationOptions } from 'rxdb-supabase';
import { SupabaseClient } from '@supabase/supabase-js';

import { projectSchema, ProjectDocType } from './schemas/projectSchema';
import { folderSchema, FolderDocType } from './schemas/folderSchema';
import { taskSchema, TaskDocType } from './schemas/taskSchema';

// Типы коллекций
export type MyDatabaseCollections = {
    projects: RxCollection<ProjectDocType>;
    folders: RxCollection<FolderDocType>;
    tasks: RxCollection<TaskDocType>;
}

export type MyDatabase = RxDatabase<MyDatabaseCollections>;

// Включаем плагины
addRxPlugin(RxDBUpdatePlugin);
addRxPlugin(RxDBQueryBuilderPlugin);
addRxPlugin(RxDBLeaderElectionPlugin);

if (process.env.NODE_ENV === 'development') {
    addRxPlugin(RxDBDevModePlugin);
}

let dbPromise: Promise<MyDatabase> | null = null;

const createDatabase = async (): Promise<MyDatabase> => {
    console.log('RxDB: Creating database...');
    
    const db = await createRxDatabase<MyDatabaseCollections>({
        name: 'myprojs_db',
        storage: getRxStorageDexie(),
        multiInstance: true,
        eventReduce: true
    });

    await db.addCollections({
        projects: {
            schema: projectSchema
        },
        folders: {
            schema: folderSchema
        },
        tasks: {
            schema: taskSchema
        }
    });

    // Leader Election
    db.waitForLeadership().then(() => {
        console.log('RxDB: This tab is now the LEADER');
    });

    console.log('RxDB: Database created');
    return db;
};

export const getDatabase = () => {
    if (!dbPromise) {
        dbPromise = createDatabase();
    }
    return dbPromise;
};

// Функция запуска репликации (вызывается извне, когда у нас есть supabase клиент)
export const startReplication = async (db: MyDatabase, supabase: SupabaseClient) => {
    console.log('RxDB: Starting replication...');

    // 1. Projects Replication
    const projectReplication = replicateSupabase({
        replicationIdentifier: 'projects-replication-v1',
        supabaseClient: supabase,
        collection: db.projects,
        pull: { realtimePostgresChanges: true },
        push: { }
    });

    // 2. Folders Replication
    const folderReplication = replicateSupabase({
        replicationIdentifier: 'folders-replication-v1',
        supabaseClient: supabase,
        collection: db.folders,
        pull: { realtimePostgresChanges: true },
        push: { }
    });

    // 3. Tasks Replication
    const taskReplication = replicateSupabase({
        replicationIdentifier: 'tasks-replication-v1',
        supabaseClient: supabase,
        collection: db.tasks,
        pull: { realtimePostgresChanges: true },
        push: { }
    });

    // Error Handling
    const logError = (err: any, type: string) => console.error(`RxDB Replication Error (${type}):`, err);
    projectReplication.error$.subscribe((err: any) => logError(err, 'Projects'));
    folderReplication.error$.subscribe((err: any) => logError(err, 'Folders'));
    taskReplication.error$.subscribe((err: any) => logError(err, 'Tasks'));

    console.log('RxDB: Replication started');
};

