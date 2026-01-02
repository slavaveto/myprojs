'use client';

import React, { useState, useEffect } from 'react';
import { Button, Popover, PopoverTrigger, PopoverContent, Input } from '@heroui/react';
import { FileWarning, RefreshCw, AlertTriangle, FileCode } from 'lucide-react';
import { OverloadFile, scanOverloadedFiles } from './scanOverload';
import { clsx } from 'clsx';
import { createLogger } from '@/utils/logger/Logger';
import { globalStorage } from '@/utils/storage';

const logger = createLogger('OverloadScanner');

interface OverloadScannerProps {
    projectLocalPath?: string;
}

export const OverloadScanner = ({ projectLocalPath }: OverloadScannerProps) => {
    const [files, setFiles] = useState<OverloadFile[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [hasScanned, setHasScanned] = useState(false);
    const [threshold, setThreshold] = useState<number>(500);

    // Initialize threshold from storage on mount
    useEffect(() => {
        const stored = globalStorage.getItem('overload_threshold');
        if (stored) {
            const parsed = parseInt(stored, 10);
            if (!isNaN(parsed) && parsed > 0) {
                setThreshold(parsed);
            }
        }
    }, []);

    const handleThresholdChange = (val: string) => {
        const num = parseInt(val, 10);
        if (!isNaN(num) && num > 0) {
            setThreshold(num);
            globalStorage.setItem('overload_threshold', num.toString());
        }
    };

    useEffect(() => {
        if (isOpen) {
            handleScan();
        }
    }, [isOpen]);

    const handleScan = async () => {
        setIsLoading(true);
        try {
            const result = await scanOverloadedFiles(projectLocalPath, threshold);
            setFiles(result);
            setHasScanned(true);
            logger.info('Overload scan completed', { count: result.length, threshold });
        } catch (e) {
            logger.error('Overload scan failed', e);
        } finally {
            setIsLoading(false);
        }
    };

    const openInEditor = (absolutePath: string) => {
        const url = `cursor://file/${absolutePath}`;
        window.open(url, '_self');
    };

    return (
        <Popover placement="bottom-end" isOpen={isOpen} onOpenChange={setIsOpen} shouldFlip>
            <PopoverTrigger>
                <Button 
                    size="sm" 
                    variant="flat" 
                    className="h-9 bg-white hover:bg-orange-50 text-gray-700 hover:text-orange-700 text-xs font-medium px-4 gap-2 border border-gray-200 shadow-sm"
                >
                    <FileWarning size={16} className={clsx(hasScanned && files.length > 0 ? "text-orange-500" : "text-gray-500")} />
                    <span>Check Overload</span>
                    {hasScanned && files.length > 0 && (
                        <span className="bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                            {files.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[420px] max-h-[500px] flex flex-col shadow-xl border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b bg-gray-50/80 backdrop-blur gap-3">
                    <div className="flex flex-col gap-1 flex-grow">
                        <span className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                            <AlertTriangle size={14} className="text-orange-500"/>
                            Overloaded Files
                        </span>
                        <div className="flex items-center gap-2 text-[10px] uppercase font-bold tracking-wider text-gray-500 w-full">
                           <span className="flex-shrink-0">Threshold:</span>
                           <input 
                                type="number" 
                                className="w-12 h-6 text-[11px] border rounded px-1 text-center bg-gray-50 text-gray-800 focus:border-orange-500 focus:ring-1 focus:ring-orange-200 outline-none transition-all flex-shrink-0"
                                value={threshold}
                                onChange={(e) => handleThresholdChange(e.target.value)}
                                min="10"
                           />
                           <span className="flex-shrink-0">lines</span>
                           {hasScanned && (
                               <span className="ml-auto text-orange-600 truncate flex-shrink-1 text-right min-w-0">Found: {files.length}</span>
                           )}
                        </div>
                    </div>
                    <Button 
                        size="sm" 
                        isIconOnly 
                        variant="light" 
                        onPress={handleScan} 
                        isLoading={isLoading} 
                        className="text-gray-500 hover:text-gray-900"
                    >
                        <RefreshCw size={14} />
                    </Button>
                </div>
                
                <div className="overflow-y-auto flex-grow min-h-0 bg-white p-1">
                    {!hasScanned && !isLoading && (
                        <div className="p-8 text-center text-gray-400 text-xs">
                            Click refresh to scan files &gt; {threshold} lines.
                        </div>
                    )}

                    {!isLoading && hasScanned && files.length === 0 && (
                        <div className="p-8 text-center text-green-600 text-xs font-medium">
                            No files larger than {threshold} lines found.
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-1">
                        {files.map((file) => (
                            <button
                                key={file.absolutePath}
                                onClick={() => openInEditor(file.absolutePath)}
                                className="group flex items-center gap-3 px-3 py-2 hover:bg-orange-50/50 rounded-md transition-colors text-xs text-left w-full border border-transparent hover:border-orange-100"
                            >
                                <div className="mt-0.5 text-gray-400 group-hover:text-orange-500">
                                    <FileCode size={14} />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <div className="font-mono text-gray-700 font-medium truncate mb-0.5 group-hover:text-gray-900 text-[11px]" title={file.fileName}>
                                        {file.fileName}
                                    </div>
                                </div>
                                <div className="text-orange-600 font-mono font-bold bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 group-hover:bg-orange-100 text-[10px]">
                                    {file.lineCount}
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};
