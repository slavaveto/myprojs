import { useState } from 'react';
import { AbstractPowerSyncDatabase } from '@powersync/web';
import { SupabaseClient } from '@supabase/supabase-js';

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
            const tables = ['projects', 'folders', 'tasks'];
            let missingLocalTotal = 0;
            let missingRemoteTotal = 0;
            const reportDetails: string[] = [];

            for (const table of tables) {
                // Local
                const localRes = await db.getAll<{ id: string }>(`SELECT id FROM ${table}`);
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

