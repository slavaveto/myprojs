'use server';

import fs from 'fs';
import path from 'path';

export interface FlowNode {
  id: string;
  parentId?: string;
  type: string;
  label: string;
  position: { x: number; y: number };
  data: { label: string; type: string };
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  type?: string;
  animated?: boolean;
}

export interface FlowGraph {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export async function scanFlow(): Promise<FlowGraph> {
  const filePath = path.join(process.cwd(), 'app/_services/loadingService.ts');
  const content = fs.readFileSync(filePath, 'utf-8');

  const nodes: FlowNode[] = [];
  const edges: FlowEdge[] = [];
  
  // Regex to find flow objects: flow: { ... }
  // We capture the content inside the braces
  const flowRegex = /flow:\s*\{([\s\S]*?)\}/g;
  
  let match;
  while ((match = flowRegex.exec(content)) !== null) {
    const flowBody = match[1];
    
    // Simple parser to extract keys and values from the object string
    // e.g. id: 'app_init', type: 'start'
    const idMatch = flowBody.match(/id:\s*['"]([^'"]+)['"]/);
    const parentIdMatch = flowBody.match(/parentId:\s*['"]([^'"]+)['"]/);
    const typeMatch = flowBody.match(/type:\s*['"]([^'"]+)['"]/);
    const labelMatch = flowBody.match(/label:\s*['"]([^'"]+)['"]/);

    if (idMatch) {
      const id = idMatch[1];
      const parentId = parentIdMatch ? parentIdMatch[1] : undefined;
      const type = typeMatch ? typeMatch[1] : 'default';
      const label = labelMatch ? labelMatch[1] : id;

      nodes.push({
        id,
        parentId, // Keep for layout calculation
        type: 'default', // React Flow node type (we'll style them later)
        label, // Plain text label
        position: { x: 0, y: 0 }, // Will be calculated by dagre
        data: { label, type }
      });

      if (parentId) {
        edges.push({
          id: `${parentId}-${id}`,
          source: parentId,
          target: id,
          type: 'smoothstep',
          animated: true,
        });
      }
    }
  }

  return { nodes, edges };
}

