'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { scanFlowRefs, CodeRef } from '@/app/docs/scanFlow';
import { Button, Spinner, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { RefreshCw, Code2, FileCode, ChevronRight, ScanSearch } from 'lucide-react';

interface FlowPageProps {
    projectLocalPath?: string;
}

export default function FlowPage({ projectLocalPath }: FlowPageProps) {
  const [refs, setRefs] = useState<CodeRef[]>([]);
  const [loading, setLoading] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);

  const loadRefs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await scanFlowRefs(projectLocalPath);
      setRefs(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [projectLocalPath]);

  // Load refs only when popover is opened
  useEffect(() => {
      if (isScanOpen && refs.length === 0) {
          loadRefs();
      }
  }, [isScanOpen, refs.length, loadRefs]);

  const openInEditor = (absolutePath: string, line: number) => {
      const url = `cursor://file/${absolutePath}:${line}`;
      window.open(url, '_self');
  };

  return (
    <div className="h-full flex flex-col font-sans bg-white">
      {/* Header */}
      <div className="h-12 border-b flex items-center justify-between px-4 sticky top-0 z-20 bg-white flex-shrink-0">
         <h1 className="font-bold text-gray-800">Documentation</h1>
         
         {/* Scan Button with Popover */}
         <Popover placement="bottom-end" isOpen={isScanOpen} onOpenChange={setIsScanOpen} shouldFlip>
            <PopoverTrigger>
                <Button size="sm" variant="flat" color="primary" startContent={<ScanSearch size={16} />}>
                    Scan Code
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[400px] max-h-[500px] overflow-hidden flex flex-col">
                <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                    <span className="font-bold text-sm text-gray-700">Found References ({refs.length})</span>
                    <Button size="sm" isIconOnly variant="light" onPress={loadRefs} isLoading={loading}>
                        <RefreshCw size={14} />
                    </Button>
                </div>
                
                <div className="overflow-y-auto flex-grow min-h-0">
                    {loading && (
                        <div className="flex justify-center py-10">
                            <Spinner size="sm" />
                        </div>
                    )}

                    {!loading && (
                        <div className="divide-y divide-gray-100">
                             {refs.length === 0 && (
                                 <div className="text-center py-10 text-xs text-gray-400 px-4">
                                     No tags found. Add <code>// @ref:my_id</code> in your code.
                                 </div>
                             )}
                             {refs.map((ref) => (
                                 <div key={`${ref.id}-${ref.fileName}`} className="group flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors text-xs">
                                     <span className="bg-blue-50 text-blue-600 border border-blue-100 px-1 py-0.5 rounded text-[10px] font-mono font-bold flex-shrink-0">
                                         {ref.id}
                                     </span>
                                     
                                     <div className="flex-grow min-w-0">
                                         <div className="font-medium text-gray-700 truncate" title={ref.description}>
                                             {ref.description || <span className="italic text-gray-400">No description</span>}
                                         </div>
                                         <div className="flex items-center gap-1 text-gray-400 text-[10px] font-mono mt-0.5 truncate" title={ref.fileName}>
                                             <FileCode size={8} />
                                             <span className="truncate">{ref.fileName.split('/').pop()}:{ref.lineNumber}</span>
                                         </div>
                                     </div>

                                     <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                          <Popover placement="left">
                                             <PopoverTrigger>
                                                 <button className="p-1 text-gray-400 hover:text-gray-600 rounded"><ChevronRight size={12} /></button>
                                             </PopoverTrigger>
                                             <PopoverContent className="p-0 border border-gray-700 rounded overflow-hidden shadow-xl">
                                                 <div className="bg-gray-900 p-2 text-[10px] font-mono text-gray-300 max-w-[300px] overflow-x-auto">
                                                     <pre>{ref.snippet}</pre>
                                                 </div>
                                             </PopoverContent>
                                          </Popover>
                                         <button onClick={() => openInEditor(ref.absolutePath, ref.lineNumber)} className="p-1 text-blue-500 hover:text-blue-700 rounded">
                                             <Code2 size={12} />
                                         </button>
                                     </div>
                                 </div>
                             ))}
                        </div>
                    )}
                </div>
            </PopoverContent>
         </Popover>
      </div>

      {/* Main Layout */}
      <div className="flex-grow flex min-h-0">
         {/* Left Sidebar: Flow List */}
         <div className="w-64 border-r bg-gray-50 flex flex-col p-4">
            <h3 className="text-xs font-bold text-gray-500 uppercase mb-3">Flows</h3>
            <div className="text-sm text-gray-400 italic text-center py-4 border-2 border-dashed rounded-lg">
                No flows yet
            </div>
         </div>

         {/* Right Content: Flow Details */}
         <div className="flex-grow bg-white p-8 flex items-center justify-center text-gray-300">
             Select a flow to view details
         </div>
      </div>
    </div>
  );
}
