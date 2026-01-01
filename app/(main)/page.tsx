'use client';

import React from 'react';
import { clsx } from 'clsx';
import { Button, Spinner } from '@heroui/react';
import {
   Plus,
   LayoutGrid,
   Inbox,
   CheckCircle2,
   FileText,
   EllipsisVertical,
   Star,
} from 'lucide-react';
import { AppLoaderProvider, useAppLoader } from '@/app/AppLoader';
import { ProjectScreen } from '@/app/tabs/ProjectScreen';
import { DocsScreen } from '@/app/tabs/docs/DocsScreen';
import { CreateItemPopover } from '@/app/components/CreateItem';
import { LogsScreen } from '@/app/tabs/LogsScreen';
import { DoneScreen } from '@/app/tabs/DoneScreen';
import { TodayScreen } from '@/app/tabs/TodayScreen';
import { InboxScreen } from '@/app/tabs/InboxScreen';
import { StatusBadge } from '@/utils/supabase/StatusBadge';
import { EditProjectPopover } from '@/app/components/EditProject';
import { globalStorage } from '@/utils/storage';

// DnD Imports
import {
   DndContext,
   closestCenter,
} from '@dnd-kit/core';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import {
   SortableContext,
   verticalListSortingStrategy,
   useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import { usePageLogic } from './hooks/usePageLogic';
import { Project } from '@/app/types';

// --- Sortable Project Item Component (Internal) ---
interface SortableProjectItemProps {
   project: Project;
   isActive: boolean;
   // isFirst removed as we use project.is_highlighted
   onClick: () => void;
   onUiClick?: () => void; // Handler for UI Satellite
   onDocsClick?: () => void; // Handler for Docs Satellite
   satelliteId?: string; // UI Satellite ID
   docsSatelliteId?: string; // Docs Satellite ID
   isUiActive?: boolean; // UI active state
   isDocsActive?: boolean; // Docs active state
   children?: React.ReactNode;
}

const SortableProjectItem = ({
   project,
   isActive,
   onClick,
   onDocsClick,
   onUiClick,
   satelliteId,
   docsSatelliteId,
   isUiActive,
   isDocsActive,
   children,
}: SortableProjectItemProps) => {
   const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
      id: project.id,
   });

   const style = {
      transform: CSS.Translate.toString(transform),
      transition,
      opacity: 1, // Keep full opacity
      zIndex: isDragging ? 10 : 1,
      position: 'relative' as const,
   };

   return (
      <div ref={setNodeRef} style={style} className={clsx("w-full mb-1 group relative", project.is_highlighted && "mb-0 border border-default-200 rounded-lg")}>
            <div
               onClick={onClick}
               className={clsx(
                  'flex items-center gap-3 px-3 pr-2 py-2 rounded-lg transition-colors w-full text-left select-none  min-h-[40px]', // Added min-h-[40px]

                  // Dragging state (cursor, z-index, ring)
                  isDragging && 'z-20 ring-1 ring-primary/30',

               // Hover state (handled via group-hover on parent to keep highlight when hovering actions)
               !isDragging && !isActive && 'cursor-pointer group-hover:bg-default-100',
               !isDragging && isActive && 'cursor-pointer',

               // Colors and Backgrounds
               isDragging
                  ? clsx(
                       'bg-default-100',
                       isActive ? 'text-primary font-medium' : 'text-foreground'
                    )
                  : isActive
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground'
            )}
         >
            {/* Drag Handle (Circle) */}
            <div
               {...attributes}
               {...listeners}
               className="w-[20px] flex items-center justify-center flex-shrink-0 cursor-grab active:cursor-grabbing outline-none"
               onClick={(e) => e.stopPropagation()}
            >
               <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.proj_color || '#3b82f6' }}
               />
            </div>

            <span className="truncate flex-grow">{project.title}</span>
            
            {/* Docs Chip */}
            <div className="flex items-center gap-1">
               {satelliteId && (
                  <div 
                     className={clsx(
                        "flex items-center gap-1 bg-purple-100 hover:bg-purple-200 px-2 py-[6px] rounded-lg text-[10px] font-medium text-purple-600 transition-all",
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        isUiActive && "ring-2 ring-purple-500 ring-offset-1" // Highlight active UI button
                     )}
                     onClick={(e) => {
                        e.stopPropagation();
                        onUiClick?.();
                     }}
                  >
                     <span>UI</span>
                  </div>
               )}

               {docsSatelliteId && (
                  <div 
                     className={clsx(
                        "flex items-center gap-1 bg-orange-100 hover:bg-orange-200 px-2 py-[6px] rounded-lg text-[10px] font-medium text-orange-600 transition-all",
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100",
                        isDocsActive && "ring-2 ring-orange-500 ring-offset-1" // Highlight active Docs button
                     )}
                     onClick={(e) => {
                        e.stopPropagation();
                        onDocsClick?.();
                     }}
                  >
                     <span>Docs</span>
                  </div>
               )}
               
               {/* {project.show_docs_btn && (
                  <div 
                     className={clsx(
                        "flex items-center gap-1 bg-orange-100 hover:bg-orange-200 px-2 py-[6px] rounded-lg text-[10px] font-medium text-default-500 transition-all",
                        isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                     )}
                     onClick={(e) => {
                        e.stopPropagation();
                        onDocsClick();
                     }}
                  >
                     <span>Docs</span>
                  </div>
               )} */}
            </div>
         </div>

         {/* {children && (
            <div
               className=" absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20"
               onPointerDown={(e) => e.stopPropagation()}
               onClick={(e) => e.stopPropagation()}
            >
               {children}
            </div>
         )} */}
      </div>
   );
};

// --- Personal Project Item Component (No DnD) ---
const PersonalProjectItem = ({
   project,
   isActive,
   onClick,
   children,
}: {
   project: Project;
   isActive: boolean;
   onClick: () => void;
   children?: React.ReactNode;
}) => {
   return (
      <div className={clsx("w-full mb-1 group relative", project.is_highlighted && "mb-0 border border-default-200 rounded-lg")}>
         <div
            onClick={onClick}
            className={clsx(
               'flex items-center gap-3 px-3 pr-2 py-2 rounded-lg transition-colors w-full text-left select-none min-h-[40px]',
               !isActive && 'cursor-pointer hover:bg-default-100',
               isActive && 'bg-primary/10 text-primary font-medium cursor-pointer'
            )}
         >
            <div className="w-[20px] flex items-center justify-center flex-shrink-0">
               <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: project.proj_color || '#3b82f6' }}
               />
            </div>
            <span className="truncate flex-grow">{project.title}</span>
         </div>
         {children}
      </div>
   );
};

// --- Helper for System Tabs (Internal) ---
const SidebarItem = ({
   icon: Icon,
   label,
   onClick,
   isActive,
}: {
   icon: any;
   label: string;
   onClick?: () => void;
   isActive?: boolean;
}) => (
   <button
      onClick={onClick}
      className={clsx(
         'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors w-full text-left cursor-pointer select-none mb-1',
         'text-foreground',
         isActive ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-default-100'
      )}
   >
      <Icon size={20} className={isActive ? 'text-primary' : 'text-default-500'} />
      <span className="truncate flex-grow">{label}</span>
   </button>
);

function AppContent() {
   const {
      // State
      projects,
      activeProjectId,
      activeSystemTab,
      projectScreenMode,
      isInit,
      canLoadBackground,
      sidebarStatus,
      readyProjects,
      
      // State Setters
      setActiveProjectId,
      setActiveSystemTab,
      setProjectScreenMode,
      
      // Handlers
      handleCreateProject,
      handleUpdateProject,
      handleDeleteProject,
      handleDragEnd,
      handleNavigate,
      handleMoveTask,
      handleRestoreTaskFromDone,
      handleProjectReady,
      updateProjectInState,
      removeProjectFromState,
      handleToggleSatellite, // Import new handler
      
      // Props
      sensors,
   } = usePageLogic();

   // Filter out satellite projects (ui/docs) AND personal projects from the main sidebar list
   const sidebarProjects = projects.filter(p => p.proj_type !== 'ui' && p.proj_type !== 'docs' && p.proj_type !== 'personal');
   
   // Personal projects list
   const personalProjects = projects.filter(p => p.proj_type === 'personal');

   // Map parent projects to their satellites and store parent colors
   // { parentId: { ui: satelliteId, docs: satelliteId } }
   const { satellitesMap, parentColorsMap } = React.useMemo(() => {
      const satMap: Record<string, { ui?: string, docs?: string }> = {};
      const colorMap: Record<string, string> = {}; // { parentId: color }

      // First pass: collect parent colors
      projects.forEach(p => {
          if (p.proj_type !== 'ui' && p.proj_type !== 'docs') {
              colorMap[p.id] = p.proj_color;
          }
      });

      // Second pass: map satellites
      projects.forEach(p => {
         if (p.parent_proj_id) {
             if (p.proj_type === 'ui') {
                 if (!satMap[p.parent_proj_id]) satMap[p.parent_proj_id] = {};
                 satMap[p.parent_proj_id].ui = p.id;
             }
             if (p.proj_type === 'docs') {
                 if (!satMap[p.parent_proj_id]) satMap[p.parent_proj_id] = {};
                 satMap[p.parent_proj_id].docs = p.id;
             }
         }
      });
      return { satellitesMap: satMap, parentColorsMap: colorMap };
   }, [projects]);

   return (
      <div className="flex h-screen w-full overflow-hidden bg-background">
         {/* Sidebar */}
         <aside className="w-[300px] flex-shrink-0 border-r border-default-200 bg-content1 flex flex-col z-20">
            <div className="p-4 border-b border-default-200 flex items-center justify-between">
               <div className="flex items-center gap-2 font-bold text-lg min-w-0">
                  <LayoutGrid size={24} className="text-primary flex-shrink-0" />
                  <span className="truncate">Projects</span>
               </div>

               <CreateItemPopover
                  title="New Project"
                  inputPlaceholder="Project Name"
                  onCreate={handleCreateProject}
                  placement="right"
                  withColorPicker={true}
               >
                  <Button isIconOnly size="sm" variant="flat" color="success">
                     <Plus size={20} />
                  </Button>
               </CreateItemPopover>
            </div>

            <div className="flex-grow overflow-y-auto p-2">
               {/* System Tabs Top */}
               <div className="mb-5">
                  <SidebarItem
                     icon={Inbox}
                     label="Inbox"
                     isActive={activeSystemTab === 'inbox'}
                     onClick={() => {
                        setActiveSystemTab('inbox');
                        setActiveProjectId(null);
                     }}
                  />
                  <SidebarItem
                     icon={Star}
                     label="Today"
                     isActive={activeSystemTab === 'today'}
                     onClick={() => {
                        setActiveSystemTab('today');
                        setActiveProjectId(null);
                     }}
                  />
               </div>

               {/* Personal Projects Section */}
               {personalProjects.length > 0 && (
                  <div className="mb-5  pt-0">
                     {/* <div className="px-2 pb-2 text-xs font-semibold text-default-400 uppercase tracking-wider">
                        Personal
                     </div> */}
                     {personalProjects.map(project => {
                        const sats = satellitesMap[project.id] || {};
                        return (
                           <PersonalProjectItem
                              key={project.id}
                              project={project}
                              isActive={activeProjectId === project.id}
                              onClick={() => {
                                 setActiveProjectId(project.id);
                                 setActiveSystemTab(null);
                                 setProjectScreenMode('tasks');
                                 globalStorage.setItem('active_project_id', project.id);
                              }}
                           >
                              <EditProjectPopover
                                 initialTitle={project.title}
                                 initialColor={project.proj_color}
                                 initialShowDocs={project.show_docs_btn || false}
                                 initialIsHighlighted={project.is_highlighted || false}
                                 onUpdate={(t, c, sd, ih) => handleUpdateProject(project.id, t, c, sd, ih)}
                                 onDelete={() => handleDeleteProject(project.id)}
                              >
                                 <button
                                    type="button"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-default-400 hover:text-primary transition-colors outline-none cursor-pointer opacity-0 group-hover:opacity-100"
                                 >
                                    <EllipsisVertical size={18} />
                                 </button>
                              </EditProjectPopover>
                           </PersonalProjectItem>
                        );
                     })}
                  </div>
               )}

               <div className="px-2 pb-2 text-xs font-semibold text-default-400 uppercase tracking-wider">
                  My Projects
               </div>

               <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                  modifiers={[restrictToVerticalAxis]}
               >
                  <SortableContext
                     items={sidebarProjects.map((p: Project) => p.id)}
                     strategy={verticalListSortingStrategy}
                  >
                     {sidebarProjects.map((project) => {
                        const sats = satellitesMap[project.id] || {};
                        const uiId = sats.ui;
                        const docsId = sats.docs;
                        
                        // Active if self is active OR any satellite is active
                        const isSelfOrSatelliteActive = activeProjectId === project.id || 
                           (uiId && activeProjectId === uiId) || 
                           (docsId && activeProjectId === docsId);
                           
                        const isUiActive = uiId ? activeProjectId === uiId : false;
                        const isDocsActive = docsId ? activeProjectId === docsId : false;
                        
                        return (
                           <SortableProjectItem
                              key={project.id}
                              project={project}
                              isActive={!!isSelfOrSatelliteActive}
                              satelliteId={uiId} // Pass UI Satellite ID
                              docsSatelliteId={docsId} // Pass Docs Satellite ID
                              isUiActive={isUiActive} // Pass UI active state
                              isDocsActive={isDocsActive} // Pass Docs active state
                              onClick={() => {
                                 setActiveProjectId(project.id);
                                 setActiveSystemTab(null);
                                 setProjectScreenMode('tasks'); // Default to tasks
                                 globalStorage.setItem('active_project_id', project.id);
                              }}
                              onDocsClick={() => {
                                 if (docsId) {
                                    setActiveProjectId(docsId);
                                    setActiveSystemTab(null);
                                    setProjectScreenMode('tasks'); // Docs project is a separate project, render it fully
                                    globalStorage.setItem('active_project_id', docsId);
                                 }
                              }}
                              onUiClick={() => {
                                 if (uiId) {
                                    setActiveProjectId(uiId);
                                    setActiveSystemTab(null);
                                    setProjectScreenMode('tasks'); // UI projects likely use task/default view
                                    globalStorage.setItem('active_project_id', uiId);
                                 }
                              }}
                           >
                              <EditProjectPopover
                                 initialTitle={project.title}
                                 initialColor={project.proj_color}
                                 initialShowDocs={project.show_docs_btn || false}
                                 initialIsHighlighted={project.is_highlighted || false}
                                 onUpdate={(t, c, sd, ih) => handleUpdateProject(project.id, t, c, sd, ih)}
                                 onDelete={() => handleDeleteProject(project.id)}
                                 hasUiSatellite={!!uiId}
                                 hasDocsSatellite={!!docsId}
                                 onToggleSatellite={(type: 'ui' | 'docs', enabled: boolean) => handleToggleSatellite(project.id, type, enabled)}
                              >
                                 <button
                                    type="button"
                                    className=" w-8 h-8 flex items-center justify-center text-default-400 hover:text-primary transition-colors outline-none cursor-pointer"
                                 >
                                    <EllipsisVertical size={18} />
                                 </button>
                              </EditProjectPopover>
                           </SortableProjectItem>
                        );
                     })}
                  </SortableContext>
               </DndContext>

               <div className="pt-5">
                  <SidebarItem
                     icon={CheckCircle2}
                     label="Done"
                     isActive={activeSystemTab === 'done'}
                     onClick={() => {
                        setActiveSystemTab('done');
                        setActiveProjectId(null);
                     }}
                  />

                  <SidebarItem
                     icon={FileText}
                     label="Logs"
                     isActive={activeSystemTab === 'logs'}
                     onClick={() => {
                        setActiveSystemTab('logs');
                        setActiveProjectId(null);
                     }}
                  />
               </div>
            </div>
         </aside>

         {/* Main Content */}
         <main className="flex-grow flex flex-col h-full overflow-hidden relative">
            {/* System Screens */}
            <div
               className={clsx(
                  'absolute inset-0 w-full h-full bg-background transition-opacity duration-300',
                  activeSystemTab === 'logs'
                     ? 'z-30 opacity-100 pointer-events-auto'
                     : 'z-0 opacity-0 pointer-events-none'
               )}
            >
               {/* System Screen: Logs */}
               <LogsScreen
                  globalStatus={sidebarStatus}
                  canLoad={canLoadBackground || activeSystemTab === 'logs'}
                  isActive={activeSystemTab === 'logs'}
               />
            </div>

            <div
               className={clsx(
                  'absolute inset-0 w-full h-full bg-background transition-opacity duration-300',
                  activeSystemTab === 'inbox'
                     ? 'z-30 opacity-100 pointer-events-auto'
                     : 'z-0 opacity-0 pointer-events-none'
               )}
            >
               <InboxScreen
                  globalStatus={sidebarStatus}
                  canLoad={canLoadBackground || activeSystemTab === 'inbox'}
                  isActive={activeSystemTab === 'inbox'}
                  onMoveTask={handleMoveTask}
                  onNavigate={handleNavigate}
               />
            </div>

            <div
               className={clsx(
                  'absolute inset-0 w-full h-full bg-background transition-opacity duration-300',
                  activeSystemTab === 'today'
                     ? 'z-30 opacity-100 pointer-events-auto'
                     : 'z-0 opacity-0 pointer-events-none'
               )}
            >
               <TodayScreen
                  globalStatus={sidebarStatus}
                  canLoad={canLoadBackground || activeSystemTab === 'today'}
                  isActive={activeSystemTab === 'today'}
                  onMoveTask={handleMoveTask}
                  onNavigate={handleNavigate}
               />
            </div>

            <div
               className={clsx(
                  'absolute inset-0 w-full h-full bg-background transition-opacity duration-300',
                  activeSystemTab === 'done'
                     ? 'z-30 opacity-100 pointer-events-auto'
                     : 'z-0 opacity-0 pointer-events-none'
               )}
            >
               <DoneScreen
                  globalStatus={sidebarStatus}
                  canLoad={canLoadBackground || activeSystemTab === 'done'}
                  isActive={activeSystemTab === 'done'}
                  onRestoreTask={handleRestoreTaskFromDone}
               />
            </div>

            {projects.map((project) => {
               // If satellite (ui or docs), inherit color from parent
               const isSatellite = (project.proj_type === 'ui' || project.proj_type === 'docs');
               const projectToRender = (isSatellite && project.parent_proj_id && parentColorsMap[project.parent_proj_id])
                  ? { ...project, proj_color: parentColorsMap[project.parent_proj_id] }
                  : project;

               return (
                  <div
                     key={project.id}
                     className={clsx(
                        'absolute inset-0 w-full h-full bg-background transition-opacity duration-300',
                        activeProjectId === project.id
                           ? 'z-10 block'
                           : 'z-0 hidden'
                     )}
                  >
                     <div className={clsx("h-full w-full", projectScreenMode === 'tasks' ? 'block' : 'hidden')}>
                        <ProjectScreen
                           project={projectToRender}
                           isActive={activeProjectId === project.id && projectScreenMode === 'tasks'}
                           canLoad={activeProjectId === project.id || canLoadBackground}
                           onReady={() => handleProjectReady(project.id)}
                           globalStatus={sidebarStatus}
                           onNavigate={handleNavigate}
                           onUpdateProject={(updates) => updateProjectInState(project.id, updates)}
                           onDeleteProject={() => removeProjectFromState(project.id)}
                        />
                     </div>

                     <div className={clsx("h-full w-full", projectScreenMode === 'docs' ? 'block' : 'hidden')}>
                        <DocsScreen 
                           project={projectToRender}
                           isActive={activeProjectId === project.id && projectScreenMode === 'docs'}
                           canLoad={canLoadBackground && !!readyProjects[project.id]} 
                        />
                     </div>
                  </div>
               );
            })}

            {projects.length === 0 && isInit && (
               <div className="flex items-center justify-center h-full text-default-400">
                  No projects found. Create one to get started.
               </div>
            )}
         </main>
      </div>
   );
}

function LoaderOverlay() {
   const { isLoading } = useAppLoader();

   return (
      <div
         className={clsx(
            'fixed inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-[9999] transition-opacity duration-300',
            isLoading ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
         )}
      >
         <Spinner size="lg"  color="primary" />
      </div>
   );
}

export default function MainPage() {
   return (
      <AppLoaderProvider>
         <AppContent />
         <LoaderOverlay />
      </AppLoaderProvider>
   );
}
