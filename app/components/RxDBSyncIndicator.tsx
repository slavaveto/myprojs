'use client';

import React, { useEffect, useState } from 'react';
import { useRxDB } from '@/services/rxdb/RxDBProvider';
import { Spinner } from '@heroui/react';

export const RxDBSyncIndicator = () => {
    // Cast to any to avoid TS errors with context return type
    const context = useRxDB() as any; 
    const isSyncing = context?.isSyncing;
    
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        let timeoutId: NodeJS.Timeout;

        if (isSyncing) {
            setIsVisible(true);
        } else {
            // Delay hiding to prevent flickering and ensure visibility
            timeoutId = setTimeout(() => {
                setIsVisible(false);
            }, 2000);
        }

        return () => {
            if (timeoutId) clearTimeout(timeoutId);
        };
    }, [isSyncing]);

    if (!isVisible) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-default-200 transition-all duration-300 animate-fade-in hover:opacity-100">
             <Spinner size="sm" color="success" />
             <span className="text-xs font-medium text-default-700 dark:text-default-300 pr-1">
                {isSyncing ? 'Синхронизация...' : 'Готово'}
             </span>
        </div>
    );
};
