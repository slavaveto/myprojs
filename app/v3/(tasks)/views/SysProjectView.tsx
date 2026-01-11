import React, { useState } from 'react';
import { useQuery } from '@powersync/react';
import { ProjectV3 } from '../components/ProjectBar';
import { Header } from '../components/Header';
import { SysTaskList, SysTaskV3 } from '../components/SysTaskList';
import { DetailsPanel } from '../components/DetailsPanel';
import { usePanelResize } from '../hooks/usePanelResize';
import { 
    Inbox, 
    Star, 
    Target, 
    CheckCircle2, 
    FileText 
} from 'lucide-react';

interface SysProjectViewProps {
    systemId: string;
}

const getSystemQuery = (systemId: string) => {
    switch (systemId) {
        case 'sys_inbox':
            // Inbox: Tasks in 'Inbox' project, not completed
            return `
                SELECT t.*, p.title as project_title, p.proj_color 
                FROM tasks t 
                LEFT JOIN projects p ON t.project_id = p.id 
                WHERE p.title = 'Inbox' 
                AND (t.is_completed = 0 OR t.is_completed IS NULL)
                AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
                ORDER BY t.sort_order
            `;
        case 'sys_today':
            // Today: Due date is today, not completed
            return `
                SELECT t.*, p.title as project_title, p.proj_color 
                FROM tasks t 
                LEFT JOIN projects p ON t.project_id = p.id 
                WHERE date(t.due_date) = date('now') 
                AND (t.is_completed = 0 OR t.is_completed IS NULL)
                AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
                ORDER BY t.sort_order
            `;
        case 'sys_doing':
            // Doing Now: Status is 'doing'
            return `
                SELECT t.*, p.title as project_title, p.proj_color 
                FROM tasks t 
                LEFT JOIN projects p ON t.project_id = p.id 
                WHERE t.status = 'doing'
                AND (t.is_completed = 0 OR t.is_completed IS NULL)
                AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
                ORDER BY t.sort_order
            `;
        case 'sys_done':
            // Done: Completed tasks
            return `
                SELECT t.*, p.title as project_title, p.proj_color 
                FROM tasks t 
                LEFT JOIN projects p ON t.project_id = p.id 
                WHERE t.is_completed = 1 
                AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
                ORDER BY t.completed_at DESC, t.updated_at DESC
                LIMIT 100
            `;
        case 'sys_logs':
            // Logs
             return `
                SELECT t.*, p.title as project_title, p.proj_color 
                FROM tasks t 
                LEFT JOIN projects p ON t.project_id = p.id 
                WHERE t.is_completed = 1 
                AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
                ORDER BY t.completed_at DESC
                LIMIT 200
            `;
        default:
            return '';
    }
};

const getSystemTitle = (systemId: string) => {
    switch (systemId) {
        case 'sys_inbox': return 'Inbox';
        case 'sys_today': return 'Сегодня';
        case 'sys_doing': return 'В работе (Doing)';
        case 'sys_done': return 'Выполнено';
        case 'sys_logs': return 'Лог';
        default: return 'System View';
    }
};

const getSystemIcon = (systemId: string) => {
    switch (systemId) {
        case 'sys_inbox': return <Inbox className="text-blue-500" />;
        case 'sys_today': return <Star className="text-yellow-500" />;
        case 'sys_doing': return <Target className="text-red-500" />;
        case 'sys_done': return <CheckCircle2 className="text-green-500" />;
        case 'sys_logs': return <FileText className="text-gray-500" />;
        default: return undefined;
    }
};

export const SysProjectView = ({ systemId }: SysProjectViewProps) => {
    const query = getSystemQuery(systemId);
    const { data: tasksData } = useQuery(query);
    const tasks: SysTaskV3[] = tasksData || [];
    
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Resize Hook (V2 Logic)
    const { width: panelWidth, containerRef, startResizing } = usePanelResize(400);
    const safePanelWidth = isNaN(panelWidth) ? 400 : panelWidth;

    // Handlers (Placeholders)
    const handleToggleTask = (id: string, isCompleted: boolean) => { console.log('Toggle task', id, isCompleted); };

    // Fake Project object for Header
    const sysProject: ProjectV3 = {
        id: systemId,
        title: getSystemTitle(systemId),
        proj_color: '#666',
        icon: getSystemIcon(systemId)
    };

    return (
        <div className="flex flex-col h-full w-full bg-background">
            <Header activeProject={sysProject} />
            
            {/* Split Content Area - No Tabs, No Folders */}
            <div 
                ref={containerRef}
                className="flex-1 flex min-h-0 overflow-hidden relative"
            >
                {/* Left: Task List */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
                    <SysTaskList 
                        tasks={tasks} 
                        selectedTaskId={selectedTaskId}
                        onSelectTask={setSelectedTaskId}
                        onToggleTask={handleToggleTask}
                    />
                </div>

                {/* Resize Handle (V2 Exact Copy) */}
                <div
                    className="w-[1px] relative z-30 cursor-col-resize group select-none"
                    onMouseDown={startResizing}
                >
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-default-200 group-hover:w-[3px] group-hover:bg-primary transition-all duration-300 delay-200 ease-out" />
                    <div className="absolute inset-y-0 -left-1 -right-1 z-10 bg-transparent" />
                </div>

                {/* Right: Details Panel */}
                <div 
                    style={{ width: safePanelWidth }}
                    className="flex-shrink-0 bg-content2/50 overflow-y-auto z-10"
                >
                    <DetailsPanel taskId={selectedTaskId} />
                </div>
            </div>
        </div>
    );
};
