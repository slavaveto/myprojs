import React from 'react';
import { LogOut } from 'lucide-react';
import { clsx } from 'clsx';
import { AdminTabConfig, TabId } from './types';

interface MobileLayoutProps {
   visibleTabs: AdminTabConfig[];
   activeTab: TabId;
   onTabChange: (id: TabId) => void;
   onSignOut: () => void;
   children: React.ReactNode;
   fadeInContent: boolean;
}

export const MobileLayout = ({
   visibleTabs,
   activeTab,
   onTabChange,
   onSignOut,
   children,
   fadeInContent
}: MobileLayoutProps) => {
   return (
      <div
         className={clsx(
            'flex h-screen bg-background text-foreground overflow-hidden transition-opacity duration-700',
            fadeInContent ? 'opacity-100' : 'opacity-0'
         )}
      >
         <div className="flex-grow flex flex-col h-full overflow-hidden relative p-3">
            {/* Mobile Header */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-default-200 bg-content1 shrink-0 z-20">
               <span className="font-bold">Admin</span>
               <div className="flex gap-2">{/* Mobile Tabs / Dropdown could go here */}</div>
            </div>

            {/* Content Area */}
            <div
               className={clsx(
                  'flex-grow overflow-hidden relative p-0 transition-opacity duration-500',
                  fadeInContent ? 'opacity-100' : 'opacity-0'
               )}
            >
               {children}
            </div>

            {/* --- MOBILE BOTTOM NAVIGATION --- */}
            <div className="h-16 border-t border-default-200 bg-content1 flex items-center justify-around px-2 shrink-0 z-20">
               {visibleTabs.map((tab) => (
                  <button
                     key={tab.id}
                     onClick={() => onTabChange(tab.id)}
                     className={clsx(
                        'flex flex-col items-center justify-center p-2 rounded-lg transition-colors',
                        activeTab === tab.id ? 'text-primary' : 'text-default-500'
                     )}
                  >
                     <tab.icon size={24} />
                     <span className="text-[10px] mt-1">{tab.label}</span>
                  </button>
               ))}
               <button
                  onClick={onSignOut}
                  className="flex flex-col items-center justify-center p-2 rounded-lg text-danger"
               >
                  <LogOut size={24} />
                  <span className="text-[10px] mt-1">Exit</span>
               </button>
            </div>
         </div>
      </div>
   );
};
