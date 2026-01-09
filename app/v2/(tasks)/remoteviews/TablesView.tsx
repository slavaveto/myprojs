import React, { useEffect, useState } from 'react';
import { getRemoteConfig } from '@/app/_services/powerSync/remoteConfig';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('TablesView');

interface TablesViewProps {
    projectId: string;
    satelliteId?: string;
    projectTitle?: string;
}

interface TableInfo {
    table_name: string;
    columns: {
        name: string;
        type: string;
        nullable: string;
        default: string;
    }[];
    policies: {
        name: string;
        command: string;
        roles: string[];
        definition: string;
        check: string;
    }[];
}

export const TablesView = ({ projectId, projectTitle }: TablesViewProps) => {
    const { supabase: localSupabase } = useSupabase();
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sqlNeeded, setSqlNeeded] = useState(false);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);

    const loadSchema = async () => {
        if (!projectTitle) return;

        setLoading(true);
        setError(null);
        setSqlNeeded(false);

        try {
            const config = getRemoteConfig(projectTitle);
            let client: SupabaseClient = localSupabase;

            // If Remote Project, create a temporary client
            if (config.type === 'remote') {
                if (!config.url || !config.token) {
                    throw new Error('Remote config missing URL or Token');
                }
                
                // Use Service Key if available for full access
                const configAny = config as any;
                if (config.supabaseUrl && configAny.serviceKey) {
                    client = createClient(config.supabaseUrl, configAny.serviceKey, {
                        auth: { persistSession: false }
                    });
                } else {
                    // Fallback to Anon Key (might not have permissions to read policies)
                     throw new Error('Service Role Key required to inspect policies');
                }
            }

            // Call RPC
            logger.info(`Fetching schema for ${projectTitle}...`);
            const { data, error } = await client.rpc('get_schema_info');

            if (error) {
                logger.error('RPC Error:', error);
                if (error.message?.includes('function') && error.message?.includes('does not exist')) {
                    setSqlNeeded(true);
                } else {
                    throw error;
                }
            } else {
                // Sort tables: underscores first, then alphabetical
                const sortedTables = (data as TableInfo[]).sort((a, b) => {
                    return a.table_name.localeCompare(b.table_name);
                });
                
                setTables(sortedTables);
                if (sortedTables.length > 0 && !selectedTable) {
                    setSelectedTable(sortedTables[0].table_name);
                }
            }

        } catch (e: any) {
            logger.error('Failed to load schema', e);
            setError(e.message || 'Unknown error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSchema();
    }, [projectTitle]); // Reload when project changes

    const SQL_CODE = `
create or replace function get_schema_info()
returns json
language plpgsql
security definer
as $$
declare
    result json;
begin
    select json_agg(
        json_build_object(
            'table_name', t.table_name,
            'columns', (
                select json_agg(
                    json_build_object(
                        'name', c.column_name,
                        'type', c.data_type,
                        'nullable', c.is_nullable,
                        'default', c.column_default
                    )
                )
                from information_schema.columns c
                where c.table_name = t.table_name 
                and c.table_schema = 'public'
            ),
            'policies', (
                select json_agg(
                    json_build_object(
                        'name', p.policyname,
                        'command', p.cmd,
                        'roles', p.roles,
                        'definition', p.qual,
                        'check', p.with_check
                    )
                )
                from pg_policies p
                where p.tablename = t.table_name 
                and p.schemaname = 'public'
            )
        )
    )
    into result
    from information_schema.tables t
    where t.table_schema = 'public';

    return result;
end;
$$;
`;

    if (loading) {
        return <div className="p-10 text-center text-default-400">Loading schema for {projectTitle}...</div>;
    }

    if (sqlNeeded) {
    return (
            <div className="flex-1 p-6 bg-background overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
                        <h3 className="text-lg font-bold text-yellow-800 mb-2">Setup Required</h3>
                        <p className="text-yellow-700 mb-4">
                            To inspect database tables and policies, you need to create a helper function in your Supabase project <b>{projectTitle}</b>.
                        </p>
                        <p className="text-sm text-yellow-600 mb-4">
                            Go to Supabase Dashboard &gt; SQL Editor and run this query:
                        </p>
                        <div className="relative">
                            <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto whitespace-pre-wrap">
                                {SQL_CODE}
                            </pre>
                            <button 
                                onClick={() => navigator.clipboard.writeText(SQL_CODE)}
                                className="absolute top-2 right-2 px-3 py-1 bg-white/10 hover:bg-white/20 text-white text-xs rounded transition-colors"
                            >
                                Copy SQL
                            </button>
                        </div>
                        <button 
                            onClick={loadSchema}
                            className="mt-6 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
                        >
                            I've run the SQL, check again
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-10 text-center">
                <div className="text-red-500 font-bold mb-2">Error loading schema</div>
                <div className="text-default-400 text-sm">{error}</div>
                <button onClick={loadSchema} className="mt-4 text-primary hover:underline">Retry</button>
            </div>
        );
    }

    const activeTableInfo = tables.find(t => t.table_name === selectedTable);

    return (
        <div className="flex h-full bg-background">
            {/* Sidebar: List of Tables */}
            <div className="w-64 border-r border-default-200 overflow-y-auto bg-default-50">
                <div className="p-4 font-bold text-sm text-default-500 uppercase tracking-wider">Tables</div>
                {tables.map(t => (
                    <button
                        key={t.table_name}
                        onClick={() => setSelectedTable(t.table_name)}
                        className={`w-full text-left px-4 py-3 text-sm font-medium transition-colors border-l-4 ${
                            selectedTable === t.table_name 
                                ? 'bg-white border-primary text-primary shadow-sm' 
                                : 'border-transparent text-default-600 hover:bg-default-100'
                        }`}
                    >
                        {t.table_name}
                    </button>
                ))}
            </div>

            {/* Main Content: Table Details */}
            <div className="flex-1 overflow-y-auto p-8">
                {activeTableInfo ? (
                    <div className="max-w-5xl mx-auto space-y-8">
                        
                        {/* Header */}
                        <div className="flex items-baseline gap-3 border-b border-default-200 pb-4">
                            <h2 className="text-2xl font-bold">{activeTableInfo.table_name}</h2>
                            <span className="text-default-400 text-sm">{activeTableInfo.columns.length} columns</span>
                        </div>

                        {/* Columns */}
                        <div>
                            <h3 className="text-sm font-bold text-default-500 uppercase tracking-wider mb-3">Columns</h3>
                            <div className="border border-default-200 rounded-lg overflow-hidden bg-white">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-default-50 text-default-500 font-medium border-b border-default-200">
                                        <tr>
                                            <th className="px-4 py-2">Name</th>
                                            <th className="px-4 py-2">Type</th>
                                            <th className="px-4 py-2">Nullable</th>
                                            <th className="px-4 py-2">Default</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-default-100">
                                        {activeTableInfo.columns.map(c => (
                                            <tr key={c.name} className="hover:bg-default-50/50">
                                                <td className="px-4 py-3 font-mono text-default-700">{c.name}</td>
                                                <td className="px-4 py-3 text-blue-600 font-mono text-xs">{c.type}</td>
                                                <td className="px-4 py-3 text-default-400">{c.nullable === 'YES' ? 'Nullable' : 'Not Null'}</td>
                                                <td className="px-4 py-3 text-default-400 font-mono text-xs truncate max-w-[200px]">{c.default || '-'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        {/* Policies (RLS) */}
                        <div>
                            <h3 className="text-sm font-bold text-default-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                                RLS Policies
                                <span className={`text-xs px-2 py-0.5 rounded-full ${activeTableInfo.policies.length > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                    {activeTableInfo.policies.length > 0 ? 'Enabled' : 'No Policies'}
                                </span>
                            </h3>
                            
                            {activeTableInfo.policies.length > 0 ? (
                                <div className="grid gap-4">
                                    {activeTableInfo.policies.map((p, idx) => (
                                        <div key={idx} className="border border-default-200 rounded-lg p-4 bg-white shadow-sm">
                                            <div className="flex items-center gap-3 mb-2">
                                                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase ${
                                                    p.command === 'SELECT' ? 'bg-blue-100 text-blue-700' :
                                                    p.command === 'INSERT' ? 'bg-green-100 text-green-700' :
                                                    p.command === 'UPDATE' ? 'bg-orange-100 text-orange-700' :
                                                    p.command === 'DELETE' ? 'bg-red-100 text-red-700' :
                                                    'bg-gray-100 text-gray-700'
                                                }`}>
                                                    {p.command}
                                                </span>
                                                <span className="font-bold text-default-800">{p.name}</span>
                                                <span className="text-xs text-default-400 ml-auto">Roles: {p.roles.join(', ')}</span>
                                            </div>
                                            
                                            {p.definition && (
                                                <div className="mt-2">
                                                    <div className="text-xs font-bold text-default-400 mb-1">USING (visible rows):</div>
                                                    <code className="block bg-default-50 p-2 rounded text-xs font-mono text-default-700 break-all">
                                                        {p.definition}
                                                    </code>
                                                </div>
                                            )}

                                            {p.check && (
                                                <div className="mt-2">
                                                    <div className="text-xs font-bold text-default-400 mb-1">WITH CHECK (allowed writes):</div>
                                                    <code className="block bg-default-50 p-2 rounded text-xs font-mono text-default-700 break-all">
                                                        {p.check}
                                                    </code>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-4 border border-dashed border-default-300 rounded-lg text-center text-default-400 text-sm bg-default-50">
                                    No Row Level Security policies defined. Table might be public or inaccessible depending on global settings.
                                </div>
                            )}
                        </div>

                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-default-400">
                        Select a table to view details
                    </div>
                )}
            </div>
        </div>
    );
};
