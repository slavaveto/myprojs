import React, { useState, useEffect } from 'react';
import { useStatus } from '@powersync/react';
import { RefreshCw, CloudOff, Cloud, UploadCloud, DownloadCloud, AlertTriangle, Database } from 'lucide-react';
import { Popover, PopoverTrigger, PopoverContent, Button, Chip } from '@heroui/react';
import { clsx } from 'clsx';
import { usePowerSync } from '@/app/_services/powerSync/PowerSyncProvider';
import { useSupabase } from '@/utils/supabase/useSupabase';

export const SyncIndicator = () => {
    const status = useStatus();
    const db = usePowerSync();
    const { supabase } = useSupabase();

    const [isChecking, setIsChecking] = useState(false);
    const [integrityReport, setIntegrityReport] = useState<null | {
        missingInLocal: number;
        missingInRemote: number;
        details: string[];
    }>(null);

    const checkIntegrity = async () => {
        setIsChecking(true);
        setIntegrityReport(null);
        try {
            const tables = ['projects', 'folders', 'tasks'];
            let missingLocalTotal = 0;
            let missingRemoteTotal = 0;
            const reportDetails: string[] = [];

            for (const table of tables) {
                // Local
                const localRes = await db.getAll(`SELECT id FROM ${table}`);
                const localIds = new Set(localRes.map(r => r.id));

                // Remote
                const { data: remoteRes, error } = await supabase.from(table).select('id');
                if (error) throw error;
                const remoteIds = new Set(remoteRes?.map(r => r.id));

                // Diff
                let missingLocal = 0;
                let missingRemote = 0;

                remoteIds.forEach(id => {
                    if (!localIds.has(id)) missingLocal++;
                });

                localIds.forEach(id => {
                    // @ts-ignore
                    if (!remoteIds.has(id)) missingRemote++;
                });

                if (missingLocal > 0 || missingRemote > 0) {
                    reportDetails.push(`${table}: -${missingLocal} local, -${missingRemote} remote`);
                }

                missingLocalTotal += missingLocal;
                missingRemoteTotal += missingRemote;
            }

            setIntegrityReport({
                missingInLocal: missingLocalTotal,
                missingInRemote: missingRemoteTotal,
                details: reportDetails
            });

        } catch (e) {
            console.error('Integrity check failed:', e);
            setIntegrityReport({
                missingInLocal: 0,
                missingInRemote: 0,
                // @ts-ignore
                details: [`Error: ${e.message}`]
            });
        } finally {
            setIsChecking(false);
        }
    };


    // Determine state
    // @ts-ignore
    const rawIsSyncing = status.dataFlow?.downloading || status.dataFlow?.uploading || status.downloading || status.uploading;
    // @ts-ignore
    const rawIsConnecting = status.connecting;

    // Debug status changes
    useEffect(() => {
        // @ts-ignore
        const up = status.dataFlow?.uploading || status.uploading;
        // @ts-ignore
        const down = status.dataFlow?.downloading || status.downloading;
        
        if (up || down) {
             console.log('SyncIndicator: Activity detected!', { uploading: up, downloading: down });
        }
    }, [status]);
    
    // UI States with min duration (500ms debounce on trailing edge)
    const [isUploading, setIsUploading] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // Custom Event Listener for Upload (Manual Override)
    useEffect(() => {
        const handleUploadStart = () => setIsUploading(true);
        const handleUploadEnd = () => {
            setTimeout(() => {
                 // @ts-ignore
                 const stillUploading = status.dataFlow?.uploading || status.uploading;
                 if (!stillUploading) setIsUploading(false);
            }, 500);
        };

        window.addEventListener('powersync-upload-start', handleUploadStart);
        window.addEventListener('powersync-upload-end', handleUploadEnd);

        return () => {
            window.removeEventListener('powersync-upload-start', handleUploadStart);
            window.removeEventListener('powersync-upload-end', handleUploadEnd);
        };
    }, [status]);

    useEffect(() => {
        // @ts-ignore
        const rawUp = status.dataFlow?.uploading || status.uploading;
        // @ts-ignore
        const rawDown = status.dataFlow?.downloading || status.downloading;

        let upTimer: NodeJS.Timeout;
        let downTimer: NodeJS.Timeout;

        if (rawUp) setIsUploading(true);
        else upTimer = setTimeout(() => setIsUploading(false), 500);

        if (rawDown) setIsDownloading(true);
        else downTimer = setTimeout(() => setIsDownloading(false), 500);

        return () => {
            clearTimeout(upTimer);
            clearTimeout(downTimer);
        };
    }, [status]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (rawIsConnecting) {
            setIsConnecting(true);
        } else {
            timer = setTimeout(() => setIsConnecting(false), 500);
        }
        return () => clearTimeout(timer);
    }, [rawIsConnecting]);

    const isOffline = !status.connected && !status.connecting;
    // @ts-ignore
    const uploadError = status.dataFlow?.uploadError;
    // @ts-ignore
    const downloadError = status.dataFlow?.downloadError;
    // @ts-ignore
    const anyError = status.anyError || uploadError || downloadError;
    
    // Status Text logic
    const getStatusText = () => {
        if (anyError) return 'Sync Error';
        if (isConnecting) return 'Connecting...';
        if (isUploading) return 'Uploading...';
        if (isDownloading) return 'Downloading...';
        return 'Online';
    };

    const getStatusColor = () => {
        if (anyError) return 'danger';
        if (isOffline) return 'danger';
        if (isConnecting) return 'warning';
        if (isUploading) return 'danger'; // Red for upload
        if (isDownloading) return 'primary'; // Blue for download
        return 'success';
    };

    return (
        <Popover 
            placement="bottom-end" 
            onOpenChange={(isOpen) => {
                if (!isOpen) {
                    setIntegrityReport(null);
                    setIsChecking(false);
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
                        (isOffline || anyError) ? "text-red-500" : 
                        isConnecting ? "text-orange-500" :
                        isUploading ? "text-red-500" :
                        isDownloading ? "text-blue-500" :
                        "text-default-500"
                    )}
                >
                    {/* ICON LOGIC */}
                    {anyError ? (
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
                        {status.dataFlow?.uploading && (
                            <div className="flex justify-between text-orange-600 bg-orange-50 p-1 rounded">
                                <span className="flex items-center gap-1"><UploadCloud size={12}/> Uploading</span>
                                <span>Processing...</span>
                            </div>
                        )}

                        {/* Downloading */}
                        {/* @ts-ignore */}
                        {status.dataFlow?.downloading && (
                            <div className="flex justify-between text-blue-600 bg-blue-50 p-1 rounded">
                                <span className="flex items-center gap-1"><DownloadCloud size={12}/> Downloading</span>
                                <span>Processing...</span>
                            </div>
                        )}
                        
                        {/* Error */}
                        {anyError && (
                            <div className="bg-red-50 text-red-600 p-2 rounded text-[10px] break-words border border-red-200">
                                <div className="font-bold mb-1">Sync Error:</div>
                                {uploadError && <div>Upload: {uploadError.message || JSON.stringify(uploadError)}</div>}
                                {downloadError && <div>Download: {downloadError.message || JSON.stringify(downloadError)}</div>}
                                {!uploadError && !downloadError && (
                                    <div>{anyError.message || JSON.stringify(anyError)}</div>
                                )}
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
                                Проверить базу
                             </Button>

                             {integrityReport && (
                                 <div className="mt-2 text-[10px] p-2 bg-default-50 rounded border border-default-200">
                                     {integrityReport.missingInLocal === 0 && integrityReport.missingInRemote === 0 ? (
                                         <div className="text-green-600 font-bold">Все записи на месте! ✅</div>
                                     ) : (
                                         <div className="text-red-600 font-bold mb-1">Найдено расхождений! ⚠️</div>
                                     )}
                                     
                                     {integrityReport.details.map((line, i) => (
                                         <div key={i}>{line}</div>
                                     ))}
                                     
                                     {(integrityReport.missingInLocal > 0 || integrityReport.missingInRemote > 0) && (
                                         <div className="mt-1 text-default-500">
                                             Local missing: {integrityReport.missingInLocal}<br/>
                                             Remote missing: {integrityReport.missingInRemote}
                                         </div>
                                     )}
                                 </div>
                             )}
                        </div>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

