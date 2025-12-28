'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { scanFlowRefs, CodeRef } from '@/app/docs/scanFlow';
import { Button, Spinner, Card, CardBody, Code } from '@heroui/react';
import { RefreshCw, Code2 } from 'lucide-react';

export default function FlowPage() {
  const [refs, setRefs] = useState<CodeRef[]>([]);
  const [loading, setLoading] = useState(true);

  const loadRefs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await scanFlowRefs();
      setRefs(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRefs();
  }, [loadRefs]);

  const openInEditor = (absolutePath: string, line: number) => {
      const url = `cursor://file/${absolutePath}:${line}`;
      window.open(url, '_self');
  };

  return (
    <div className="h-full flex flex-col font-sans bg-gray-50">
      {/* Header */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm flex-shrink-0">
         <div className="flex items-center gap-3">
            <h1 className="font-bold text-lg text-gray-800">Flow Scanner</h1>
            <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-500">
                Found {refs.length} refs
            </span>
         </div>
         <Button size="sm" color="primary" onPress={loadRefs} isLoading={loading}>
            <RefreshCw size={16} /> Scan Code
         </Button>
      </div>

      {/* Content */}
      <div className="flex-grow w-full p-8 overflow-y-auto min-h-0">
         {loading && (
             <div className="flex justify-center py-20">
                 <Spinner label="Scanning for @ref: tags..." />
             </div>
         )}

         {!loading && (
             <div className="grid gap-4 max-w-4xl mx-auto">
                 {refs.length === 0 && (
                     <div className="text-center py-10 text-gray-400">
                         No tags found. Add <code>// @ref:my_id</code> to your code.
                     </div>
                 )}

                 {refs.map((ref) => (
                     <Card key={`${ref.id}-${ref.fileName}`} shadow="sm" className="w-full">
                         <CardBody className="p-4">
                             <div className="flex justify-between items-start mb-3">
                                 <div>
                                     <div className="flex items-center gap-2">
                                         <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-sm font-mono font-bold">
                                             {ref.id}
                                         </span>
                                         {ref.description && (
                                             <span className="text-gray-700 font-medium">
                                                 {ref.description}
                                             </span>
                                         )}
                                     </div>
                                     <div className="mt-1 text-xs text-gray-400 font-mono">
                                         {ref.fileName}:{ref.lineNumber}
                                     </div>
                                 </div>
                                 <Button 
                                    isIconOnly 
                                    size="sm" 
                                    variant="light" 
                                    onPress={() => openInEditor(ref.absolutePath, ref.lineNumber)}
                                 >
                                     <Code2 size={18} />
                                 </Button>
                             </div>

                             {/* Code Snippet */}
                             <div className="bg-gray-900 rounded p-3 text-xs font-mono overflow-x-auto">
                                 <pre className="text-gray-300">
                                     {ref.snippet}
                                 </pre>
                             </div>
                         </CardBody>
                     </Card>
                 ))}
             </div>
         )}
      </div>
    </div>
  );
}
