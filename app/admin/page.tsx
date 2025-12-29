'use client';

import React, { useState, useEffect, useMemo, useLayoutEffect, useCallback, useRef } from 'react';
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
import { adminLoadingService } from '@/app/admin/_services/adminLoadingService';
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
      adminLoadingService.logInit();
   }, [setGlobalLoading]);

   const [activeTab, setActiveTab] = useState<TabId>('rooms');

   useEffect(() => {
       activeTabFinishedRef.current = false;
       if (timerRef.current) {
           clearTimeout(timerRef.current);
           timerRef.current = null;
       }
       adminLoadingService.logActiveTabStart(activeTab);
   }, [activeTab]);
   const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
   const [fadeInContent, setFadeInContent] = useState(false);
   const [canLoadBackground, setCanLoadBackground] = useState(false);
   const [readyTabs, setReadyTabs] = useState<{ [key in TabId]?: boolean }>({});
   const loggedTabsRef = useRef<Set<string>>(new Set());
   const activeTabFinishedRef = useRef(false);
   const timerRef = useRef<NodeJS.Timeout | null>(null);

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
         if (!fadeInContent && !activeTabFinishedRef.current) {
            activeTabFinishedRef.current = true;
            adminLoadingService.logActiveTabFinish(activeTab);
            adminLoadingService.logTransitionToBackground(200);
            
            // Store timer in ref so it survives re-renders
            timerRef.current = setTimeout(() => {
               setGlobalLoading(false);
               setTimeout(() => {
                  setFadeInContent(true);
                  setCanLoadBackground(true); // Enable background loading
                  
                  // Log start of background loading for other tabs
                  visibleTabs.forEach(tab => {
                      if (tab.id !== activeTab) {
                          adminLoadingService.logBackgroundTabStart(tab.id);
                      }
                  });

                  toast.success('Данные успешно загружены');
                  timerRef.current = null;
               }, 50);
            }, 200);
         } else if (fadeInContent) {
             // Ensure spinner is hidden if content is already visible
             setGlobalLoading(false);
         }
      }
   }, [readyTabs, activeTab, isAdminLoading, setGlobalLoading, fadeInContent, visibleTabs]);

   // Log background readiness (optional, if we track all tabs)
   useEffect(() => {
       if (canLoadBackground) {
           Object.keys(readyTabs).forEach((key) => {
               const tabId = key as TabId;
               
               // If this tab is ready AND wasn't logged yet AND isn't the active one (active is logged separately)
               if (readyTabs[tabId] && !loggedTabsRef.current.has(tabId) && tabId !== activeTab) {
                   loggedTabsRef.current.add(tabId);
                   adminLoadingService.logBackgroundTabFinish(tabId);
               }
           });

           // Check if ALL visible tabs are ready
           const allVisibleTabsReady = visibleTabs.every(tab => readyTabs[tab.id]);
           if (allVisibleTabsReady && !loggedTabsRef.current.has('ALL_FINISHED')) {
               loggedTabsRef.current.add('ALL_FINISHED');
               adminLoadingService.logAllFinished();
           }
       } else {
           // If we are NOT in background mode yet, but active tab is ready, mark it as logged so we don't log it as background later
           if (readyTabs[activeTab] && !loggedTabsRef.current.has(activeTab)) {
               loggedTabsRef.current.add(activeTab);
           }
       }
   }, [readyTabs, canLoadBackground, activeTab, visibleTabs]);

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
            canLoad={activeTab === tab.id || canLoadBackground}
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
