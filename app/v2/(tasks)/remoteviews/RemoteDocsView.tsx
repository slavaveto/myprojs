import React from 'react';

interface RemoteDocsViewProps {
    projectId: string;
    satelliteId?: string; // ID of the Docs project
}

export const RemoteDocsView = ({ projectId, satelliteId }: RemoteDocsViewProps) => {
    return (
        <div className="flex-1 flex items-center justify-center bg-background p-6">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold">Docs</span>
                </div>
                <h2 className="text-xl font-bold mb-2">Remote Docs Management</h2>
                <p className="text-default-500 mb-6">
                    Direct connection to remote documentation database.
                    Manage your project documentation here.
                </p>
                <div className="p-4 bg-default-50 rounded-lg border border-default-200 text-left text-xs font-mono text-default-600">
                    <p>Parent Project: {projectId}</p>
                    <p>Satellite ID: {satelliteId || 'Loading...'}</p>
                    <p>Connection: Direct (Supabase Client)</p>
                </div>
            </div>
        </div>
    );
};

