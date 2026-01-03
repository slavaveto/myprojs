import { checkPermission, Permission, UserAccessContext } from './acl';
import { useCallback } from 'react';
import { useIsLocal } from '@/utils/useIsLocal';

export function usePermission() {
  const isLocal = useIsLocal();

  const userContext: UserAccessContext = {
    isLocal: isLocal
  };

  const can = useCallback((permission: Permission): boolean => {
    return checkPermission(permission, userContext);
  }, [isLocal]);

  return { 
    can,
    isLoading: false,
  };
}

