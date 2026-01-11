import React from 'react';
import { useQuery } from '@powersync/react';
import { LogV3 } from './LogsList';

interface LogDetailsProps {
    logId: string | null;
}

export const LogDetails = ({ logId }: LogDetailsProps) => {
    // 1. Load Log Data
    const { data: logData } = useQuery(
        logId ? `SELECT * FROM logs WHERE id = ?` : '',
        logId ? [logId] : []
    );
    const log: LogV3 | undefined = logData?.[0];

    if (!logId) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-default-400 z-20">
                <span className="text-sm">Выберите лог для просмотра</span>
            </div>
        );
    }

    if (!log) {
        return (
            <div className="w-full h-full flex flex-col items-center justify-center text-default-400 z-20">
                <span className="text-sm">Загрузка...</span>
            </div>
        );
    }

    return (
        <div className="w-full h-full flex flex-col z-20">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-default-200/50 bg-gray-50/50">
                <span className="text-xs font-bold text-default-400 uppercase tracking-wider">Детали лога</span>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                
                {/* ID & Time */}
                <div className="text-xs text-default-400 flex flex-col gap-1">
                    <div>ID: <span className="font-mono">{log.id}</span></div>
                    <div>Time: {new Date(log.created_at).toLocaleString()}</div>
                </div>

                {/* Action */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-default-500 uppercase">Action</label>
                    <div className="text-lg font-bold">{log.action}</div>
                </div>

                {/* Entity */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-default-500 uppercase">Entity</label>
                    <div className="text-base">{log.entity_type}</div>
                </div>

                {/* Details (JSON or Text) */}
                <div className="space-y-1">
                    <label className="text-xs font-medium text-default-500 uppercase">Details</label>
                    <div className="p-3 bg-default-50 rounded-lg border border-default-200 text-sm font-mono whitespace-pre-wrap break-all">
                        {log.details}
                    </div>
                </div>

            </div>
        </div>
    );
};

