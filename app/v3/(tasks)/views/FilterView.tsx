import React, { useState } from 'react';
import { useQuery } from '@powersync/react';
import { ProjectV3 } from '../components/ProjectBar';
import { Header } from '../components/Header';
import { FilterList, FilterItemV3 } from './FilterList';
import { DetailsPanel } from '../components/DetailsPanel';
import { usePanelResize } from '../hooks/usePanelResize';
import { 
    Inbox, 
    Star, 
    Target, 
    CheckCircle2, 
    FileText 
} from 'lucide-react';

interface FilterViewProps {
    filterId: string;
}

const getFilterQuery = (filterId: string) => {
    switch (filterId) {
        case 'filter_inbox':
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
        case 'filter_today':
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
        case 'filter_doing':
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
        case 'filter_done':
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
        case 'filter_logs':
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

const getFilterTitle = (filterId: string) => {
    switch (filterId) {
        case 'filter_inbox': return 'Inbox';
        case 'filter_today': return 'Сегодня';
        case 'filter_doing': return 'В работе (Doing)';
        case 'filter_done': return 'Выполнено';
        case 'filter_logs': return 'Лог';
        default: return 'Filter View';
    }
};

const getFilterIcon = (filterId: string) => {
    switch (filterId) {
        case 'filter_inbox': return <Inbox className="text-blue-500" />;
        case 'filter_today': return <Star className="text-yellow-500" />;
        case 'filter_doing': return <Target className="text-red-500" />;
        case 'filter_done': return <CheckCircle2 className="text-green-500" />;
        case 'filter_logs': return <FileText className="text-gray-500" />;
        default: return undefined;
    }
};

export const FilterView = ({ filterId }: FilterViewProps) => {
    const query = getFilterQuery(filterId);
    const { data: tasksData } = useQuery(query);
    const tasks: FilterItemV3[] = tasksData || [];
    
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

    // Resize Hook (V2 Logic)
    const { width: panelWidth, containerRef, startResizing } = usePanelResize(400);
    const safePanelWidth = isNaN(panelWidth) ? 400 : panelWidth;

    // Handlers (Placeholders)
    const handleToggleTask = (id: string, isCompleted: boolean) => { console.log('Toggle task', id, isCompleted); };

    // Fake Project object for Header
    const filterProject: ProjectV3 = {
        id: filterId,
        title: getFilterTitle(filterId),
        proj_color: '#666',
        icon: getFilterIcon(filterId)
    };

    return (
        <div className="flex flex-col h-full w-full bg-background">
            <Header activeProject={filterProject} />
            
            {/* Split Content Area - No Tabs, No Folders */}
            <div 
                ref={containerRef}
                className="flex-1 flex min-h-0 overflow-hidden relative"
            >
                {/* Left: Task List */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
                    <FilterList 
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
