import { useIsSuperAdmin } from '@/utils/supabase/useIsSuperAdmin';
import { checkPermission, Permission, UserAccessContext } from './acl';
import { useCallback } from 'react';
import { useIsLocal } from '@/utils/useIsLocal';

export function usePermission() {
  const { roleData, isLoading } = useIsSuperAdmin();
  const isLocal = useIsLocal();

  const userContext: UserAccessContext = {
    isLocal: isLocal
  };

  const can = useCallback((permission: Permission): boolean => {
    if (isLoading) return false;
    return checkPermission(permission, userContext);
  }, [isLoading,   isLocal]); // Depend on primitives

  return { 
    can, 
    isLoading,
  };
}

