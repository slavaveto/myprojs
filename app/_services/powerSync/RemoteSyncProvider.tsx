import React, { useEffect, useState } from 'react';
import { PowerSyncContext, usePowerSync } from "@powersync/react";
import { PowerSyncDatabase, WASQLitePowerSyncDatabaseOpenFactory, PowerSyncBackendConnector, AbstractPowerSyncDatabase } from "@powersync/web";
import { AppSchema } from '@/app/_services/powerSync/AppSchema';
import { RemoteAppSchema } from '@/app/_services/powerSync/RemoteAppSchema';
import { getRemoteConfig } from '@/app/_services/powerSync/remoteConfig';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { syncBridge } from './syncStatusBridge';

import { createLogger } from '@/utils/logger/Logger';
const logger = createLogger('RemoteSyncProvider');

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
        const transaction = await database.getNextCrudTransaction();
        if (!transaction) return;
        
        // MANUALLY NOTIFY BRIDGE ABOUT UPLOAD START
        syncBridge.updateStatus({
            connected: true, // Assuming connected if uploading
            connecting: false,
            downloading: false,
            uploading: true,
            dataFlow: { uploading: true, downloading: false }
        });

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

                logger.info(`[RemotePowerSync] Uploading ${opAny.op} to ${table}`, data);

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
        } catch (e: any) {
            logger.error('[RemoteConnector] Upload failed RAW:', e);
            if (e && typeof e === 'object') {
                logger.error('[RemoteConnector] Upload failed JSON:', JSON.stringify(e, null, 2));
                if (e.message) logger.error('[RemoteConnector] Error Message:', e.message);
                if (e.details) logger.error('[RemoteConnector] Error Details:', e.details);
                if (e.hint) logger.error('[RemoteConnector] Error Hint:', e.hint);
            }
        } finally {
            // MANUALLY NOTIFY BRIDGE ABOUT UPLOAD END
            syncBridge.updateStatus({
                connected: true,
                connecting: false,
                downloading: false,
                uploading: false,
                dataFlow: { uploading: false, downloading: false }
            });
        }
    }
}

interface RemoteSyncProviderProps {
    projectId: string;
    projectTitle: string;
    children: React.ReactNode;
}

// Global cache to prevent multiple connections to the same DB file
export const dbCache = new Map<string, PowerSyncDatabase>();

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
            logger.info(`[RemoteSyncProvider] Using cached DB for ${projectTitle}`);
            setRemoteDb(dbCache.get(projectId)!);
            setIsLoading(false);
            return;
        }

        // Remote Logic
        const initRemote = async () => {
            if (!config.url || !config.token) {
                logger.error("Missing remote config for project:", projectTitle);
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

            // BRIDGE STATUS UPDATES
            db.registerListener({
                statusChanged: (status) => {
                    const s = status as any;
                    syncBridge.updateStatus({
                        connected: status.connected,
                        connecting: status.connecting,
                        downloading: s.dataFlow?.downloading || !!s.downloading,
                        uploading: s.dataFlow?.uploading || !!s.uploading,
                        lastSyncedAt: status.lastSyncedAt,
                        anyError: s.anyError,
                        dataFlow: s.dataFlow
                    });
                }
            });

            // 5. Connect to Backend (NON-BLOCKING)
            // We do NOT await this before rendering. UI should load from local DB immediately.
            const connectBackground = async () => {
                try {
                    logger.info(`[RemotePowerSync] Connecting to ${projectTitle}...`);
                    
                    // CREATE DEDICATED SUPABASE CLIENT FOR REMOTE
                    let remoteSupabase = supabase;
                    const configAny = config as any; 
                    
                    if (config.supabaseUrl && configAny.serviceKey) {
                        remoteSupabase = createClient(config.supabaseUrl, configAny.serviceKey, {
                            auth: {
                                persistSession: false,
                                autoRefreshToken: false,
                            }
                        });
                    }

                    const connector = new StaticRemoteConnector(config.url!, config.token!, remoteSupabase);
                    
                    await db.connect(connector);
                    logger.info(`[RemotePowerSync] Connected to ${projectTitle}`);
                } catch (e) {
                    logger.error(`[RemotePowerSync] Connection failed for ${projectTitle}`, e);
                }
            };

            // Start connection in background
            connectBackground();
            
            // Render UI immediately
            dbCache.set(projectId, db);
            setRemoteDb(db);
            setIsLoading(false);
        };

        initRemote();

        return () => {
             // DO NOT DISCONNECT. Keep connection alive.
             // Clear bridge on unmount (optional, but good for cleanup if switching tabs)
             syncBridge.clear();
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
    // PREVENT RENDERING CHILDREN IF REMOTE DB IS MISSING (to avoid leaking to Main DB)
    return null;
};
