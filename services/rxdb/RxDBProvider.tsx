'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { getDatabase, startReplication, MyDatabase } from './db';

const RxDBContext = createContext<MyDatabase | null>(null);

export const RxDBProvider = ({ children }: { children: React.ReactNode }) => {
    const [db, setDb] = useState<MyDatabase | null>(null);
    const { supabase, userId } = useSupabase();

    useEffect(() => {
        const initDB = async () => {
            try {
                const database = await getDatabase();
                setDb(database);

                // Start replication only if we have a user (and thus valid token)
                if (userId) {
                    await startReplication(database, supabase);
                }
            } catch (err) {
                console.error('Failed to initialize RxDB:', err);
            }
        };

        initDB();
    }, [supabase, userId]);

    if (!db) {
        return null; // Or a loading spinner
    }

    return (
        <RxDBContext.Provider value={db}>
            {children}
        </RxDBContext.Provider>
    );
};

export const useRxDB = () => {
    const db = useContext(RxDBContext);
    if (!db) {
        throw new Error('useRxDB must be used within an RxDBProvider');
    }
    return db;
};

