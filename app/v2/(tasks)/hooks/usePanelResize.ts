import { useState, useRef, useCallback, useEffect } from 'react';
import { globalStorage } from '@/utils/storage';

const STORAGE_KEY = 'v2_details_panel_width';
const EVENT_NAME = 'v2_panel_resize_sync';

export const usePanelResize = (initialWidth = 400, minWidth = 300) => {
    // Read initial safely
    const readStored = () => {
        if (typeof window === 'undefined') return initialWidth;
        const saved = globalStorage.getItem(STORAGE_KEY);
        const parsed = saved ? parseInt(saved, 10) : initialWidth;
        return isNaN(parsed) ? initialWidth : parsed;
    };

    const [width, setWidth] = useState(readStored);
    const containerRef = useRef<HTMLDivElement>(null);

    // Sync listener
    useEffect(() => {
        const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && !isNaN(detail)) {
                setWidth(detail);
            }
        };
        window.addEventListener(EVENT_NAME, handler);
        return () => window.removeEventListener(EVENT_NAME, handler);
    }, []);

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation(); // Stop bubbling
        
        const startX = e.clientX;
        const startWidth = isNaN(width) ? initialWidth : width;

        const onMouseMove = (e: MouseEvent) => {
            e.preventDefault();
            if (!containerRef.current) return;
            
            const containerWidth = containerRef.current.offsetWidth;
            const maxWidth = containerWidth / 2; // Limit to 50%
            
            // Move left -> increase right panel width
            const delta = startX - e.clientX;
            const newWidth = Math.min(Math.max(startWidth + delta, minWidth), maxWidth);
            
            // Update local state
            setWidth(newWidth);
            
            // Broadcast change
            globalStorage.setItem(STORAGE_KEY, newWidth.toString());
            window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: newWidth }));
        };

        const onMouseUp = () => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.body.style.cursor = 'col-resize';
        document.body.style.userSelect = 'none';
        
    }, [width, minWidth, initialWidth]);

    return { width, containerRef, startResizing };
};

