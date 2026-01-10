import React, { useState, useEffect } from 'react';
import { useStatus } from '@powersync/react';
import { RefreshCw, CloudOff, Cloud, UploadCloud, DownloadCloud, AlertTriangle, Database } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent, Button, Chip } from '@heroui/react';
import { clsx } from 'clsx';
import { usePowerSync } from '@/app/_services/powerSync/SyncProvider';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { useSyncCheck } from '@/app/v2/(tasks)/hooks/useSyncCheck';
import { syncBridge, SimpleSyncStatus } from '@/app/_services/powerSync/syncStatusBridge';
import { useConnectionHealth } from '@/app/v2/(tasks)/hooks/useConnectionHealth';

import { createLogger } from '@/utils/logger/Logger';
const logger = createLogger('SyncIndicator');

export interface SyncIndicatorProps {
    isRemote?: boolean;
    projectTitle?: string;
}

export const SyncIndicator = ({ isRemote, projectTitle }: SyncIndicatorProps) => {
    // 1. Get default status (Main DB)
    const mainStatus = useStatus() as any;
    
    // 2. Get ALL remote statuses (Map)
    const [remoteStatuses, setRemoteStatuses] = useState<Map<string, SimpleSyncStatus>>(new Map());

    useEffect(() => {
        const handler = (statuses: Map<string, SimpleSyncStatus>) => {
            setRemoteStatuses(new Map(statuses)); // Clone
        };
        syncBridge.on('change', handler);
        // Initial sync
        setRemoteStatuses(new Map(syncBridge.getStatuses()));
        
        return () => {
            syncBridge.off('change', handler);
        };
    }, []);

    // 3. Determine ACTIVE status (for current view)
    // If remote, find the status for THIS project (we don't have ID here easily, unless passed? 
    // Wait, syncBridge keys are project IDs. We only have projectTitle passed.
    // We should ideally pass projectId too. But let's find by title or assume single active remote if isRemote is true?
    // Actually, syncBridge stores by ID.
    // Let's iterate values to find one matching title? Or just use "Any Active Remote Status"?
    // Ideally Header should pass ID.
    
    // Fallback: If isRemote, we try to find a matching status in map, or use the last updated one?
    // Let's assume for now we use the map values.
    
    let activeRemoteStatus: SimpleSyncStatus | null = null;
    if (isRemote && projectTitle) {
        // Try to find by title
        for (const s of Array.from(remoteStatuses.values())) {
            if (s.projectTitle === projectTitle) {
                activeRemoteStatus = s;
                break;
            }
        }
    }

    const currentViewStatus = isRemote 
        ? (activeRemoteStatus || { connected: false, connecting: true }) 
        : mainStatus;

    const db = usePowerSync();
    const { supabase } = useSupabase();

    // 4. HEALTH CHECK (GLOBAL)
    
    // Main DB Health
    const mainHealth = useConnectionHealth(db, 'MainDB'); // Always check Main DB
    const isMainUnhealthy = !mainHealth.isHealthy;

    // Collect Unhealthy Remotes
    const unhealthyRemotes: { name: string, failures: number }[] = [];
    remoteStatuses.forEach((s, pid) => {
        if (s.isHealthy === false) {
            unhealthyRemotes.push({ 
                name: s.projectTitle || `Remote ${pid.slice(0,4)}`, 
                failures: s.consecutiveFailures || 0 
            });
        }
    });

    const isGlobalUnhealthy = isMainUnhealthy || unhealthyRemotes.length > 0;
    
    // Active Health (for current view color logic if we want to be specific, but Global Red is better)
    
    // SyncCheck is strictly for MAIN DB for now
    const { checkIntegrity, isChecking, integrityReport, clearReport } = useSyncCheck(db, supabase);

    // Determine state (Current View)
    const rawIsSyncing = currentViewStatus.dataFlow?.downloading || currentViewStatus.dataFlow?.uploading || currentViewStatus.downloading || currentViewStatus.uploading;
    const rawIsConnecting = currentViewStatus.connecting;

    // Debug status changes
    useEffect(() => {
        const up = currentViewStatus.dataFlow?.uploading || currentViewStatus.uploading;
        const down = currentViewStatus.dataFlow?.downloading || currentViewStatus.downloading;
        if (up || down) {
            logger.info('SyncIndicator: Activity detected!', { uploading: up, downloading: down });
        }
    }, [currentViewStatus]);
    
    // UI States
    const [isUploading, setIsUploading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    useEffect(() => {
        const rawUp = currentViewStatus.dataFlow?.uploading || currentViewStatus.uploading;
        const rawDown = currentViewStatus.dataFlow?.downloading || currentViewStatus.downloading;

        let upTimer: NodeJS.Timeout;
        let downTimer: NodeJS.Timeout;

        if (rawUp) setIsUploading(true);
        else upTimer = setTimeout(() => setIsUploading(false), 500);

        if (rawDown) setIsDownloading(true);
        else downTimer = setTimeout(() => setIsDownloading(false), 500);

        return () => { clearTimeout(upTimer); clearTimeout(downTimer); };
    }, [currentViewStatus]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (rawIsConnecting) {
            setIsConnecting(true);
        } else {
            timer = setTimeout(() => setIsConnecting(false), 500);
        }
        return () => clearTimeout(timer);
    }, [rawIsConnecting]);

    const isOffline = !currentViewStatus.connected && !currentViewStatus.connecting;
    const anyError = currentViewStatus.anyError || currentViewStatus.dataFlow?.uploadError || currentViewStatus.dataFlow?.downloadError;
    
    // Status Text logic
    const getStatusText = () => {
        if (isGlobalUnhealthy) return `Unstable (${unhealthyRemotes.length + (isMainUnhealthy ? 1 : 0)})`;
        if (anyError) return 'Sync Error';
        if (isConnecting) return 'Connecting...';
        if (isUploading) return 'Uploading...';
        if (isDownloading) return 'Downloading...';
        return 'Online';
    };

    const getStatusColor = () => {
        if (isGlobalUnhealthy) return 'danger';
        if (anyError) return 'danger';
        if (isOffline) return 'danger';
        if (isConnecting) return 'warning';
        if (isUploading) return 'danger'; 
        if (isDownloading) return 'primary';
        return 'success';
    };

    return (
        <Popover 
            placement="bottom-end" 
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    clearReport();
                }
            }}
        >
            <PopoverTrigger>
                <Button 
                    isIconOnly 
                    variant="light" 
                    size="sm" 
                    className={clsx(
                        "transition-all",
                        (isGlobalUnhealthy || isOffline || anyError) ? "text-red-500" : 
                        isConnecting ? "text-orange-500" :
                        isUploading ? "text-red-500" :
                        isDownloading ? "text-blue-500" :
                        "text-default-500"
                    )}
                >
                    {/* ICON LOGIC */}
                    {isGlobalUnhealthy ? (
                         <AlertTriangle size={18} className="text-red-600 animate-pulse" />
                    ) : anyError ? (
                        <AlertTriangle size={18} className="text-red-600 animate-pulse" />
                    ) : isConnecting ? (
                        <RefreshCw size={18} className="animate-spin text-orange-500" />
                    ) : isUploading ? (
                        <RefreshCw size={18} className="animate-spin text-red-500" />
                    ) : isDownloading ? (
                        <RefreshCw size={18} className="animate-spin text-blue-500" />
                    ) : isOffline ? (
                        <CloudOff size={18} className="text-red-500" />
                    ) : (
                        <div className="relative">
                            <Cloud size={18} className="text-green-600" />
                            <span className="absolute top-0 right-0 -mt-0.5 -mr-0.5 flex h-2 w-2">
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                        </div>
                    )}
                </Button>
            </PopoverTrigger>
            
            <PopoverContent>
                <div className="px-1 py-2 w-[260px] flex flex-col gap-3">
                    <div className="flex items-center justify-between border-b border-default-200 pb-2">
                        <span className="text-sm font-bold">Sync Status</span>
                        <Chip size="sm" color={getStatusColor()} variant="flat">
                            {getStatusText()}
                        </Chip>
                    </div>

                    <div className="space-y-2 text-xs text-default-600">
                        {/* GLOBAL HEALTH ISSUES */}
                        {isGlobalUnhealthy && (
                            <div className="flex flex-col gap-1 mb-2">
                                {isMainUnhealthy && (
                                    <div className="flex items-start items-center gap-2 bg-red-50 text-red-700 p-2 rounded text-[12px] border border-red-100">
                                        <AlertTriangle size={12} className="mt-[2px] shrink-0" />
                                        <div>
                                            <span className="font-semibold">Main DB:</span> Unstable ({mainHealth.consecutiveFailures} fails)
                                        </div>
                                    </div>
                                )}
                                {unhealthyRemotes.map((r, i) => (
                                    <div key={i} className="flex items-start items-center gap-2 bg-red-50 text-red-700 p-2 rounded text-[12px] border border-red-100">
                                        <AlertTriangle size={12} className="mt-[2px] shrink-0" />
                                        <div>
                                            <span className="font-semibold">{r.name}:</span> Unstable ({r.failures} fails)
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Connection (Current View) */}
                        <div className="flex justify-between">
                            <span>Connection ({isRemote ? (projectTitle || 'Remote') : 'Main'})</span>
                            <span className={currentViewStatus.connected ? "text-green-600" : "text-red-500"}>
                                {currentViewStatus.connected ? "Online" : "Disconnected"}
                            </span>
                        </div>

                        {/* Last Synced */}
                        <div className="flex justify-between">
                            <span>Last Synced</span>
                            <span className="font-mono">
                                {currentViewStatus.lastSyncedAt 
                                    ? new Date(currentViewStatus.lastSyncedAt).toLocaleTimeString()
                                    : "Never"}
                            </span>
                        </div>

                        {/* Activity */}
                        {currentViewStatus.dataFlow?.uploading && (
                            <div className="flex justify-between text-orange-600 bg-orange-50 p-1 rounded">
                                <span className="flex items-center gap-1"><UploadCloud size={12}/> Uploading</span>
                                <span>Processing...</span>
                            </div>
                        )}
                        {currentViewStatus.dataFlow?.downloading && (
                            <div className="flex justify-between text-blue-600 bg-blue-50 p-1 rounded">
                                <span className="flex items-center gap-1"><DownloadCloud size={12}/> Downloading</span>
                                <span>Processing...</span>
                            </div>
                        )}
                        
                        {/* Errors */}
                        {anyError && (
                            <div className="bg-red-50 text-red-600 p-2 rounded text-[10px] break-words border border-red-200">
                                <div className="font-bold mb-1">Sync Error:</div>
                                <div>{anyError.message || JSON.stringify(anyError)}</div>
                            </div>
                        )}

                        <div className="pt-2 border-t border-default-200">
                             <Button 
                                size="sm" 
                                variant="flat" 
                                color="primary" 
                                className="w-full text-xs" 
                                isLoading={isChecking}
                                startContent={!isChecking && <Database size={12}/>}
                                onPress={checkIntegrity}
                             >
                                Проверить базы
                             </Button>
                             
                             {/* Integrity Report Rendering */}
                             {integrityReport && (
                                 <div className="mt-2 text-[10px] p-2 bg-default-50 rounded border border-default-200">
                                     {integrityReport.missingInLocal === 0 && integrityReport.missingInRemote === 0 ? (
                                         <div className="text-green-600 font-bold">Все записи на месте! ✅</div>
                                     ) : (
                                         <div className="text-red-600 font-bold mb-1">Найдено расхождений! ⚠️</div>
                                     )}
                                     
                                    {integrityReport.details.map((line: string, i: number) => (
                                        <div key={i} dangerouslySetInnerHTML={{ __html: line }} />
                                    ))}
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
