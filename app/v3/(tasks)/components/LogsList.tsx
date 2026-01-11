import React from 'react';
import { clsx } from 'clsx';

export interface LogV3 {
    id: string;
    created_at: string;
    action: string;
    entity_type: string;
    details: string;
}

interface LogsListProps {
    logs: LogV3[];
    selectedLogId: string | null;
    onSelectLog: (id: string) => void;
}

export const LogsList = ({ logs, selectedLogId, onSelectLog }: LogsListProps) => {
    if (logs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-default-400 py-10">
                <p>No logs found.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-[2px] pb-10">
            {logs.map((log) => (
                <div 
                    key={log.id}
                    onClick={() => onSelectLog(log.id)}
                    className={clsx(
                        "group flex flex-col gap-1 px-3 py-2 rounded-lg cursor-pointer transition-colors border border-transparent",
                        selectedLogId === log.id 
                            ? "bg-primary/10 border-primary/20" 
                            : "hover:bg-default-100 hover:border-default-200"
                    )}
                >
                    <div className="flex items-center justify-between">
                        <span className={clsx(
                            "text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded",
                            log.action === 'create' && "bg-green-100 text-green-700",
                            log.action === 'update' && "bg-blue-100 text-blue-700",
                            log.action === 'delete' && "bg-red-100 text-red-700"
                        )}>
                            {log.action}
                        </span>
                        <span className="text-[10px] text-default-400">
                            {new Date(log.created_at).toLocaleString()}
                        </span>
                    </div>
                    
                    <div className="text-sm font-medium text-foreground truncate">
                        {log.entity_type}
                    </div>
                    
                    <div className="text-xs text-default-500 truncate">
                        {log.details}
                    </div>
                </div>
            ))}
        </div>
    );
};
