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
import { replicateRxCollection, RxReplicationState } from 'rxdb/plugins/replication';
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
        name: 'myprojs_db_v7', // Reset to v7 with version 0 schemas
        storage,
        multiInstance: true,
        eventReduce: true,
        allowSlowCount: true // Enable slow counts for consistency check
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
export const startReplication = async (db: MyDatabase, supabase: SupabaseClient): Promise<RxReplicationState<any, any>[]> => {
    console.log('RxDB: Starting replication (Native)...');
    const replicationStates: RxReplicationState<any, any>[] = [];

    const replicateTable = async (collection: any, tableName: string) => {
        // Получаем список допустимых полей из схемы
        const schema = collection.schema.jsonSchema;
        const allowedFields = Object.keys(schema.properties);
        
        const replicationState = await replicateRxCollection({
            collection,
            replicationIdentifier: `replication-${tableName}-v7`, // Increment version to force re-sync logic
            pull: {
                async handler(checkpointOrNull: any) {
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

                    console.log(`RxDB Pull ${tableName}: received raw ${data.length} docs from Supabase`);
                    
                    if (data.length > 0) {
                        console.log(`RxDB Pull ${tableName}: Checkpoint updated to ${data[data.length - 1].updated_at}`);
                    }

                    // Clean docs to match schema (remove extra fields dynamically)
                    const cleanDocs = data.map((doc: any) => {
                        const cleanDoc: any = {};
                        allowedFields.forEach(field => {
                            // Копируем только те поля, которые есть в схеме
                            if (Object.prototype.hasOwnProperty.call(doc, field)) {
                                cleanDoc[field] = doc[field];
                            }
                        });
                        return cleanDoc;
                    });

                    if (cleanDocs.length === 0) {
                        return {
                            documents: [],
                            checkpoint: checkpointOrNull
                        };
                    }

                    return {
                        documents: cleanDocs,
                        checkpoint: {
                            updated_at: cleanDocs[cleanDocs.length - 1].updated_at
                        }
                    };
                }
            },
            push: {
                async handler(changeRows: any[]) {
                    const docs = changeRows.map((r: any) => {
                        const doc = r.newDocumentState;
                        // Strip RxDB internal fields starting with _
                        const cleanDoc: any = {};
                        Object.keys(doc).forEach(key => {
                            if (!key.startsWith('_')) {
                                cleanDoc[key] = doc[key];
                            }
                        });
                        return cleanDoc;
                    });
                    
                    console.log(`RxDB Push ${tableName}: sending ${docs.length} docs`);
                    // console.log('Docs payload:', JSON.stringify(docs, null, 2)); 

                    const { data: upserted, error } = await supabase
                        .from(tableName)
                        .upsert(docs)
                        .select();
                    
                    if (upserted && upserted.length === 0) {
                        console.warn(`RxDB Push ${tableName}: Upsert returned 0 rows! Check RLS or data mismatch.`);
                    }

                    if (error) {
                        console.error(`Push error for ${tableName}:`, JSON.stringify(error, null, 2));
                        throw error;
                    }
                    return [];
                }
            },
            // Auto-retry on connection loss
            retryTime: 5000,
            live: true,
        });

        console.log(`RxDB: Replication initialized for ${tableName}`);
        replicationStates.push(replicationState);
        return replicationState;
    };

    try {
        await replicateTable(db.projects, 'projects');
        await replicateTable(db.folders, 'folders');
        await replicateTable(db.tasks, 'tasks');
        console.log('RxDB: Replication started successfully');
    } catch (err: any) {
        console.error('RxDB: Failed to start replication', err);
    }

    return replicationStates;
};
