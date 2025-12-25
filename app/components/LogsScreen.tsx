'use client';

import React, { useEffect, useState } from 'react';
import { logService, LogEntry } from '@/app/_services/logService';
import { Spinner, Chip, Card, CardBody } from '@heroui/react';
import { createLogger } from '@/utils/logger/Logger';
import { clsx } from 'clsx';

const logger = createLogger('LogsScreen');

export const LogsScreen = () => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const data = await logService.getLogs(50);
                setLogs(data || []);
            } catch (err) {
                logger.error('Failed to load logs', err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchLogs();
    }, []);

    const getActionColor = (action: string) => {
        switch (action) {
            case 'create': return 'success';
            case 'update': return 'warning';
            case 'delete': return 'danger';
            case 'move': return 'primary';
            default: return 'default';
        }
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Spinner label="Loading logs..." />
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-6 max-w-5xl mx-auto w-full">
            <h1 className="text-2xl font-bold mb-6">Activity Logs</h1>
            
            <div className="flex-grow overflow-y-auto space-y-2 pb-10">
                {logs.length === 0 && (
                    <div className="text-center text-default-400 py-10">
                        No logs found.
                    </div>
                )}
                
                {logs.map((log) => (
                    <Card key={log.id} shadow="sm" className="border border-default-200">
                        <CardBody className="p-3">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Chip 
                                        size="sm" 
                                        color={getActionColor(log.action)} 
                                        variant="flat"
                                        className="uppercase font-bold text-[10px]"
                                    >
                                        {log.action}
                                    </Chip>
                                    <span className="font-mono text-xs text-default-500">
                                        {log.entity_table} / {log.entity_id.slice(0, 8)}
                                    </span>
                                </div>
                                <div className="text-xs text-default-400">
                                    {new Date(log.created_at).toLocaleString()}
                                </div>
                            </div>
                            
                            {log.details && (
                                <pre className="bg-default-100 p-2 rounded text-[10px] overflow-x-auto font-mono text-default-600">
                                    {JSON.stringify(log.details, null, 2)}
                                </pre>
                            )}
                        </CardBody>
                    </Card>
                ))}
            </div>
        </div>
    );
};

