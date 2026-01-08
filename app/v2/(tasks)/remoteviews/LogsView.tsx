import React from 'react';

interface LogsViewProps {
    projectId: string;
    satelliteId?: string;
}

export const LogsView = ({ projectId, satelliteId }: LogsViewProps) => {
    return (
        <div className="flex-1 flex items-center justify-center bg-background p-6">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold">Logs</span>
                </div>
                <h2 className="text-xl font-bold mb-2">Remote Logs</h2>
                <p className="text-default-500 mb-6">
                    View activity logs for this remote project.
                </p>
            </div>
        </div>
    );
};

