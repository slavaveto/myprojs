'use client';

import React, { useState, useEffect } from 'react';
import { RemoteSyncProvider } from '@/app/_services/powerSync/RemoteSyncProvider';
import { usePowerSync, useQuery, useStatus } from '@powersync/react';
import { getRemoteConfig } from '@/utils/remoteConfig';
import { clsx } from 'clsx';
import { Folder, HardDrive, Server, Wifi, WifiOff, Plus, Database, AlertCircle } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// --- DEBUG INFO COMPONENT ---
const ConnectionStatus = ({ title }: { title: string }) => {
    const status = useStatus();
    const config = getRemoteConfig(title);
    const isRemote = config.type === 'remote';

    useEffect(() => {
        console.log(`[ConnectionStatus] Status update for ${title}:`, {
            connected: status.connected,
            lastSyncedAt: status.lastSyncedAt,
            hasError: !!(status as any).lastConnectError,
            error: (status as any).lastConnectError
        });

        if (!status.connected && (status as any).lastConnectError) {
             console.error(`[ConnectionStatus] CONNECTION ERROR:`, (status as any).lastConnectError);
        }
    }, [status, title]);

    return (
        <div className="flex flex-col gap-2 border-b border-default-200 pb-3 mb-3">
            <div className="flex items-center gap-4 text-xs font-medium">
                <div className="flex items-center gap-2">
                    <div className={clsx("w-2 h-2 rounded-full", isRemote ? "bg-purple-500" : "bg-orange-500")} />
                    <span className="text-default-600 uppercase">{config.type} MODE</span>
                </div>
                
                <div className="h-4 w-[1px] bg-default-200" />

                <div className="flex items-center gap-2">
                    {status.connected ? <Wifi size={14} className="text-green-600" /> : <WifiOff size={14} className="text-red-500" />}
                    <span className={status.connected ? "text-green-700" : "text-red-600"}>
                        {status.connected ? 'PowerSync Connected' : 'PowerSync Disconnected'}
                    </span>
                </div>

                <div className="h-4 w-[1px] bg-default-200" />
                
                <div className="text-default-400">
                    Last Synced: {status.lastSyncedAt ? status.lastSyncedAt.toLocaleTimeString() : 'Never'}
                </div>
            </div>

            {/* CONNECTION ERROR DISPLAY */}
            {!status.connected && (status as any).lastConnectError && (
                <div className="flex items-start gap-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700 mt-1">
                    <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
                    <div>
                        <strong>Connection Error:</strong> {(status as any).lastConnectError.message || JSON.stringify((status as any).lastConnectError)}
                    </div>
                </div>
            )}
        </div>
    );
};

// --- SUPABASE DIRECT TEST COMPONENT ---
const SupabaseDirectTest = ({ title }: { title: string }) => {
    const config = getRemoteConfig(title);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [errorMsg, setErrorMsg] = useState('');
    const [rows, setRows] = useState<any[]>([]);

    useEffect(() => {
        if (config.type !== 'remote' || !config.supabaseUrl || !config.token) {
            return;
        }

        const testSupabase = async () => {
            setStatus('loading');
            try {
                // Create direct client using Service Key
                const supabase = createClient(config.supabaseUrl!, config.token!);
                
                // Try to SELECT data
                const { data, error } = await supabase
                    .from('_ui_folders')
                    .select('*')
                    .limit(5);

                if (error) throw error;

                setRows(data || []);
                setStatus('success');
            } catch (e: any) {
                console.error('Supabase Direct Error:', e);
                setErrorMsg(e.message);
                setStatus('error');
            }
        };

        testSupabase();
    }, [config.type, config.supabaseUrl, config.token]);

    if (config.type !== 'remote') return null;

    return (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm">
            <div className="flex items-center gap-2 mb-2 font-semibold text-blue-800">
                <Database size={16} />
                <span>Supabase Direct Check</span>
            </div>
            
            {status === 'loading' && <div className="text-blue-500">Connecting to Supabase...</div>}
            
            {status === 'success' && (
                <div className="text-green-700">
                    <div>✅ Connection Successful! Found <strong>{rows.length}</strong> rows (showing max 5).</div>
                    {rows.length > 0 && (
                        <div className="mt-2 text-xs bg-white p-2 rounded border border-blue-100 max-h-32 overflow-y-auto font-mono text-gray-600">
                            {rows.map(r => (
                                <div key={r.id} className="border-b last:border-0 py-1">
                                    {JSON.stringify(r)}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
            
            {status === 'error' && (
                <div className="text-red-600">
                    ❌ Connection Failed: {errorMsg}
                </div>
            )}
        </div>
    );
};

// --- REMOTE COMPONENT ---
const RemoteDataDisplay = ({ title }: { title: string }) => {
    const powerSync = usePowerSync();
    
    // Query _ui_folders
    const { data: folders, isLoading } = useQuery('SELECT * FROM _ui_folders ORDER BY sort_order');
    const [newItemTitle, setNewItemTitle] = useState('');

    const createTestFolder = async () => {
        if (!newItemTitle.trim()) return;
        try {
            const id = crypto.randomUUID();
            await powerSync.execute(
                `INSERT INTO _ui_folders (id, title, sort_order, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, datetime('now'), datetime('now'))`,
                [id, newItemTitle, 100]
            );
            setNewItemTitle('');
        } catch (e: any) {
            alert('Error: ' + e.message);
        }
    };

    if (isLoading) return <div className="p-4 text-default-400 text-sm">Loading data...</div>;

    return (
        <div className="flex flex-col h-full bg-white rounded-xl border border-default-200 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-default-50 border-b border-default-200 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <Server size={16} className="text-default-500" />
                    <span className="font-semibold text-default-700">{title}</span>
                </div>
                <div className="text-xs text-default-400 font-mono">
                    remote_{title}.sqlite
                </div>
            </div>

            <div className="p-4 flex-1 flex flex-col min-h-0">
                <ConnectionStatus title={title} />
                <SupabaseDirectTest title={title} />

                {/* List */}
                <div className="flex-1 overflow-y-auto min-h-0 space-y-1 pr-1">
                    {folders?.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-default-300">
                            <Folder size={32} strokeWidth={1} className="mb-2" />
                            <span className="text-sm">No folders found in PowerSync local DB</span>
                        </div>
                    )}
                    
                    {folders?.map((f: any) => (
                        <div key={f.id} className="group flex items-center justify-between px-3 py-2 rounded-lg bg-default-50/50 hover:bg-default-100 border border-transparent hover:border-default-200 transition-all text-sm">
                            <div className="flex items-center gap-2">
                                <Folder size={14} className="text-purple-500 fill-purple-500/10" />
                                <span className="font-medium text-default-700">{f.title}</span>
                            </div>
                            <span className="text-[10px] text-default-300 font-mono opacity-0 group-hover:opacity-100">
                                {f.id.slice(0, 6)}
                            </span>
                        </div>
                    ))}
                </div>

                {/* Footer Input */}
                <div className="mt-4 pt-3 border-t border-default-100 flex gap-2">
                    <input 
                        className="flex-1 px-3 py-2 bg-default-50 border border-default-200 rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:bg-white transition-colors"
                        value={newItemTitle}
                        onChange={e => setNewItemTitle(e.target.value)}
                        placeholder="New Remote Folder..."
                        onKeyDown={e => e.key === 'Enter' && createTestFolder()}
                    />
                    <button 
                        onClick={createTestFolder}
                        className="p-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-sm"
                    >
                        <Plus size={18} />
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- MAIN PAGE ---
export default function TestRemotePage() {
    const { data: remoteProjects } = useQuery(
        `SELECT * FROM projects WHERE has_remote = 1 OR has_remote = true`
    );

    const [selectedProject, setSelectedProject] = useState<any>(null);

    return (
        <div className="h-screen w-full bg-[#f6f6f6] p-4 flex gap-4 text-default-800 font-sans">
            {/* LEFT: Sidebar */}
            <div className="w-64 flex flex-col bg-white rounded-xl border border-default-200 shadow-sm overflow-hidden">
                <div className="p-4 border-b border-default-100">
                    <h2 className="text-sm font-bold text-default-500 uppercase tracking-wider">Remote Projects</h2>
                </div>
                
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {remoteProjects?.map((proj: any) => (
                        <button
                            key={proj.id}
                            onClick={() => setSelectedProject(proj)}
                            className={clsx(
                                "w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2",
                                selectedProject?.id === proj.id 
                                    ? "bg-purple-100 text-purple-700 shadow-sm" 
                                    : "text-default-600 hover:bg-default-100"
                            )}
                        >
                            <HardDrive size={16} className={selectedProject?.id === proj.id ? "text-purple-600" : "text-default-400"} />
                            <span className="truncate">{proj.title}</span>
                        </button>
                    ))}
                    
                    {remoteProjects?.length === 0 && (
                        <div className="px-4 py-8 text-center text-xs text-default-400">
                            No projects with has_remote found
                        </div>
                    )}
                </div>
            </div>

            {/* RIGHT: Content */}
            <div className="flex-1 min-w-0">
                {selectedProject ? (
                    <RemoteSyncProvider 
                        key={selectedProject.id} 
                        projectId={selectedProject.id} 
                        projectTitle={selectedProject.title}
                    >
                        <RemoteDataDisplay title={selectedProject.title} />
                    </RemoteSyncProvider>
                ) : (
                    <div className="h-full flex items-center justify-center text-default-400 bg-white/50 border border-dashed border-default-200 rounded-xl">
                        <div className="text-center">
                            <Server size={48} className="mx-auto mb-2 opacity-20" />
                            <p>Select a project to verify remote connection</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
