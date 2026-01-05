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
import { RxDBMigrationSchemaPlugin } from 'rxdb/plugins/migration-schema';
import { replicateRxCollection } from 'rxdb/plugins/replication';
import { wrappedValidateAjvStorage } from 'rxdb/plugins/validate-ajv';
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
addRxPlugin(RxDBMigrationSchemaPlugin);
// addRxPlugin(RxDBReplicationPlugin); // Not needed for basic replication

if (process.env.NODE_ENV === 'development') {
    addRxPlugin(RxDBDevModePlugin);
}

let dbPromise: Promise<MyDatabase> | null = null;

const createDatabase = async (): Promise<MyDatabase> => {
    console.log('RxDB: Creating database...');
    
    let storage: any = getRxStorageDexie();
    if (process.env.NODE_ENV === 'development') {
        storage = wrappedValidateAjvStorage({ storage });
    }

    const db = await createRxDatabase<MyDatabaseCollections>({
        name: 'myprojs_db_v1', // Renamed to reset broken schema state (v0 locked)
        storage,
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
            schema: taskSchema,
            migrationStrategies: {
                // 1: from v0 to v1 (Fix indexes)
                1: function(oldDoc: any) {
                    return oldDoc;
                }
            }
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
    console.log('RxDB: Starting replication (Native)...');

    const replicateTable = async (collection: any, tableName: string) => {
        return replicateRxCollection({
            collection,
            replicationIdentifier: `replication-${tableName}-v1`,
            pull: {
                async handler(checkpointOrNull) {
                    const checkpoint = checkpointOrNull ? checkpointOrNull.updated_at : new Date(0).toISOString();
                    console.log(`RxDB Pull ${tableName}: fetching since ${checkpoint}`);
                    
                    const { data, error } = await supabase
                        .from(tableName)
                        .select('*')
                        .gt('updated_at', checkpoint)
                        .order('updated_at', { ascending: true });

                    if (error) {
                        console.error(`Pull error for ${tableName}:`, error);
                        throw error;
                    }

                    console.log(`RxDB Pull ${tableName}: received ${data.length} docs`);

                    if (data.length === 0) {
                        return {
                            documents: [],
                            checkpoint: checkpointOrNull
                        };
                    }

                    return {
                        documents: data,
                        checkpoint: {
                            updated_at: data[data.length - 1].updated_at
                        }
                    };
                }
            },
            push: {
                async handler(changeRows) {
                    const docs = changeRows.map(r => r.newDocument);
                    const { error } = await supabase
                        .from(tableName)
                        .upsert(docs);
                    
                    if (error) {
                        console.error(`Push error for ${tableName}:`, error);
                        throw error;
                    }
                    return [];
                }
            },
            // Auto-retry on connection loss
            retryTime: 5000,
            live: true,
        });
    };

    try {
        await replicateTable(db.projects, 'projects');
        await replicateTable(db.folders, 'folders');
        await replicateTable(db.tasks, 'tasks');
        console.log('RxDB: Replication started successfully');
    } catch (err) {
        console.error('RxDB: Failed to start replication', err);
    }
};

