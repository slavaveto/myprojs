'use client';

import React, { useEffect, useState, useRef } from 'react';
import { PowerSyncDatabase, PowerSyncBackendConnector, AbstractPowerSyncDatabase } from '@powersync/web';
import { PowerSyncContext } from '@powersync/react';
import { useAuth } from '@clerk/nextjs';
import { getPowerSyncV3 } from './Client';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('SyncProviderV3');
const POWERSYNC_URL = process.env.NEXT_PUBLIC_POWERSYNC_URL || 'https://foo.powersync.io';

class ClerkConnector implements PowerSyncBackendConnector {
    readonly client = getPowerSyncV3();

    constructor(
        private getToken: () => Promise<string | null>,
        private supabase: SupabaseClient
    ) {}

    async fetchCredentials() {
        try {
            const token = await this.getToken();
            if (!token) return null;
            return {
                endpoint: POWERSYNC_URL,
                token: token
            };
        } catch (e) {
            logger.error('ClerkConnector: Error fetching token', e);
            return null;
        }
    }

    async uploadData(database: AbstractPowerSyncDatabase) {
        const transaction = await database.getNextCrudTransaction();
        if (!transaction) return;
        
        try {
            if (!this.supabase) {
                throw new Error('Supabase client is not initialized in connector');
            }

            for (const op of transaction.crud) {
                const opAny = op as any;
                const table = opAny.table || opAny.type;
                const id = opAny.id;
                
                let data = opAny.data;
                if (!data) {
                    try {
                        const json = JSON.parse(JSON.stringify(opAny));
                        data = json.data;
                    } catch (e) {
                        logger.warn('[PowerSync] Failed to parse operation JSON', e);
                    }
                }

                logger.info(`[PowerSync] Uploading ${opAny.op} to ${table}`, data);

                if (!table) {
                    logger.warn('[PowerSync] No table specified for operation', opAny);
                    continue;
                }

                if (op.op === 'PUT') {
                    const { error } = await this.supabase
                        .from(table)
                        .upsert(data || {});
                    if (error) throw new Error(`Supabase Upsert Error: ${error.message} (${error.code})`);
                } else if (op.op === 'PATCH') {
                    const { error } = await this.supabase
                        .from(table)
                        .update(data)
                        .eq('id', id);
                    if (error) throw new Error(`Supabase Patch Error: ${error.message} (${error.code})`);
                } else if (op.op === 'DELETE') {
                    const { error } = await this.supabase
                        .from(table)
                        .delete()
                        .eq('id', id);
                    if (error) throw new Error(`Supabase Delete Error: ${error.message} (${error.code})`);
                }
            }

            await transaction.complete();
            logger.info('[PowerSync] Transaction completed successfully');
        } catch (e: any) {
            logger.error('[PowerSync] UploadData Failed:', e);
            throw e;
        }
    }
}

export const usePowerSyncV3 = () => {
    const context = React.useContext(PowerSyncContext);
    if (!context) {
        throw new Error('usePowerSyncV3 must be used within a PowerSyncContext.Provider');
    }
    return context;
};

export const ProviderV3 = ({ children }: { children: React.ReactNode }) => {
    const [db, setDb] = useState<PowerSyncDatabase | null>(null);
    const { getToken, isLoaded } = useAuth();
    const { supabase } = useSupabase();
    const connectingRef = useRef(false);
    const getTokenRef = useRef(getToken);
    
    useEffect(() => {
        getTokenRef.current = getToken;
    }, [getToken]);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                const _db = getPowerSyncV3();
                setDb(_db);
            } catch (e) {
                logger.error("[PowerSync] Error init:", e);
            }
        }
    }, []);

    useEffect(() => {
        if (!db || !isLoaded) return;
        if (db.connected || connectingRef.current) return;

        const connect = async () => {
            try {
                connectingRef.current = true;
                logger.info('[PowerSync] Connecting to:', POWERSYNC_URL);
                const connector = new ClerkConnector(async () => {
                     const token = await getTokenRef.current({ template: 'supabase_daysync_new' });
                     return token || '';
                }, supabase);
                await db.connect(connector);
            } catch (e) {
                logger.error('[PowerSync] Connection failed:', e);
            } finally {
                connectingRef.current = false;
            }
        };

        connect();
    }, [db, isLoaded]);

    if (!db) return null;

    return (
        <PowerSyncContext.Provider value={db}>
            {children}
        </PowerSyncContext.Provider>
    );
};

