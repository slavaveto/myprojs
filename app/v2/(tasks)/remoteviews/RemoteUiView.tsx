import React from 'react';

interface RemoteUiViewProps {
    projectId: string;
    satelliteId?: string; // ID of the UI project
}

export const RemoteUiView = ({ projectId, satelliteId }: RemoteUiViewProps) => {
    return (
        <div className="flex-1 flex items-center justify-center bg-background p-6">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold">UI</span>
                </div>
                <h2 className="text-xl font-bold mb-2">Remote UI Management</h2>
                <p className="text-default-500 mb-6">
                    Direct connection to remote localization database.
                    Here you will manage translation keys.
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

