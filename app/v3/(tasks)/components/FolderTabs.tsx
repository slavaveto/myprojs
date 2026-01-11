import React, { useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import { Button } from '@heroui/react';

// Minimal Folder type for V3
export interface FolderV3 {
    id: string;
    title: string;
    project_id: string;
    sort_order?: number;
}

interface FolderTabsProps {
    folders: FolderV3[];
    activeFolderId: string | null;
    onSelectFolder: (id: string) => void;
    onCreateFolder?: () => void; // Пока опционально
}

export const FolderTabs = ({
    folders,
    activeFolderId,
    onSelectFolder,
    onCreateFolder
}: FolderTabsProps) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to active folder (basic implementation)
    useEffect(() => {
        if (activeFolderId && scrollContainerRef.current) {
            const activeElement = scrollContainerRef.current.querySelector(`[data-folder-id="${activeFolderId}"]`);
            if (activeElement) {
                activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
            }
        }
    }, [activeFolderId]);

    return (
        <div className="flex-none px-6 pb-0 pt-2 border-b border-default-200 bg-background z-10">
            <div className="flex items-center gap-2 overflow-hidden">
                
                {/* Scrollable Tabs Area */}
                <div 
                    ref={scrollContainerRef}
                    className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar mask-gradient-right pb-[1px]" // pb-1px hides border overlap
                >
                    {folders.map(folder => {
                        const isActive = activeFolderId === folder.id;
                        
                        return (
                            <button
                                key={folder.id}
                                data-folder-id={folder.id}
                                onClick={() => onSelectFolder(folder.id)}
                                className={clsx(
                                    "relative flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors whitespace-nowrap rounded-t-lg select-none",
                                    isActive 
                                        ? "text-primary bg-content2 border-b-2 border-primary" 
                                        : "text-default-500 hover:text-default-700 hover:bg-default-100 border-b-2 border-transparent"
                                )}
                            >
                                <span className="max-w-[150px] truncate">{folder.title}</span>
                                {/* Counter placeholder if needed */}
                                {/* <span className="text-xs opacity-50 ml-1">0</span> */}
                            </button>
                        );
                    })}

                    {folders.length === 0 && (
                        <div className="text-sm text-default-400 px-2 italic">
                            No folders
                        </div>
                    )}
                </div>

                {/* Add Folder Button (Fixed right) */}
                <Button
                    isIconOnly
                    size="sm"
                    variant="light"
                    className="flex-shrink-0 text-default-400 hover:text-primary mb-[1px]"
                    onClick={onCreateFolder}
                >
                    <Plus size={18} />
                </Button>
            </div>
        </div>
    );
};

