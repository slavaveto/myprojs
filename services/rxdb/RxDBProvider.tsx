'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { getDatabase, startReplication, MyDatabase } from './db';
import { RxReplicationState } from 'rxdb/plugins/replication';
import { combineLatest } from 'rxjs';

interface RxDBContextValue {
    db: MyDatabase;
    isSyncing: boolean;
    notifySyncStart: () => void;
}

const RxDBContext = createContext<RxDBContextValue | null>(null);

export const RxDBProvider = ({ children }: { children: React.ReactNode }) => {
    const [db, setDb] = useState<MyDatabase | null>(null);
    const [replicationStates, setReplicationStates] = useState<RxReplicationState<any, any>[]>([]);
    const [realSyncing, setRealSyncing] = useState(false);
    const [manualSyncing, setManualSyncing] = useState(false);
    
    const { supabase, userId } = useSupabase();

    const notifySyncStart = () => {
        setManualSyncing(true);
        setTimeout(() => setManualSyncing(false), 2000); // Guarantee 2s sync visual
    };

    const isSyncing = realSyncing || manualSyncing;

    useEffect(() => {
        const initDB = async () => {
            try {
                const database = await getDatabase();
                setDb(database);

                // Start replication only if we have a user (and thus valid token)
                if (userId) {
                    const states = await startReplication(database, supabase);
                    setReplicationStates(states);
                }
            } catch (err) {
                console.error('Failed to initialize RxDB:', err);
            }
        };

        initDB();
    }, [supabase, userId]);

    // Track sync status
    useEffect(() => {
        console.log(`RxDBProvider: Replication states count: ${replicationStates.length}`);
        if (replicationStates.length === 0) return;

        // Combine active$ observables from all replication states
        const activeObservables = replicationStates.map(state => state.active$);
        
        const sub = combineLatest(activeObservables).subscribe((activeStates) => {
            // If any replication is active, we are syncing
            const anyActive = activeStates.some(isActive => isActive);
            console.log('RxDB Sync Status:', anyActive); 
            setRealSyncing(anyActive);
        });

        return () => sub.unsubscribe();
    }, [replicationStates]);

    if (!db) {
        return null; // Or a loading spinner
    }

    return (
        <RxDBContext.Provider value={{ db, isSyncing, notifySyncStart }}>
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
