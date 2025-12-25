import React from 'react';
import { Permission } from '@/app/admin/_services/acl';

export type TabId = 'rooms' | 'localization' | 'users' | 'logs' | 'logger' | 'profile';

export interface AdminTabConfig {
   id: TabId;
   label: string;
   icon: React.ElementType;
   component: React.ComponentType<any>;
   isVisible?: (can: (permission: Permission) => boolean) => boolean;
}

export interface AdminTabStaticConfig {
   label: string;
   texts: {
      saveLoading: string;
      saveSuccess: string;
      refreshLoading: string;
      refreshSuccess: string;
      [key: string]: string;
   };
}
