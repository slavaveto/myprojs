'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { scanFlowRefs, CodeRef } from '@/app/docs/scanFlow';
import { Button, Spinner, Tooltip, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { RefreshCw, Code2, FileCode, ChevronRight } from 'lucide-react';
import { clsx } from 'clsx';

interface FlowPageProps {
    projectLocalPath?: string;
}

export default function FlowPage({ projectLocalPath }: FlowPageProps) {
  const [refs, setRefs] = useState<CodeRef[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  const openInEditor = (absolutePath: string, line: number) => {
      const url = `cursor://file/${absolutePath}:${line}`;
      window.open(url, '_self');
  };

  return (
    <div className="h-full flex flex-col font-sans bg-white">
      {/* Header */}
      <div className="h-12 border-b flex items-center justify-between px-4 sticky top-0 z-20 bg-white flex-shrink-0">
         <div className="flex items-center gap-2">
            <h1 className="font-bold text-sm text-gray-800">Code References</h1>
            <span className="text-[10px] bg-gray-100 px-1.5 py-0.5 rounded text-gray-500 font-mono">
                {refs.length}
            </span>
         </div>
         <Button size="sm" variant="light" color="primary" onPress={loadRefs} isLoading={loading} className="min-w-0 h-8 px-2">
            <RefreshCw size={14} />
         </Button>
      </div>

      {/* Content */}
      <div className="flex-grow w-full overflow-y-auto min-h-0">
         {loading && (
             <div className="flex justify-center py-10">
                 <Spinner size="sm" />
             </div>
         )}

         {!loading && (
             <div className="divide-y divide-gray-100">
                 {refs.length === 0 && (
                     <div className="text-center py-10 text-xs text-gray-400">
                         No tags found. Add <code>// @ref:my_id</code>
                     </div>
                 )}

                 {refs.map((ref) => (
                     <div key={`${ref.id}-${ref.fileName}`} className="group flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition-colors text-sm">
                         {/* ID Badge */}
                         <div className="flex-shrink-0">
                             <span className="bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold select-all">
                                 {ref.id}
                             </span>
                         </div>

                         {/* Main Info */}
                         <div className="flex-grow min-w-0 flex items-center gap-2">
                             {ref.description ? (
                                 <span className="font-medium text-gray-700 truncate" title={ref.description}>
                                     {ref.description}
                                 </span>
                             ) : (
                                 <span className="text-gray-400 italic text-xs">No description</span>
                             )}
                             
                             <span className="text-gray-300 mx-1">|</span>
                             
                             <div className="flex items-center gap-1 text-gray-400 text-xs font-mono truncate" title={ref.fileName}>
                                 <FileCode size={10} />
                                 <span className="truncate">{ref.fileName.split('/').pop()}:{ref.lineNumber}</span>
                             </div>
                         </div>

                         {/* Actions */}
                         <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                             {/* Code Preview Popover */}
                             <Popover placement="left">
                                 <PopoverTrigger>
                                     <button className="p-1 text-gray-400 hover:text-gray-600 rounded">
                                         <ChevronRight size={14} />
                                     </button>
                                 </PopoverTrigger>
                                 <PopoverContent className="p-0 border border-gray-700 rounded overflow-hidden shadow-xl">
                                     <div className="bg-gray-900 p-3 text-[10px] font-mono text-gray-300 max-w-[400px] overflow-x-auto">
                                         <pre>{ref.snippet}</pre>
                                     </div>
                                 </PopoverContent>
                             </Popover>

                             {/* Open in Editor */}
                             <button 
                                onClick={() => openInEditor(ref.absolutePath, ref.lineNumber)}
                                className="p-1 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded"
                                title="Open in Cursor"
                             >
                                 <Code2 size={14} />
                             </button>
                         </div>
                     </div>
                 ))}
             </div>
         )}
      </div>
    </div>
  );
}
