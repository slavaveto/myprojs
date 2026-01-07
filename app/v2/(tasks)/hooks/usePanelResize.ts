import { useState, useRef, useCallback, useEffect } from 'react';
import { globalStorage } from '@/utils/storage';

const STORAGE_KEY = 'v2_details_panel_width';

export const usePanelResize = (initialWidth = 400, minWidth = 300) => {
    const [width, setWidth] = useState(() => {
        if (typeof window === 'undefined') return initialWidth;
        const saved = globalStorage.getItem(STORAGE_KEY);
        return saved ? parseInt(saved, 10) : initialWidth;
    });
    
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        globalStorage.setItem(STORAGE_KEY, width.toString());
    }, [width]);

    const startResizing = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        
        const startX = e.clientX;
        const startWidth = width;

        const onMouseMove = (e: MouseEvent) => {
            if (!containerRef.current) return;
            
            const containerWidth = containerRef.current.offsetWidth;
            const maxWidth = containerWidth / 2;
            
            // Двигаем влево -> увеличиваем ширину правой панели
            const delta = startX - e.clientX;
            const newWidth = Math.min(Math.max(startWidth + delta, minWidth), maxWidth);
            
            setWidth(newWidth);
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
        
    }, [width, minWidth]);

    return { width, containerRef, startResizing };
};

