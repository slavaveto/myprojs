import { PowerSyncDatabase, WASQLitePowerSyncDatabaseOpenFactory } from '@powersync/web';
import { SchemaV3 } from './Schema';

let instance: PowerSyncDatabase | null = null;

export const getPowerSyncV3 = (): PowerSyncDatabase => {
    if (typeof window === 'undefined') {
        throw new Error('PowerSync cannot be initialized on server');
    }

    if (!instance) {
        // PowerSync requires a worker file to be served as a static asset.
        const workerUrl = new URL('/worker/powersync-worker.js', window.location.origin).href;

        const factory = new WASQLitePowerSyncDatabaseOpenFactory({
            schema: SchemaV3,
            dbFilename: 'daysync_v3.sqlite', // New DB file for V3
            worker: workerUrl
        } as any);
        
        instance = factory.getInstance() as unknown as PowerSyncDatabase;
    }
    return instance;
};

