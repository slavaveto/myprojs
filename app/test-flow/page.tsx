'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { scanFlow, FlowGraph } from '@/app/actions/scanFlow';
import { Button, Spinner, Card, CardBody } from '@heroui/react';
import { ArrowDown, Code2, Layout } from 'lucide-react';

export default function FlowPage() {
  const [data, setData] = useState<FlowGraph | null>(null);
  const [loading, setLoading] = useState(true);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const result = await scanFlow();
      setData(result);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  const openInEditor = (absolutePath: string, line: number) => {
      // Use the absolute path provided by the server
      // Format: cursor://file/ABSOLUTE_PATH:LINE
      const url = `cursor://file/${absolutePath}:${line}`;
      window.open(url, '_self');
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      <div className="h-16 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm">
         <div className="flex items-center gap-3">
            <Layout className="text-primary" />
            <h1 className="font-bold text-xl text-gray-800">System Story Map</h1>
         </div>
         <Button size="sm" color="primary" onPress={loadGraph} isLoading={loading}>
            Refresh
         </Button>
      </div>

      <div className="flex-grow max-w-3xl mx-auto w-full p-8">
         {loading && (
             <div className="flex justify-center py-20">
                 <Spinner label="Scanning Codebase..." />
             </div>
         )}

         {!loading && data && (
             <div className="flex flex-col relative">
                 {/* Timeline Line */}
                 <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-200 z-0"></div>

                 {data.nodes.length === 0 && (
                     <div className="text-center py-10 text-gray-400">
                         No @FlowStep markers found in code.
                     </div>
                 )}

                 {data.nodes.map((step, index) => {
                     const isLast = index === data.nodes.length - 1;
                     
                     return (
                         <div key={step.id} className="relative z-10 mb-6 group">
                             <div className="flex gap-6">
                                 {/* Index Circle */}
                                 <div className="flex-shrink-0 w-12 flex justify-center pt-2">
                                     <div className="w-8 h-8 rounded-full bg-blue-500 text-white font-bold flex items-center justify-center shadow-md border-4 border-gray-50 z-10">
                                         {step.data.order < 999 ? step.data.order : index + 1}
                                     </div>
                                 </div>

                                 {/* Card */}
                                 <div className="flex-grow">
                                     <Card shadow="sm" className="w-full hover:shadow-md transition-all border-l-4 border-blue-500">
                                         <CardBody className="p-4">
                                             <div className="flex justify-between items-start">
                                                 <div>
                                                     <h3 className="text-lg font-bold text-gray-900">{step.data.label}</h3>
                                                     {step.data.subtitle && (
                                                         <p className="text-gray-500 text-sm mt-1">{step.data.subtitle}</p>
                                                     )}
                                                 </div>
                                                 
                                                 <Button 
                                                    isIconOnly 
                                                    size="sm" 
                                                    variant="light" 
                                                    className="opacity-50 hover:opacity-100"
                                                    onPress={() => openInEditor(step.data.absolutePath, step.data.lineNumber)}
                                                    title={`Open ${step.data.fileName}:${step.data.lineNumber}`}
                                                 >
                                                     <Code2 size={18} />
                                                 </Button>
                                             </div>

                                             <div className="mt-3 pt-2 border-t border-gray-100 flex items-center gap-2 text-[10px] text-gray-400 font-mono">
                                                 <span className="truncate max-w-[300px]">{step.data.fileName}</span>
                                                 <span>:</span>
                                                 <span className="text-blue-500">{step.data.lineNumber}</span>
                                             </div>
                                         </CardBody>
                                     </Card>
                                 </div>
                             </div>
                             
                             {!isLast && (
                                 <div className="absolute left-6 -bottom-4 transform -translate-x-1/2 text-gray-300">
                                     <ArrowDown size={16} />
                                 </div>
                             )}
                         </div>
                     );
                 })}
             </div>
         )}
      </div>
    </div>
  );
}
