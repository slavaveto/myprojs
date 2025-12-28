'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Input, Chip } from '@heroui/react';
import { Search, Folder as FolderIcon, Inbox, CheckCircle2 } from 'lucide-react';
import { taskService } from '@/app/_services/taskService';
import { createLogger } from '@/utils/logger/Logger';
import { clsx } from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

const logger = createLogger('GlobalSearch');

interface SearchItem {
    id: string;
    content: string;
    is_completed: boolean;
    folder_id: string | null;
    folders?: {
        id: string;
        title: string;
        projects?: {
            id: string;
            title: string;
            color: string;
        };
    };
}

export interface NavigationTarget {
    type: 'project' | 'inbox' | 'today';
    projectId?: string;
    folderId?: string;
    taskId?: string;
}

interface GlobalSearchProps {
    onNavigate: (target: NavigationTarget) => void;
    className?: string;
    currentProjectId?: string;
    currentFolderId?: string;
}

export const GlobalSearch = ({ onNavigate, className, currentProjectId, currentFolderId }: GlobalSearchProps) => {
    const [items, setItems] = useState<SearchItem[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<SearchItem[]>([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Load Index
    useEffect(() => {
        const loadIndex = async () => {
            try {
                const data = await taskService.getAllTasksShort();
                setItems(data as any[]);
            } catch (err) {
                logger.error('Failed to load search index', err);
            }
        };

        // Delay load slightly to prioritize UI render
        const timer = setTimeout(loadIndex, 500);
        return () => clearTimeout(timer);
    }, []);

    // Search Logic
    useEffect(() => {
        if (!searchQuery || searchQuery.trim().length < 2) {
            setSearchResults([]);
            setIsSearchOpen(false);
            return;
        }

        const lowerQuery = searchQuery.toLowerCase();
        const matches = items
            .filter(item => 
                item.content && item.content.toLowerCase().includes(lowerQuery)
            )
            .sort((a, b) => {
                // 1. Completed at bottom
                if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
                
                // 2. Current Folder (Top Priority)
                const aInCurrentFolder = currentFolderId && a.folder_id === currentFolderId;
                const bInCurrentFolder = currentFolderId && b.folder_id === currentFolderId;
                if (aInCurrentFolder !== bInCurrentFolder) return aInCurrentFolder ? -1 : 1;
                
                // 3. Current Project (Second Priority)
                const aInCurrentProject = currentProjectId && a.folders?.projects?.id === currentProjectId;
                const bInCurrentProject = currentProjectId && b.folders?.projects?.id === currentProjectId;
                if (aInCurrentProject !== bInCurrentProject) return aInCurrentProject ? -1 : 1;
                
                // 4. Default Sort (Alphabetical or Date)
                return 0;
            })
            .slice(0, 10);

        setSearchResults(matches);
        setIsSearchOpen(matches.length > 0);
    }, [searchQuery, items, currentProjectId, currentFolderId]);

    // Click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsSearchOpen(false);
                setSearchQuery(''); // Auto-clear on blur/click outside
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (item: SearchItem) => {
        setIsSearchOpen(false);
        setSearchQuery('');

        const projectId = item.folders?.projects?.id;
        const folderId = item.folders?.id; // If null/undefined -> Inbox (assuming folder_id is null)

        if (!folderId) {
            // Inbox Task
            onNavigate({
                type: 'inbox',
                taskId: item.id
            });
        } else if (projectId && folderId) {
            // Project Task
            onNavigate({
                type: 'project',
                projectId,
                folderId,
                taskId: item.id
            });
        }
    };

    const getHighlightedText = (text: string, highlight: string) => {
        if (!text) return null;
        if (!highlight.trim()) return <span>{text}</span>;

        const escapedHighlight = highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const parts = text.split(new RegExp(`(${escapedHighlight})`, 'gi'));
        return (
            <span>
                {parts.map((part, i) =>
                    part.toLowerCase() === highlight.toLowerCase() ? (
                        <span
                            key={i}
                            className="bg-yellow-200 dark:bg-yellow-800 text-foreground font-semibold rounded-[2px]"
                        >
                            {part}
                        </span>
                    ) : (
                        <span key={i}>{part}</span>
                    )
                )}
            </span>
        );
    };


    return (
        <div className={clsx("relative w-full max-w-[240px]", className)} ref={searchRef}>
            <Input
                placeholder="Search..."
                startContent={<Search className="text-default-400" size={16} />}
                value={searchQuery}
                onValueChange={setSearchQuery}
                size="sm"
                isClearable
                onClear={() => setSearchQuery('')}
                classNames={{
                    inputWrapper: 'bg-default-100 h-8 min-h-8',
                    input: 'text-small',
                    clearButton: "text-default-400 -mr-[10px]"
                }}
            />

            <AnimatePresence>
                {isSearchOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -10, scale: 0.98 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="absolute top-full left-1/2 -translate-x-1/2 mt-3 bg-content1 rounded-medium shadow-large border border-default-200 z-50 overflow-hidden max-h-[400px] overflow-y-auto w-[600px]"
                    >
                        {searchResults.map((item, index) => (
                            <motion.button
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.03, duration: 0.2 }}
                                key={item.id}
                                className={clsx(
                                    "w-full text-left px-3 py-2 hover:bg-default-100 transition-colors border-b border-default-100 last:border-0 flex flex-col gap-0.5",
                                    item.is_completed && "opacity-60"
                                )}
                                onClick={() => handleSelect(item)}
                            >
                            {/* Path / Context */}
                            <div className="flex items-center gap-2 text-sm text-default-700 mb-1">
                                {item.folders?.projects ? (
                                    <>
                                        <div 
                                            className="w-2.5 h-2.5 rounded-full flex-shrink-0 shadow-sm border border-white/10" 
                                            style={{ backgroundColor: item.folders.projects.color || '#3b82f6' }}
                                        />
                                        <span className="">{item.folders.projects.title}</span>
                                        <span className="opacity-40">/</span>
                                        <FolderIcon size={14} className="opacity-60" />
                                        <span className="opacity-80">{item.folders.title}</span>
                                    </>
                                    ) : (
                                        <>
                                            <Inbox size={10} className="text-primary" />
                                            <span>Inbox</span>
                                        </>
                                    )}
                                    
                                    {item.is_completed && (
                                        <span className="ml-auto text-success flex items-center gap-1">
                                            <CheckCircle2 size={10} />
                                            Done
                                        </span>
                                    )}
                                </div>

                                {/* Content */}
                                <div className={clsx(
                                    "text-sm font-medium w-full text-foreground truncate",
                                    item.is_completed && "line-through text-default-400"
                                )}>
                                    {getHighlightedText(item.content, searchQuery)}
                                </div>
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

