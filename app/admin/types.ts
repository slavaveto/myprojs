import React from 'react';
import { Permission } from '@/app/admin/_services/acl';

export type TabId = 'rooms' | 'users' | 'logs' | 'logger' | 'profile';

export interface AdminTabTexts {
   saveLoading: string;
   saveSuccess: string;
   refreshLoading: string;
   refreshSuccess: string;
}

export interface AdminTabStaticConfig {
   label: string;
   texts: AdminTabTexts;
}

export interface AdminTabConfig {
   id: TabId;
   label: string;
   icon: React.ElementType;
   component: React.ComponentType<{ onReady?: () => void; isActive: boolean; canLoad?: boolean }>;
   isVisible: (can: (permission: Permission) => boolean) => boolean;
}
