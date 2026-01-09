import { useState, useEffect } from 'react';
import { AbstractPowerSyncDatabase } from '@powersync/web';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('ConnectionHealth');

interface HealthState {
    isHealthy: boolean;
    consecutiveFailures: number;
    lastCheckedAt: Date | null;
}

export const useConnectionHealth = (db: AbstractPowerSyncDatabase | null, dbName: string) => {
    const [health, setHealth] = useState<HealthState>({
        isHealthy: true,
        consecutiveFailures: 0,
        lastCheckedAt: null
    });

    useEffect(() => {
        if (!db) return;

        const checkHealth = async () => {
            let isConnected = false;
            
            // 1. Check direct connection status
            if (db.connected) {
                isConnected = true;
            } else {
                // Double check via internal status if available
                const status = db.currentStatus;
                isConnected = status.connected;
            }

            // 2. Logic for failures
            setHealth(prev => {
                const newFailures = isConnected ? 0 : prev.consecutiveFailures + 1;
                const isHealthy = newFailures < 3; // Unhealthy if 3 or more consecutive failures

                if (!isHealthy) {
                    logger.warn(`[${dbName}] Connection unhealthy! Failures: ${newFailures}`);
                }

                return {
                    isHealthy,
                    consecutiveFailures: newFailures,
                    lastCheckedAt: new Date()
                };
            });
        };

        // Run immediately
        checkHealth();

        // Run every 60 seconds
        const interval = setInterval(checkHealth, 60000);

        return () => clearInterval(interval);
    }, [db, dbName]);

    return health;
};

