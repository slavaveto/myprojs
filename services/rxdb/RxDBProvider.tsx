'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { getDatabase, startReplication, MyDatabase } from './db';
import { RxReplicationState } from 'rxdb/plugins/replication';
import { combineLatest } from 'rxjs';
import { toast } from 'react-hot-toast';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('RxDBProvider');

interface RxDBContextValue {
    db: MyDatabase;
    isSyncing: boolean;
    notifySyncStart: () => void;
    lastSyncStats: { sent: number, received: number };
}

const RxDBContext = createContext<RxDBContextValue | null>(null);

export const RxDBProvider = ({ children }: { children: React.ReactNode }) => {
    const [db, setDb] = useState<MyDatabase | null>(null);
    const [replicationStates, setReplicationStates] = useState<RxReplicationState<any, any>[]>([]);
    const [realSyncing, setRealSyncing] = useState(false);
    const [manualSyncing, setManualSyncing] = useState(false);
    
    const { supabase, userId } = useSupabase();
    const statsRef = React.useRef({ sent: 0, received: 0 });
    
    // Track sent IDs to ignore echoes (Оставляем для дебага, но не для вычитания)
    const pendingEchoesRef = React.useRef<Set<string>>(new Set());

    const syncTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
    const [wasSyncing, setWasSyncing] = useState(false);
    const [lastSyncStats, setLastSyncStats] = useState({ sent: 0, received: 0 });

    const notifySyncStart = () => {
        logger.info('notifySyncStart triggered');
        if (syncTimeoutRef.current) clearTimeout(syncTimeoutRef.current);
        setManualSyncing(true);
        syncTimeoutRef.current = setTimeout(() => {
            setManualSyncing(false);
            syncTimeoutRef.current = null;
        }, 2000); 
    };

    const isSyncing = realSyncing || manualSyncing;

    useEffect(() => {
        const initDB = async () => {
            try {
                const database = await getDatabase();
                setDb(database);

                // Start replication only if we have a user (and thus valid token)
                if (userId) {
                    const states = await startReplication(database, supabase, userId);
                    setReplicationStates(states);
                }
            } catch (err) {
                logger.error('Failed to initialize RxDB:', err);
            }
        };

        initDB();
    }, [supabase, userId]);

    // Track sync status
    useEffect(() => {
        logger.info(`Replication states count: ${replicationStates.length}`);
        if (replicationStates.length === 0) return;

        // Combine active$ observables from all replication states
        const activeObservables = replicationStates.map(state => state.active$);
        
        const sub = combineLatest(activeObservables).subscribe((activeStates) => {
            // If any replication is active, we are syncing
            const anyActive = activeStates.some(isActive => isActive);
            logger.info('Sync Status:', anyActive); 
            setRealSyncing(anyActive);
        });

        return () => sub.unsubscribe();
    }, [replicationStates]);

    // Track sync stats
    useEffect(() => {
        if (replicationStates.length === 0) return;
        const subs = replicationStates.map(state => [
            state.received$.subscribe((doc: any) => {
                // ОТКЛЮЧЕНО ВЫЧИТАНИЕ ЭХА
                // Просто считаем всё, что пришло
                statsRef.current.received++;
                
                // Старая логика (для истории):
                if (pendingEchoesRef.current.has(doc.id)) {
                    pendingEchoesRef.current.delete(doc.id);
                    logger.info(`Echo detected for ${doc.id} (but counted anyway)`);
                }
            }),
            state.sent$.subscribe((doc: any) => {
                statsRef.current.sent++;
                pendingEchoesRef.current.add(doc.id);
                // Auto-clear from pending after 5s (in case echo never comes or is lost)
                setTimeout(() => {
                    if (pendingEchoesRef.current.has(doc.id)) {
                        pendingEchoesRef.current.delete(doc.id);
                    }
                }, 5000);
            })
        ]).flat();
        return () => subs.forEach(s => s.unsubscribe());
    }, [replicationStates]);

    // Capture stats on sync finish
    useEffect(() => {
        if (isSyncing) {
            setWasSyncing(true);
        } else if (wasSyncing) {
             const { sent, received } = statsRef.current;
             setLastSyncStats({ sent, received });
             
             // Reset
             statsRef.current = { sent: 0, received: 0 };
             // pendingEchoesRef.current.clear(); 
             setWasSyncing(false);
        }
    }, [isSyncing, wasSyncing]);

    // // Consistency Check with Retry
    // useEffect(() => {
    //     if (!isSyncing && db && userId && replicationStates.length > 0) {
    //         const timer = setTimeout(() => {
                
    //             const performCheck = async (retryCount = 0) => {
    //                 logger.info(`Running consistency check (Attempt ${retryCount + 1})...`);
    //                 const tables: ('projects' | 'folders' | 'tasks')[] = ['projects', 'folders', 'tasks'];
    //                 let allMatch = true;
    //                 const mismatches: string[] = [];
                    
    //                 for (const table of tables) {
    //                     try {
    //                         const localDocs = await db[table].find({
    //                             selector: { is_deleted: { $ne: true } }
    //                         }).exec();
                            
    //                         const localMap = new Map<string, string>();
    //                         localDocs.forEach(d => localMap.set(d.id, d.updated_at));

    //                         const { data: remoteDocs, error } = await supabase
    //                             .from(table)
    //                             .select('id, updated_at')
    //                             .not('is_deleted', 'is', true)
    //                             .eq('user_id', userId);

    //                         if (error) {
    //                             logger.error(`Consistency Check Error (${table}):`, error);
    //                             allMatch = false;
    //                             mismatches.push(`${table}: API Error`);
    //                         } else {
    //                             const remoteMap = new Map<string, string>();
    //                             if (remoteDocs) {
    //                                 remoteDocs.forEach((d: any) => remoteMap.set(d.id, d.updated_at));
    //                             }

    //                             let tableMismatch = false;
                                
    //                             for (const [id, localAt] of localMap) {
    //                                 if (!remoteMap.has(id)) {
    //                                     tableMismatch = true;
    //                                 } else {
    //                                     const remoteAt = remoteMap.get(id);
    //                                     if (new Date(remoteAt!).getTime() !== new Date(localAt).getTime()) {
    //                                         tableMismatch = true;
    //                                     }
    //                                 }
    //                             }

    //                             for (const [id] of remoteMap) {
    //                                 if (!localMap.has(id)) {
    //                                     tableMismatch = true;
    //                                 }
    //                             }

    //                             if (tableMismatch) {
    //                                 allMatch = false;
    //                                 mismatches.push(`${table} (Diff)`);
    //                             } else {
    //                                 logger.info(`Match [${table}]: Identical (${localMap.size} docs)`);
    //                             }
    //                         }
    //                     } catch (e) {
    //                          logger.error(`Check exception ${table}`, e);
    //                          allMatch = false;
    //                     }
    //                 }

    //                 if (!allMatch) {
    //                     if (retryCount < 3) {
    //                         logger.warning(`Check failed, retrying in 2s... Mismatches: ${mismatches.join(', ')}`);
    //                         setTimeout(() => performCheck(retryCount + 1), 2000);
    //                     } else {
    //                         toast.error(`Sync Mismatch: ${mismatches.join(', ')}`, { duration: 5000 });
    //                     }
    //                 } else {
    //                     logger.success('Sync Verified: All tables match');
    //                 }
    //             };

    //             performCheck();

    //         }, 3000);

    //         return () => clearTimeout(timer);
    //     }
    // }, [isSyncing, db, userId, supabase, replicationStates]);

    if (!db) {
        return null; // Or a loading spinner
    }

    return (
        <RxDBContext.Provider value={{ db, isSyncing, notifySyncStart, lastSyncStats }}>
            {children}
        </RxDBContext.Provider>
    );
};

export const useRxDB = () => {
    const context = useContext(RxDBContext);
    if (!context) {
        throw new Error('useRxDB must be used within an RxDBProvider');
    }
    return context; // Returns { db, isSyncing }
};
