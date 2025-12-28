'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { scanFlowRefs, CodeRef } from '@/app/docs/scanFlow';
import { docsService, DocFlow, DocStep } from '@/app/_services/docsService';
import { Button, Spinner, Popover, PopoverTrigger, PopoverContent, Input } from '@heroui/react';
import { RefreshCw, Code2, FileCode, ChevronRight, ScanSearch, Plus, LayoutList, Share2, FileText, Trash2, CheckSquare } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';

interface FlowPageProps {
    projectId: string;
    projectLocalPath?: string;
}

export default function FlowPage({ projectId, projectLocalPath }: FlowPageProps) {
  // --- Scan State ---
  const [scannedRefs, setScannedRefs] = useState<CodeRef[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);

  // --- DB State ---
  const [flows, setFlows] = useState<DocFlow[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  
  const [steps, setSteps] = useState<DocStep[]>([]);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null); // New state for 3rd column

  const [dbLoading, setDbLoading] = useState(false);
  const [stepsLoading, setStepsLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // --- Initial Load ---
  useEffect(() => {
    loadFlows();
  }, [projectId]);

  // --- Load Flows ---
  const loadFlows = async () => {
      setDbLoading(true);
      try {
          const data = await docsService.getFlows(projectId);
          setFlows(data);
      } catch (e) {
          console.error(e);
      } finally {
          setDbLoading(false);
      }
  };

  // --- Create Flow ---
  const handleCreateFlow = async () => {
      setCreateLoading(true);
      try {
          const newFlow = await docsService.createFlow(projectId, 'New Flow');
          setFlows(prev => [...prev, newFlow]);
          setSelectedFlowId(newFlow.id);
      } catch (e) {
          console.error(e);
          toast.error('Failed to create flow');
      } finally {
          setCreateLoading(false);
      }
  };

  // --- Load Steps when Flow Selected ---
  useEffect(() => {
      if (!selectedFlowId) {
          setSteps([]);
          setSelectedStepId(null);
          return;
      }
      
      const loadSteps = async () => {
          setStepsLoading(true);
          try {
              const data = await docsService.getSteps(selectedFlowId);
              setSteps(data);
              // Auto-select first step if available
              if (data.length > 0) {
                  setSelectedStepId(data[0].id);
              } else {
                  setSelectedStepId(null);
              }
          } catch (e) {
              console.error(e);
          } finally {
              setStepsLoading(false);
          }
      };
      
      loadSteps();
  }, [selectedFlowId]);

  // --- Add Step from Scan ---
  const handleAddRefToFlow = async (ref: CodeRef) => {
      if (!selectedFlowId) {
          toast.error('Select a flow first');
          return;
      }

      if (steps.some(s => s.ref_id === ref.id)) {
          toast.error('Step with this Ref ID already exists');
          return;
      }

      const nextOrder = steps.length > 0 
          ? Math.max(...steps.map(s => s.step_order)) + 1 
          : 0;

      try {
          const newStep = await docsService.addStep({
              flow_id: selectedFlowId,
              ref_id: ref.id,
              title: ref.description || ref.id,
              description: '',
              step_order: nextOrder,
              role: 'action',
              snippet: ref.snippet
          });

          setSteps(prev => [...prev, newStep]);
          setSelectedStepId(newStep.id); // Auto select new step
          toast.success('Step added');
      } catch (e) {
          console.error(e);
          toast.error('Failed to add step');
      }
  };
  
  // --- Delete Step ---
    const handleDeleteStep = async (stepId: string) => {
        if (!confirm('Delete step?')) return;
        try {
            await docsService.deleteStep(stepId);
            setSteps(prev => prev.filter(s => s.id !== stepId));
            if (selectedStepId === stepId) {
                setSelectedStepId(null);
            }
        } catch (e) {
            console.error(e);
            toast.error('Failed to delete step');
        }
    };


  // --- Scan Logic ---
  const loadRefs = useCallback(async () => {
    setScanLoading(true);
    try {
      const result = await scanFlowRefs(projectLocalPath);
      setScannedRefs(result);
    } catch (e) {
      console.error(e);
    } finally {
      setScanLoading(false);
    }
  }, [projectLocalPath]);

  useEffect(() => {
      if (isScanOpen && scannedRefs.length === 0) {
          loadRefs();
      }
  }, [isScanOpen, scannedRefs.length, loadRefs]);

  const openInEditor = (absolutePath: string, line: number) => {
      const url = `cursor://file/${absolutePath}:${line}`;
      window.open(url, '_self');
  };

  const selectedFlow = flows.find(f => f.id === selectedFlowId);
  const selectedStep = steps.find(s => s.id === selectedStepId);

  return (
    <div className="h-full flex font-sans bg-white overflow-hidden">
      
      {/* COLUMN 1: Flows List (200px) */}
      <div className="w-[200px] border-r bg-gray-50 flex flex-col flex-shrink-0">
         <div className="h-10 border-b flex items-center justify-between px-3 flex-shrink-0 bg-gray-100">
             <h2 className="text-[10px] font-bold text-gray-500 uppercase">Flows</h2>
             <Button 
                size="sm" isIconOnly variant="light" 
                className="text-gray-400 hover:text-gray-600 h-6 w-6 min-w-0"
                onPress={handleCreateFlow}
                isLoading={createLoading}
             >
                 <Plus size={14} />
             </Button>
         </div>
         
         <div className="flex-grow p-2 overflow-y-auto">
            {dbLoading && <div className="flex justify-center p-2"><Spinner size="sm"/></div>}
            
            <div className="space-y-0.5">
                {flows.map(flow => (
                    <button
                        key={flow.id}
                        onClick={() => setSelectedFlowId(flow.id)}
                        className={clsx(
                            "w-full text-left px-2 py-1.5 rounded text-xs transition-colors flex items-center gap-2 truncate",
                            selectedFlowId === flow.id 
                                ? "bg-white shadow-sm text-blue-700 font-medium ring-1 ring-gray-200" 
                                : "text-gray-600 hover:bg-gray-100"
                        )}
                    >
                        <Share2 size={12} className={selectedFlowId === flow.id ? "text-blue-500" : "text-gray-400"} />
                        <span className="truncate">{flow.title}</span>
                    </button>
                ))}
            </div>
         </div>
      </div>

      {/* COLUMN 2: Steps List (250px) */}
      <div className="w-[250px] border-r flex flex-col flex-shrink-0 bg-white">
         <div className="h-10 border-b flex items-center justify-between px-3 flex-shrink-0 bg-white">
             <h2 className="text-[10px] font-bold text-gray-500 uppercase truncate">
                 {selectedFlow ? selectedFlow.title : 'Steps'}
             </h2>
             {/* Scan Button (Tiny) */}
             <Popover placement="bottom-start" isOpen={isScanOpen} onOpenChange={setIsScanOpen} shouldFlip>
                <PopoverTrigger>
                    <Button size="sm" isIconOnly variant="light" className="h-6 w-6 min-w-0 text-blue-600">
                        <ScanSearch size={14} />
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[400px] max-h-[500px] flex flex-col shadow-xl border border-gray-200">
                    {/* ... Scan Content Same as Before ... */}
                    <div className="flex items-center justify-between p-3 border-b bg-gray-50">
                        <div className="flex flex-col">
                            <span className="font-bold text-sm text-gray-800">Scan Results</span>
                            <div className="flex gap-3 text-[10px] uppercase font-bold tracking-wider mt-0.5">
                                <span className="text-gray-500">Total: {scannedRefs.length}</span>
                                <span className="text-green-600">New: {scannedRefs.filter(r => !steps.some(s => s.ref_id === r.id)).length}</span>
                                <span className="text-blue-600">Added: {scannedRefs.filter(r => steps.some(s => s.ref_id === r.id)).length}</span>
                            </div>
                        </div>
                        <Button size="sm" isIconOnly variant="light" onPress={loadRefs} isLoading={scanLoading}>
                            <RefreshCw size={14} />
                        </Button>
                    </div>
                    <div className="overflow-y-auto flex-grow min-h-0 bg-white">
                        {!scanLoading && (
                            <div className="divide-y divide-gray-100">
                                 {scannedRefs.map((ref) => {
                                     const isAdded = steps.some(s => s.ref_id === ref.id);
                                     if (isAdded) return null;
                                     return (
                                     <div key={ref.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-xs">
                                         <div className="flex-grow min-w-0">
                                             <div className="font-bold text-gray-700 truncate">{ref.id}</div>
                                             <div className="text-gray-500 truncate text-[10px]">{ref.description || ref.debug}</div>
                                         </div>
                                         {selectedFlowId && (
                                              <button onClick={() => handleAddRefToFlow(ref)} className="text-blue-500 hover:text-blue-700 p-1">
                                                  <Plus size={14} />
                                              </button>
                                          )}
                                     </div>
                                 );})}
                            </div>
                        )}
                    </div>
                </PopoverContent>
             </Popover>
         </div>

         <div className="flex-grow overflow-y-auto p-0">
             {stepsLoading && <div className="flex justify-center p-4"><Spinner size="sm"/></div>}
             
             {!stepsLoading && selectedFlow && steps.length === 0 && (
                 <div className="text-center py-8 px-4 text-xs text-gray-400">
                     No steps. Use the scan icon above to add refs.
                 </div>
             )}

             <div className="divide-y divide-gray-50">
                 {steps.map((step, index) => (
                     <div 
                        key={step.id} 
                        onClick={() => setSelectedStepId(step.id)}
                        className={clsx(
                            "px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors border-l-2",
                            selectedStepId === step.id 
                                ? "bg-blue-50 border-blue-500" 
                                : "border-transparent"
                        )}
                     >
                         <div className="flex items-center justify-between mb-0.5">
                             <div className="flex items-center gap-2 min-w-0">
                                 <span className="text-[10px] font-mono text-gray-400 w-4 text-right">{index + 1}</span>
                                 <span className={clsx(
                                     "text-[9px] px-1 py-0 rounded uppercase font-bold tracking-wider",
                                     step.role === 'trigger' ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"
                                 )}>
                                     {step.role}
                                 </span>
                             </div>
                             {/* Delete (only visible on hover or selected) */}
                             <button 
                                onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.id); }}
                                className={clsx("text-gray-300 hover:text-red-500", selectedStepId === step.id ? "opacity-100" : "opacity-0 hover:opacity-100")}
                             >
                                 <Trash2 size={12} />
                             </button>
                         </div>
                         <div className="font-medium text-xs text-gray-800 truncate pl-6" title={step.title}>
                             {step.title}
                         </div>
                         <div className="text-[10px] text-gray-400 font-mono truncate pl-6">
                             {step.ref_id}
                         </div>
                     </div>
                 ))}
             </div>
         </div>
      </div>

      {/* COLUMN 3: Step Details (Flex Grow) */}
      <div className="flex-grow bg-white flex flex-col min-w-0 overflow-y-auto">
         {selectedStep ? (
             <div className="max-w-3xl mx-auto w-full p-8">
                 {/* Header */}
                 <div className="mb-6">
                     <div className="flex items-center gap-2 mb-2">
                         <span className="text-sm font-mono text-blue-500 bg-blue-50 px-2 py-0.5 rounded">
                             {selectedStep.ref_id}
                         </span>
                         <span className={clsx(
                             "text-xs px-2 py-0.5 rounded uppercase font-bold tracking-wider",
                             selectedStep.role === 'trigger' ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"
                         )}>
                             {selectedStep.role}
                         </span>
                     </div>
                     <h1 className="text-2xl font-bold text-gray-900">{selectedStep.title}</h1>
                 </div>

                 {/* Description */}
                 <div className="mb-8">
                     <h3 className="text-xs font-bold text-gray-400 uppercase mb-2">Description</h3>
                     <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                         {selectedStep.description || <span className="text-gray-400 italic">No additional description.</span>}
                     </div>
                 </div>

                 {/* Code Snippet */}
                 <div className="mb-8">
                     <div className="flex items-center justify-between mb-2">
                         <h3 className="text-xs font-bold text-gray-400 uppercase">Implementation</h3>
                         {/* Open in Editor Button */}
                         {(() => {
                             const liveRef = scannedRefs.find(r => r.id === selectedStep.ref_id);
                             return (
                                 <button 
                                    onClick={() => liveRef && openInEditor(liveRef.absolutePath, liveRef.lineNumber)}
                                    disabled={!liveRef}
                                    className={clsx(
                                        "flex items-center gap-1 text-xs transition-colors px-2 py-1 rounded",
                                        liveRef 
                                            ? "text-blue-600 hover:bg-blue-50" 
                                            : "text-gray-300 cursor-not-allowed"
                                    )}
                                    title={liveRef ? "Open in Cursor" : "Run scan to enable linking"}
                                 >
                                     <Code2 size={12} />
                                     <span>Open in Editor</span>
                                 </button>
                             );
                         })()}
                     </div>
                     
                     <div className="bg-[#1e1e1e] rounded-lg overflow-hidden border border-gray-800 shadow-sm">
                         <div className="px-4 py-2 bg-[#2d2d2d] border-b border-gray-800 flex items-center gap-2">
                             <div className="flex gap-1.5">
                                 <div className="w-2.5 h-2.5 rounded-full bg-red-500/20"></div>
                                 <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/20"></div>
                                 <div className="w-2.5 h-2.5 rounded-full bg-green-500/20"></div>
                             </div>
                             <span className="text-[10px] text-gray-500 font-mono ml-2">{'//'} @ref:{selectedStep.ref_id}</span>
                         </div>
                         <div className="p-4 overflow-x-auto">
                             <pre className="text-xs font-mono text-gray-300 leading-5">
{`// @ref:${selectedStep.ref_id}
// ${selectedStep.title}
${selectedStep.code_snippet || '// No snippet saved'}`}
                             </pre>
                         </div>
                     </div>
                 </div>

             </div>
         ) : (
             <div className="flex-grow flex flex-col items-center justify-center text-gray-300">
                 <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                     <LayoutList size={24} className="text-gray-300" />
                 </div>
                 <p className="text-sm">Select a step to view details</p>
             </div>
         )}
      </div>
    </div>
  );
}
