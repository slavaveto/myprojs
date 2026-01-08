import React, { useEffect, useState } from 'react';
import { PowerSyncContext, usePowerSync } from "@powersync/react";
import { PowerSyncDatabase, WASQLitePowerSyncDatabaseOpenFactory, PowerSyncBackendConnector, AbstractPowerSyncDatabase } from "@powersync/web";
import { AppSchema } from '@/app/_services/powerSync/AppSchema';
import { getRemoteConfig } from '@/utils/remoteConfig';

// Simple connector for static token
class StaticRemoteConnector implements PowerSyncBackendConnector {
    constructor(private url: string, private token: string) {}

    async fetchCredentials() {
        return {
            endpoint: this.url,
            token: this.token
        };
    }

    async uploadData(database: AbstractPowerSyncDatabase) {
        // Implement simple upload or read-only
        const transaction = await database.getNextCrudTransaction();
        if (!transaction) return;
        
        try {
            await transaction.complete();
        } catch (e) {
            console.error('[RemoteConnector] Upload failed', e);
            // In a real implementation, we would send data to the remote Supabase via REST API or similar
        }
    }
}

interface RemoteSyncProviderProps {
    projectId: string;
    projectTitle: string;
    children: React.ReactNode;
}

export const RemoteSyncProvider = ({ projectId, projectTitle, children }: RemoteSyncProviderProps) => {
    const mainPowerSync = usePowerSync(); // Access main DB context (unused here but available)
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

        // Remote Logic
        const initRemote = async () => {
            if (!config.url || !config.token) {
                console.error("Missing remote config for project:", projectTitle);
                // Fallback to local to avoid crash, but log error
                setRemoteDb(null);
                setIsLoading(false);
                return;
            }

            // Create new DB instance for this project
            // Note: We need unique DB filename
            const workerUrl = new URL('/worker/powersync-worker.js', window.location.origin).href;
            const factory = new WASQLitePowerSyncDatabaseOpenFactory({
                schema: AppSchema, // Use the FULL schema
                dbFilename: `remote_${projectId}.sqlite`,
            });

            const db = factory.getInstance() as unknown as PowerSyncDatabase;

            // Connect using static connector
            try {
                console.log(`[RemotePowerSync] Connecting to ${projectTitle}...`);
                const connector = new StaticRemoteConnector(config.url, config.token);
                db.connect(connector);
            } catch (e) {
                console.error(`[RemotePowerSync] Connection failed for ${projectTitle}`, e);
            }
            
            setRemoteDb(db);
            setIsLoading(false);
        };

        initRemote();

        return () => {
             // Cleanup if needed
        };

    }, [projectId, projectTitle, config.type, config.url, config.token]);

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
