'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { createLogger } from '@/utils/logger/Logger';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Input, Button } from '@heroui/react';
import { usePermission } from '@/app/admin/_services/usePermission';
import { PERMISSIONS } from '@/app/admin/_services/acl';
import { RefreshCw as IconRefresh, Search as IconSearch } from 'lucide-react';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { AdminUserMenu } from '@/app/admin/AdminUserMenu';
import { logService } from '@/app/admin/_services/logService';

const logger = createLogger('AdminLogsScreen');

interface LogEntry {
  id: number;
  created_at: string;
  user_id: string;
  action: string;
  entity: string;
  entity_id: string;
  details: any;
}

interface LogsScreenProps {
   onReady?: () => void;
   isActive: boolean;
   canLoad?: boolean;
   texts: {
      saveLoading: string;
      saveSuccess: string;
      refreshLoading: string;
      refreshSuccess: string;
   };
   showToast?: boolean;
}

export const LogsScreen = ({ onReady, isActive, canLoad, texts, showToast = true }: LogsScreenProps) => {
  const { supabase } = useSupabase();
  const { can, isLoading: isPermissionLoading } = usePermission();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const { execute: executeRefresh, status: refreshStatus, error: refreshError } = useAsyncAction({
    minDuration: 1000,
    useToast: showToast,
    loadingMessage: texts.refreshLoading,
    successMessage: texts.refreshSuccess,
    errorMessage: 'Ошибка обновления логов'
  });

  const isRefreshing = refreshStatus !== 'idle';
  
  const badgeStatus = isRefreshing ? refreshStatus : 'idle';
  const badgeError = refreshStatus === 'error' ? refreshError?.message : undefined;
  
  const loadLogs = async (isManualRefresh = false) => {
     setIsLoading(true);

     const fetchLogs = async () => {
         const data = await logService.getLogs(supabase, 100);
         setLogs(data as any);
     };

     if (isManualRefresh) {
        await executeRefresh(fetchLogs);
     } else {
        try {
           await fetchLogs();
        } catch (err) {
           logger.error('Failed to load logs', err);
        }
     }
     
     setIsLoading(false);
     if (onReady) setTimeout(() => onReady(), 0);
  };
  
  useEffect(() => {
    if (canLoad) {
        loadLogs();
    }
  }, [supabase, canLoad, isActive]);

  const filteredLogs = useMemo(() => {
    if (!searchQuery) return logs;
    const lower = searchQuery.toLowerCase();
    return logs.filter(log => 
        log.action?.toLowerCase().includes(lower) ||
        log.entity?.toLowerCase().includes(lower) ||
        log.user_id?.toLowerCase().includes(lower) ||
        JSON.stringify(log.details)?.toLowerCase().includes(lower)
    );
  }, [logs, searchQuery]);

  if (isPermissionLoading) return null;

  if (!can(PERMISSIONS.VIEW_AUDIT_LOGS)) {
     return <div className="p-8 text-center text-red-500">Доступ запрещен</div>;
  }

  return (
   <div className="h-full flex flex-col ">
           <div className="grid grid-cols-[250px_1fr_250px] items-center pb-4 gap-4 min-h-[60px]">
              <h1 className="tab-title">Audit Logs</h1>

              {/* Search Bar */}
              <div className="w-full max-w-md mx-auto">
                 <Input
                    placeholder="Search logs..."
                    startContent={<IconSearch className="text-default-400" size={18} />}
                    value={searchQuery}
                    onValueChange={setSearchQuery}
                    size="sm"
                    isClearable
                    onClear={() => setSearchQuery('')}
                    classNames={{
                       inputWrapper: "bg-default-100",
                    }}
                 />
              </div>

              <div className="flex items-center gap-2 justify-self-end">
                 <div className="w-[140px] flex justify-end">
                    <StatusBadge 
                       status={badgeStatus} 
                       errorMessage={badgeError}
                       loadingText={texts.refreshLoading}
                       successText={texts.refreshSuccess}
                    />
                 </div>

                 <Button 
                    isIconOnly 
                    variant="flat" 
                    onPress={() => loadLogs(true)} 
                    size="sm" 
                  color="success"
                  isLoading={isLoading} 
                  className=""
                 >
                    <IconRefresh size={16} />
                 </Button>

                 <AdminUserMenu />
              </div>

           </div>
     
         
             <Table aria-label="Logs table"  
             isHeaderSticky
             
             classNames={{
               base: " overflow-scroll  ",
               wrapper: "bg-default-50 dark:bg-content1 rounded-large shadow-none",
               tbody: " ",
             }}>

                <TableHeader>
                   <TableColumn>Date</TableColumn>
                   <TableColumn>Action</TableColumn>
                   <TableColumn>Entity</TableColumn>
                   <TableColumn>User ID</TableColumn>
                   <TableColumn>Details</TableColumn>
                </TableHeader>
                <TableBody emptyContent="No logs found">
                   {filteredLogs.map((log, idx) => (
                      <TableRow key={log.id || `log-idx-${idx}`}>
                         <TableCell className="whitespace-nowrap text text-default-500">
                            {new Date(log.created_at).toLocaleString('ru-RU')}
                         </TableCell>
                         <TableCell>
                            <Chip size="sm" variant="flat" color="secondary">{log.action}</Chip>
                         </TableCell>
                         <TableCell>
                            <div className="flex flex-col text">
                               <span className="font-bold">{log.entity}</span>
                               <span className="text-default-400 font-mono">{log.entity_id}</span>
                            </div>
                         </TableCell>
                         <TableCell>
                            <span className="font-mono text text-default-500">{log.user_id.substring(0,8)}...</span>
                         </TableCell>
                         <TableCell>
                            <pre className="text-[12px] max-w-[300px] overflow-hidden text-default-400 whitespace-pre-wrap">
                               {JSON.stringify(log.details)}
                            </pre>
                         </TableCell>
                      </TableRow>
                   ))}
                </TableBody>
             </Table>
           
  
        </div>
 
  );
};

