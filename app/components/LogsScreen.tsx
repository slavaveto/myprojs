'use client';

import React, { useEffect, useState } from 'react';
import { logService, LogEntry } from '@/app/_services/logService';
import { Spinner, Chip, Card, CardBody, Button } from '@heroui/react';
import { createLogger } from '@/utils/logger/Logger';
import { clsx } from 'clsx';
import { RefreshCw } from 'lucide-react';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { ActionStatus } from '@/utils/supabase/useAsyncAction';

const logger = createLogger('LogsScreen');

const LogDetails = ({ details }: { details: any }) => {
    if (!details || typeof details !== 'object' || Object.keys(details).length === 0) return null;

    return (
        <div className="mt-2 bg-default-50 rounded-lg p-2 border border-default-100">
            <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                {Object.entries(details).map(([key, value]) => (
                    <React.Fragment key={key}>
                        <span className="text-default-400 font-medium text-right select-none">{key}:</span>
                        <span className="text-foreground font-mono break-all">
                            {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                        </span>
                    </React.Fragment>
                ))}
            </div>
        </div>
    );
};

interface LogsScreenProps {
    globalStatus?: ActionStatus;
    canLoad?: boolean;
}

export const LogsScreen = ({ globalStatus = 'idle', canLoad = true }: LogsScreenProps) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    const fetchLogs = async (showSpinner = true) => {
        // If we shouldn't load, just return. 
        if (!canLoad && showSpinner) return;

        if (showSpinner) {
            setIsLoading(true);
            logger.start('Loading logs...');
        } else {
            setIsRefreshing(true);
            logger.info('Refreshing logs...');
        }
        
        try {
            const [data] = await Promise.all([
                logService.getLogs(50),
                new Promise(resolve => setTimeout(resolve, 1000))
            ]);
            setLogs(data || []);
            setIsLoaded(true);
            logger.success('Logs loaded');
        } catch (err) {
            logger.error('Failed to load logs', err);
        } finally {
            setIsLoading(false);
            setIsRefreshing(false);
        }
    };

    useEffect(() => {
        if (canLoad && !isLoaded) {
            fetchLogs(true);
        } else if (!canLoad) {
            logger.info('Waiting for background load permission...');
        }
    }, [canLoad, isLoaded]);

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
            <div className="flex justify-between items-center mb-4 min-h-[40px]">
                <h1 className="text-2xl font-bold">Activity Logs</h1>
                <div className="flex items-center gap-2">
                    <StatusBadge 
                        status={globalStatus}
                        loadingText="Saving..."
                        successText="Saved"
                    />
                    <Button 
                        isIconOnly 
                        size="sm" 
                        variant="flat" 
                        color="success"
                        onPress={() => fetchLogs(false)}
                        isLoading={isRefreshing}
                    >
                        <RefreshCw size={18} />
                    </Button>
                </div>
            </div>
            
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
                            
                            {log.details && <LogDetails details={log.details} />}
                        </CardBody>
                    </Card>
                ))}
            </div>
        </div>
    );
};

