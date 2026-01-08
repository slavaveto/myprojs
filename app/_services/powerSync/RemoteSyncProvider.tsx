import React, { createContext, useContext, useEffect, useState } from 'react';
import { PowerSyncContext, usePowerSync } from "@powersync/react";
import { PowerSyncDatabase, WASQLitePowerSyncDatabaseOpenFactory, PowerSyncBackendConnector, AbstractPowerSyncDatabase } from "@powersync/web";
import { RemoteAppSchema } from '@/app/_services/powerSync/RemoteAppSchema';
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
        // Read-only for now, or implement upload logic later
        const transaction = await database.getNextCrudTransaction();
        if (!transaction) return;
        
        console.warn('[RemoteConnector] Upload requested but not implemented. Completing transaction to clear queue.');
        await transaction.complete(); 
    }
}

interface RemoteSyncProviderProps {
    projectId: string;
    children: React.ReactNode;
}

export const RemoteSyncProvider = ({ projectId, children }: RemoteSyncProviderProps) => {
    const mainPowerSync = usePowerSync(); // Access main DB
    const [remoteDb, setRemoteDb] = useState<PowerSyncDatabase | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    
    const config = getRemoteConfig(projectId);

    useEffect(() => {
        if (config.type === 'local') {
            // Use main DB (it has -ui tables in schema)
            setRemoteDb(null); 
            setIsLoading(false);
            return;
        }

        // Remote Logic
        const initRemote = async () => {
            if (!config.url || !config.token) {
                console.error("Missing remote config for", projectId);
                return;
            }

            // Create new DB instance for this project
            // Note: We need unique DB filename
            const workerUrl = new URL('/worker/powersync-worker.js', window.location.origin).href;
            const factory = new WASQLitePowerSyncDatabaseOpenFactory({
                schema: RemoteAppSchema,
                dbFilename: `remote_${projectId}.sqlite`,
            });

            const db = factory.getInstance() as unknown as PowerSyncDatabase;

            // Connect using static connector
            try {
                console.log(`[RemotePowerSync] Connecting to ${projectId}...`);
                const connector = new StaticRemoteConnector(config.url, config.token);
                db.connect(connector);
            } catch (e) {
                console.error(`[RemotePowerSync] Connection failed for ${projectId}`, e);
            }
            
            setRemoteDb(db);
            setIsLoading(false);
        };

        initRemote();

        return () => {
             // Cleanup if needed, but usually we keep DB open
             // If we want to disconnect on unmount:
             // remoteDb?.disconnect();
        };

    }, [projectId, config.type, config.url, config.token]);

    if (isLoading) return <div>Connecting to remote...</div>;

    // If local, we render children directly (they use Main Context)
    // Actually, we want to BE TRANSPARENT.
    // If we render children without provider, they use parent provider.
    // If we wrap, they use new provider.
    
    if (config.type === 'local') {
        return <>{children}</>;
    }

    if (remoteDb) {
        return (
            <PowerSyncContext.Provider value={remoteDb}>
                {children}
            </PowerSyncContext.Provider>
        );
    }

    return null;
};

