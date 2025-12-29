'use client';

import React, { useEffect, useCallback, useState } from 'react';
import { scanFlowRefs, CodeRef } from '@/app/tabs/docs/scanFlow';
import { docsService, DocFlow, DocStep } from '@/app/_services/docsService';
import { globalStorage } from '@/utils/storage';
import { Button, Spinner, Popover, PopoverTrigger, PopoverContent } from '@heroui/react';
import { RefreshCw, Code2, ChevronRight, ScanSearch, Plus, LayoutList, Share2, Trash2, FolderGit2, Search, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';
import toast from 'react-hot-toast';
import { createLogger } from '@/utils/logger/Logger';

import { OverloadScanner } from '@/app/tabs/docs/OverloadScanner';

const logger = createLogger('FlowTab');

interface FlowTabProps {
    projectId: string;
    projectLocalPath?: string;
    projectTitle?: string;
    projectColor?: string;
}

export default function FlowTab({ projectId, projectLocalPath, projectTitle, projectColor }: FlowTabProps) {
  // --- Scan State ---
  const [scannedRefs, setScannedRefs] = useState<CodeRef[]>([]);
  const [scanLoading, setScanLoading] = useState(false);
  const [isScanOpen, setIsScanOpen] = useState(false);

  // --- DB State ---
  const [flows, setFlows] = useState<DocFlow[]>([]);
  const [selectedFlowId, setSelectedFlowIdState] = useState<string | null>(null);
  
  const [allSteps, setAllSteps] = useState<DocStep[]>([]); // Store all steps for the project
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const [dbLoading, setDbLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);

  // Wrapper for setSelectedFlowId to persist to storage
  const setSelectedFlowId = (id: string | null) => {
      setSelectedFlowIdState(id);
      if (id) {
          globalStorage.setItem(`active_flow_${projectId}`, id);
      } else {
          globalStorage.removeItem(`active_flow_${projectId}`);
      }
      setSelectedStepId(null); // Reset step selection when flow changes
  };

  // --- Initial Load ---
  useEffect(() => {
    loadData();
  }, [projectId]);

  // --- Load Data (Flows & All Steps) ---
  const loadData = async () => {
      setDbLoading(true);
      try {
          // Load flows and all steps in parallel
          const [flowsData, stepsData] = await Promise.all([
              docsService.getFlows(projectId),
              (docsService as any).getAllProjectSteps(projectId)
          ]);
          
          setFlows(flowsData);
          setAllSteps(stepsData);

          // Restore active flow selection
          const storedFlowId = globalStorage.getItem(`active_flow_${projectId}`);
          if (storedFlowId && flowsData.some((f: DocFlow) => f.id === storedFlowId)) {
              setSelectedFlowIdState(storedFlowId);
          } else {
              setSelectedFlowIdState(null);
          }
      } catch (e) {
          logger.error('Failed to load docs data', e);
          toast.error('Failed to load docs data');
      } finally {
          setDbLoading(false);
      }
  };

  // --- Derived State: Current Flow Steps ---
  const steps = allSteps.filter(s => s.flow_id === selectedFlowId).sort((a, b) => a.step_order - b.step_order);

  // --- Create Flow ---
  const handleCreateFlow = async () => {
      setCreateLoading(true);
      try {
          const newFlow = await docsService.createFlow(projectId, 'New Flow');
          setFlows(prev => [...prev, newFlow]);
          setSelectedFlowId(newFlow.id);
          logger.success('Flow created', { id: newFlow.id });
      } catch (e) {
          logger.error('Failed to create flow', e);
          toast.error('Failed to create flow');
      } finally {
          setCreateLoading(false);
      }
  };

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

          setAllSteps(prev => [...prev, newStep]); // Add to global list
          setSelectedStepId(newStep.id); 
          toast.success('Step added');
      } catch (e) {
          logger.error('Failed to add step', e);
          toast.error('Failed to add step');
      }
  };
  
  // --- Delete Step ---
    const handleDeleteStep = async (stepId: string) => {
        if (!confirm('Delete step?')) return;
        try {
            await docsService.deleteStep(stepId);
            setAllSteps(prev => prev.filter(s => s.id !== stepId)); // Remove from global list
            if (selectedStepId === stepId) {
                setSelectedStepId(null);
            }
        } catch (e) {
            logger.error('Failed to delete step', e);
            toast.error('Failed to delete step');
        }
    };


  // --- Scan Logic ---
  const loadRefs = useCallback(async () => {
    setScanLoading(true);
    try {
      const result = await scanFlowRefs(projectLocalPath);
      setScannedRefs(result);
      logger.info('Refs scanned', { count: result.length });
    } catch (e) {
      logger.error('Scan failed', e);
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
    <div className="h-full flex flex-col font-sans bg-gray-50/50 overflow-hidden">
      
      {/* GLOBAL HEADER */}
      <div className="flex-shrink-0 px-6 py-6 flex items-center justify-between gap-3 bg-white border-b border-gray-100">
         <div className="flex items-center gap-3">
            <div 
                className="w-4 h-4 rounded-full flex-shrink-0 shadow-sm border border-white/10" 
                style={{ backgroundColor: projectColor || '#3b82f6' }}
            />
            <h1 className="text-2xl font-bold text-gray-900">{projectTitle}</h1>
         </div>

         <div className="flex items-center gap-2">
            <OverloadScanner projectLocalPath={projectLocalPath} />

            {/* Scan Popover in Header */}
            <Popover placement="bottom-end" isOpen={isScanOpen} onOpenChange={setIsScanOpen} shouldFlip>
            <PopoverTrigger>
                <Button size="sm" variant="flat" className="h-9 bg-white hover:bg-gray-50 text-gray-700 text-xs font-medium px-4 gap-2 border border-gray-200 shadow-sm">
                    <ScanSearch size={16} className="text-blue-600"/>
                    <span>Scan References</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[420px] max-h-[500px] flex flex-col shadow-xl border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex items-center justify-between p-3 border-b bg-gray-50/80 backdrop-blur">
                    <div className="flex flex-col gap-1">
                        <span className="font-semibold text-sm text-gray-900">Code References</span>
                        <div className="flex gap-3 text-[10px] uppercase font-bold tracking-wider">
                            <span className="text-gray-500">Total: {scannedRefs.length}</span>
                            <span className="text-green-600">New: {scannedRefs.filter(r => !steps.some(s => s.ref_id === r.id)).length}</span>
                            <span className="text-blue-600">Added: {scannedRefs.filter(r => steps.some(s => s.ref_id === r.id)).length}</span>
                        </div>
                    </div>
                    <Button size="sm" isIconOnly variant="light" onPress={loadRefs} isLoading={scanLoading} className="text-gray-500 hover:text-gray-900">
                        <RefreshCw size={14} />
                    </Button>
                </div>
                <div className="overflow-y-auto flex-grow min-h-0 bg-white p-1">
                    {!scanLoading && scannedRefs.length === 0 && (
                        <div className="p-8 text-center text-gray-400 text-xs">No references found in codebase.</div>
                    )}
                    <div className="flex flex-col gap-1">
                        {scannedRefs.map((ref) => {
                            const isAdded = steps.some(s => s.ref_id === ref.id);
                            if (isAdded) return null;
                            return (
                            <div key={ref.id} className="group flex items-start gap-3 px-3 py-2 hover:bg-gray-50 rounded-md transition-colors text-xs border border-transparent hover:border-gray-100">
                                <div className="mt-1 text-gray-400 group-hover:text-blue-500">
                                    <Code2 size={14} />
                                </div>
                                <div className="flex-grow min-w-0">
                                    <div className="font-mono text-blue-600 font-medium truncate mb-0.5" title={ref.id}>{ref.id}</div>
                                    <div className="text-gray-500 line-clamp-2 leading-relaxed">{ref.description || ref.debug}</div>
                                </div>
                                {selectedFlowId && (
                                    <Button 
                                        size="sm" isIconOnly variant="light" 
                                        onClick={() => handleAddRefToFlow(ref)} 
                                        className="text-gray-300 hover:text-blue-600 opacity-0 group-hover:opacity-100 -mr-2"
                                    >
                                        <Plus size={16} />
                                    </Button>
                                )}
                            </div>
                        );})}
                    </div>
                </div>
            </PopoverContent>
         </Popover>
         </div>
      </div>

      <div className="flex-grow flex min-h-0">
          {/* COLUMN 1: Flows List (240px) - Navigation Sidebar Style */}
          <div className="w-[240px] border-r border-gray-200 bg-gray-50 flex flex-col flex-shrink-0">
             <div className="h-14 flex items-center justify-between px-4 flex-shrink-0">
                 <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-2">
                    <FolderGit2 size={14} />
                    User Flows
                 </h2>
                 <Button 
                    size="sm" isIconOnly variant="light" 
                    className="text-gray-400 hover:text-gray-700 h-8 w-8 min-w-0 rounded-md"
                    onPress={handleCreateFlow}
                    isLoading={createLoading}
                 >
                     <Plus size={16} />
                 </Button>
             </div>
             
             <div className="flex-grow p-3 overflow-y-auto space-y-1">
                {dbLoading && <div className="flex justify-center p-4"><Spinner size="sm" color="default"/></div>}
                
                {flows.map(flow => (
                    <button
                        key={flow.id}
                        onClick={() => setSelectedFlowId(flow.id)}
                        className={clsx(
                            "w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all flex items-center gap-3 truncate group",
                            selectedFlowId === flow.id 
                                ? "bg-white text-gray-900 font-semibold shadow-sm ring-1 ring-gray-200" 
                                : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                        )}
                    >
                        <div className={clsx(
                            "w-1.5 h-1.5 rounded-full flex-shrink-0 transition-colors",
                            selectedFlowId === flow.id ? "bg-blue-500" : "bg-gray-300 group-hover:bg-gray-400"
                        )} />
                        <span className="truncate flex-grow min-w-0">{flow.title}</span>
                        {selectedFlowId === flow.id && <ChevronRight size={14} className="text-gray-400 flex-shrink-0" />}
                    </button>
                ))}
                
                {!dbLoading && flows.length === 0 && (
                    <div className="text-center py-8 px-4 text-xs text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                        No flows yet. <br/>Click + to create one.
                    </div>
                )}
             </div>
          </div>

          {/* COLUMN 2: Steps List (300px) - Task List Style */}
          <div className="w-[300px] border-r border-gray-200 flex flex-col flex-shrink-0 bg-white">
             <div className="h-14 border-b border-gray-100 flex items-center justify-between px-4 flex-shrink-0 bg-white z-10">
                 <div className="flex items-center gap-2 min-w-0 w-full">
                    <span className="font-semibold text-gray-800 truncate text-sm flex-grow min-w-0">
                        {selectedFlow ? selectedFlow.title : 'Select a Flow'}
                    </span>
                    {selectedFlow && <span className="text-xs text-gray-400 font-mono flex-shrink-0">({steps.length})</span>}
                 </div>
             </div>

             <div className="flex-grow overflow-y-auto p-2 bg-gray-50/30">
                 
                 {!selectedFlow && (
                     <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                         <LayoutList size={32} className="mb-3 opacity-20" />
                         <p className="text-sm">Select a flow to view steps</p>
                     </div>
                 )}

                 {selectedFlow && steps.length === 0 && (
                     <div className="h-full flex flex-col items-center justify-center text-gray-400 p-8 text-center">
                         <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-3">
                             <ScanSearch size={20} className="text-gray-400" />
                         </div>
                         <p className="text-sm font-medium text-gray-600">No steps defined</p>
                         <p className="text-xs mt-1 max-w-[180px]">Scan references to add steps to this flow.</p>
                     </div>
                 )}

                 <div className="space-y-2">
                     {steps.map((step, index) => (
                         <div 
                            key={step.id} 
                            onClick={() => setSelectedStepId(step.id)}
                            className={clsx(
                                "group relative flex flex-col p-3 rounded-xl border transition-all cursor-pointer",
                                selectedStepId === step.id 
                                    ? "bg-white border-blue-500 shadow-md ring-1 ring-blue-500/10 z-10" 
                                    : "bg-white border-gray-200 hover:border-blue-300 hover:shadow-sm"
                            )}
                         >
                             <div className="flex items-start justify-between gap-3 mb-2">
                                 <div className="flex items-center gap-2">
                                    <span className="flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-500 font-mono">
                                        {index + 1}
                                    </span>
                                    <span className={clsx(
                                        "text-[9px] px-1.5 py-0.5 rounded-md uppercase font-bold tracking-wider",
                                        step.role === 'trigger' ? "bg-purple-50 text-purple-600 border border-purple-100" : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                    )}>
                                        {step.role}
                                    </span>
                                 </div>
                                 
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteStep(step.id); }}
                                    className={clsx(
                                        "text-gray-300 hover:text-red-500 p-1 rounded-md hover:bg-red-50 transition-colors", 
                                        selectedStepId === step.id ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                                    )}
                                 >
                                     <Trash2 size={12} />
                                 </button>
                             </div>
                             
                             <h3 className="text-sm font-semibold text-gray-800 leading-tight mb-1 line-clamp-2" title={step.title}>
                                 {step.title}
                             </h3>
                             
                             <div className="flex items-center gap-1.5 text-xs text-gray-400 font-mono overflow-hidden">
                                 <Code2 size={10} className="flex-shrink-0" />
                                 <span className="truncate">{step.ref_id}</span>
                             </div>
                         </div>
                     ))}
                 </div>
             </div>
          </div>

          {/* COLUMN 3: Step Details (Flex Grow) - Content Panel Style */}
          <div className="flex-grow bg-white flex flex-col min-w-0 overflow-y-auto">
             {selectedStep ? (
                 <div className="max-w-4xl mx-auto w-full p-10">
                     {/* Breadcrumbs / Header */}
                     <div className="flex items-center gap-2 text-xs text-gray-400 mb-6 uppercase tracking-wider font-bold">
                         <span className="flex items-center gap-1"><FolderGit2 size={12}/> Flow</span>
                         <ArrowRight size={10} />
                         <span>Step {steps.findIndex(s => s.id === selectedStep.id) + 1}</span>
                     </div>

                     {/* Main Title Area */}
                     <div className="mb-8 border-b border-gray-100 pb-8">
                         <div className="flex items-start justify-between gap-4 mb-4">
                            <h1 className="text-3xl font-bold text-gray-900 leading-tight">{selectedStep.title}</h1>
                            <span className={clsx(
                                 "flex-shrink-0 text-xs px-3 py-1 rounded-full uppercase font-bold tracking-wider border",
                                 selectedStep.role === 'trigger' ? "bg-purple-50 text-purple-600 border-purple-100" : "bg-emerald-50 text-emerald-600 border-emerald-100"
                             )}>
                                 {selectedStep.role}
                             </span>
                         </div>
                         <div className="flex items-center gap-2 text-sm font-mono text-blue-600 bg-blue-50 px-3 py-1.5 rounded-md self-start inline-flex">
                             <span className="text-blue-400">@ref:</span>
                             <span className="font-semibold">{selectedStep.ref_id}</span>
                         </div>
                     </div>

                     {/* Description Section */}
                     <div className="mb-10">
                         <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                            <Search size={12} />
                            Description
                         </h3>
                         <div className="text-base text-gray-700 leading-7 bg-gray-50/50 p-6 rounded-xl border border-gray-100">
                             {selectedStep.description || <span className="text-gray-400 italic">No detailed description provided for this step.</span>}
                         </div>
                     </div>

                     {/* Code Snippet Section */}
                     <div>
                         <div className="flex items-center justify-between mb-3">
                             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Code2 size={12} />
                                Implementation
                             </h3>
                             
                             {(() => {
                                 const liveRef = scannedRefs.find(r => r.id === selectedStep.ref_id);
                                 return (
                                     <button 
                                        onClick={() => liveRef && openInEditor(liveRef.absolutePath, liveRef.lineNumber)}
                                        disabled={!liveRef}
                                        className={clsx(
                                            "flex items-center gap-1.5 text-xs font-medium transition-colors px-3 py-1.5 rounded-md",
                                            liveRef 
                                                ? "text-blue-600 bg-blue-50 hover:bg-blue-100" 
                                                : "text-gray-400 bg-gray-50 cursor-not-allowed"
                                        )}
                                        title={liveRef ? "Open in Cursor" : "Run scan to enable linking"}
                                     >
                                        <Share2 size={12} />
                                        <span>Open in Editor</span>
                                     </button>
                                 );
                             })()}
                         </div>
                         
                         <div className="bg-[#1e1e1e] rounded-xl overflow-hidden shadow-lg border border-gray-800 ring-4 ring-gray-100">
                             <div className="px-4 py-2.5 bg-[#252526] border-b border-black/20 flex items-center justify-between">
                                 <div className="flex gap-1.5">
                                     <div className="w-2.5 h-2.5 rounded-full bg-[#ff5f56]"></div>
                                     <div className="w-2.5 h-2.5 rounded-full bg-[#ffbd2e]"></div>
                                     <div className="w-2.5 h-2.5 rounded-full bg-[#27c93f]"></div>
                                 </div>
                                 <span className="text-[10px] text-gray-500 font-mono opacity-50">TypeScript</span>
                             </div>
                             <div className="p-0 overflow-x-auto">
                                 <pre className="text-xs font-mono text-[#d4d4d4] leading-relaxed p-5">
{`// @ref:${selectedStep.ref_id}
// ${selectedStep.title}

${selectedStep.code_snippet || '// No snippet saved'}`}
                                 </pre>
                             </div>
                         </div>
                     </div>

                 </div>
             ) : (
                 <div className="flex-grow flex flex-col items-center justify-center text-gray-300 bg-gray-50/30">
                     <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-6">
                         <LayoutList size={32} className="text-gray-300" />
                     </div>
                     <h3 className="text-lg font-medium text-gray-900 mb-2">No Step Selected</h3>
                     <p className="text-sm text-gray-500 max-w-xs text-center">Select a step from the list to view its details, description, and code implementation.</p>
                 </div>
             )}
          </div>
      </div>
    </div>
  );
}