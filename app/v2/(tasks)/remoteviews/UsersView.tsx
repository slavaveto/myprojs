import React from 'react';

interface UsersViewProps {
    projectId: string;
    satelliteId?: string;
}

export const UsersView = ({ projectId, satelliteId }: UsersViewProps) => {
    return (
        <div className="flex-1 flex items-center justify-center bg-background p-6">
            <div className="text-center max-w-md">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
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

