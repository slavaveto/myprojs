import React from 'react';
import { useQuery } from '@powersync/react';
import { clsx } from 'clsx';

interface LogsViewProps {
    isActive: boolean;
}

const LogsViewComponent = ({ isActive }: LogsViewProps) => {
    // Only query if active (or keep querying for live logs?)
    // Let's keep it simple: query always, but limit
    const { data: logsData } = useQuery(
        `SELECT * FROM logs ORDER BY created_at DESC LIMIT 50`
    );
    
    const logs = logsData || [];

    return (
        <div className="flex flex-col h-full w-full bg-background overflow-hidden">
      
            
            <div className="flex-1 overflow-y-auto p-4">
                {logs.length === 0 ? (
                    <div className="text-center text-default-400 py-10">No logs found.</div>
                ) : (
                    <table className="w-full text-sm text-left">
                        <thead className="text-xs text-default-500 uppercase bg-default-50 sticky top-0">
                            <tr>
                                <th className="px-4 py-2">Time</th>
                                <th className="px-4 py-2">Action</th>
                                <th className="px-4 py-2">Entity</th>
                                <th className="px-4 py-2">Details</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-default-100">
                            {logs.map((log: any) => (
                                <tr key={log.id} className="hover:bg-default-50">
                                    <td className="px-4 py-2 whitespace-nowrap text-default-500 text-xs">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td className="px-4 py-2 font-medium">
                                        <span className={clsx(
                                            "px-2 py-0.5 rounded text-[10px] uppercase",
                                            log.action === 'create' && "bg-green-100 text-green-700",
                                            log.action === 'update' && "bg-blue-100 text-blue-700",
                                            log.action === 'delete' && "bg-red-100 text-red-700"
                                        )}>
                                            {log.action}
                                        </span>
                                    </td>
                                    <td className="px-4 py-2 text-default-600">
                                        {log.entity_type}
                                    </td>
                                    <td className="px-4 py-2 text-default-500 truncate max-w-[200px]" title={log.details}>
                                        {log.details}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};

export const LogsView = React.memo(LogsViewComponent, (prev, next) => {
    // Only re-render if visibility changes
    if (prev.isActive !== next.isActive) return false;
    // If hidden, don't re-render on data changes (optional optimization)
    if (!next.isActive) return true;
    return false;
});

