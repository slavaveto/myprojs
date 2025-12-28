'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { scanFlow, FlowGraph } from '@/app/actions/scanFlow';
import { Button, Spinner, Card, CardBody } from '@heroui/react';
import { ArrowDown, Code2, Layout, Zap, Play } from 'lucide-react';

export default function FlowPage() {
  const [data, setData] = useState<FlowGraph | null>(null);
  const [loading, setLoading] = useState(true);

  // We should NOT fetch inside the component render if we want to reuse it.
  // BUT for now, to make it work inside ProjectScreen, we keep it client-side fetching.
  // In real app, we should pass 'projectId' to filter flows relevant to the project.
  
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
      const url = `cursor://file/${absolutePath}:${line}`;
      window.open(url, '_self');
  };

  const getRoleIcon = (role: string) => {
      if (role.toLowerCase() === 'trigger') return <Zap size={14} />;
      if (role.toLowerCase() === 'action') return <Play size={14} />;
      return <Code2 size={14} />;
  };

  const getRoleColor = (role: string) => {
      if (role.toLowerCase() === 'trigger') return 'warning';
      if (role.toLowerCase() === 'action') return 'primary';
      return 'default';
  };

  return (
    <div className="h-full flex flex-col font-sans bg-gray-50">
      <div className="h-14 bg-white border-b flex items-center justify-between px-6 sticky top-0 z-20 shadow-sm flex-shrink-0">
         <div className="flex items-center gap-3">
            <Layout className="text-primary" />
            <h1 className="font-bold text-lg text-gray-800">System Story Map</h1>
         </div>
         <Button size="sm" color="primary" onPress={loadGraph} isLoading={loading}>
            Refresh
         </Button>
      </div>

      <div className="flex-grow w-full p-8 overflow-y-auto min-h-0">
         {loading && (
             <div className="flex justify-center py-20">
                 <Spinner label="Scanning Codebase..." />
             </div>
         )}

         {!loading && data && (
             <div className="flex flex-col relative max-w-3xl mx-auto">
                 <div className="absolute left-6 top-4 bottom-4 w-0.5 bg-gray-200 z-0"></div>

                 {data.nodes.length === 0 && (
                     <div className="text-center py-10 text-gray-400">
                         No @flow_id markers found.
                     </div>
                 )}

                 {data.nodes.map((step, index) => {
                     const isLast = index === data.nodes.length - 1;
                     
                     const locations = [...step.data.locations].sort((a, b) => {
                         const roleA = a.role.toLowerCase();
                         if (roleA === 'trigger') return -1;
                         return 1;
                     });

                     return (
                         <div key={step.id} className="relative z-10 mb-6 group">
                             <div className="flex gap-6">
                                 {/* Index Circle */}
                                 <div className="flex-shrink-0 w-12 flex justify-center pt-2">
                                     <div className="w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center shadow-md border-4 border-gray-50 z-10">
                                         {step.data.step_order < 999 ? step.data.step_order : index + 1}
                                     </div>
                                 </div>

                                 {/* Card */}
                                 <div className="flex-grow">
                                     <Card shadow="sm" className="w-full hover:shadow-md transition-all border-l-4 border-blue-600">
                                         <CardBody className="p-4">
                                             <div className="mb-3">
                                                 <h3 className="text-lg font-bold text-gray-900">{step.data.label}</h3>
                                                 {step.data.description && (
                                                     <p className="text-gray-500 text-sm mt-1">{step.data.description}</p>
                                                 )}
                                             </div>

                                             <div className="flex flex-wrap gap-2">
                                                 {locations.map((loc, idx) => (
                                                     <Button
                                                        key={idx}
                                                        size="sm"
                                                        variant="flat"
                                                        color={getRoleColor(loc.role) as any}
                                                        className="h-8 text-xs font-semibold px-3 min-w-0"
                                                        startContent={getRoleIcon(loc.role)}
                                                        onPress={() => openInEditor(loc.absolutePath, loc.lineNumber)}
                                                        title={`${loc.fileName}:${loc.lineNumber}`}
                                                     >
                                                         {loc.role}: {loc.fileName.split('/').pop()}
                                                     </Button>
                                                 ))}
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
