import React from 'react';
import { Button } from '@heroui/react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { clsx } from 'clsx';
import { AppTabConfig, TabId } from './types';

interface DesktopLayoutProps {
   visibleTabs: AppTabConfig[];
   activeTab: TabId;
   onTabChange: (id: TabId) => void;
   isSidebarCollapsed: boolean;
   setIsSidebarCollapsed: (v: boolean) => void;
   children: React.ReactNode;
   fadeInContent: boolean;
}

export const DesktopLayout = ({
   visibleTabs,
   activeTab,
   onTabChange,
   isSidebarCollapsed,
   setIsSidebarCollapsed,
   children,
   fadeInContent
}: DesktopLayoutProps) => {
   return (
      <div
         className={clsx(
            'flex h-screen bg-background text-foreground overflow-hidden transition-opacity duration-700',
            fadeInContent ? 'opacity-100' : 'opacity-0'
         )}
      >
         {/* --- SIDEBAR --- */}
         <div
            className={clsx(
               'flex flex-col border-r border-default-200 bg-content1 transition-all duration-300',
               isSidebarCollapsed ? 'w-16' : 'w-[200px]'
            )}
         >
            {/* Sidebar Header */}
            <div className="h-14 flex items-center px-4 border-b border-default-200">
               {!isSidebarCollapsed && <span className="font-bold text-lg">App</span>}
               <Button
                  isIconOnly
                  variant="light"
                  size="sm"
                  onPress={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
                  className="ml-auto"
               >
                  {isSidebarCollapsed ? <ChevronsRight size={22} /> : <ChevronsLeft size={22} />}
               </Button>
            </div>

            {/* Navigation */}
            <div className="flex-grow flex flex-col gap-2 p-2 overflow-y-auto">
               {visibleTabs.map((tab) => (
                  <Button
                     key={tab.id}
                     variant={activeTab === tab.id ? 'flat' : 'light'}
                     color={activeTab === tab.id ? 'primary' : 'default'}
                     className={clsx(
                        'justify-start',
                        isSidebarCollapsed ? 'px-0 justify-center min-w-0' : ''
                     )}
                     onPress={() => onTabChange(tab.id)}
                     startContent={<tab.icon size={20} />}
                  >
                     {!isSidebarCollapsed && tab.label}
                  </Button>
               ))}
            </div>

            {/* User Info & Logout REMOVED */}
         </div>

         {/* --- MAIN CONTENT --- */}
         <div className="flex-grow flex flex-col h-full overflow-hidden relative p-3">
            <div
               className={clsx(
                  'flex-grow overflow-hidden relative p-0 transition-opacity duration-500',
                  fadeInContent ? 'opacity-100' : 'opacity-0'
               )}
            >
               {children}
            </div>
         </div>
      </div>
   );
};
