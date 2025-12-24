'use client';

import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { useSupabase } from '@/utils/supabase/useSupabase';
import { createLogger } from '@/utils/logger/Logger';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Spinner, Select, SelectItem, Tooltip, Input, Button, SortDescriptor, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { usePermission } from '@/app/admin/_services/usePermission';
import { PERMISSIONS } from '@/app/admin/_services/acl';
import { useUserActions } from '@/app/admin/tabs/hooks/useUserActions';
import { useGlobalPersistentState } from '@/utils/storage';
import { RefreshCw as IconRefresh, Search as IconSearch, Download as IconDownload, User as IconUser } from 'lucide-react';
import toast from 'react-hot-toast';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { useAsyncAction } from '@/utils/supabase/useAsyncAction';
import { AdminUserMenu, profileUpdateEvent } from '@/app/admin/AdminUserMenu';

const logger = createLogger('UsersScreen');

interface UserData {
  user_id: string;
  username: string;
  full_name?: string;
  avatar_url?: string;
  is_super_admin: boolean;
  is_owner?: boolean;
  email: string;
  plan: string;
  subscription_status: string;
  created_at?: string;
}

interface UsersScreenProps {
   onReady?: () => void; 
   isActive: boolean;
   texts: {
      saveLoading: string;
      saveSuccess: string;
      refreshLoading: string;
      refreshSuccess: string;
   };
   showToast?: boolean;
}

export const UsersScreen = ({ onReady, isActive, texts, showToast = true }: UsersScreenProps) => {
  const { supabase } = useSupabase();
  const { can, isLoading: isPermissionLoading } = usePermission();
  const { updateUserRole, isUpdating } = useUserActions();
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortDescriptor, setSortDescriptor] = useGlobalPersistentState<SortDescriptor>('users_sort_descriptor', {
    column: "created_at",
    direction: "descending",
  });

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncData, setSyncData] = useState<{ toCreate: string[], toUpdate: string[], toDelete: string[] } | null>(null);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const handleDryRunSync = async () => {
    setIsSyncing(true);
    try {
        // По умолчанию API работает в режиме dryRun (безопасно)
        const res = await fetch('/api/admin/sync-users', { method: 'POST' });
        const json = await res.json();
        
        if (!res.ok) throw new Error(json.error || 'Check failed');
        
        const { toCreate, toUpdate, toDelete } = json.stats;

        if (toCreate.length === 0 && toUpdate.length === 0 && toDelete.length === 0) {
            toast.success('Все пользователи актуальны');
            setIsPopoverOpen(false);
            return;
        }

        setSyncData({ toCreate, toUpdate, toDelete });
        setIsPopoverOpen(true);

    } catch (err: any) {
        logger.error('Sync check error', err);
        toast.error(`Ошибка проверки: ${err.message}`);
    } finally {
        setIsSyncing(false);
    }
  };

  const handleConfirmSync = async () => {
    setIsSyncing(true);
    setIsPopoverOpen(false); // Закрываем сразу
    const toastId = toast.loading('Синхронизация...');
    
    try {
        // Явно передаем mode=commit для записи
        const res = await fetch('/api/admin/sync-users?mode=commit', { method: 'POST' });
        const json = await res.json();
        
        if (!res.ok) throw new Error(json.error || 'Sync failed');
        
        toast.success(`Синхронизация завершена: +${json.stats.created}, ~${json.stats.updated}, -${json.stats.deleted}`, { id: toastId });
        await loadUsers(true);
    } catch (err: any) {
        toast.error(`Ошибка: ${err.message}`, { id: toastId });
    } finally {
        setIsSyncing(false);
        setSyncData(null);
    }
  };

  const { execute: executeRefresh, status: refreshStatus, error: refreshError } = useAsyncAction({
    minDuration: 1000,
    useToast: showToast,
    loadingMessage: texts.refreshLoading,
    successMessage: texts.refreshSuccess,
    errorMessage: 'Ошибка обновления'
  });

  const { execute: executeSave, status: saveStatus, error: saveError } = useAsyncAction({
    useToast: showToast,
    minDuration: 800,
    successDuration: 2000,
    loadingMessage: texts.saveLoading,
    successMessage: texts.saveSuccess,
    errorMessage: (err) => `Error: ${err.message}`
  });

  const isRefreshing = refreshStatus !== 'idle';
  const badgeStatus = isRefreshing ? refreshStatus : saveStatus;
  const badgeError = refreshStatus === 'error' ? refreshError?.message : saveError?.message;

  const loadingText = isRefreshing ? texts.refreshLoading : texts.saveLoading;
  const successText = isRefreshing ? texts.refreshSuccess : texts.saveSuccess;

  const loadUsers = useCallback(async (isManualRefresh = false) => {
    setIsLoading(true);
    const fetchUsers = async () => {
      // 1. Грузим юзеров
      const { data: usersData, error: usersError } = await supabase.from('users').select('*');
      if (usersError) throw usersError;

      if (!usersData || usersData.length === 0) {
         setUsers([]);
         return;
      }

      // 2. Грузим профили для этих юзеров
      const userIds = usersData.map(u => u.user_id);
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, username, full_name, avatar_url')
        .in('user_id', userIds);
        
      if (profilesError) {
         logger.error('Error fetching profiles', profilesError);
      }

      // 3. Склеиваем
      const mappedData = usersData.map(u => {
         const profile = profilesData?.find(p => p.user_id === u.user_id);
         return {
            ...u,
            username: profile?.username || u.username || '-', // Приоритет профилю
            full_name: profile?.full_name || '',
            avatar_url: profile?.avatar_url
         };
      });

      setUsers(mappedData);
    };

    if (isManualRefresh) {
        await executeRefresh(fetchUsers);
    } else {
        try {
            await fetchUsers();
        } catch (err) {
            logger.error('Failed to load users', err);
        }
    }
    
    setIsLoading(false);
    if (onReady) setTimeout(() => onReady(), 0);
  }, [supabase, executeRefresh, onReady]);

  useEffect(() => {
    loadUsers();

    const handleUpdate = () => {
        loadUsers();
    };

    profileUpdateEvent.addEventListener('profileUpdated', handleUpdate);
    return () => {
        profileUpdateEvent.removeEventListener('profileUpdated', handleUpdate);
    };
  }, [loadUsers]);

  const filteredUsers = useMemo(() => {
    let result = users;

    // 1. Filter
    if (searchQuery) {
        const lower = searchQuery.toLowerCase();
        result = result.filter(u => 
            u.user_id.toLowerCase().includes(lower) ||
            u.email?.toLowerCase().includes(lower) ||
            u.username?.toLowerCase().includes(lower) ||
            u.full_name?.toLowerCase().includes(lower)
        );
    }

    // 2. Sort
    return result.sort((a: any, b: any) => {
        const first = a[sortDescriptor.column as keyof UserData];
        const second = b[sortDescriptor.column as keyof UserData];
        const cmp = first < second ? -1 : first > second ? 1 : 0;

        return sortDescriptor.direction === "descending" ? -cmp : cmp;
    });
  }, [users, searchQuery, sortDescriptor]);

  const handleRoleChange = async (userId: string, isSuper: boolean) => {
    try {
      await executeSave(async () => {
          await updateUserRole(userId, { is_super_admin: isSuper });
      });
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, is_super_admin: isSuper } : u))
      );
    } catch (err) {
      // Error handled in hook
    }
  };

  const handlePlanChange = async (userId: string, plan: string) => {
    try {
      await executeSave(async () => {
          await updateUserRole(userId, { plan });
      });
      setUsers((prev) =>
        prev.map((u) => (u.user_id === userId ? { ...u, plan } : u))
      );
    } catch (err) {
      // Error handled in hook
    }
  };

  if (isPermissionLoading) return null;
  
  if (!can(PERMISSIONS.MANAGE_USERS)) {
     return <div className="p-8 text-center text-red-500">Доступ запрещен</div>;
  }

  return (
    <div className="h-full flex flex-col ">
          <div className="grid grid-cols-[250px_1fr_250px] items-center pb-4 gap-4 min-h-[60px]">
             <h1 className="tab-title">Users Manager</h1>

             {/* Search Bar */}
             <div className="w-full max-w-md mx-auto">
                <Input
                   placeholder="Search users..."
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

             <div className="flex items-center gap-3 justify-self-end">
                <div className="w-[140px] flex justify-end">
                   <StatusBadge 
                      status={badgeStatus} 
                      errorMessage={badgeError}
                      loadingText={loadingText}
                      successText={successText}
                   />
                </div>

                <div className="flex gap-2">
                          <div className="relative">
                              <Button 
                                  isIconOnly 
                                  variant="flat" 
                                  onPress={handleDryRunSync} 
                                  isLoading={isSyncing}
                                  className="shadow-lg bg-background/80 backdrop-blur-md border border-default-200"
                              >
                                 <IconDownload size={16} />
                              </Button>

                              <Popover isOpen={isPopoverOpen} onOpenChange={setIsPopoverOpen} placement="bottom">
                                  <PopoverTrigger>
                                      {/* Невидимый триггер для позиционирования Popover'а, чтобы клик по кнопке не открывал его сразу */}
                                      <div className="absolute w-full h-1 bottom-0 left-0" />
                                  </PopoverTrigger>
                                  <PopoverContent>
                                      <div className="px-1 py-2 w-64">
                                          <div className="text-small font-bold mb-2">Sync Preview</div>
                                          
                                          {syncData?.toCreate.length ? (
                                              <div className="mb-2">
                                                  <div className="text-tiny text-success font-bold">New Users ({syncData.toCreate.length}):</div>
                                                  <ul className="text-tiny list-disc list-inside max-h-20 overflow-y-auto">
                                                      {syncData.toCreate.map((u, i) => <li key={i}>{u}</li>)}
                                                  </ul>
                                              </div>
                                          ) : null}

                                          {syncData?.toUpdate.length ? (
                                              <div className="mb-2">
                                                  <div className="text-tiny text-warning font-bold">Updates ({syncData.toUpdate.length}):</div>
                                                  <ul className="text-tiny list-disc list-inside max-h-20 overflow-y-auto">
                                                      {syncData.toUpdate.map((u, i) => <li key={i}>{u}</li>)}
                                                  </ul>
                                              </div>
                                          ) : null}

                                          {syncData?.toDelete.length ? (
                                              <div className="mb-2">
                                                  <div className="text-tiny text-danger font-bold">Delete ({syncData.toDelete.length}):</div>
                                                  <ul className="text-tiny list-disc list-inside max-h-20 overflow-y-auto">
                                                      {syncData.toDelete.map((u, i) => <li key={i}>{u}</li>)}
                                                  </ul>
                                              </div>
                                          ) : null}

                                          <Button size="sm" color="primary" fullWidth onPress={handleConfirmSync}>
                                              Confirm Sync
                                          </Button>
                                      </div>
                                  </PopoverContent>
                              </Popover>
                          </div>

                   <Button isIconOnly variant="flat" onPress={() => loadUsers(true)} 
                   isLoading={isLoading}
                   className="shadow-lg bg-background/80 backdrop-blur-md border border-default-200"
                   >
                      <IconRefresh size={16} />
                   </Button>

                   <AdminUserMenu />
                </div>
             </div>
          </div>
      

        <Table aria-label="Users table" 
        isHeaderSticky
        sortDescriptor={sortDescriptor}
        onSortChange={setSortDescriptor}
        classNames={{
          base: " overflow-scroll  ",
          wrapper: "bg-default-50 dark:bg-content1 rounded-large shadow-none",
          tbody: " ",
        }}>
          <TableHeader>
            <TableColumn key="avatar">Avatar</TableColumn>
            <TableColumn key="user_id" allowsSorting>User ID</TableColumn>
            <TableColumn key="username" allowsSorting>Username</TableColumn>
            <TableColumn key="full_name" allowsSorting>Full Name</TableColumn>
            <TableColumn key="is_super_admin" allowsSorting>Role</TableColumn>
            <TableColumn key="plan" allowsSorting>Plan</TableColumn>
            <TableColumn key="subscription_status" allowsSorting>Status</TableColumn>
            <TableColumn key="created_at" allowsSorting>Created</TableColumn>
          </TableHeader>
          <TableBody emptyContent={"No users found"}>
            {filteredUsers.map((user) => (
              <TableRow key={user.user_id}>
                <TableCell>
                  <div className="w-8 h-8 rounded-full bg-default-200 overflow-hidden flex items-center justify-center">
                    {user.avatar_url ? (
                      <img 
                        src={user.avatar_url} 
                        alt={user.username} 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <IconUser size={16} className="text-default-500" />
                    )}
                  </div>
                </TableCell>
                <TableCell>
                      <span className="font-mono text-xs cursor-default text-default-500">{user.user_id.substring(0, 8)}...</span>
                </TableCell>
                <TableCell>
                   <div className="flex flex-col">
                   <span className="text-sm font-bold">{user.username || '-'}</span>
                      <span className="text-xs text-default-400">{user.email}</span>
                   </div>
                </TableCell>
                <TableCell>
                   <span className="text-sm text-default-600">{user.full_name || '-'}</span>
                </TableCell>
                <TableCell>
                   {user.is_owner ? (
                      <Chip color="warning" size="sm" variant="dot" className="font-bold">OWNER</Chip>
                   ) : (
                      <Select 
                         size="sm" 
                         aria-label="Role Selection"
                         selectedKeys={user.is_super_admin ? ['super'] : ['admin']}
                         onChange={(e) => handleRoleChange(user.user_id, e.target.value === 'super')}
                         isDisabled={isUpdating}
                         classNames={{
                           trigger: "cursor-pointer"
                         }}
                         className="max-w-[150px]"
                         color={user.is_super_admin ? "danger" : "default"}
                      >
                         <SelectItem key="admin">Admin</SelectItem>
                         <SelectItem key="super">Super Admin</SelectItem>
                      </Select>
                   )}
                </TableCell>
                <TableCell>
                   {user.is_owner ? (
                      <Chip color="success" size="sm" variant="flat">Infinity</Chip>
                   ) : (
                      <Select 
                         size="sm" 
                         aria-label="Plan Selection"
                         selectedKeys={[user.plan || 'free']}
                         onChange={(e) => handlePlanChange(user.user_id, e.target.value)}
                         isDisabled={isUpdating}
                         classNames={{
                           trigger: "cursor-pointer"
                         }}
                         className="max-w-[100px]"
                         color={user.plan === 'pro' ? "success" : "default"}
                      >
                         <SelectItem key="free">Free</SelectItem>
                         <SelectItem key="pro">Pro</SelectItem>
                      </Select>
                   )}
                </TableCell>
                <TableCell>
                   <span className={user.subscription_status === 'active' ? 'text-success' : 'text-default-400'}>
                      {user.subscription_status || 'inactive'}
                   </span>
                </TableCell>
                <TableCell>
                   <span className="text-xs text-default-400 whitespace-nowrap">
                      {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                   </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        </div>


  );
};

