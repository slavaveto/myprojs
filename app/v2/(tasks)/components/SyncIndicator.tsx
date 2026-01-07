import React from 'react';
import { useStatus } from '@powersync/react';
import { RefreshCw, CloudOff, Cloud, CheckCircle2, UploadCloud, DownloadCloud } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent, Button, Chip } from '@heroui/react';
import { clsx } from 'clsx';

export const SyncIndicator = () => {
    const status = useStatus();

    // Determine state
    // @ts-ignore
    const isWorking = status.connecting || status.downloading || status.uploading;
    const isOffline = !status.connected && !status.connecting;
    
    // Status Text logic
    const getStatusText = () => {
        if (status.connecting) return 'Connecting...';
        // @ts-ignore
        if (status.downloading) return 'Downloading changes...';
        // @ts-ignore
        if (status.uploading) return 'Uploading changes...';
        if (!status.connected) return 'Offline';
        return 'Synced';
    };

    const getStatusColor = () => {
        if (isOffline) return 'danger';
        if (isWorking) return 'warning';
        return 'success';
    };

    return (
        <Popover placement="bottom-end">
            <PopoverTrigger>
                <Button 
                    isIconOnly 
                    variant="light" 
                    size="sm" 
                    className={clsx(
                        "transition-all",
                        isOffline ? "text-red-500" : "text-default-500"
                    )}
                >
                    {/* ICON LOGIC */}
                    {isWorking ? (
                        <RefreshCw size={18} className="animate-spin text-orange-500" />
                    ) : isOffline ? (
                        <CloudOff size={18} className="text-red-500" />
                    ) : (
                        <div className="relative">
                            <Cloud size={18} className="text-green-600" />
                            {/* Small ping animation if connected */}
                            <span className="absolute top-0 right-0 -mt-0.5 -mr-0.5 flex h-2 w-2">
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                        </div>
                    )}
                </Button>
            </PopoverTrigger>
            
            <PopoverContent>
                <div className="px-1 py-2 w-[240px] flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-default-200 pb-2">
                        <span className="text-sm font-bold">Sync Status</span>
                        <Chip size="sm" color={getStatusColor()} variant="flat">
                            {getStatusText()}
                        </Chip>
                    </div>

                    <div className="space-y-2 text-xs text-default-600">
                        {/* Connection */}
                        <div className="flex justify-between">
                            <span>Connection</span>
                            <span className={status.connected ? "text-green-600" : "text-red-500"}>
                                {status.connected ? "Online" : "Disconnected"}
                            </span>
                        </div>

                        {/* Last Synced */}
                        <div className="flex justify-between">
                            <span>Last Synced</span>
                            <span className="font-mono">
                                {status.lastSyncedAt 
                                    ? status.lastSyncedAt.toLocaleTimeString() 
                                    : "Never"}
                            </span>
                        </div>

                        {/* Uploading */}
                        {/* @ts-ignore */}
                        {status.uploading && (
                            <div className="flex justify-between text-orange-600 bg-orange-50 p-1 rounded">
                                <span className="flex items-center gap-1"><UploadCloud size={12}/> Uploading</span>
                                <span>Processing...</span>
                            </div>
                        )}

                        {/* Downloading */}
                        {/* @ts-ignore */}
                        {status.downloading && (
                            <div className="flex justify-between text-blue-600 bg-blue-50 p-1 rounded">
                                <span className="flex items-center gap-1"><DownloadCloud size={12}/> Downloading</span>
                                <span>Processing...</span>
                            </div>
                        )}
                        
                        {/* Error */}
                        {/* @ts-ignore */}
                        {status.anyError && (
                            <div className="bg-red-50 text-red-600 p-2 rounded text-[10px] break-words">
                                {/* @ts-ignore */}
                                Error: {status.anyError.message || JSON.stringify(status.anyError)}
                            </div>
                        )}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

