import { useState } from 'react';
import { AbstractPowerSyncDatabase } from '@powersync/web';
import { SupabaseClient, createClient } from '@supabase/supabase-js';
import { dbCache } from '@/app/_services/powerSync/RemoteSyncProvider';
import { getRemoteConfig } from '@/app/_services/powerSync/remoteConfig';

export interface IntegrityReport {
    missingInLocal: number;
    missingInRemote: number;
    details: string[];
}

export const useSyncCheck = (db: AbstractPowerSyncDatabase, supabase: SupabaseClient) => {
    const [isChecking, setIsChecking] = useState(false);
    const [integrityReport, setIntegrityReport] = useState<IntegrityReport | null>(null);

    const checkIntegrity = async () => {
        setIsChecking(true);
        setIntegrityReport(null);
        try {
            // 1. Check Main DB
            const mainTables = ['projects', 'folders', 'tasks', '_ui_folders', '_ui_items'];
            let missingLocalTotal = 0;
            let missingRemoteTotal = 0;
            const reportDetails: string[] = [];

            reportDetails.push('<b>--- Main DB ---</b>');

            for (const table of mainTables) {
                // Local
                const localRes = await db.getAll<{ id: string }>(`SELECT id FROM ${table}`);
                const localIds = new Set(localRes.map(r => r.id));

                // Remote (Default Supabase Client - filtered by RLS if anon)
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
                    if (!remoteIds.has(id)) missingRemote++;
                });

                const status = (missingLocal === 0 && missingRemote === 0) ? '✅' : '🔴';
                const diffInfo = (missingLocal > 0 || missingRemote > 0) 
                    ? ` (Missing: ${missingLocal} in Local, ${missingRemote} in Remote)` 
                    : '';

                reportDetails.push(
                    `${status} <b>${table}</b>: SQLite(${localIds.size}) / Supabase(${remoteIds.size})${diffInfo}`
                );

                missingLocalTotal += missingLocal;
                missingRemoteTotal += missingRemote;
            }

            // 2. Check Remote DBs from Cache
            console.log('[SyncCheck] Checking remote DBs. Cache size:', dbCache.size);
            if (dbCache.size > 0) {
                for (const [projectId, remoteDb] of dbCache.entries()) {
                    
                    // Find Title for config lookup
                    const projectRes = await db.getAll<{ title: string }>(`SELECT title FROM projects WHERE id = '${projectId}'`);
                    const projectTitle = projectRes[0]?.title;
                    const config = projectTitle ? getRemoteConfig(projectTitle) : null;
                    const isServiceKey = !!(config as any)?.serviceKey;

                    reportDetails.push(`<b>--- Remote (${projectTitle}) ---</b>`);
                    
                    const remoteTables = ['_ui_folders', '_ui_items'];
                    
                    // Create dedicated client if config available
                    let remoteClient = supabase;
                    if ((config as any)?.supabaseUrl && (config as any)?.serviceKey) {
                         // console.log('[SyncCheck] Using dedicated Service Client for', projectTitle);
                         remoteClient = createClient((config as any).supabaseUrl, (config as any).serviceKey);
                    }

                    for (const table of remoteTables) {
                        // Local (Remote SQLite)
                        let localIds = new Set<string>();
                        try {
                             const localRes = await remoteDb.getAll<{ id: string }>(`SELECT id FROM ${table}`);
                             localIds = new Set(localRes.map(r => r.id));
                        } catch (e) {
                            reportDetails.push(`⚠️ <b>${table}</b>: Table missing in SQLite?`);
                            continue;
                        }

                        // Remote (Supabase)
                        let query = remoteClient.from(table).select('id');
                        
                        // Only filter by projectId if we are NOT using a dedicated service key 
                        // OR if we suspect the remote DB is shared. 
                        // But since column might not exist (as per error), we skip it for now OR check if it's the main DB client.
                        
                        // If we are using the DEFAULT supabase client, we might need filtering (if the table is shared).
                        // But if column doesn't exist, we can't filter.
                        // Assuming dedicated DBs for remote projects based on config presence.
                        
                        // query = query.eq('project_id', projectId); 

                        const { data: remoteRes, error } = await query;
                        
                        if (error) {
                             reportDetails.push(`⚠️ <b>${table}</b>: Supabase error: ${error.message}`);
                             continue;
                        }

                        const remoteIds = new Set(remoteRes?.map(r => r.id));

                        // Diff
                        let missingLocal = 0;
                        let missingRemote = 0;

                        remoteIds.forEach(id => {
                            if (!localIds.has(id)) missingLocal++;
                        });

                        localIds.forEach(id => {
                            if (!remoteIds.has(id)) missingRemote++;
                        });

                         const status = (missingLocal === 0 && missingRemote === 0) ? '✅' : '🔴';
                         const diffInfo = (missingLocal > 0 || missingRemote > 0) 
                            ? ` (Missing: ${missingLocal} in Local, ${missingRemote} in Remote)` 
                            : '';
                        
                         const sourceLabel = isServiceKey ? 'ServiceKey' : 'Anon';

                        reportDetails.push(
                            `${status} <b>${table}</b>: SQLite(${localIds.size}) / Supabase[${sourceLabel}](${remoteIds.size})${diffInfo}`
                        );
                        
                        missingLocalTotal += missingLocal;
                        missingRemoteTotal += missingRemote;
                    }
                }
            } else {
                 reportDetails.push('<i>No active remote connections</i>');
            }

            setIntegrityReport({
                missingInLocal: missingLocalTotal,
                missingInRemote: missingRemoteTotal,
                details: reportDetails
            });

        } catch (e: any) {
            console.error('Integrity check failed:', e);
            setIntegrityReport({
                missingInLocal: 0,
                missingInRemote: 0,
                details: [`Error: ${e?.message || 'Unknown error'}`]
            });
        } finally {
            setIsChecking(false);
        }
    };
    
    const clearReport = () => setIntegrityReport(null);

    return { checkIntegrity, isChecking, integrityReport, clearReport };
};

