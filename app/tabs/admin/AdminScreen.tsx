'use client';

import React, { useState, useEffect } from 'react';
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
import { NavigationTarget, GlobalSearch } from '@/app/components/GlobalSearch'; // Import GlobalSearch
import { StatusBadge } from '@/utils/supabase/StatusBadge'; // Import StatusBadge
import { EditProjectPopover } from '@/app/components/EditProject'; // Import EditProject
import { Button } from '@heroui/react'; // Import Button
import { EllipsisVertical } from 'lucide-react'; // Import Icon
import { globalStorage } from '@/utils/storage'; // Import globalStorage

import { ActionStatus } from '@/utils/supabase/useAsyncAction'; // Import ActionStatus
import { OverloadScanner } from '@/app/components/remote/scanners/OverloadScanner'; // Import Scanner

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

// Memoized components to prevent re-rendering when hidden
const MemoizedProjectScreen = React.memo(ProjectScreen, (prev, next) => {
   if (prev.isActive !== next.isActive) return false;
   if (prev.canLoad !== next.canLoad) return false;
   // Re-render if hidden status changes (to stop spinner/reset state) - actually handled by internal logic
   if (!next.isActive) return true; // Don't re-render if staying hidden? Wait, if we hide it, we want it to freeze?
   // Actually, the previous logic was:
   // if (!next.isActive) return true;
   // This means if the component is hidden (isActive=false), we return TRUE (props are equal), so NO RENDER.
   // This is good for performance.
   return false;
});

interface StatusState {
    status: ActionStatus;
    error: Error | null;
}

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
   const [projectStatus, setProjectStatus] = useState<StatusState>({ status: 'idle', error: null });

   // Load saved tab on mount or project change
   useEffect(() => {
       const savedTab = globalStorage.getItem(`active_admin_tab_${project.id}`);
       if (savedTab && ['ui', 'docs', 'users', 'logs'].includes(savedTab)) {
           setActiveTab(savedTab as AdminTab);
       } else {
           setActiveTab('ui'); // Default
       }
   }, [project.id]);

   // Reset status on tab change
   useEffect(() => {
       setProjectStatus({ status: 'idle', error: null });
   }, [activeTab]);

   const handleTabChange = (tab: AdminTab) => {
       setActiveTab(tab);
       globalStorage.setItem(`active_admin_tab_${project.id}`, tab);
   };

   // Helper to avoid unnecessary state updates
   const updateStatusIfChanged = React.useCallback((newStatus: StatusState) => {
       setProjectStatus(prev => {
           if (prev.status === newStatus.status && prev.error === newStatus.error) return prev;
           return newStatus;
       });
   }, []);

   const handleUiStatusChange = React.useCallback((status: StatusState) => {
       if (activeTab === 'ui') updateStatusIfChanged(status);
   }, [activeTab, updateStatusIfChanged]);

   const handleDocsStatusChange = React.useCallback((status: StatusState) => {
       if (activeTab === 'docs') updateStatusIfChanged(status);
   }, [activeTab, updateStatusIfChanged]);

   // Render content regardless of active state (handled by parent visibility)
   const renderContent = () => {
      return (
          <>
            <div className={clsx("h-full w-full", activeTab === 'ui' ? 'block' : 'hidden')}>
                {uiSatellite ? (
                    <MemoizedProjectScreen 
                        project={uiSatellite}
                        isActive={isActive && activeTab === 'ui'}
                        canLoad={canLoad}
                        globalStatus={globalStatus}
                        onNavigate={onNavigate}
                        onReady={() => onProjectReady(uiSatellite.id)}
                        onUpdateProject={(updates) => onUpdateProject(uiSatellite.id, updates)}
                        onDeleteProject={() => {}} 
                        hideHeader={true}
                        onStatusChange={handleUiStatusChange}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-default-400">UI Project not enabled or not found</div>
                )}
            </div>

            <div className={clsx("h-full w-full", activeTab === 'docs' ? 'block' : 'hidden')}>
                {docsSatellite ? (
                    <MemoizedProjectScreen 
                        project={docsSatellite}
                        isActive={isActive && activeTab === 'docs'}
                        canLoad={canLoad} 
                        globalStatus={globalStatus}
                        onNavigate={onNavigate}
                        onReady={() => onProjectReady(docsSatellite.id)}
                        onUpdateProject={(updates) => onUpdateProject(docsSatellite.id, updates)}
                        onDeleteProject={() => {}} 
                        hideHeader={true}
                        onStatusChange={handleDocsStatusChange}
                    />
                ) : (
                    <div className="flex items-center justify-center h-full text-default-400">Docs Project not enabled or not found</div>
                )}
            </div>

            <div className={clsx("h-full w-full", activeTab === 'users' ? 'block' : 'hidden')}>
                <PlaceholderScreen title="Users Management" />
            </div>

            <div className={clsx("h-full w-full", activeTab === 'logs' ? 'block' : 'hidden')}>
                <PlaceholderScreen title="Logs Viewer" />
            </div>
          </>
      );
   };

   const tabs = [
      { id: 'users', label: 'Users', icon: Users },
      { id: 'ui', label: 'UI', icon: LayoutTemplate },
      { id: 'logs', label: 'Logs', icon: FileText },
      { id: 'docs', label: 'Docs', icon: Book },
   ];

   return (
      <div className="flex flex-col h-full w-full bg-background overflow-hidden">
         {/* HEADER SECTION (Copied from ProjectScreen) */}
         <div className="flex-none px-6 py-4 border-b border-default-200 bg-background z-10 flex flex-col gap-4">
             {/* Title Row */}
             <div className="grid grid-cols-[1fr_auto_1fr] items-center min-h-[40px] gap-4">
                <div className="flex items-center gap-2 justify-self-start pl-1">
                    <div 
                        className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm border border-white/10" 
                        style={{ backgroundColor: project.proj_color || '#3b82f6' }}
                    />
                    <h1 className="text-2xl font-bold truncate">{project.title} - Admin</h1>
                </div>
                
                <div className="w-full max-w-[240px] justify-self-center">
                    {onNavigate && (
                        <GlobalSearch 
                            onNavigate={onNavigate} 
                            currentProjectId={project.id}
                            // No current folder ID for Admin Screen root
                        />
                    )}
                </div>

                <div className="flex items-center gap-2 justify-self-end">
                    {/* Add OverloadScanner for Docs tab */}
                    {activeTab === 'docs' && (
                        <OverloadScanner 
                            // We don't have projectLocalPath in Project type yet?
                            // Assuming it might be added or we pass undefined for now and it works with defaults or fails gracefully
                            projectLocalPath={undefined} 
                        />
                    )}
                    
                    <StatusBadge 
                        status={projectStatus.status} 
                        loadingText="Saving..."
                        successText="Saved"
                        errorMessage={projectStatus.error?.message}
                    />
                </div>
             </div>
        </div>

        <div className="flex flex-grow overflow-hidden">
             {/* Left Sidebar Menu */}
             <div className="w-[150px] border-r border-default-200 bg-default-50 flex flex-col pt-4 flex-shrink-0">
                 {/* <div className="px-4 mb-4 text-xs font-semibold text-default-400 uppercase">
                     Admin Panel
                 </div> */}
                 
                 <div className="flex flex-col gap-1 px-2 pt-3">
                     {tabs.map(tab => {
                         const Icon = tab.icon;
                         const isTabActive = activeTab === tab.id;
                         return (
                             <button
                                 key={tab.id}
                                 onMouseDown={(e) => {
                                     if (e.button === 0) handleTabChange(tab.id as AdminTab);
                                 }}
                                 className={clsx(
                                     "flex items-center gap-3 px-3 py-2 rounded-lg font-medium text transition-colors text-left cursor-pointer select-none",
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
      </div>
   );
};

