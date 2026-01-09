import React, { useState } from 'react';
import { useRemoteUiData } from '../hooks/useRemoteUiData';
import { RemoteSyncProvider } from '@/app/_services/powerSync/RemoteSyncProvider';
import { TaskList } from '../components/TaskList';
import { DetailsPanel } from '../components/DetailsPanel';
import { usePanelResize } from '../hooks/usePanelResize';

interface RemoteUiViewProps {
    projectId: string;
    projectTitle: string;
}

const RemoteUiContent = ({ projectId }: { projectId: string }) => {
    // Uses REMOTE DB (from RemoteSyncProvider)
    const remoteUi = useRemoteUiData(projectId);
    
    // UI State
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const { width: panelWidth, containerRef, startResizing } = usePanelResize(400);
    const safePanelWidth = isNaN(panelWidth) ? 400 : panelWidth;

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
            <div 
                ref={containerRef}
                className="flex-1 flex min-h-0 overflow-hidden relative"
            >
                {/* Left: Task List */}
                <div className="flex-1 overflow-y-scroll p-6 bg-background">
                    {remoteUi.activeFolderId ? (
                        <TaskList 
                            tasks={remoteUi.tasks}
                            onSelectTask={setSelectedTaskId}
                            selectedTaskId={selectedTaskId}
                            onUpdateTask={remoteUi.updateTask}
                        />
                    ) : (
                        <div className="border-2 border-dashed border-default-200 rounded-xl h-full flex items-center justify-center text-default-400">
                            
                        </div>
                    )}
                </div>

                {/* Resize Handle */}
                <div
                    className="w-[1px] relative z-30 cursor-col-resize group select-none"
                    onMouseDown={startResizing}
                >
                    {/* Visual Line: expands symmetrically from center */}
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-default-200 group-hover:w-[3px] group-hover:bg-primary transition-all duration-300 delay-200 ease-out" />
                    
                    {/* Invisible hit area */}
                    <div className="absolute inset-y-0 -left-1 -right-1 z-10 bg-transparent" />
                </div>

                {/* Right: Details Panel */}
                <div 
                    style={{ width: safePanelWidth }}
                    className="flex-shrink-0 bg-content2/50 overflow-y-auto z-10"
                >
                    <DetailsPanel 
                        taskId={selectedTaskId} 
                    />
                </div>
            </div>
        </div>
    );
};

export const RemoteUiView = ({ projectId, projectTitle }: RemoteUiViewProps) => {
    return (
        <RemoteSyncProvider projectId={projectId} projectTitle={projectTitle}>
            <RemoteUiContent projectId={projectId} />
        </RemoteSyncProvider>
    );
};
