import React, { createContext, useContext, useEffect, useState } from 'react';
import { PowerSyncContext, usePowerSync } from "@powersync/react";
import { PowerSyncDatabase, WASQLitePowerSyncDatabaseOpenFactory } from "@powersync/web";
import { RemoteAppSchema } from '@/app/_services/powerSync/RemoteAppSchema';
import { getRemoteConfig } from '@/utils/remoteConfig';

// A context to provide the CURRENTLY ACTIVE database instance (Main or Remote)
// Actually, PowerSyncContext already does this. We just need to nest it.

interface RemotePowerSyncProviderProps {
    projectId: string;
    children: React.ReactNode;
}

export const RemotePowerSyncProvider = ({ projectId, children }: RemotePowerSyncProviderProps) => {
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
                worker: workerUrl
            } as any);

            const db = factory.getInstance() as unknown as PowerSyncDatabase;

            // Connect using static connector (simplified)
            // In production, you'd use a proper Connector class
            // db.connect(new RemoteConnector(config.url, config.token));
            
            // For now, we just create the DB instance. Connection logic TBD.
            // Assuming we just need the DB instance for queries if it was connected.
            // But we need to connect it!
            
            // TODO: Implement RemoteConnector using url/token
            
            setRemoteDb(db);
            setIsLoading(false);
        };

        initRemote();

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

