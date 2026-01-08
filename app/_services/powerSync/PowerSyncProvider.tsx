'use client';

import React, { useEffect, useState, useRef } from 'react';
import { PowerSyncDatabase, PowerSyncBackendConnector, AbstractPowerSyncDatabase } from '@powersync/web';
import { PowerSyncContext } from '@powersync/react';
import { useAuth } from '@clerk/nextjs';
import { getPowerSync } from './client';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { SupabaseClient } from '@supabase/supabase-js';

const POWERSYNC_URL = process.env.NEXT_PUBLIC_POWERSYNC_URL || 'https://foo.powersync.io';

class ClerkConnector implements PowerSyncBackendConnector {
    readonly client = getPowerSync();

    constructor(
        private getToken: () => Promise<string | null>,
        private supabase: SupabaseClient
    ) {}

    async fetchCredentials() {
        try {
            console.log('[ClerkConnector] Requesting credentials...');
            const token = await this.getToken();
            console.log('[ClerkConnector] Token result:', token ? 'YES' : 'NO');
            
            if (!token) return null;
            
            return {
                endpoint: POWERSYNC_URL,
                token: token
            };
        } catch (e) {
            console.error('ClerkConnector: Error fetching token', e);
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
                // Cast to any to safely access properties that might differ between SDK versions
                const opAny = op as any;
                const table = opAny.table || opAny.type;
                const id = opAny.id;
                
                // Try direct access first, fallback to JSON parsing if property is hidden/proxy
                let data = opAny.data;
                if (!data) {
                    try {
                        const json = JSON.parse(JSON.stringify(opAny));
                        data = json.data;
                    } catch (e) {
                        console.warn('[PowerSync] Failed to parse operation JSON', e);
                    }
                }

                console.log(`[PowerSync] Uploading ${opAny.op} to ${table}`, data);

                if (!table) {
                    console.warn('[PowerSync] No table specified for operation', opAny);
                    continue;
                }

                if (op.op === 'PUT') {
                    // Upsert (INSERT or UPDATE)
                    const { error } = await this.supabase
                        .from(table)
                        .upsert(data || {});
                    
                    if (error) throw new Error(`Supabase Upsert Error: ${error.message} (${error.code})`);
                } else if (op.op === 'PATCH') {
                    // UPDATE specific fields
                    const { error } = await this.supabase
                        .from(table)
                        .update(data)
                        .eq('id', id);

                    if (error) throw new Error(`Supabase Patch Error: ${error.message} (${error.code})`);
                } else if (op.op === 'DELETE') {
                    // DELETE
                    const { error } = await this.supabase
                        .from(table)
                        .delete()
                        .eq('id', id);

                    if (error) throw new Error(`Supabase Delete Error: ${error.message} (${error.code})`);
                }
            }

            await transaction.complete();
            console.log('[PowerSync] Transaction completed successfully');
        } catch (e: any) {
            console.error('[PowerSync] UploadData Failed:', e);
            // Re-throw to notify PowerSync about the failure
            throw e;
        }
    }
}

// Экспортируем хук, который использует официальный контекст
export const usePowerSync = () => {
    const context = React.useContext(PowerSyncContext);
    if (!context) {
        throw new Error('usePowerSync must be used within a PowerSyncContext.Provider');
    }
    return context;
};

export const PowerSyncProvider = ({ children }: { children: React.ReactNode }) => {
    const [db, setDb] = useState<PowerSyncDatabase | null>(null);
    const { getToken, isLoaded } = useAuth();
    const { supabase } = useSupabase();
    const connectingRef = useRef(false);

    // Инициализация базы (только на клиенте)
    useEffect(() => {
        if (typeof window !== 'undefined') {
            try {
                console.log('[PowerSync] Init started...');
                const _db = getPowerSync();
                // Enable debug logging
                // @ts-ignore
                if (_db.enableLogging) _db.enableLogging(); 
                console.log('[PowerSync] DB created:', _db);
                setDb(_db);
            } catch (e) {
                console.error("[PowerSync] Error init:", e);
            }
        }
    }, []);

    // Подключение к бекенду
    useEffect(() => {
        if (!db || !isLoaded) return;

        const connect = async () => {
            if (db.connected) return;

            try {
                console.log('[PowerSync] Connecting to:', POWERSYNC_URL);
                const connector = new ClerkConnector(async () => {
                     // Get fresh token
                     const token = await getToken({ template: 'supabase_daysync_new' });
                     return token || '';
                }, supabase);
                await db.connect(connector);
            } catch (e) {
                console.error('[PowerSync] Connection failed:', e);
            }
        };

        connect();

        // Cleanup on unmount or re-run to avoid ghosts (especially in Fast Refresh)
        return () => {
            if (db && db.connected) {
                console.log('[PowerSync] Disconnecting due to effect cleanup...');
                db.disconnect();
            }
        };
    }, [db, isLoaded, getToken]);

    // Monitor connection status
    useEffect(() => {
        if (!db) return;
        
        // Log status changes
        const l = db.registerListener({
            statusChanged: (status) => {
                console.log('[PowerSync] Status Changed:', {
                     connected: status.connected,
                     lastSyncedAt: status.lastSyncedAt,
                     // @ts-ignore
                     error: status.anyError,
                     statusObj: status // Log full object
                });
            }
        });

        // Periodic check
        const interval = setInterval(() => {
            console.log('[PowerSync] Heartbeat Status:', {
                connected: db.connected,
                // @ts-ignore
                hasError: !!db.currentStatus?.anyError
            });
        }, 5000);

        return () => {
            l?.();
            clearInterval(interval);
        };
    }, [db]);

    // Не рендерим детей пока db не создана
    if (!db) return null;

    // ИСПОЛЬЗУЕМ ОФИЦИАЛЬНЫЙ КОНТЕКСТ ИЗ @powersync/react
    return (
        <PowerSyncContext.Provider value={db}>
            {children}
        </PowerSyncContext.Provider>
    );
};
