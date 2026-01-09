import React, { useEffect, useState } from 'react';
import { getRemoteConfig } from '@/app/_services/powerSync/remoteConfig';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { createLogger } from '@/utils/logger/Logger';
import { clsx } from 'clsx';

const logger = createLogger('TablesView');

interface TablesViewProps {
    projectId: string;
    satelliteId?: string;
    projectTitle?: string;
}

interface TableInfo {
    table_name: string;
    rls_enabled: boolean;
    publication: string | null;
    columns: {
        name: string;
        type: string;
        nullable: string;
        default: string;
        is_pk: boolean;
    }[];
    policies: {
        name: string;
        command: string;
        roles: string[];
        definition: string;
        check: string;
    }[];
    triggers: {
        name: string;
        event: string;
    }[] | null;
}

const RPC_NAME = 'get_schema_info_v2';

export const TablesView = ({ projectId, projectTitle }: TablesViewProps) => {
    const { supabase: localSupabase } = useSupabase();
    const [tables, setTables] = useState<TableInfo[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [sqlNeeded, setSqlNeeded] = useState(false);
    const [activeTab, setActiveTab] = useState<'overview' | 'details'>('overview');
    const [selectedTable, setSelectedTable] = useState<string | null>(null);

    const loadSchema = async () => {
        if (!projectTitle) return;

        setLoading(true);
        setError(null);
        setSqlNeeded(false);

        try {
            const config = getRemoteConfig(projectTitle);
            let client: SupabaseClient = localSupabase;

            if (config.type === 'remote') {
                if (!config.url || !config.token) {
                    throw new Error('Remote config missing URL or Token');
                }
                const configAny = config as any;
                if (config.supabaseUrl && configAny.serviceKey) {
                    client = createClient(config.supabaseUrl, configAny.serviceKey, {
                        auth: { persistSession: false }
                    });
                } else {
                     throw new Error('Service Role Key required to inspect policies');
                }
            }

            logger.info(`Fetching schema for ${projectTitle}...`);
            const { data, error } = await client.rpc(RPC_NAME);

            if (error) {
                logger.error('RPC Error:', error);
                const msg = error.message?.toLowerCase() || '';
                if (msg.includes('function') && (msg.includes('does not exist') || msg.includes('could not find'))) {
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
    }, [projectTitle]);

    const SQL_CODE = `
create or replace function ${RPC_NAME}()
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
            'rls_enabled', (
                select c.relrowsecurity 
                from pg_class c 
                join pg_namespace n on n.oid = c.relnamespace 
                where c.relname = t.table_name and n.nspname = 'public'
            ),
            'publication', (
                select string_agg(pubname, ', ')
                from pg_publication_tables
                where tablename = t.table_name and schemaname = 'public'
            ),
            'columns', (
                select json_agg(
                    json_build_object(
                        'name', c.column_name,
                        'type', c.data_type,
                        'nullable', c.is_nullable,
                        'default', c.column_default,
                        'is_pk', exists (
                            select 1 from information_schema.table_constraints tc
                            join information_schema.key_column_usage kcu 
                            on kcu.constraint_name = tc.constraint_name
                            where tc.table_name = t.table_name 
                            and tc.constraint_type = 'PRIMARY KEY'
                            and kcu.column_name = c.column_name
                        )
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
            ),
            'triggers', (
                 select json_agg(
                    json_build_object(
                        'name', tr.trigger_name,
                        'event', tr.event_manipulation
                    )
                )
                from information_schema.triggers tr
                where tr.event_object_table = t.table_name
                and tr.event_object_schema = 'public'
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

    if (loading) return <div className="p-10 text-center text-default-400">Loading schema for {projectTitle}...</div>;

    if (sqlNeeded) {
        return (
            <div className="flex-1 p-6 bg-background overflow-y-auto">
                <div className="max-w-4xl mx-auto">
                    <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 mb-6">
                        <h3 className="text-lg font-bold text-yellow-800 mb-2">Setup Required</h3>
                        <p className="text-yellow-700 mb-4">
                            To view the database overview, you need to create a helper function in <b>{projectTitle}</b>.
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
        <div className="flex flex-col h-full bg-background">
            {/* Top Tabs */}
            <div className="flex items-center gap-6 px-6 border-b border-default-200 bg-default-50/50">
                <button 
                    onClick={() => setActiveTab('overview')}
                    className={clsx(
                        "py-3 text-sm font-medium border-b-2 transition-colors",
                        activeTab === 'overview' 
                            ? "border-primary text-primary" 
                            : "border-transparent text-default-500 hover:text-default-700"
                    )}
                >
                    Overview
                </button>
                <button 
                    onClick={() => setActiveTab('details')}
                    className={clsx(
                        "py-3 text-sm font-medium border-b-2 transition-colors",
                        activeTab === 'details' 
                            ? "border-primary text-primary" 
                            : "border-transparent text-default-500 hover:text-default-700"
                    )}
                >
                    Table Details
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-h-0 overflow-hidden">
                {activeTab === 'overview' ? (
                    <div className="h-full overflow-y-auto p-6">
                        <div className="max-w-6xl mx-auto">
                            <div className="border border-default-200 rounded-xl overflow-hidden bg-white shadow-sm">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-default-50 text-default-500 font-medium border-b border-default-200 uppercase tracking-wider text-xs">
                                        <tr>
                                            <th className="px-6 py-3">Table</th>
                                            <th className="px-6 py-3 text-center">RLS</th>
                                            <th className="px-6 py-3 text-center">Policies</th>
                                            <th className="px-6 py-3">Triggers</th>
                                            <th className="px-6 py-3">Publication</th>
                                            <th className="px-6 py-3 text-right">Cols</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-default-100">
                                        {tables.map(t => (
                                            <tr 
                                                key={t.table_name} 
                                                className="hover:bg-default-50/80 cursor-pointer transition-colors"
                                                onClick={() => {
                                                    setSelectedTable(t.table_name);
                                                    setActiveTab('details');
                                                }}
                                            >
                                                <td className="px-6 py-4 font-bold text-default-800">{t.table_name}</td>
                                                <td className="px-6 py-4 text-center">
                                                    {t.rls_enabled ? (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                                            Enabled
                                                        </span>
                                                    ) : (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                                                            Disabled
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <span className={clsx("font-mono font-bold", t.policies.length === 0 ? "text-default-300" : "text-default-700")}>
                                                        {t.policies.length}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-xs text-default-500 max-w-[200px] truncate">
                                                    {t.triggers && t.triggers.length > 0 
                                                        ? t.triggers.map(tr => tr.name).join(', ') 
                                                        : '-'}
                                                </td>
                                                <td className="px-6 py-4 text-xs font-mono text-blue-600">
                                                    {t.publication || '-'}
                                                </td>
                                                <td className="px-6 py-4 text-right text-default-400">
                                                    {t.columns.length}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full">
                        {/* Sidebar */}
                        <div className="w-64 border-r border-default-200 overflow-y-auto bg-default-50/50">
                            {tables.map(t => (
                                <button
                                    key={t.table_name}
                                    onClick={() => setSelectedTable(t.table_name)}
                                    className={clsx(
                                        "w-full text-left px-4 py-3 text-sm font-medium transition-colors border-l-4",
                                        selectedTable === t.table_name 
                                            ? "bg-white border-primary text-primary shadow-sm" 
                                            : "border-transparent text-default-600 hover:bg-default-100"
                                    )}
                                >
                                    {t.table_name}
                                </button>
                            ))}
                        </div>

                        {/* Detail View */}
                        <div className="flex-1 overflow-y-auto p-8 bg-background">
                            {activeTableInfo ? (
                                <div className="max-w-5xl mx-auto space-y-8">
                                    {/* Header */}
                                    <div className="flex items-center justify-between border-b border-default-200 pb-4">
                                        <div>
                                            <h2 className="text-2xl font-bold flex items-center gap-3">
                                                {activeTableInfo.table_name}
                                                {activeTableInfo.rls_enabled && (
                                                    <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700 border border-green-200">RLS ON</span>
                                                )}
                                            </h2>
                                            <div className="text-default-400 text-xs mt-1 font-mono">
                                                Pub: {activeTableInfo.publication || 'None'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Columns */}
                                    <div>
                                        <h3 className="text-sm font-bold text-default-500 uppercase tracking-wider mb-3">Columns</h3>
                                        <div className="border border-default-200 rounded-lg overflow-hidden bg-white">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-default-50 text-default-500 font-medium border-b border-default-200">
                                                    <tr>
                                                        <th className="px-4 py-2 w-10"></th>
                                                        <th className="px-4 py-2">Name</th>
                                                        <th className="px-4 py-2">Type</th>
                                                        <th className="px-4 py-2">Nullable</th>
                                                        <th className="px-4 py-2">Default</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-default-100">
                                                    {activeTableInfo.columns.map(c => (
                                                        <tr key={c.name} className={clsx("hover:bg-default-50/50", c.is_pk && "bg-yellow-50/30")}>
                                                            <td className="px-4 py-3 text-center">
                                                                {c.is_pk && <span title="Primary Key">🔑</span>}
                                                            </td>
                                                            <td className="px-4 py-3 font-mono text-default-700 font-medium">{c.name}</td>
                                                            <td className="px-4 py-3 text-blue-600 font-mono text-xs">{c.type}</td>
                                                            <td className="px-4 py-3 text-default-400">{c.nullable === 'YES' ? 'Nullable' : 'Not Null'}</td>
                                                            <td className="px-4 py-3 text-default-400 font-mono text-xs truncate max-w-[200px]">{c.default || '-'}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Policies */}
                                    <div>
                                        <h3 className="text-sm font-bold text-default-500 uppercase tracking-wider mb-3">RLS Policies</h3>
                                        {activeTableInfo.policies.length > 0 ? (
                                            <div className="grid gap-4">
                                                {activeTableInfo.policies.map((p, idx) => (
                                                    <div key={idx} className="border border-default-200 rounded-lg p-4 bg-white shadow-sm">
                                                        <div className="flex items-center gap-3 mb-2">
                                                            <span className={clsx("px-2 py-0.5 rounded text-xs font-bold uppercase", 
                                                                p.command === 'SELECT' ? 'bg-blue-100 text-blue-700' :
                                                                p.command === 'INSERT' ? 'bg-green-100 text-green-700' :
                                                                p.command === 'UPDATE' ? 'bg-orange-100 text-orange-700' :
                                                                p.command === 'DELETE' ? 'bg-red-100 text-red-700' :
                                                                'bg-gray-100 text-gray-700'
                                                            )}>
                                                                {p.command}
                                                            </span>
                                                            <span className="font-bold text-default-800">{p.name}</span>
                                                            <span className="text-xs text-default-400 ml-auto bg-default-100 px-2 py-1 rounded">Roles: {p.roles.join(', ')}</span>
                                                        </div>
                                                        
                                                        {p.definition && (
                                                            <div className="mt-2 text-xs">
                                                                <span className="font-bold text-default-400">USING: </span>
                                                                <code className="font-mono text-default-700">{p.definition}</code>
                                                            </div>
                                                        )}
                                                        {p.check && (
                                                            <div className="mt-1 text-xs">
                                                                <span className="font-bold text-default-400">WITH CHECK: </span>
                                                                <code className="font-mono text-default-700">{p.check}</code>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="p-4 border border-dashed border-default-300 rounded-lg text-center text-default-400 text-sm bg-default-50">
                                                No policies defined.
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Triggers */}
                                    {activeTableInfo.triggers && activeTableInfo.triggers.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-bold text-default-500 uppercase tracking-wider mb-3">Triggers</h3>
                                            <div className="border border-default-200 rounded-lg bg-white divide-y divide-default-100">
                                                {activeTableInfo.triggers.map((tr, idx) => (
                                                    <div key={idx} className="p-3 flex items-center justify-between text-sm">
                                                        <span className="font-mono text-default-700">{tr.name}</span>
                                                        <span className="text-xs text-default-400 uppercase">{tr.event}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                </div>
                            ) : (
                                <div className="h-full flex items-center justify-center text-default-400">Select a table</div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
