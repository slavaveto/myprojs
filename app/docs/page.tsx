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
          return;
      }
      
      const loadSteps = async () => {
          setStepsLoading(true);
          try {
              const data = await docsService.getSteps(selectedFlowId);
              setSteps(data);
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

      // Check if already exists in this flow
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
              title: ref.description || ref.id, // Use description or ID as title
              description: '',
              step_order: nextOrder,
              role: 'action', // Default to action
              snippet: ref.snippet
          });

          setSteps(prev => [...prev, newStep]);
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

  // Lazy load scan refs
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

  return (
    <div className="h-full flex font-sans bg-white overflow-hidden">
      
      {/* Left Sidebar: Flows List */}
      <div className="w-[200px] border-r bg-gray-50 flex flex-col flex-shrink-0">
         <div className="h-12 border-b flex items-center justify-between px-4 flex-shrink-0">
             <h2 className="text-xs font-bold text-gray-500 uppercase">Flows</h2>
             <Button 
                size="sm" isIconOnly variant="light" 
                className="text-gray-400 hover:text-gray-600"
                onPress={handleCreateFlow}
                isLoading={createLoading}
             >
                 <Plus size={16} />
             </Button>
         </div>
         
         <div className="flex-grow p-2 overflow-y-auto">
            {dbLoading && <div className="flex justify-center p-4"><Spinner size="sm"/></div>}
            
            {!dbLoading && flows.length === 0 && (
                <div className="text-sm text-gray-400 italic text-center py-8 border-2 border-dashed border-gray-200 rounded-lg mx-2">
                    No flows yet
                </div>
            )}

            <div className="space-y-1">
                {flows.map(flow => (
                    <button
                        key={flow.id}
                        onClick={() => setSelectedFlowId(flow.id)}
                        className={clsx(
                            "w-full text-left px-3 py-2 rounded-md text-sm transition-colors flex items-center gap-2",
                            selectedFlowId === flow.id 
                                ? "bg-white shadow-sm text-blue-600 font-medium ring-1 ring-gray-200" 
                                : "text-gray-600 hover:bg-gray-100"
                        )}
                    >
                        <Share2 size={14} className={selectedFlowId === flow.id ? "text-blue-500" : "text-gray-400"} />
                        <span className="truncate">{flow.title}</span>
                    </button>
                ))}
            </div>
         </div>
      </div>

      {/* Right Content: Flow Details & Scanner */}
      <div className="flex-grow flex flex-col min-w-0 bg-white">
         
         {/* Right Header */}
         <div className="h-12 border-b flex items-center justify-between px-6 flex-shrink-0">
             <div className="flex items-center gap-2">
                 {selectedFlow ? (
                     <>
                        <h1 className="font-bold text-gray-800">{selectedFlow.title}</h1>
                        <span className="text-gray-300 text-sm">/ Steps</span>
                     </>
                 ) : (
                     <h1 className="font-bold text-gray-400">No Flow Selected</h1>
                 )}
             </div>

             {/* Scan Button with Popover */}
             <Popover placement="bottom-end" isOpen={isScanOpen} onOpenChange={setIsScanOpen} shouldFlip>
                <PopoverTrigger>
                    <Button size="sm" variant="flat" color="primary" startContent={<ScanSearch size={16} />}>
                        Scan Code
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-[450px] max-h-[600px] overflow-hidden flex flex-col shadow-xl border border-gray-200">
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
                        {scanLoading && (
                            <div className="flex justify-center py-10">
                                <Spinner size="sm" />
                     </div>
                 )}

                        {!scanLoading && (
                            <div className="divide-y divide-gray-100">
                                 {scannedRefs.length === 0 && (
                                     <div className="text-center py-10 text-xs text-gray-400 px-4">
                                         No tags found. Add <code>// @ref:my_id</code> in your code.
                                     </div>
                                 )}
                                 {scannedRefs.map((ref) => {
                                     // Check if already added
                                     const isAdded = steps.some(s => s.ref_id === ref.id);
                                     
                                     // Hide if already added to current flow
                                     if (isAdded) return null;

                                     return (
                                     <div key={`${ref.id}-${ref.fileName}`} className="group flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors text-xs">
                                         <span className="bg-blue-50 text-blue-600 border border-blue-100 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold flex-shrink-0 select-all">
                                             {ref.id}
                                         </span>
                                         
                                         <div className="flex-grow min-w-0">
                                             <div className="font-medium text-gray-700 truncate" title={ref.description}>
                                                 {ref.description || (
                                                     <span className="italic text-gray-400 text-[10px]">{ref.debug || "No description"}</span>
                                                 )}
                                             </div>
                                             <div className="flex items-center gap-1.5 text-gray-400 text-[10px] font-mono mt-0.5 truncate" title={ref.fileName}>
                                                 <FileCode size={10} />
                                                 <span className="truncate">{ref.fileName.split('/').pop()}:{ref.lineNumber}</span>
                                             </div>
                                         </div>

                                         <div className="flex-shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              {/* Add to Flow Button */}
                                              {selectedFlowId && (
                                                  <button 
                                                    onClick={() => handleAddRefToFlow(ref)}
                                                    disabled={isAdded}
                                                    className={clsx(
                                                        "p-1.5 rounded transition-colors",
                                                        isAdded 
                                                            ? "text-green-500 cursor-default" 
                                                            : "text-gray-400 hover:text-green-600 hover:bg-green-50"
                                                    )}
                                                    title={isAdded ? "Already added" : "Add to current flow"}
                                                  >
                                                      {isAdded ? <CheckSquare size={14} /> : <Plus size={14} />}
                                                  </button>
                                              )}

                                              <Popover placement="left">
                                                 <PopoverTrigger>
                                                     <button className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded transition-colors"><ChevronRight size={14} /></button>
                                                 </PopoverTrigger>
                                                 <PopoverContent className="p-0 border border-gray-700 rounded overflow-hidden shadow-2xl">
                                                     <div className="bg-[#1e1e1e] p-3 text-[10px] font-mono text-gray-300 max-w-[400px] overflow-x-auto">
                                                         <pre>{ref.snippet}</pre>
                                                     </div>
                                                 </PopoverContent>
                                              </Popover>
                                             <button 
                                                onClick={() => openInEditor(ref.absolutePath, ref.lineNumber)} 
                                                className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                                title="Open in Editor"
                                             >
                                                 <Code2 size={14} />
                                             </button>
                                         </div>
                                     </div>
                                 );})}
                            </div>
                        )}
                    </div>
                </PopoverContent>
             </Popover>
         </div>

         {/* Main Content Area: Steps List */}
         <div className="flex-grow overflow-y-auto p-8 bg-gray-50/30">
             {!selectedFlow && (
                 <div className="h-full flex flex-col items-center justify-center text-gray-300">
                     <Share2 size={48} className="mb-4 text-gray-200" />
                     <h3 className="text-lg font-medium text-gray-400 mb-2">Select a Flow</h3>
                     <p className="text-sm text-gray-400 max-w-xs mx-auto text-center">Choose a flow from the sidebar to view its documentation and steps.</p>
                 </div>
             )}

             {selectedFlow && stepsLoading && (
                 <div className="flex justify-center py-20">
                     <Spinner />
                 </div>
             )}

             {selectedFlow && !stepsLoading && (
                 <div className="max-w-3xl mx-auto space-y-4">
                     {steps.length === 0 && (
                         <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl bg-white">
                             <p className="text-gray-400">No steps in this flow yet.</p>
                             <div className="mt-2 text-xs text-gray-400">
                                 Open <b>Scan Code</b> to add steps from codebase.
                             </div>
                         </div>
                     )}

                     {steps.map((step, index) => (
                         <div key={step.id} className="bg-white border rounded-lg p-4 shadow-sm flex gap-4 group">
                             {/* Order / Connector */}
                             <div className="flex flex-col items-center pt-1">
                                 <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold font-mono">
                                     {index + 1}
                                 </div>
                                 {index < steps.length - 1 && (
                                     <div className="w-px h-full bg-gray-200 my-1"></div>
                                 )}
                             </div>
                             
                             {/* Content */}
                             <div className="flex-grow">
                                 <div className="flex items-center justify-between mb-1">
                                     <h3 className="font-bold text-gray-800">{step.title}</h3>
                                     <div className="flex items-center gap-2">
                                         <span className={clsx(
                                             "text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider",
                                             step.role === 'trigger' ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"
                                         )}>
                                             {step.role}
                                         </span>
                                         <button 
                                            onClick={() => handleDeleteStep(step.id)}
                                            className="text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                         >
                                             <Trash2 size={14} />
                                         </button>
                                     </div>
                                 </div>
                                 
                                 {step.description && (
                                     <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                                 )}

                                 {/* Ref Badge and Actions */}
                                 <div className="flex items-center justify-between mt-2">
                                     <div className="flex items-center gap-2">
                                         <span className="text-xs text-gray-400 font-mono">Ref:</span>
                                         <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded text-xs font-mono">
                                             {step.ref_id}
                                         </span>
                                     </div>

                                     <div className="flex items-center gap-1">
                                         {/* View Code Snippet */}
                                         {step.code_snippet && (
                                             <Popover placement="left">
                                                 <PopoverTrigger>
                                                     <button className="p-1 text-gray-400 hover:text-blue-600 rounded flex items-center gap-1 text-xs transition-colors" title="View Saved Snippet">
                                                         <FileCode size={14} />
                                                         <span className="font-mono">Snippet</span>
                                                     </button>
                                                 </PopoverTrigger>
                                                 <PopoverContent className="p-0 border border-gray-700 rounded overflow-hidden shadow-2xl">
                                                     <div className="bg-[#1e1e1e] p-3 text-[10px] font-mono text-gray-300 max-w-[500px] overflow-x-auto">
                                                         <div className="text-gray-500 select-none">{'//'} @ref:{step.ref_id}</div>
                                                         {step.title && step.title !== step.ref_id && (
                                                             <div className="text-gray-500 mb-2 select-none">{'//'} {step.title}</div>
                                                         )}
                                                         <pre>{step.code_snippet}</pre>
                                                     </div>
                                                 </PopoverContent>
                                             </Popover>
                                         )}

                                         {/* Open in Editor (only if scanned) */}
                                         {(() => {
                                             const liveRef = scannedRefs.find(r => r.id === step.ref_id);
                                             return (
                                                 <button 
                                                    onClick={() => liveRef && openInEditor(liveRef.absolutePath, liveRef.lineNumber)}
                                                    disabled={!liveRef}
                                                    className={clsx(
                                                        "p-1 rounded flex items-center gap-1 text-xs transition-colors",
                                                        liveRef 
                                                            ? "text-blue-500 hover:text-blue-700 hover:bg-blue-50" 
                                                            : "text-gray-300 cursor-not-allowed"
                                                    )}
                                                    title={liveRef ? "Open in Editor" : "Scan code to enable linking"}
                                                 >
                                                     <Code2 size={14} />
                                                     <span>Open</span>
                                                 </button>
                                             );
                                         })()}
                                     </div>
                                 </div>
                             </div>
                         </div>
                     ))}
             </div>
         )}
         </div>
      </div>
    </div>
  );
}
