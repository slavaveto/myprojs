"use client";

import React, { useState, useEffect, useMemo, useLayoutEffect, useCallback } from 'react';
import { useDevice } from '@/utils/providers/MobileDetect';
// LOCAL IMPORTS (Copied Tabs)
import { LocalizScreen } from '@/app/tabs/LocalizScreen';
import { UsersScreen } from '@/app/tabs/UsersScreen';
import { LogsScreen } from '@/app/tabs/LogsScreen';

import { Languages, Users, FileText } from 'lucide-react';
import { createLogger } from '@/utils/logger/Logger';
import { MobileLayout } from '@/app/MobileLayout'; // LOCAL
import { DesktopLayout } from '@/app/DesktopLayout'; // LOCAL
import { ADMIN_TABS_DATA, ADMIN_SETTINGS } from '@/app/admin/settings';
import { TabId, AdminTabConfig } from '@/app/types'; // LOCAL
import { Spinner } from "@heroui/react";
import clsx from "clsx";
import { AdminLoaderProvider, useAdminLoader } from '@/app/AdminLoader'; // LOCAL

// Создаем упрощенный тип конфига
type PublicTabConfig = Omit<AdminTabConfig, 'isVisible'>;

function PageContent() {
   const logger = createLogger('MainPage');
   const { isMobile } = useDevice();
   
   // Используем контекст лоадера, как в админке
   const { setLoading: setGlobalLoading } = useAdminLoader();

   const [fadeInContent, setFadeInContent] = useState(false);
   
   // Табы
   const [activeTab, setActiveTab] = useState<TabId>('users');
   const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
   
   // Словарь готовности табов
   const [readyTabs, setReadyTabs] = useState<{ [key in TabId]?: boolean }>({});

   useLayoutEffect(() => {
      setGlobalLoading(true);
   }, [setGlobalLoading]);

   const tabsConfig: PublicTabConfig[] = useMemo(
      () => [
         {
            id: 'users',
            label: 'Users',
            icon: Users,
            component: (props: any) => <UsersScreen {...props} texts={ADMIN_TABS_DATA.users.texts} showToast={ADMIN_SETTINGS.showToast} />,
         },
         {
            id: 'localization',
            label: 'Localization',
            icon: Languages,
            component: (props: any) => <LocalizScreen {...props} texts={ADMIN_TABS_DATA.localization.texts} showToast={ADMIN_SETTINGS.showToast} />,
         },
         {
            id: 'logs',
            label: 'Logs',
            icon: FileText,
            component: (props: any) => <LogsScreen {...props} texts={ADMIN_TABS_DATA.logs.texts} showToast={ADMIN_SETTINGS.showToast} />,
         },
      ],
      []
   );

   const handleTabChange = (id: TabId) => {
      setActiveTab(id);
   };

   // Колбэк от таба, что он загрузил данные
   const handleTabReady = useCallback((tabId: TabId) => {
      logger.info(`Tab ready signal: ${tabId}`);
      setReadyTabs((prev) => {
         if (prev[tabId]) return prev;
         return { ...prev, [tabId]: true };
      });
   }, [logger]);

   // Эффект, который следит за готовностью АКТИВНОГО таба
   useEffect(() => {
      const isCurrentTabReady = readyTabs[activeTab];

      if (isCurrentTabReady) {
         if (!fadeInContent) {
            logger.info(`Tab '${activeTab}' is ready. Hiding spinner...`);
            
            const spinnerTimer = setTimeout(() => {
               setGlobalLoading(false);
               setTimeout(() => {
                  setFadeInContent(true);
               }, 50);
            }, 200);
            
            return () => clearTimeout(spinnerTimer);
         } else {
            setGlobalLoading(false);
         }
      }
   }, [readyTabs, activeTab, fadeInContent, logger, setGlobalLoading]);

   // Рендер контента табов
   const content = tabsConfig.map((tab) => (
      <div
         key={tab.id}
         className={`absolute inset-0 w-full h-full ${
            activeTab === tab.id
               ? 'z-10 visible opacity-100 pointer-events-auto'
               : 'z-0 invisible opacity-0 pointer-events-none'
         }`}
      >
         <tab.component
            onReady={() => handleTabReady(tab.id)}
            isActive={activeTab === tab.id}
         />
      </div>
   ));

   const compatibleTabs = tabsConfig.map(t => ({
       ...t,
       isVisible: () => true 
   }));

   const Layout = isMobile ? MobileLayout : DesktopLayout;

   return (
      <Layout
         visibleTabs={compatibleTabs}
         activeTab={activeTab}
         onTabChange={handleTabChange}
         isSidebarCollapsed={isSidebarCollapsed}
         setIsSidebarCollapsed={setIsSidebarCollapsed}
         onSignOut={() => console.log('Guest cannot sign out')}
         fadeInContent={fadeInContent}
      >
         {content}
      </Layout>
   );
}

// Компонент-обертка, который держит провайдер и сам спиннер (аналог AdminLayoutClient)
function PageLayoutWrapper({ children }: { children: React.ReactNode }) {
   const { isLoading } = useAdminLoader();
   
   return (
      <>
         <div 
            className={clsx(
               "fixed inset-0 flex items-center justify-center bg-content1 z-[9999] transition-opacity duration-500",
               isLoading ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
            )}
         >
            <Spinner size="lg" color="primary" />
         </div>
         {children}
      </>
   );
}

export default function Page() {
   return (
      <AdminLoaderProvider>
         <PageLayoutWrapper>
            <PageContent />
         </PageLayoutWrapper>
      </AdminLoaderProvider>
   );
}
