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
import { globalStorage } from '@/utils/storage';
import { TabId, AppTabConfig } from '@/app/types'; // LOCAL
import { Spinner } from "@heroui/react";
import clsx from "clsx";
import { AppLoaderProvider, useAppLoader } from '@/app/AppLoader'; // LOCAL
import { APP_TABS_DATA, APP_SETTINGS } from '@/app/settings'; // LOCAL SETTINGS

// Создаем упрощенный тип конфига
type PublicTabConfig = AppTabConfig;

function PageContent() {
   const logger = createLogger('MainPage');
   const { isMobile } = useDevice();
   
   // Используем контекст лоадера, как в админке
   const { setLoading: setGlobalLoading } = useAppLoader();

   const [fadeInContent, setFadeInContent] = useState(false);
   
   // Табы
   const [activeTab, setActiveTab] = useState<TabId>('users');
   const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
   
   // Словарь готовности табов
   const [readyTabs, setReadyTabs] = useState<{ [key in TabId]?: boolean }>({});

   useEffect(() => {
      const savedTab = globalStorage.getItem('main_active_tab') as TabId;
      if (savedTab && ['users', 'localization', 'logs'].includes(savedTab)) {
         setActiveTab(savedTab);
      }
   }, []);

   useLayoutEffect(() => {
      setGlobalLoading(true);
   }, [setGlobalLoading]);

   const tabsConfig: PublicTabConfig[] = useMemo(
      () => [
         {
            id: 'users',
            label: 'Users',
            icon: Users,
            component: (props: any) => <UsersScreen {...props} texts={APP_TABS_DATA.users.texts} showToast={APP_SETTINGS.showToast} />,
         },
         {
            id: 'localization',
            label: 'Localization',
            icon: Languages,
            component: (props: any) => <LocalizScreen {...props} texts={APP_TABS_DATA.localization.texts} showToast={APP_SETTINGS.showToast} />,
         },
         {
            id: 'logs',
            label: 'Logs',
            icon: FileText,
            component: (props: any) => <LogsScreen {...props} texts={APP_TABS_DATA.logs.texts} showToast={APP_SETTINGS.showToast} />,
         },
      ],
      []
   );

   const handleTabChange = (id: TabId) => {
      setActiveTab(id);
      globalStorage.setItem('main_active_tab', id);
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
         fadeInContent={fadeInContent}
      >
         {content}
      </Layout>
   );
}

// Компонент-обертка, который держит провайдер и сам спиннер (аналог AppLayoutClient)
function PageLayoutWrapper({ children }: { children: React.ReactNode }) {
   const { isLoading } = useAppLoader();
   
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
      <AppLoaderProvider>
         <PageLayoutWrapper>
            <PageContent />
         </PageLayoutWrapper>
      </AppLoaderProvider>
   );
}
