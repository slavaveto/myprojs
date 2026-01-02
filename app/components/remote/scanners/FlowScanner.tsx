'use client';

import React, { useState, useEffect } from 'react';
import { Button, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { Network, RefreshCw, AlertTriangle, Workflow } from 'lucide-react';
import { scanFlowRefs, CodeRef } from './scanFlow';
import { clsx } from 'clsx';
import { createLogger } from '@/utils/logger/Logger';

const logger = createLogger('FlowScanner');

interface FlowScannerProps {
    projectLocalPath?: string;
}

export const FlowScanner = ({ projectLocalPath }: FlowScannerProps) => {
    const [refs, setRefs] = useState<CodeRef[]>([]);
    const [scannedPath, setScannedPath] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const [hasScanned, setHasScanned] = useState(false);

    useEffect(() => {
        if (isOpen && !hasScanned) {
            handleScan();
        }
    }, [isOpen]);

    const handleScan = async () => {
        setIsLoading(true);
        try {
            const result = await scanFlowRefs(projectLocalPath);
            setRefs(result.refs);
            setScannedPath(result.scannedPath);
            setHasScanned(true);
            logger.info('Flow scan completed', { count: result.refs.length, path: result.scannedPath });
        } catch (e) {
            logger.error('Flow scan failed', e);
        } finally {
            setIsLoading(false);
        }
    };

    const openInEditor = (absolutePath: string, lineNumber: number) => {
        const url = `cursor://file/${absolutePath}:${lineNumber}`;
        window.open(url, '_self');
    };

    return (
        <Popover placement="bottom-end" isOpen={isOpen} onOpenChange={setIsOpen} shouldFlip>
            <PopoverTrigger>
                <Button 
                    size="sm" 
                    variant="flat" 
                    className="h-9 bg-white hover:bg-blue-50 text-gray-700 hover:text-blue-700 text-xs font-medium px-4 gap-2 border border-gray-200 shadow-sm"
                >
                    <Network size={16} className={clsx(hasScanned && refs.length > 0 ? "text-blue-500" : "text-gray-500")} />
                    <span>Check Flows</span>
                    {hasScanned && refs.length > 0 && (
                        <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full text-[10px] font-bold">
                            {refs.length}
                        </span>
                    )}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[600px] max-h-[600px] flex flex-col shadow-xl border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex flex-col border-b bg-gray-50/80 backdrop-blur shrink-0">
                    <div className="flex items-center justify-between p-3 pb-2 gap-3">
                        <div className="flex flex-col gap-1 flex-grow">
                            <span className="font-semibold text-sm text-gray-900 flex items-center gap-2">
                                <Workflow size={14} className="text-blue-500"/>
                                Flow Refs
                            </span>
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
                    
                    <div className="px-3 pb-2 flex flex-col gap-2">
                        {scannedPath && (
                            <div className="text-[10px] text-gray-400 truncate font-mono bg-gray-100/50 px-1.5 py-0.5 rounded" title={scannedPath}>
                                Path: {scannedPath}
                            </div>
                        )}
                    </div>
                </div>
                
                <div className="overflow-y-auto flex-grow min-h-0 bg-white p-1">
                    {!hasScanned && !isLoading && (
                        <div className="p-8 text-center text-gray-400 text-xs">
                            Click refresh to scan for @ref:ID tags.
                        </div>
                    )}

                    {!isLoading && hasScanned && refs.length === 0 && (
                        <div className="p-8 text-center text-gray-500 text-xs font-medium">
                            No flow references found.
                        </div>
                    )}
                    
                    <div className="flex flex-col gap-1">
                        {refs.map((ref) => (
                            <button
                                key={ref.id + ref.fileName + ref.lineNumber}
                                onClick={() => openInEditor(ref.absolutePath, ref.lineNumber)}
                                className="group flex items-start gap-3 px-3 py-2 hover:bg-blue-50/50 rounded-md transition-colors text-xs text-left w-full border border-transparent hover:border-blue-100"
                            >
                                <div className="mt-1 text-gray-400 group-hover:text-blue-500 flex-shrink-0">
                                    <Workflow size={14} />
                                </div>
                                <div className="flex-grow min-w-0 flex flex-col gap-1">
                                    <div className="flex justify-between items-start gap-2">
                                        <div className="font-mono text-blue-600 font-bold bg-blue-50 px-1.5 py-0.5 rounded text-[11px] border border-blue-100 shrink-0">
                                            {ref.id}
                                        </div>
                                        {ref.description && (
                                            <div className="text-gray-700 font-medium whitespace-normal break-words group-hover:text-gray-900 min-w-0 flex-grow pt-0.5 text-[11px] leading-tight">
                                                {ref.description}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center gap-2">
                                        <div className="text-[10px] text-gray-400 font-mono truncate max-w-full group-hover:text-gray-500" title={ref.fileName}>
                                            {ref.fileName}:{ref.lineNumber}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

