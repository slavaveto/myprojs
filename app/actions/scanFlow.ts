'use server';

import fs from 'fs';
import path from 'path';
import { glob } from 'glob';

export interface FlowNode {
  id: string;
  type: string;
  label: string;
  description?: string;
  position: { x: number; y: number };
  data: { 
      label: string;
      description?: string;
      step_order: number;
      locations: {
          role: string;
          fileName: string;
          absolutePath: string;
          lineNumber: number;
      }[];
  };
}

export interface FlowGraph {
  nodes: FlowNode[];
}

export async function scanFlow(): Promise<FlowGraph> {
  const files = await glob('app/**/*.{ts,tsx}', { ignore: 'node_modules/**' });
  
  const nodesMap = new Map<string, FlowNode>();
  const flowBlockRegex = /\/\*\*([\s\S]*?)\*\//g;
  
  for (const file of files) {
      const absolutePath = path.join(process.cwd(), file);
      const content = fs.readFileSync(absolutePath, 'utf-8');
      
      let match;
      while ((match = flowBlockRegex.exec(content)) !== null) {
          const commentBlock = match[1];
          
          const flowIdMatch = commentBlock.match(/@flow_id\s+([^\n\r]+)/);
          if (!flowIdMatch) continue;
          
          const stepIdMatch = commentBlock.match(/@step_id\s+([^\n\r]+)/);
          if (!stepIdMatch) continue;
          
          const id = stepIdMatch[1].trim();
          const titleMatch = commentBlock.match(/@title\s+([^\n\r]+)/);
          const descMatch = commentBlock.match(/@description\s+([^\n\r]+)/);
          // Changed from @order to @step_order
          const orderMatch = commentBlock.match(/@step_order\s+(\d+)/); 
          const roleMatch = commentBlock.match(/@role\s+([^\n\r]+)/);
          
          const title = titleMatch ? titleMatch[1].trim() : id;
          const description = descMatch ? descMatch[1].trim() : undefined;
          const step_order = orderMatch ? parseInt(orderMatch[1]) : 999;
          const role = roleMatch ? roleMatch[1].trim() : 'Unknown';

          const upToMatch = content.substring(0, match.index);
          const lineNumber = upToMatch.split('\n').length + 1;

          if (!nodesMap.has(id)) {
              nodesMap.set(id, {
                  id,
                  type: 'default',
                  label: title,
                  description,
                  position: { x: 0, y: 0 },
                  data: {
                      label: title,
                      description,
                      step_order,
                      locations: []
                  }
              });
          }
          
          const node = nodesMap.get(id)!;
          
          node.data.locations.push({
              role,
              fileName: file,
              absolutePath,
              lineNumber
          });
          
          if (step_order < node.data.step_order) node.data.step_order = step_order;
      }
  }

  const nodes = Array.from(nodesMap.values());
  nodes.sort((a, b) => a.data.step_order - b.data.step_order);

  return { nodes };
}
