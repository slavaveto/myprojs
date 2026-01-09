import React, { useEffect, useState } from 'react';
import { PowerSyncContext, usePowerSync } from "@powersync/react";
import { PowerSyncDatabase, WASQLitePowerSyncDatabaseOpenFactory, PowerSyncBackendConnector, AbstractPowerSyncDatabase } from "@powersync/web";
import { AppSchema } from '@/app/_services/powerSync/AppSchema';
import { RemoteAppSchema } from '@/app/_services/powerSync/RemoteAppSchema';
import { getRemoteConfig } from '@/utils/remoteConfig';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { SupabaseClient } from '@supabase/supabase-js';

// Connector with Write-Back to Supabase
class StaticRemoteConnector implements PowerSyncBackendConnector {
    constructor(
        private url: string, 
        private token: string,
        private supabase: SupabaseClient
    ) {}

    async fetchCredentials() {
        return {
            endpoint: this.url,
            token: this.token
        };
    }

    async uploadData(database: AbstractPowerSyncDatabase) {
        // console.log('[RemoteConnector] Upload requested');
        const transaction = await database.getNextCrudTransaction();
        if (!transaction) return;
        
        try {
            if (!this.supabase) throw new Error('Supabase client missing');

            for (const op of transaction.crud) {
                const opAny = op as any;
                const table = opAny.table || opAny.type;
                const id = opAny.id;
                let data = opAny.data;

                // Handle PowerSync JSON wrapping
                if (!data) {
                    try {
                        const json = JSON.parse(JSON.stringify(opAny));
                        data = json.data;
                    } catch (e) {
                        // ignore
                    }
                }

                console.log(`[RemotePowerSync] Uploading ${opAny.op} to ${table}`, data);

                if (!table) continue;

                if (op.op === 'PUT') {
                    const { error } = await this.supabase.from(table).upsert(data || {});
                    if (error) throw error;
                } else if (op.op === 'PATCH') {
                    const { error } = await this.supabase.from(table).update(data).eq('id', id);
                    if (error) throw error;
                } else if (op.op === 'DELETE') {
                    const { error } = await this.supabase.from(table).delete().eq('id', id);
                    if (error) throw error;
                }
            }
            await transaction.complete();
            // console.log('[RemoteConnector] Upload transaction completed');
        } catch (e) {
            console.error('[RemoteConnector] Upload failed', e);
        }
    }
}

interface RemoteSyncProviderProps {
    projectId: string;
    projectTitle: string;
    children: React.ReactNode;
}

// Global cache to prevent multiple connections to the same DB file
const dbCache = new Map<string, PowerSyncDatabase>();

export const RemoteSyncProvider = ({ projectId, projectTitle, children }: RemoteSyncProviderProps) => {
    const mainPowerSync = usePowerSync(); 
    const { supabase } = useSupabase(); // Use app Supabase client
    const [remoteDb, setRemoteDb] = useState<PowerSyncDatabase | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    // Look up config by TITLE
    const config = getRemoteConfig(projectTitle);

    useEffect(() => {
        // If config is local, we don't need to create a DB
        if (config.type === 'local') {
            setRemoteDb(null); 
            setIsLoading(false);
            return;
        }

        // 1. CHECK CACHE
        if (dbCache.has(projectId)) {
            console.log(`[RemoteSyncProvider] Using cached DB for ${projectTitle}`);
            setRemoteDb(dbCache.get(projectId)!);
            setIsLoading(false);
            return;
        }

        // Remote Logic
        const initRemote = async () => {
            if (!config.url || !config.token) {
                console.error("Missing remote config for project:", projectTitle);
                setRemoteDb(null);
                setIsLoading(false);
                return;
            }

            // Create new DB instance for this project
            const workerUrl = new URL('/worker/powersync-worker.js', window.location.origin).href;
            const factory = new WASQLitePowerSyncDatabaseOpenFactory({
                schema: RemoteAppSchema, // Use the REMOTE schema for remote projects
                dbFilename: `remote_${projectId}.sqlite`,
            });

            const db = factory.getInstance() as unknown as PowerSyncDatabase;

            // Connect using static connector
            try {
                console.log(`[RemotePowerSync] Connecting to ${projectTitle}...`);
                // Pass supabase to connector
                const connector = new StaticRemoteConnector(config.url, config.token, supabase);
                
                await db.connect(connector);
                console.log(`[RemotePowerSync] Connected to ${projectTitle}`);

                // --- DEBUG DB COUNTS ---
                try {
                    const tables = ['_ui_folders', '_ui_items'];
                    console.group(`--- Remote DB Counts (${projectTitle}) ---`);
                    for (const t of tables) {
                        try {
                            const res = await db.getAll<{ c: number }>(`SELECT count(*) as c FROM ${t} WHERE is_deleted = 0 OR is_deleted IS NULL`);
                            console.log(`${t} (active):`, res[0]?.c);
                        } catch (e) {
                            // console.log(`${t}: table missing?`);
                        }
                    }
                    console.groupEnd();
                } catch (e) {
                    console.error('Error logging counts', e);
                }
                // -----------------------
                
                // SAVE TO CACHE
                dbCache.set(projectId, db);

            } catch (e) {
                console.error(`[RemotePowerSync] Connection failed for ${projectTitle}`, e);
            }
            
            setRemoteDb(db);
            setIsLoading(false);
        };

        initRemote();

        return () => {
             // DO NOT DISCONNECT. Keep connection alive.
        };

    }, [projectId, projectTitle, config.type, config.url, config.token, supabase]);

    if (isLoading) return <div>Connecting to remote {projectTitle}...</div>;

    // 1. If local config (DaySync), render children directly.
    // They will inherit the parent PowerSyncContext (Main DB).
    if (config.type === 'local') {
        return <>{children}</>;
    }

    // 2. If remote DB created, wrap children in NEW Provider.
    if (remoteDb) {
        return (
            <PowerSyncContext.Provider value={remoteDb}>
                {children}
            </PowerSyncContext.Provider>
        );
    }

    // 3. Fallback (should not happen if logic is correct, but safer to render children)
    return <>{children}</>;
};
