import React from 'react';

interface RemoteTablesViewProps {
    projectId: string;
    satelliteId?: string;
}

export const RemoteTablesView = ({ projectId, satelliteId }: RemoteTablesViewProps) => {
    return (
        <div className="flex-1 flex items-center justify-center bg-background p-6">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold">Tables</span>
                </div>
                <h2 className="text-xl font-bold mb-2">Remote Tables</h2>
                <p className="text-default-500 mb-6">
                    Manage database tables for this remote project.
                </p>
            </div>
        </div>
    );
};

