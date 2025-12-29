'use client';

import React, { useEffect, useState } from 'react';
import { Project } from '@/app/types';
import FlowPage from '@/app/tabs/docs/FlowTab';
import { createLogger } from '@/utils/logger/Logger';
import { loadingService } from '@/app/_services/loadingLogsService';

const logger = createLogger('DocsScreen');

interface DocsScreenProps {
    project: Project;
    isActive: boolean;
    canLoad: boolean; // Permission to start loading data
    onReady?: () => void; // Signal that initial data is loaded
}

export const DocsScreen = (props: DocsScreenProps) => {
    const { project, isActive, canLoad, onReady } = props;
    const [isLoaded, setIsLoaded] = useState(false);

    // We don't fetch data here directly because FlowPage handles its own fetching.
    // But we need to signal onReady when FlowPage is ready.
    // However, FlowPage currently fetches on mount. 
    // We should modify FlowPage to fetch only when canLoad is true.
    
    // For now, let's assume DocsScreen is "ready" immediately or we pass canLoad to FlowPage?
    // Let's pass canLoad to FlowPage and have it call onReady.
    
    // Actually, FlowPage logic is:
    // useEffect(() => { loadFlows() }, [projectId])
    
    // We can wrap FlowPage to control when it renders/loads.
    
    useEffect(() => {
        if (canLoad && !isLoaded) {
            loadingService.logDocsScreenStart(project.title);
            // Signal ready immediately for now as FlowPage handles its own loading states gracefully
            // Or we can wait for FlowPage to report readiness?
            // Let's just mark it as ready to not block the app, 
            // as docs are secondary to tasks usually.
            setIsLoaded(true);
            if (onReady) onReady();
            loadingService.logDocsScreenFinish(project.title);
        }
    }, [canLoad, isLoaded, onReady, project.title]);

    // Optimize rendering: if not active and not loaded, don't render heavy stuff?
    // But we want background loading.
    
    if (!canLoad && !isLoaded) {
        return null; 
    }

    return (
        <div className="h-full w-full bg-white">
             {/* Pass projectId and projectLocalPath */}
             <FlowPage projectId={project.id} projectLocalPath={project.local_path} />
        </div>
    );
};

