'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { 
   LayoutTemplate, 
   Book, 
   Users, 
   FileText 
} from 'lucide-react';
import { Project } from '@/app/types';
import { ProjectScreen } from '@/app/tabs/ProjectScreen';
import { DocsScreen } from '@/app/tabs/docs/DocsScreen';
import { NavigationTarget } from '@/app/components/GlobalSearch';

// Заглушки для экранов
const PlaceholderScreen = ({ title }: { title: string }) => (
   <div className="flex items-center justify-center h-full text-default-400">
      {title} Content Area
   </div>
);

interface AdminScreenProps {
   project: Project; // Родительский проект
   uiSatellite?: Project;
   docsSatellite?: Project;
   isActive: boolean;
   
   // Пропсы для экранов
   canLoad: boolean;
   globalStatus?: any;
   onNavigate: (target: NavigationTarget) => void;
   onUpdateProject: (projectId: string, updates: Partial<Project>) => void;
   onProjectReady: (projectId: string) => void;
}

type AdminTab = 'ui' | 'docs' | 'users' | 'logs';

export const AdminScreen = ({
   project,
   uiSatellite,
   docsSatellite,
   isActive,
   canLoad,
   globalStatus,
   onNavigate,
   onUpdateProject,
   onProjectReady
}: AdminScreenProps) => {
   const [activeTab, setActiveTab] = useState<AdminTab>('ui');

   // Если экран не активен, ничего не рендерим
   if (!isActive) return null;

   const renderContent = () => {
      switch (activeTab) {
         case 'ui':
            if (!uiSatellite) {
                return <div className="flex items-center justify-center h-full text-default-400">UI Project not enabled or not found</div>;
            }
            return (
                <ProjectScreen 
                    project={uiSatellite}
                    isActive={isActive && activeTab === 'ui'}
                    canLoad={canLoad}
                    globalStatus={globalStatus}
                    onNavigate={onNavigate}
                    onReady={() => onProjectReady(uiSatellite.id)}
                    onUpdateProject={(updates) => onUpdateProject(uiSatellite.id, updates)}
                    onDeleteProject={() => {}} // Satellites are deleted via parent
                />
            );
         case 'docs':
            if (!docsSatellite) {
                return <div className="flex items-center justify-center h-full text-default-400">Docs Project not enabled or not found</div>;
            }
            return (
                <DocsScreen 
                   project={docsSatellite}
                   isActive={isActive && activeTab === 'docs'}
                   canLoad={canLoad} 
                />
            );
         case 'users':
            return <PlaceholderScreen title="Users Management" />;
         case 'logs':
            return <PlaceholderScreen title="Logs Viewer" />;
         default:
            return null;
      }
   };

   const tabs = [
      { id: 'ui', label: 'UI', icon: LayoutTemplate },
      { id: 'docs', label: 'Docs', icon: Book },
      { id: 'users', label: 'Users', icon: Users },
      { id: 'logs', label: 'Logs', icon: FileText },
   ];

   return (
      <div className="flex h-full w-full bg-background">
         {/* Left Sidebar Menu */}
         <div className="w-48 border-r border-default-200 bg-default-50 flex flex-col pt-4">
             <div className="px-4 mb-4 text-xs font-semibold text-default-400 uppercase">
                 Admin Panel
             </div>
             
             <div className="flex flex-col gap-1 px-2">
                 {tabs.map(tab => {
                     const Icon = tab.icon;
                     const isTabActive = activeTab === tab.id;
                     return (
                         <button
                             key={tab.id}
                             onClick={() => setActiveTab(tab.id as AdminTab)}
                             className={clsx(
                                 "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left",
                                 isTabActive 
                                     ? "bg-primary/10 text-primary font-medium" 
                                     : "text-default-600 hover:bg-default-200"
                             )}
                         >
                             <Icon size={18} />
                             <span>{tab.label}</span>
                         </button>
                     );
                 })}
             </div>
         </div>

         {/* Main Content Area */}
         <div className="flex-grow h-full overflow-hidden bg-background relative">
             {renderContent()}
         </div>
      </div>
   );
};

