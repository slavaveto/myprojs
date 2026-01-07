import { PowerSyncDatabase, WASQLitePowerSyncDatabaseOpenFactory } from '@powersync/web';
import { AppSchema } from './AppSchema';

let instance: PowerSyncDatabase | null = null;

export const getPowerSync = (): PowerSyncDatabase => {
    if (typeof window === 'undefined') {
        throw new Error('PowerSync cannot be initialized on server');
    }

    if (!instance) {
        // PowerSync requires a worker file to be served as a static asset.
        // We use a full URL to avoid relative path issues.
        const workerUrl = new URL('/worker/powersync-worker.js', window.location.origin).href;
        console.log('[PowerSync] Worker URL:', workerUrl);

        const factory = new WASQLitePowerSyncDatabaseOpenFactory({
            schema: AppSchema,
            dbFilename: 'daysync_db.sqlite',
            worker: workerUrl
        } as any);
        
        instance = factory.getInstance() as unknown as PowerSyncDatabase;
    }
    return instance;
};
