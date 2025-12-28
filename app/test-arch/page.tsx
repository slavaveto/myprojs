'use client';

import React, { useEffect, useCallback, useState, useMemo } from 'react';
import { 
    ReactFlow, 
    Background, 
    Controls, 
    useNodesState, 
    useEdgesState, 
    Panel,
    MarkerType,
    Node,
    Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { scanArchitecture, ArchGraph } from '@/app/actions/scanArch';
import { Button, Spinner } from '@heroui/react';

// --- Dagre Layout ---
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 200;
const nodeHeight = 80;

const getLayoutedElements = (nodes: any[], edges: any[]) => {
  dagreGraph.setGraph({ rankdir: 'LR' }); // Left to Right flow

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // Style based on type
    const styles = {
        'Logic': { bg: '#eff6ff', border: '#2563eb' }, // Blue
        'Database': { bg: '#fefce8', border: '#ca8a04' }, // Yellow/Gold
        'UI': { bg: '#f0fdf4', border: '#16a34a' }, // Green
        'System': { bg: '#f3f4f6', border: '#6b7280' }, // Gray
    };

    const style = styles[node.data.type as keyof typeof styles] || styles.System;

    return {
      ...node,
      targetPosition: 'left',
      sourcePosition: 'right',
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      style: {
          background: style.bg,
          border: `2px solid ${style.border}`,
          borderRadius: '12px',
          width: nodeWidth,
          padding: '10px',
          fontSize: '12px',
          fontWeight: 'bold',
          color: '#1f2937',
          textAlign: 'center',
          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
      },
      data: {
          label: (
              <div className="flex flex-col h-full justify-between">
                  <div className="uppercase tracking-wider text-[10px] opacity-60">{node.data.type}</div>
                  <div className="text-sm">{node.data.label}</div>
                  <div className="text-[10px] opacity-50 truncate" title={node.data.fileName}>{node.data.fileName || 'System'}</div>
              </div>
          )
      }
    };
  });

  return { nodes: newNodes, edges };
};

export default function ArchPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(true);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const data: ArchGraph = await scanArchitecture();
      
      const reactFlowNodes: Node[] = data.nodes.map(n => ({
          id: n.id,
          position: { x: 0, y: 0 },
          data: { ...n },
          type: 'default'
      }));

      const reactFlowEdges: Edge[] = data.edges.map(e => ({
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          type: 'smoothstep',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed }
      }));

      const layouted = getLayoutedElements(reactFlowNodes, reactFlowEdges);
      
      setNodes(layouted.nodes);
      setEdges(layouted.edges);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [setNodes, setEdges]);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  return (
    <div className="w-full h-screen bg-gray-50 flex flex-col font-sans">
      <div className="h-14 border-b bg-white flex items-center px-4 justify-between flex-shrink-0 z-20 shadow-sm">
         <h1 className="font-bold text-lg text-gray-800">System Architecture (Live)</h1>
         <Button size="sm" color="secondary" onPress={loadGraph} isLoading={loading}>
            Refresh
         </Button>
      </div>
      
      <div className="flex-grow relative overflow-hidden bg-gray-50">
        {loading && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                 <Spinner label="Scanning Architecture..." />
             </div>
        )}
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-right"
          minZoom={0.1}
        >
          <Background gap={20} color="#cbd5e1" />
          <Controls />
          <Panel position="top-left">
             <div className="bg-white/90 backdrop-blur p-3 rounded-lg shadow-sm border border-gray-200 text-xs">
                <div className="font-bold mb-2">Component Types</div>
                <div className="flex gap-2 items-center mb-1"><div className="w-3 h-3 bg-blue-100 border border-blue-500 rounded"></div> Logic</div>
                <div className="flex gap-2 items-center mb-1"><div className="w-3 h-3 bg-yellow-100 border border-yellow-500 rounded"></div> Database</div>
                <div className="flex gap-2 items-center mb-1"><div className="w-3 h-3 bg-green-100 border border-green-500 rounded"></div> UI</div>
             </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

