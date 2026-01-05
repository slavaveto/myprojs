'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { getDatabase, startReplication, MyDatabase } from './db';
import { RxReplicationState } from 'rxdb/plugins/replication';
import { combineLatest } from 'rxjs';

interface RxDBContextValue {
    db: MyDatabase;
    isSyncing: boolean;
}

const RxDBContext = createContext<RxDBContextValue | null>(null);

export const RxDBProvider = ({ children }: { children: React.ReactNode }) => {
    const [db, setDb] = useState<MyDatabase | null>(null);
    const [replicationStates, setReplicationStates] = useState<RxReplicationState<any, any>[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    
    const { supabase, userId } = useSupabase();

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
        if (replicationStates.length === 0) return;

        // Combine active$ observables from all replication states
        const activeObservables = replicationStates.map(state => state.active$);
        
        const sub = combineLatest(activeObservables).subscribe((activeStates) => {
            // If any replication is active, we are syncing
            const anyActive = activeStates.some(isActive => isActive);
            // console.log('RxDB Sync Status:', anyActive, activeStates); // Debug log
            setIsSyncing(anyActive);
        });

        return () => sub.unsubscribe();
    }, [replicationStates]);

    if (!db) {
        return null; // Or a loading spinner
    }

    return (
        <RxDBContext.Provider value={{ db, isSyncing }}>
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
