'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { SupabaseClient } from '@supabase/supabase-js';
import { createLogger } from '@/utils/logger/Logger';
import { Table, TableHeader, TableColumn, TableBody, TableRow, TableCell, Chip, Spinner, Input, Button, SortDescriptor, Select, SelectItem } from '@heroui/react';
import { RefreshCw as IconRefresh, Search as IconSearch, User as IconUser } from 'lucide-react';
import { userService, UserData } from '@/app/admin/_services/userService';
import { StatusBadge } from '@/utils/supabase/StatusBadge';

const logger = createLogger('RemoteUsers');

interface RemoteUsersProps {
    client: SupabaseClient | null;
}

export const RemoteUsers = ({ client }: RemoteUsersProps) => {
    const [users, setUsers] = useState<UserData[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({
        column: "created_at",
        direction: "descending",
    });
    const [error, setError] = useState<string | null>(null);

    const loadUsers = async () => {
        if (!client) return;
        
        setIsLoading(true);
        setError(null);
        
        try {
            logger.info('Loading remote users...');
            const data = await userService.getAllUsers(client);
            setUsers(data);
            logger.success('Remote users loaded', { count: data.length });
        } catch (err: any) {
            logger.error('Failed to load remote users', err);
            setError(err.message || 'Failed to load users');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (client) {
            loadUsers();
        }
    }, [client]);

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

    if (!client) {
        return <div className="p-8 text-center text-default-400">Waiting for remote connection...</div>;
    }

    return (
        <div className="h-full flex flex-col bg-background">
            <div className="grid grid-cols-[auto_1fr_auto] items-center p-4 gap-4 border-b border-default-200">
                <h2 className="text-xl font-bold">Remote Users</h2>

                {/* Search Bar */}
                <div className="w-full max-w-md justify-self-center">
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

                <div className="flex items-center gap-3">
                    <Button 
                        isIconOnly 
                        variant="flat" 
                        onPress={loadUsers} 
                        size="sm" 
                        color="primary"
                        isLoading={isLoading} 
                    >
                        <IconRefresh size={16} />
                    </Button>
                </div>
            </div>
            
            {error && (
                <div className="p-4 bg-danger-50 text-danger text-sm border-b border-danger-100">
                    Error: {error}
                </div>
            )}

            <div className="flex-grow overflow-hidden relative">
                 <Table 
                    aria-label="Remote users table" 
                    isHeaderSticky
                    sortDescriptor={sortDescriptor}
                    onSortChange={setSortDescriptor}
                    classNames={{
                        base: "h-full overflow-hidden",
                        wrapper: "h-full bg-transparent shadow-none rounded-none",
                        table: "h-full",
                    }}
                >
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
                    <TableBody 
                        items={filteredUsers}
                        emptyContent={isLoading ? "Loading..." : "No users found"}
                        isLoading={isLoading}
                        loadingContent={<Spinner />}
                    >
                        {(user) => (
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
                                        <Chip 
                                            color={user.is_super_admin ? "danger" : "default"} 
                                            size="sm" 
                                            variant="flat"
                                        >
                                            {user.is_super_admin ? "Super Admin" : "Admin"}
                                        </Chip>
                                    )}
                                </TableCell>
                                <TableCell>
                                    <Chip 
                                        color={user.plan === 'pro' ? "success" : "default"} 
                                        size="sm" 
                                        variant="flat"
                                    >
                                        {user.plan || 'free'}
                                    </Chip>
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
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

