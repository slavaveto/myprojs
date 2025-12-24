import { useIsSuperAdmin } from '@/utils/supabase/useIsSuperAdmin';
import { checkPermission, Permission, UserAccessContext, getRoomLimit } from './acl';
import { useCallback } from 'react';
import { useIsLocal } from '@/utils/useIsLocal';

export function usePermission() {
  const { roleData, isLoading } = useIsSuperAdmin();
  const isLocal = useIsLocal();

  const userContext: UserAccessContext = {
    isSuperAdmin: roleData.isSuperAdmin,
    isOwner: roleData.isOwner,
    plan: roleData.plan,
    isLocal: isLocal
  };

  const can = useCallback((permission: Permission): boolean => {
    if (isLoading) return false;
    return checkPermission(permission, userContext);
  }, [isLoading, roleData.isSuperAdmin, roleData.isOwner, roleData.plan, isLocal]); // Depend on primitives

  return { 
    can, 
    isLoading,
    roleData,
    roomLimit: getRoomLimit(userContext)
  };
}

