'use client';

import React, { useEffect, useCallback } from 'react';
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, Panel } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import dagre from 'dagre';
import { scanFlow, FlowGraph } from '@/app/actions/scanFlow';
import { Button, Spinner } from '@heroui/react';

// --- Dagre Layout Helper ---
const dagreGraph = new dagre.graphlib.Graph();
dagreGraph.setDefaultEdgeLabel(() => ({}));

const nodeWidth = 200;
const nodeHeight = 50;

const getLayoutedElements = (nodes: any[], edges: any[], direction = 'TB') => {
  dagreGraph.setGraph({ rankdir: direction });

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    return {
      ...node,
      targetPosition: direction === 'TB' ? 'top' : 'left',
      sourcePosition: direction === 'TB' ? 'bottom' : 'right',
      // We are shifting the dagre node position (anchor=center center) to the top left
      // so it matches the React Flow node anchor point (top left).
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
      style: {
        background: node.data.type === 'start' ? '#e0f2fe' : 
                   node.data.type === 'success' ? '#dcfce7' : 
                   node.data.type === 'decision' ? '#fef9c3' : 
                   node.data.type === 'end' ? '#f3e8ff' : '#ffffff',
        border: '1px solid #777',
        borderRadius: '8px',
        padding: '10px',
        width: nodeWidth,
        textAlign: 'center',
        fontSize: '12px',
        fontWeight: 'bold'
      }
    };
  });

  return { nodes: newNodes, edges };
};

export default function FlowPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = React.useState(true);

  const loadGraph = useCallback(async () => {
    setLoading(true);
    try {
      const data: FlowGraph = await scanFlow();
      const layouted = getLayoutedElements(data.nodes, data.edges);
      
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
    <div className="w-full h-screen bg-gray-50 flex flex-col">
      <div className="h-14 border-b bg-white flex items-center px-4 justify-between">
         <h1 className="font-bold text-lg">System Initialization Flow</h1>
         <Button size="sm" color="primary" onPress={loadGraph} isLoading={loading}>
            Rescan Code
         </Button>
      </div>
      
      <div className="flex-grow relative">
        {loading && (
             <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/50 backdrop-blur-sm">
                 <Spinner label="Scanning Codebase..." />
             </div>
        )}
        
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          fitView
          attributionPosition="bottom-right"
        >
          <Background />
          <Controls />
          <Panel position="top-left">
             <div className="bg-white p-2 rounded shadow text-xs">
                Generated from `loadingService.ts`
             </div>
          </Panel>
        </ReactFlow>
      </div>
    </div>
  );
}

