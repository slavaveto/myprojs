import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { SyncIndicator } from '../components/misc/SyncIndicator';

export const RemoteSyncIndicatorPortal = () => {
    const [mounted, setMounted] = useState(false);
    const [target, setTarget] = useState<HTMLElement | null>(null);
    
    useEffect(() => {
        setMounted(true);
        
        const findTarget = () => {
            const el = document.getElementById('header-sync-indicator-slot');
            if (el) setTarget(el);
            return el;
        };

        if (!findTarget()) {
            // Retry if not found immediately (e.g. hydration race)
            const timer = setInterval(() => {
                if (findTarget()) clearInterval(timer);
            }, 50);
            return () => {
                clearInterval(timer);
                setMounted(false);
            };
        }
        
        return () => setMounted(false);
    }, []);

    // console.log('[RemotePortal] Rendering?', { mounted, target: !!target });

    if (!mounted || !target) return null;

    return createPortal(
        <div className="absolute inset-0 flex items-center justify-center bg-background z-[9999]">
            <SyncIndicator />
        </div>, 
        target
    );
};
