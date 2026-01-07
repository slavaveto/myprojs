import React from 'react';
import { clsx } from 'clsx';
import { Plus } from 'lucide-react';
import { Folder } from '@/app/types';

interface FolderTabsProps {
    folders: Folder[];
    activeFolderId: string | null;
    onSelectFolder: (id: string) => void;
    onCreateFolder?: () => void;
}

export const FolderTabs = ({ 
    folders, 
    activeFolderId, 
    onSelectFolder,
    onCreateFolder 
}: FolderTabsProps) => {
    
    // Auto-scroll logic could be added here later if needed

    return (
        <div className="px-6 py-2 bg-background/50 flex-none z-10 border-b border-transparent backdrop-blur-sm sticky top-0">
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
                {folders.map(folder => (
                    <button 
                        key={folder.id} 
                        onClick={() => onSelectFolder(folder.id)}
                        className={clsx(
                            "relative flex items-center px-4 py-1.5 rounded-full cursor-pointer text-sm font-medium transition-all select-none border whitespace-nowrap",
                            activeFolderId === folder.id
                                ? "bg-default-100 text-default-900 border-default-200 shadow-sm" 
                                : "bg-transparent text-default-500 border-transparent hover:bg-default-50 hover:text-default-700"
                        )}
                    >
                        {folder.title}
                        {/* Count badge could be added here if we join with tasks count */}
                    </button>
                ))}
                
                {/* Add Folder Button */}
                <button 
                    onClick={onCreateFolder}
                    className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center text-default-400 hover:bg-default-100 transition-colors ml-1"
                    title="Add Folder"
                >
                    <Plus size={16} />
                </button>
            </div>
        </div>
    );
};

