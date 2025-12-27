'use client';

import React, { useEffect, useState } from 'react';
import { logService, LogEntry } from '@/app/_services/logService';
import { Spinner, Chip, Card, CardBody, Button, Select, SelectItem } from '@heroui/react';
import { createLogger } from '@/utils/logger/Logger';
import { clsx } from 'clsx';
import { RefreshCw , FileText} from 'lucide-react';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { ActionStatus } from '@/utils/supabase/useAsyncAction';
import { useGlobalPersistentState } from '@/utils/storage';
import { BaseActions } from '@/app/_services/actions';

const logger = createLogger('LogsScreen');

const TIME_RANGES = [
    { key: 'hour', label: 'Last Hour' },
    { key: 'today', label: 'Today' },
    { key: 'all', label: 'All Time' },
];

interface LogsScreenProps {
    globalStatus?: ActionStatus;
    canLoad?: boolean;
    isActive?: boolean;
}

export const LogsScreen = ({ globalStatus = 'idle', canLoad = true, isActive = false }: LogsScreenProps) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);
    const [timeFilter, setTimeFilter] = useGlobalPersistentState<string>('logs_time_filter', 'all');

    const fetchLogs = async (showSpinner = true) => {
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
                logService.getLogs(50, timeFilter),
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
        if (canLoad && isActive) {
            logger.info('LogsScreen became active, fetching...');
            fetchLogs(!isLoaded);
        } else if (canLoad && !isLoaded) {
            fetchLogs(true);
        }
    }, [canLoad, isActive, timeFilter]);

    const getActionColor = (action: string) => {
        switch (action) {
            case BaseActions.CREATE: return 'success';
            case BaseActions.COMPLETE: return 'success';
            case BaseActions.RESTORE: return 'primary';
            case BaseActions.UPDATE: return 'warning';
            case BaseActions.REORDER: return 'secondary';
            case BaseActions.DELETE: return 'danger';
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

                <h1 className="tab-title">
                    <FileText className="text-success" />
                    Logs 
                </h1>

                <div className="flex items-center gap-4">
                    <Select 
                        size="sm"
                        selectedKeys={[timeFilter]}
                        onChange={(e) => setTimeFilter(e.target.value)}
                        className="w-[200px]"
                        aria-label="Time Range"
                        disallowEmptySelection
                    >
                        {TIME_RANGES.map((range) => (
                            <SelectItem key={range.key}>
                                {range.label}
                            </SelectItem>
                        ))}
                    </Select>

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
            </div>
            
            <div className="flex-grow overflow-y-auto space-y-2 pb-10">
                {logs.length === 0 && (
                    <div className="text-center text-default-400 py-10">
                        No logs found.
                    </div>
                )}
                
                {logs
                    .filter(log => log.action !== BaseActions.REORDER)
                    .map((log) => (
                    <Card key={log.id} shadow="sm" className="border border-default-200">
                        <CardBody className="p-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    {/* Action Chip */}
                                    <Chip 
                                        size="sm" 
                                        color={getActionColor(log.action)} 
                                        variant="flat"
                                        className="uppercase font-bold text-[10px] min-w-fit"
                                    >
                                        {log.action}
                                    </Chip>

                                    {/* Update Type Chip (if present and action is update) */}
                                    {(log.update_type && log.action === BaseActions.UPDATE) && (
                                        <Chip 
                                            size="sm" 
                                            color="default" 
                                            variant="flat"
                                            className="uppercase font-bold text-[10px] min-w-fit bg-default-100 text-default-500"
                                        >
                                            {log.update_type}
                                        </Chip>
                                    )}

                                    {/* Entity Type */}
                                    <span className="font-mono text-xs text-default-400 uppercase tracking-wider min-w-fit">
                                        {log.entity}
                                    </span>

                                    {/* Entity Title */}
                                    <span className="text-sm font-medium truncate" title={log.entity_title || log.entity_id}>
                                        {log.entity_title || <span className="text-default-300 font-mono">{log.entity_id.slice(0, 8)}</span>}
                                    </span>
                                </div>

                                {/* Time */}
                                <div className="text-xs text-default-400 whitespace-nowrap ml-4 tabular-nums">
                                    {new Date(log.created_at).toLocaleString()}
                                </div>
                            </div>
                            
                            {/* Details hidden per request "И все!!! ditales потом подключим" */}
                        </CardBody>
                    </Card>
                ))}
            </div>
        </div>
    );
};
