'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { logService, LogEntry } from '@/app/_services/logService';
import { Spinner, Chip, Card, CardBody, Button, Select, SelectItem } from '@heroui/react';
import { createLogger } from '@/utils/logger/Logger';
import { clsx } from 'clsx';
import { RefreshCw, FileText } from 'lucide-react';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { ActionStatus } from '@/utils/supabase/useAsyncAction';
import { useGlobalPersistentState } from '@/utils/storage';
import { BaseActions } from '@/app/_services/actions';
import { isToday, isYesterday, isThisWeek, isThisMonth } from 'date-fns';
import { loadingService } from '@/app/_services/loadingService';

const logger = createLogger('LogsScreen');

const TIME_RANGES = [
    { key: 'hour', label: 'Last Hour' },
    { key: 'today', label: 'Today' },
    { key: 'all', label: 'All Time' },
];

const LIMIT_OPTIONS = [
    { key: '50', label: '50 items' },
    { key: '100', label: '100 items' },
    { key: '200', label: '200 items' },
    { key: '500', label: '500 items' },
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
    const [actionFilter, setActionFilter] = useGlobalPersistentState<string>('logs_action_filter', 'all');
    const [limitFilter, setLimitFilter] = useGlobalPersistentState<string>('logs_limit_filter', '50');


    const fetchLogs = async (showSpinner = true) => {
        if (!canLoad && showSpinner) return;

        if (showSpinner) {
            setIsLoading(true);
            loadingService.logSystemTabStart('Logs');
        } else {
            setIsRefreshing(true);
            logger.info('Refreshing logs...');
        }
        
        try {
            const limit = parseInt(limitFilter) || 50;
            const [data] = await Promise.all([
                logService.getLogs(limit, timeFilter, actionFilter),
                new Promise(resolve => setTimeout(resolve, 1000))
            ]);
            setLogs(data || []);
            setIsLoaded(true);
            loadingService.logSystemTabFinish('Logs', data?.length || 0);
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
    }, [canLoad, isActive, timeFilter, actionFilter, limitFilter]);

    const getActionColor = (action: string) => {
        switch (action) {
            case BaseActions.CREATE: return 'success';
            case BaseActions.CREATE_INBOX: return 'secondary';
            case BaseActions.COMPLETE: return 'success';
            case BaseActions.RESTORE: return 'primary';
            case BaseActions.UPDATE: return 'warning';
            case BaseActions.REORDER: return 'secondary';
            case BaseActions.DELETE: return 'danger';
            default: return 'default';
        }
    };

    const handleRepair = async () => {
        const toast = (await import('react-hot-toast')).default;
        const toastId = toast.loading('Repairing logs...');
        try {
            const result = await logService.fixMissingLogs();
            toast.success(`Repaired ${result.count} logs`, { id: toastId });
            fetchLogs(false);
        } catch (e) {
            toast.error('Failed to repair', { id: toastId });
        }
    };

    const groupedLogs = useMemo(() => {
        const groups = {
            today: [] as LogEntry[],
            yesterday: [] as LogEntry[],
            thisWeek: [] as LogEntry[],
            thisMonth: [] as LogEntry[],
            older: [] as LogEntry[],
        };

        logs.filter(log => log.action !== BaseActions.REORDER).forEach(log => {
            const date = new Date(log.created_at);
            if (isToday(date)) {
                groups.today.push(log);
            } else if (isYesterday(date)) {
                groups.yesterday.push(log);
            } else if (isThisWeek(date, { weekStartsOn: 1 })) {
                groups.thisWeek.push(log);
            } else if (isThisMonth(date)) {
                groups.thisMonth.push(log);
            } else {
                groups.older.push(log);
            }
        });

        return groups;
    }, [logs]);

    const renderGroup = (title: string, groupLogs: LogEntry[]) => {
        if (groupLogs.length === 0) return null;
        return (
            <div key={title} className="mb-0">
                <div className="text font-semibold text-default-400 uppercase tracking-wider mb-2 px-1">
                    {title}
                </div>
                <div className="flex flex-col gap-2">
                    {groupLogs.map((log) => (
                        <div key={log.id} className="border border-default-200 rounded-medium p-3 bg-content1">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        <Chip 
                                            size="sm" 
                                            color={getActionColor(log.action)} 
                                            variant="flat"
                                            className="uppercase font-bold text-[10px] min-w-fit"
                                        >
                                            {log.action}
                                        </Chip>

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

                                        <span className=" text text-default-400 uppercase tracking-wider min-w-fit">
                                            {log.entity}
                                        </span>

                                        <span className="text-xs font-medium truncate text-default-500" title={log.entity_title || log.entity_id}>
                                            {log.entity_title || <span className="text-default-300">{log.entity_id.slice(0, 8)}</span>}
                                        </span>
                                    </div>

                                    <div className="text text-default-400 whitespace-nowrap ml-4 tabular-nums">
                                        {new Date(log.created_at).toLocaleTimeString()}
                                    </div>
                                </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    if (isLoading) {
        return (
            <div className="flex justify-center items-center h-full">
                <Spinner label="Loading logs..." />
            </div>
        );
    }

    const ACTION_FILTERS = [
        { key: 'all', label: 'All Actions' },
        { key: BaseActions.CREATE, label: 'Create' },
        { key: BaseActions.COMPLETE, label: 'Complete' },
        { key: BaseActions.UPDATE, label: 'Update' },
        { key: BaseActions.DELETE, label: 'Delete' },
        { key: BaseActions.RESTORE, label: 'Restore' },
        { key: BaseActions.REORDER, label: 'Reorder' },
    ];

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
                        selectedKeys={[actionFilter]}
                        onChange={(e) => setActionFilter(e.target.value)}
                        className="w-[150px]"
                        aria-label="Action Filter"
                        disallowEmptySelection
                    >
                        {ACTION_FILTERS.map((filter) => (
                            <SelectItem key={filter.key}>
                                {filter.label}
                            </SelectItem>
                        ))}
                    </Select>

                    <Select 
                        size="sm"
                        selectedKeys={[timeFilter]}
                        onChange={(e) => setTimeFilter(e.target.value)}
                        className="w-[150px]"
                        aria-label="Time Range"
                        disallowEmptySelection
                    >
                        {TIME_RANGES.map((range) => (
                            <SelectItem key={range.key}>
                                {range.label}
                            </SelectItem>
                        ))}
                    </Select>

                    <Select 
                        size="sm"
                        selectedKeys={[limitFilter]}
                        onChange={(e) => setLimitFilter(e.target.value)}
                        className="w-[150px]"
                        aria-label="Limit"
                        disallowEmptySelection
                    >
                        {LIMIT_OPTIONS.map((opt) => (
                            <SelectItem key={opt.key}>
                                {opt.label}
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
                        <Button 
                            size="sm" 
                            variant="flat" 
                            color="warning"
                            onPress={handleRepair}
                            className="min-w-0 px-3 hidden"
                        >
                            Fix Data
                        </Button>
                    </div>
                </div>
            </div>
            
            <div className="flex-grow overflow-y-auto space-y-0 pb-10">
                {logs.length === 0 ? (
                    <div className="text-center text-default-400 py-10">
                        No logs found.
                    </div>
                ) : (
                    <>
                        {renderGroup('Today', groupedLogs.today)}
                        {renderGroup('Yesterday', groupedLogs.yesterday)}
                        {renderGroup('This Week', groupedLogs.thisWeek)}
                        {renderGroup('This Month', groupedLogs.thisMonth)}
                        {renderGroup('Older', groupedLogs.older)}
                    </>
                )}
            </div>
        </div>
    );
};
