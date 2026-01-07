import React from 'react';

interface RemoteUsersViewProps {
    projectId: string;
    satelliteId?: string;
}

export const RemoteUsersView = ({ projectId, satelliteId }: RemoteUsersViewProps) => {
    return (
        <div className="flex-1 flex items-center justify-center bg-background p-6">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <span className="text-2xl font-bold">Users</span>
                </div>
                <h2 className="text-xl font-bold mb-2">Remote Users Management</h2>
                <p className="text-default-500 mb-6">
                    Manage users for this remote project.
                </p>
            </div>
        </div>
    );
};

