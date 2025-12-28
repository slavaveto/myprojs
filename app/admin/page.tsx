'use client';

import React, { useState, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { useDevice } from '@/utils/providers/MobileDetect';
import { usePermission } from '@/app/admin/_services/usePermission';
import { PERMISSIONS } from '@/app/admin/_services/acl';
import { RoomsScreen } from './tabs/RoomsScreen';
import { LocalizScreen } from './tabs/LocalizScreen';
import { UsersScreen } from './tabs/UsersScreen';
import { LogsScreen } from './tabs/LogsScreen';
import { ProfileScreen } from './tabs/ProfileScreen';
import { LayoutGrid, Languages, Users, FileText, Bug, UserCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useUser, useClerk } from '@clerk/nextjs';
import clsx from 'clsx';
import { useAdminLoader } from './AdminLoader';
import { createLogger } from '@/utils/logger/Logger';
import { globalStorage } from '@/utils/storage';
import { TabId, AdminTabConfig } from './types';
import { MobileLayout } from './MobileLayout';
import { DesktopLayout } from './DesktopLayout';
import { ADMIN_TABS_DATA, ADMIN_SETTINGS } from './settings';

export default function AdminPage() {
   const logger = createLogger('AdminPage');
   const { isMobile } = useDevice();
   const { can, isLoading: isAdminLoading } = usePermission();
   const { user } = useUser();
   const { signOut } = useClerk();

   const { setLoading: setGlobalLoading } = useAdminLoader();

   useLayoutEffect(() => {
      setGlobalLoading(true);
   }, [setGlobalLoading]);

   const [activeTab, setActiveTab] = useState<TabId>('rooms');
   const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
   const [fadeInContent, setFadeInContent] = useState(false);
   const [readyTabs, setReadyTabs] = useState<{ [key in TabId]?: boolean }>({});

   const handleSignOut = async () => {
      setGlobalLoading(true);
      await new Promise((r) => setTimeout(r, 200));
      await signOut({ redirectUrl: '/admin' });
   };

   const tabsConfig: AdminTabConfig[] = useMemo(
      () => [
         {
            id: 'profile',
            label: 'My Profile',
            icon: UserCircle,
            component: (props) => <ProfileScreen {...props} texts={ADMIN_TABS_DATA.profile.texts} showToast={ADMIN_SETTINGS.showToast} />,
            isVisible: (can) => can(PERMISSIONS.MANAGE_OWN_PROFILE),
         },
         {
            id: 'rooms',
            label: 'My Rooms',
            icon: LayoutGrid,
            component: (props) => <RoomsScreen {...props} texts={ADMIN_TABS_DATA.rooms.texts} showToast={ADMIN_SETTINGS.showToast} />,
            isVisible: (can) => can(PERMISSIONS.MANAGE_OWN_ROOMS),
         },
         {
            id: 'localization',
            label: 'Localization',
            icon: Languages,
            component: (props) => <LocalizScreen {...props} texts={ADMIN_TABS_DATA.localization.texts} showToast={ADMIN_SETTINGS.showToast} />,
            isVisible: (can) => can(PERMISSIONS.MANAGE_LOCALIZATION),
         },
         {
            id: 'users',
            label: 'Users',
            icon: Users,
            component: (props) => <UsersScreen {...props} texts={ADMIN_TABS_DATA.users.texts} showToast={ADMIN_SETTINGS.showToast} />,
            isVisible: (can) => can(PERMISSIONS.MANAGE_USERS),
         },
         {
            id: 'logs',
            label: 'Logs',
            icon: FileText,
            component: (props) => <LogsScreen {...props} texts={ADMIN_TABS_DATA.logs.texts} showToast={ADMIN_SETTINGS.showToast} />,
            isVisible: (can) => can(PERMISSIONS.VIEW_AUDIT_LOGS),
         },
      ],
      []
   );

   const visibleTabs = useMemo(
      () => tabsConfig.filter((tab) => tab.isVisible(can)),
      [tabsConfig, can]
   );

   useEffect(() => {
      const savedTab = globalStorage.getItem('admin_active_tab') as TabId;
      if (savedTab && tabsConfig.some((t) => t.id === savedTab && t.isVisible(can))) {
         setActiveTab(savedTab);
      }
   }, [can, tabsConfig]);

   const handleTabChange = (id: TabId) => {
      setActiveTab(id);
      globalStorage.setItem('admin_active_tab', id);
   };

   const handleTabReady = useCallback((tabId: TabId) => {
      logger.info(`Tab ready signal received: ${tabId}`);
      setReadyTabs((prev) => {
         if (prev[tabId]) return prev;
         return { ...prev, [tabId]: true };
      });
   }, []);

   useEffect(() => {
      if (isAdminLoading) return;
      const isCurrentTabReady = readyTabs[activeTab];

      if (isCurrentTabReady) {
         if (!fadeInContent) {
            logger.info(`Tab '${activeTab}' is ready. Hiding spinner in 200ms...`);
            const spinnerTimer = setTimeout(() => {
               setGlobalLoading(false);
               setTimeout(() => {
                  setFadeInContent(true);
                  toast.success('Данные успешно загружены');
               }, 50);
            }, 200);
            return () => clearTimeout(spinnerTimer);
         } else {
            setGlobalLoading(false);
         }
      }
   }, [readyTabs, activeTab, isAdminLoading, setGlobalLoading, fadeInContent]);

   const content = visibleTabs.map((tab) => (
      <div
         key={tab.id}
         className={clsx(
            'absolute inset-0 w-full h-full',
            activeTab === tab.id
               ? 'z-10 visible opacity-100 pointer-events-auto'
               : 'z-0 invisible opacity-0 pointer-events-none'
         )}
      >
         <tab.component
            onReady={() => handleTabReady(tab.id)}
            isActive={activeTab === tab.id}
         />
      </div>
   ));

   if (isMobile) {
      return (
         <MobileLayout
            visibleTabs={visibleTabs}
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onSignOut={handleSignOut}
            fadeInContent={fadeInContent}
         >
            {content}
         </MobileLayout>
      );
   }

   return (
      <DesktopLayout
         visibleTabs={visibleTabs}
         activeTab={activeTab}
         onTabChange={handleTabChange}
         isSidebarCollapsed={isSidebarCollapsed}
         setIsSidebarCollapsed={setIsSidebarCollapsed}
         userEmail={user?.primaryEmailAddress?.emailAddress}
         onSignOut={handleSignOut}
         fadeInContent={fadeInContent}
      >
         {content}
      </DesktopLayout>
   );
}
