import React from 'react';

export type TabId = 'rooms' | 'localization' | 'users' | 'logs' | 'logger' | 'profile';

export interface AppTabConfig {
   id: TabId;
   label: string;
   icon: React.ElementType;
   component: React.ComponentType<any>;
}

export interface AppTabStaticConfig {
   label: string;
   texts: {
      saveLoading: string;
      saveSuccess: string;
      refreshLoading: string;
      refreshSuccess: string;
      [key: string]: string;
   };
}
