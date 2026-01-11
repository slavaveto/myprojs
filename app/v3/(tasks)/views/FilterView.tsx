import React, { useState } from 'react';
import { useQuery } from '@powersync/react';
import { ProjectV3 } from '../components/ProjectBar';
import { Header } from '../components/Header';
import { FilterList, FilterItemV3 } from '../filters/FilterList';
import { FilterDetails } from '../filters/FilterDetails';
import { LogsList, LogV3 } from '../components/LogsList';
import { LogDetails } from '../components/LogDetails';
import { usePanelResize } from '../hooks/usePanelResize';
import { 
    Inbox, 
    Star, 
    Target, 
    CheckCircle2, 
    FileText 
} from 'lucide-react';

import { clsx } from 'clsx';

import { createLogger } from '@/utils/logger/Logger';
const logger = createLogger('FilterView');

interface FilterViewProps {
    filterId: string;
    isActive: boolean;
}

const getFilterQuery = (filterId: string) => {
    switch (filterId) {
        case 'filter_inbox':
            return `
                SELECT t.*, NULL as project_title, NULL as proj_color 
                FROM tasks t 
                WHERE (t.folder_id IS NULL OR t.folder_id = '' OR t.folder_id = 'inbox')
                AND (t.is_completed = 0 OR t.is_completed IS NULL)
                AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
                ORDER BY t.sort_order
            `;
        case 'filter_today':
            return `
                SELECT t.*, p.title as project_title, p.proj_color 
                FROM tasks t 
                LEFT JOIN folders f ON t.folder_id = f.id
                LEFT JOIN projects p ON f.project_id = p.id 
                WHERE t.is_today = 1
                AND (t.is_completed = 0 OR t.is_completed IS NULL)
                AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
                ORDER BY t.sort_order
            `;
        case 'filter_doing':
            return `
                SELECT t.*, p.title as project_title, p.proj_color 
                FROM tasks t 
                LEFT JOIN folders f ON t.folder_id = f.id
                LEFT JOIN projects p ON f.project_id = p.id 
                WHERE t.status = 'doing'
                AND (t.is_completed = 0 OR t.is_completed IS NULL)
                AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
                ORDER BY t.sort_order
            `;
        case 'filter_done':
             return `
                SELECT t.*, p.title as project_title, p.proj_color 
                FROM tasks t 
                LEFT JOIN folders f ON t.folder_id = f.id
                LEFT JOIN projects p ON f.project_id = p.id 
                WHERE t.is_completed = 1 
                AND (t.is_deleted = 0 OR t.is_deleted IS NULL)
                ORDER BY t.updated_at DESC
                LIMIT 100
            `;
        case 'filter_logs':
             return `SELECT * FROM logs ORDER BY created_at DESC LIMIT 100`;
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

export const FilterViewComponent = ({ filterId, isActive }: FilterViewProps) => {
    const query = getFilterQuery(filterId);
    const { data: queryData } = useQuery(query);
    
    // Cast data based on filter type
    const isLogs = filterId === 'filter_logs';
    const tasks: FilterItemV3[] = isLogs ? [] : (queryData || []);
    const logs: LogV3[] = isLogs ? (queryData || []) : [];
    
    const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
    const [selectedLogId, setSelectedLogId] = useState<string | null>(null);

    // Resize Hook (V2 Logic)
    const { width: panelWidth, containerRef, startResizing } = usePanelResize(400);
    const safePanelWidth = isNaN(panelWidth) ? 400 : panelWidth;

    // Handlers (Placeholders)
    const handleToggleTask = (id: string, isCompleted: boolean) => { logger.info('Toggle task', { id, isCompleted }); };

    return (
        <div className={clsx("flex flex-col h-full w-full bg-background", !isActive && "hidden")}>
            
            {/* Split Content Area - No Tabs, No Folders */}
            <div 
                ref={containerRef}
                className="flex-1 flex min-h-0 overflow-hidden relative"
            >
                {/* Left: Content (Tasks or Logs) */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 bg-background">
                    {isLogs ? (
                        <LogsList 
                            logs={logs} 
                            selectedLogId={selectedLogId}
                            onSelectLog={setSelectedLogId}
                        />
                    ) : (
                        <FilterList 
                            tasks={tasks} 
                            selectedTaskId={selectedTaskId}
                            onSelectTask={setSelectedTaskId}
                            onToggleTask={handleToggleTask}
                        />
                    )}
                </div>

                {/* Resize Handle (V2 Exact Copy) */}
                <div
                    className="w-[1px] relative z-30 cursor-col-resize group select-none"
                    onMouseDown={startResizing}
                >
                    <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-[1px] bg-default-200 group-hover:w-[3px] group-hover:bg-primary transition-all duration-300 delay-200 ease-out" />
                    <div className="absolute inset-y-0 -left-1 -right-1 z-10 bg-transparent" />
                </div>

                {/* Right: Task Details or Log Details */}
                <div 
                    style={{ width: safePanelWidth }}
                    className="flex-shrink-0 bg-content2/50 overflow-y-auto z-10"
                >
                    {isLogs ? (
                        <LogDetails logId={selectedLogId} />
                    ) : (
                        <FilterDetails taskId={selectedTaskId} />
                    )}
                </div>
            </div>
        </div>
    );
};

export const FilterView = React.memo(FilterViewComponent, (prev, next) => {
    // Only re-render if visibility changes
    if (prev.isActive !== next.isActive) return false;
    // If hidden, don't re-render on data changes (optional optimization)
    if (!next.isActive) return true;
    return prev.filterId === next.filterId;
});
